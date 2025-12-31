// src/lib/notificationPriority.js
// Priority-based notification sorting and filtering
// Fixes the issue where future tasks show before overdue tasks

/**
 * Priority levels for notifications
 * Lower number = higher priority (shows first)
 */
export const PRIORITY_LEVELS = {
  CRITICAL: 1,    // 30+ days overdue
  URGENT: 2,      // 1-30 days overdue  
  DUE_SOON: 3,    // Due within 7 days
  UPCOMING: 4,    // 8-30 days out
  FUTURE: 5,      // 31+ days out
};

/**
 * Get priority level for a task based on days until due
 * @param {number} daysUntil - Days until task is due (negative = overdue)
 * @returns {number} Priority level
 */
export const getTaskPriority = (daysUntil) => {
  if (daysUntil <= -30) return PRIORITY_LEVELS.CRITICAL;
  if (daysUntil < 0) return PRIORITY_LEVELS.URGENT;
  if (daysUntil <= 7) return PRIORITY_LEVELS.DUE_SOON;
  if (daysUntil <= 30) return PRIORITY_LEVELS.UPCOMING;
  return PRIORITY_LEVELS.FUTURE;
};

/**
 * Get display configuration for a priority level
 * @param {number} priority - Priority level from PRIORITY_LEVELS
 * @returns {object} Configuration object with colors and labels
 */
export const getPriorityConfig = (priority) => {
  const configs = {
    [PRIORITY_LEVELS.CRITICAL]: {
      label: 'Critical',
      emoji: '🔴',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      badgeColor: 'bg-red-500',
      badgeText: 'text-white',
      hoverBg: 'hover:bg-red-100',
      description: (days) => `${Math.abs(days)} days overdue`,
    },
    [PRIORITY_LEVELS.URGENT]: {
      label: 'Overdue',
      emoji: '🟠',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-700',
      badgeColor: 'bg-orange-500',
      badgeText: 'text-white',
      hoverBg: 'hover:bg-orange-100',
      description: (days) => `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`,
    },
    [PRIORITY_LEVELS.DUE_SOON]: {
      label: 'Due Soon',
      emoji: '🟡',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-700',
      badgeColor: 'bg-amber-500',
      badgeText: 'text-white',
      hoverBg: 'hover:bg-amber-100',
      description: (days) => days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`,
    },
    [PRIORITY_LEVELS.UPCOMING]: {
      label: 'Upcoming',
      emoji: '📅',
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-200',
      textColor: 'text-slate-600',
      badgeColor: 'bg-slate-400',
      badgeText: 'text-white',
      hoverBg: 'hover:bg-slate-100',
      description: (days) => `Due in ${days} days`,
    },
    [PRIORITY_LEVELS.FUTURE]: {
      label: 'Scheduled',
      emoji: '📅',
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-100',
      textColor: 'text-slate-500',
      badgeColor: 'bg-slate-300',
      badgeText: 'text-slate-700',
      hoverBg: 'hover:bg-slate-100',
      description: (days) => {
        if (days > 365) {
          const years = Math.floor(days / 365);
          return `Due in ${years} year${years !== 1 ? 's' : ''}`;
        }
        if (days > 60) {
          const months = Math.floor(days / 30);
          return `Due in ${months} month${months !== 1 ? 's' : ''}`;
        }
        return `Due in ${days} days`;
      },
    },
  };
  return configs[priority] || configs[PRIORITY_LEVELS.FUTURE];
};

/**
 * Sort tasks by priority (most urgent first)
 * Within same priority, sort by days until due (ascending)
 * @param {Array} tasks - Array of task objects with daysUntil property
 * @returns {Array} Sorted tasks
 */
export const sortTasksByPriority = (tasks) => {
  return [...tasks].sort((a, b) => {
    const priorityA = getTaskPriority(a.daysUntil);
    const priorityB = getTaskPriority(b.daysUntil);
    
    // First sort by priority level
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Within same priority, sort by days (most urgent first)
    return a.daysUntil - b.daysUntil;
  });
};

/**
 * Filter tasks to only show actionable items in notification bell
 * (Critical, Urgent, Due Soon - things that need attention NOW)
 * @param {Array} tasks - Array of task objects
 * @returns {Array} Filtered tasks
 */
export const getActionableTasks = (tasks) => {
  return tasks.filter(task => {
    const priority = getTaskPriority(task.daysUntil);
    return priority <= PRIORITY_LEVELS.DUE_SOON;
  });
};

/**
 * Get notification badge count
 * Only counts critical + urgent (truly overdue items)
 * @param {Array} tasks - Array of task objects
 * @returns {number} Badge count
 */
export const getNotificationBadgeCount = (tasks) => {
  return tasks.filter(task => {
    const priority = getTaskPriority(task.daysUntil);
    return priority <= PRIORITY_LEVELS.URGENT;
  }).length;
};

/**
 * Get total actionable count (for "X items need attention")
 * Includes critical, urgent, and due soon
 * @param {Array} tasks - Array of task objects
 * @returns {number} Count
 */
export const getActionableCount = (tasks) => {
  return tasks.filter(task => {
    const priority = getTaskPriority(task.daysUntil);
    return priority <= PRIORITY_LEVELS.DUE_SOON;
  }).length;
};

/**
 * Group tasks by priority for sectioned display
 * @param {Array} tasks - Array of task objects
 * @returns {object} Grouped tasks { critical: [], urgent: [], dueSoon: [], upcoming: [] }
 */
export const groupTasksByPriority = (tasks) => {
  const groups = {
    critical: [],
    urgent: [],
    dueSoon: [],
    upcoming: [],
  };
  
  tasks.forEach(task => {
    const priority = getTaskPriority(task.daysUntil);
    switch (priority) {
      case PRIORITY_LEVELS.CRITICAL:
        groups.critical.push(task);
        break;
      case PRIORITY_LEVELS.URGENT:
        groups.urgent.push(task);
        break;
      case PRIORITY_LEVELS.DUE_SOON:
        groups.dueSoon.push(task);
        break;
      default:
        groups.upcoming.push(task);
    }
  });
  
  // Sort within each group by daysUntil
  Object.keys(groups).forEach(key => {
    groups[key].sort((a, b) => a.daysUntil - b.daysUntil);
  });
  
  return groups;
};

/**
 * Format a task for display in notifications
 * Ensures consistent data structure
 * @param {object} task - Raw task object
 * @returns {object} Formatted task
 */
export const formatTaskForDisplay = (task) => {
  const priority = getTaskPriority(task.daysUntil);
  const config = getPriorityConfig(priority);
  
  // Format the due date nicely
  let formattedDate = '';
  if (task.nextDue) {
    formattedDate = new Date(task.nextDue).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: task.daysUntil > 365 ? 'numeric' : undefined
    });
  } else if (task.nextServiceDate) {
    formattedDate = new Date(task.nextServiceDate).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  return {
    ...task,
    id: task.id || `${task.recordId}-${task.taskName}`,
    displayName: task.taskName || 'Scheduled Maintenance',
    displayItem: task.item || 'Unknown Item',
    formattedDate,
    priority,
    priorityConfig: config,
    statusText: config.description(task.daysUntil),
  };
};

export default {
  PRIORITY_LEVELS,
  getTaskPriority,
  getPriorityConfig,
  sortTasksByPriority,
  getActionableTasks,
  getNotificationBadgeCount,
  getActionableCount,
  groupTasksByPriority,
  formatTaskForDisplay,
};
