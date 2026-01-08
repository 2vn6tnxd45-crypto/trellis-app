// src/components/navigation/NotificationPanel.jsx
// REWRITTEN: Priority-based notification display
// Shows overdue tasks FIRST, with clear visual hierarchy
// Fixes the issue where future tasks appeared before urgent ones

import React, { useState, useMemo } from 'react';
import { 
  X, Bell, Clock, ChevronRight, 
  Check, AlarmClock, CheckCheck, Phone, Mail, MessageSquare
} from 'lucide-react';
import {
  sortTasksByPriority,
  getActionableTasks,
  getTaskPriority,
  getPriorityConfig,
  groupTasksByPriority,
  getNotificationBadgeCount,
  PRIORITY_LEVELS,
} from '../../lib/notificationPriority';

// ============================================
// QUICK SNOOZE MENU
// ============================================
const QuickSnoozeMenu = ({ onSnooze, onClose }) => {
  const options = [
    { label: '1 Week', days: 7 },
    { label: '2 Weeks', days: 14 },
    { label: '1 Month', days: 30 },
  ];
  
  return (
    <div 
      className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 min-w-[120px] animate-in fade-in zoom-in-95 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        Snooze for
      </p>
      {options.map(opt => (
        <button
          key={opt.days}
          onClick={(e) => {
            e.stopPropagation();
            onSnooze(opt.days);
            onClose();
          }}
          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

// ============================================
// INDIVIDUAL TASK ITEM
// ============================================
const TaskItem = ({ 
  task, 
  onTaskClick, 
  onQuickComplete, 
  onQuickSnooze,
  showSnoozeFor,
  setShowSnoozeFor,
  onClose
}) => {
  const priority = getTaskPriority(task.daysUntil);
  const config = getPriorityConfig(priority);
  const taskId = task.id || `${task.recordId}-${task.taskName}`;
  const isShowingSnooze = showSnoozeFor === taskId;
  
  // Format due date
  const formattedDate = task.nextDue 
    ? new Date(task.nextDue).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : task.nextServiceDate
      ? new Date(task.nextServiceDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '';

  const handleClick = () => {
    onTaskClick?.(task);
    onClose?.();
  };

  return (
    <div className="relative group">
      <button
        onClick={handleClick}
        className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 ${config.bgColor} ${config.hoverBg} border ${config.borderColor}`}
      >
        {/* Priority Dot */}
        <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${config.badgeColor}`} />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Task Name (Primary - The Action) */}
          <p className={`font-semibold text-sm leading-tight ${config.textColor}`}>
            {task.taskName || 'Scheduled Maintenance'}
          </p>
          
          {/* Item + Contractor (Secondary Context) */}
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {task.item}
            {task.contractor && (
              <span className="text-slate-400"> • {task.contractor}</span>
            )}
          </p>
          
          {/* Status Badge */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.textColor}`}>
              <span>{config.emoji}</span>
              <span>{config.description(task.daysUntil)}</span>
            </span>
            {formattedDate && priority >= PRIORITY_LEVELS.DUE_SOON && (
              <span className="text-xs text-slate-400">
                ({formattedDate})
              </span>
            )}
          </div>
        </div>
        
        {/* Quick Actions (visible on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {onQuickSnooze && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSnoozeFor(isShowingSnooze ? null : taskId);
              }}
              className="p-1.5 rounded-lg hover:bg-white/80 text-slate-400 hover:text-amber-600 transition-colors"
              title="Snooze"
            >
              <AlarmClock size={14} />
            </button>
          )}
          {onQuickComplete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickComplete(task);
                onClose?.();
              }}
              className="p-1.5 rounded-lg hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors"
              title="Mark Done"
            >
              <Check size={14} />
            </button>
          )}
          <ChevronRight size={14} className="text-slate-300 ml-1" />
        </div>
      </button>
      
      {/* Snooze Dropdown */}
      {isShowingSnooze && onQuickSnooze && (
        <QuickSnoozeMenu
          onSnooze={(days) => {
            onQuickSnooze(task, days);
            onClose?.();
          }}
          onClose={() => setShowSnoozeFor(null)}
        />
      )}
    </div>
  );
};

// ============================================
// SECTION HEADER
// ============================================
const SectionHeader = ({ title, emoji, count, colorClass }) => (
  <div className="flex items-center gap-2 px-1 py-2">
    <span className="text-sm">{emoji}</span>
    <span className={`text-xs font-bold uppercase tracking-wider ${colorClass}`}>
      {title}
    </span>
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-slate-100 ${colorClass}`}>
      {count}
    </span>
  </div>
);

// ============================================
// MAIN NOTIFICATION PANEL
// ============================================
export const NotificationPanel = ({ 
  isOpen, 
  onClose, 
  dueTasks = [], 
  newSubmissions = [],
  unreadMessageCount = 0,
  onMessagesClick,
  onTaskClick,
  onSubmissionClick,
  dismissedIds = new Set(),
  onDismiss,
  onClearAll,
  onQuickComplete,
  onQuickSnooze,
}) => {
  const [showSnoozeFor, setShowSnoozeFor] = useState(null);
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Filter dismissed and sort by priority
  const visibleTasks = useMemo(() => {
    const filtered = (dueTasks || []).filter(task => {
      const taskId = task.id || `${task.recordId}-${task.taskName}`;
      return !dismissedIds.has(taskId);
    });
    return sortTasksByPriority(filtered);
  }, [dueTasks, dismissedIds]);
  
  // Group by priority for sectioned display
  const groupedTasks = useMemo(() => groupTasksByPriority(visibleTasks), [visibleTasks]);
  
  // Get actionable tasks (what shows in main panel)
  const actionableTasks = useMemo(() => getActionableTasks(visibleTasks), [visibleTasks]);
  
  // Counts
  const urgentCount = getNotificationBadgeCount(visibleTasks);
  const totalActionable = actionableTasks.length;
  const hasCritical = groupedTasks.critical.length > 0;
  const hasUrgent = groupedTasks.urgent.length > 0;
  
  // Close snooze menu when clicking outside
  const handlePanelClick = () => {
    if (showSnoozeFor) setShowSnoozeFor(null);
  };
  
  // Early return AFTER all hooks
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[70]" onClick={handlePanelClick}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        className="absolute top-16 right-4 w-[380px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in slide-in-from-top-2 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${hasCritical ? 'bg-red-100' : hasUrgent ? 'bg-orange-100' : 'bg-emerald-100'}`}>
              <Bell size={18} className={hasCritical ? 'text-red-600' : hasUrgent ? 'text-orange-600' : 'text-emerald-600'} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Notifications</h3>
              {totalActionable > 0 && (
                <p className="text-xs text-slate-500">
                  {urgentCount > 0 ? `${urgentCount} overdue` : `${totalActionable} upcoming`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onClearAll && totalActionable > 0 && (
              <button
                onClick={onClearAll}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                title="Clear all"
              >
                <CheckCheck size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {totalActionable === 0 && groupedTasks.upcoming.length === 0 && unreadMessageCount === 0 ? (
            // Empty State
            <div className="p-8 text-center">
              <div className="bg-emerald-100 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Check size={24} className="text-emerald-600" />
              </div>
              <p className="text-slate-700 font-semibold">You're all caught up!</p>
              <p className="text-slate-400 text-sm mt-1">No tasks need attention right now</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {/* MESSAGES Section - New unread messages */}
              {unreadMessageCount > 0 && (
                <div>
                  <SectionHeader 
                    title="Messages" 
                    emoji="💬" 
                    count={unreadMessageCount}
                    colorClass="text-blue-600"
                  />
                  <button
                    onClick={() => {
                      onMessagesClick?.();
                      onClose?.();
                    }}
                    className="w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 bg-blue-50 hover:bg-blue-100 border border-blue-200"
                  >
                    <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
                      <MessageSquare size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-blue-700">
                        {unreadMessageCount} unread message{unreadMessageCount !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-blue-500 mt-0.5">
                        Tap to view your conversations
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-blue-300 mt-1" />
                  </button>
                </div>
              )}
              
              {/* CRITICAL Section (30+ days overdue) */}
              {groupedTasks.critical.length > 0 && (
                <div>
                  <SectionHeader 
                    title="Critical" 
                    emoji="🔴" 
                    count={groupedTasks.critical.length}
                    colorClass="text-red-600"
                  />
                  <div className="space-y-2">
                    {groupedTasks.critical.map((task, idx) => (
                      <TaskItem
                        key={task.id || `${task.recordId}-${task.taskName}-${idx}`}
                        task={task}
                        onTaskClick={onTaskClick}
                        onQuickComplete={onQuickComplete}
                        onQuickSnooze={onQuickSnooze}
                        showSnoozeFor={showSnoozeFor}
                        setShowSnoozeFor={setShowSnoozeFor}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* URGENT Section (1-30 days overdue) */}
              {groupedTasks.urgent.length > 0 && (
                <div>
                  <SectionHeader 
                    title="Overdue" 
                    emoji="🟠" 
                    count={groupedTasks.urgent.length}
                    colorClass="text-orange-600"
                  />
                  <div className="space-y-2">
                    {groupedTasks.urgent.map((task, idx) => (
                      <TaskItem
                        key={task.id || `${task.recordId}-${task.taskName}-${idx}`}
                        task={task}
                        onTaskClick={onTaskClick}
                        onQuickComplete={onQuickComplete}
                        onQuickSnooze={onQuickSnooze}
                        showSnoozeFor={showSnoozeFor}
                        setShowSnoozeFor={setShowSnoozeFor}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* DUE SOON Section (within 7 days) */}
              {groupedTasks.dueSoon.length > 0 && (
                <div>
                  <SectionHeader 
                    title="Due Soon" 
                    emoji="🟡" 
                    count={groupedTasks.dueSoon.length}
                    colorClass="text-amber-600"
                  />
                  <div className="space-y-2">
                    {groupedTasks.dueSoon.map((task, idx) => (
                      <TaskItem
                        key={task.id || `${task.recordId}-${task.taskName}-${idx}`}
                        task={task}
                        onTaskClick={onTaskClick}
                        onQuickComplete={onQuickComplete}
                        onQuickSnooze={onQuickSnooze}
                        showSnoozeFor={showSnoozeFor}
                        setShowSnoozeFor={setShowSnoozeFor}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* UPCOMING Link (8-30 days) - collapsed, just shows count */}
              {groupedTasks.upcoming.length > 0 && (
                <button
                  onClick={() => {
                    onTaskClick?.({ navigateTo: 'maintenance' });
                    onClose();
                  }}
                  className="w-full p-3 mt-2 text-center text-sm text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors border border-dashed border-slate-200 hover:border-emerald-200"
                >
                  <span className="font-medium">
                    +{groupedTasks.upcoming.length} more upcoming
                  </span>
                  <span className="text-slate-400 ml-1">→ View all</span>
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <p className="text-[11px] text-slate-400 text-center">
            Hover for quick actions • Click to view details
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationPanel;
