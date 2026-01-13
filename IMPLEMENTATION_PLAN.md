# Trellis App: Critical Upgrades Implementation Plan

## Executive Summary

This document outlines a comprehensive, methodical implementation plan for critical app upgrades focused on user retention and engagement. Each feature has been analyzed for edge cases, integration points, and potential conflicts with existing functionality.

---

## Implementation Status

### PHASE 1: Task Completion Loop - **COMPLETED**

| Component | Status | File |
|-----------|--------|------|
| TaskCompletionModal | **DONE** | `src/components/common/TaskCompletionModal.jsx` |
| Enhanced handleMarkTaskDone | **DONE** | `src/hooks/useAppLogic.jsx` |
| MaintenanceDashboard Integration | **DONE** | `src/features/dashboard/MaintenanceDashboard.jsx` |
| HomeHealthCard (standalone) | **DONE** | `src/features/dashboard/components/HomeHealthCard.jsx` |

**Features Delivered:**
- Task completion modal with "Quick Complete" option
- Expandable details section for cost, notes, and photo upload
- Photo uploads to Firebase Storage
- Enhanced maintenance history with cost/photo tracking
- Backwards-compatible API (supports both string notes and object details)
- Animated Home Health Score ring component with breakdown popup

---

## Pre-Implementation Checklist

Before starting any feature:
- [x] Run existing test suite (if any)
- [x] Document current behavior of affected components
- [x] Create feature branch from `main`
- [x] Verify no conflicting PRs in progress

---

## PHASE 1: Task Completion Loop (Priority: CRITICAL) - **COMPLETED**

### 1.1 Problem Statement
Dashboard shows "Needs Attention" items but the completion flow is incomplete. Users see tasks but can't complete them in a satisfying way from the dashboard.

### 1.2 Current State Analysis

**Existing Infrastructure (WORKING):**
- `useAppLogic.jsx` has `handleMarkTaskDone` (lines 498-595) - FULLY IMPLEMENTED
- `handleSnoozeTask` (lines 786-850) - FULLY IMPLEMENTED
- `handleScheduleTask` (lines 724-783) - FULLY IMPLEMENTED
- `handleDeleteMaintenanceTask` (lines 680-721) - FULLY IMPLEMENTED
- Toast notifications with Undo capability - WORKING
- Celebration system with confetti - WORKING

**What's Missing:**
- Quick completion modal for adding optional details (cost, notes, photo)
- Better visual feedback on dashboard when task is completed
- Home Health Score display to show impact of completions

### 1.3 Implementation Plan

#### A. TaskCompletionModal Component

**File:** `src/components/common/TaskCompletionModal.jsx` (NEW)

```
Purpose: Optional details modal when completing a task
Triggers: User clicks "Mark Done" on any task
Behavior: Quick completion by default, optional expansion for details
```

**Component Structure:**
```jsx
TaskCompletionModal
├── Header (task name, item name)
├── Quick Complete Button (primary action - no form needed)
├── Expandable Details Section (optional)
│   ├── Cost input (number, optional)
│   ├── Notes textarea (optional)
│   ├── Photo upload (optional, single image)
│   └── Contractor used (prefilled from record, editable)
└── Footer (Cancel, Complete buttons)
```

**Props Interface:**
```typescript
interface TaskCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: {
    recordId: string;
    taskName: string;
    item: string;
    category: string;
    contractor?: string;
    contractorPhone?: string;
    isGranular: boolean;
    frequency: string;
  };
  onComplete: (task: Task, details?: CompletionDetails) => Promise<void>;
}

interface CompletionDetails {
  cost?: number;
  notes?: string;
  photoUrl?: string;
  contractor?: string;
}
```

**Edge Cases:**
1. User closes modal without completing → No changes made
2. User completes without details → Call existing `handleMarkTaskDone`
3. User adds cost → Store in maintenanceHistory entry
4. Photo upload fails → Show error, allow retry or skip
5. Network error during save → Show error toast, keep modal open

**Integration Points:**
- `ModernDashboard.jsx` - Wire up to NeedsAttention section
- `MaintenanceDashboard.jsx` - Wire up to task cards
- `NotificationPanel.jsx` - Wire up to quick complete button

#### B. Update MaintenanceHistory Schema

**Current Schema (maintenanceHistory entry):**
```javascript
{
  taskName: string,
  completedDate: string,
  performedBy: string,
  notes: string,
  id: string
}
```

**Enhanced Schema:**
```javascript
{
  taskName: string,
  completedDate: string,
  performedBy: string,
  notes: string,
  id: string,
  // NEW FIELDS (all optional, backwards compatible)
  cost: number | null,
  photoUrl: string | null,
  contractor: string | null,
}
```

**Migration:** None needed - new fields are optional additions

#### C. Dashboard Integration

**File:** `src/features/dashboard/ModernDashboard.jsx`

**Changes:**
1. Add state for completion modal: `const [completingTask, setCompletingTask] = useState(null)`
2. Update NeedsAttention `onDone` to open modal instead of direct completion
3. Add TaskCompletionModal render at component bottom

**Current Code (line ~481):**
```jsx
onMarkTaskDone={app.handleMarkTaskDone}
```

**New Code:**
```jsx
onMarkTaskDone={(task) => setCompletingTask(task)}
// ... later in render:
{completingTask && (
  <TaskCompletionModal
    isOpen={!!completingTask}
    onClose={() => setCompletingTask(null)}
    task={completingTask}
    onComplete={async (task, details) => {
      await app.handleMarkTaskDone(task, details?.notes || '');
      // If cost provided, update separately
      if (details?.cost) {
        // Update maintenanceHistory with cost
      }
      setCompletingTask(null);
    }}
  />
)}
```

### 1.4 Testing Checklist

- [ ] Complete task without details → Task marked done, toast shows, undo works
- [ ] Complete task with cost → Cost saved to history entry
- [ ] Complete task with notes → Notes saved to history entry
- [ ] Complete task with photo → Photo uploaded, URL saved
- [ ] Undo completion → All details restored
- [ ] Complete granular task → Correct task in array updated
- [ ] Complete record-level task → dateInstalled and nextServiceDate updated
- [ ] Network failure → Error shown, no partial state
- [ ] Close modal → No changes persisted

---

## PHASE 2: Home Health Score Display (Priority: HIGH)

### 2.1 Problem Statement
`useHomeHealth.js` hook exists and calculates a score, but it's not displayed anywhere prominent.

### 2.2 Current State Analysis

**Existing Infrastructure:**
- `src/hooks/useHomeHealth.js` - Calculates score (0-100)
- Score breakdown: profile (0-50) + maintenance (0-50)
- Penalizes overdue tasks (-10 per overdue)
- Tracks category coverage (HVAC, Plumbing, Safety, Roof, Appliances, Electrical)

**Score Calculation (from code):**
```javascript
const profileScore = Math.min(50, (foundCategories.size / 5) * 50);
const maintenanceScore = Math.max(0, 50 - (overdueCount * 10));
return {
  score: Math.round(profileScore + maintenanceScore),
  breakdown: { profile, maintenance, categories },
  overdueCount
};
```

### 2.3 Implementation Plan

#### A. HomeHealthCard Component

**File:** `src/features/dashboard/components/HomeHealthCard.jsx` (NEW)

**Component Structure:**
```jsx
HomeHealthCard
├── Score Circle (animated, color-coded)
│   ├── 80-100: Emerald (Excellent)
│   ├── 60-79: Amber (Good)
│   ├── 40-59: Orange (Fair)
│   └── 0-39: Red (Needs Attention)
├── Breakdown Pills
│   ├── Profile: X/50
│   └── Maintenance: X/50
├── Quick Insight
│   └── "2 overdue tasks" or "All caught up!"
└── Trend Arrow (future: weekly comparison)
```

**Props Interface:**
```typescript
interface HomeHealthCardProps {
  score: number;
  breakdown: {
    profile: number;
    maintenance: number;
    categories: number;
  };
  overdueCount: number;
  onViewDetails?: () => void;
}
```

**Edge Cases:**
1. New user with 0 items → Show 0 score with "Add items to improve"
2. All tasks overdue → Score could be 0, show encouraging message
3. Perfect score (100) → Show celebration badge
4. Score decreases → Show trend indicator (future enhancement)

#### B. Dashboard Integration

**File:** `src/features/dashboard/ModernDashboard.jsx`

**Changes:**
1. Import and use `useHomeHealth` hook
2. Add HomeHealthCard to hero section or quick stats area
3. Pass score data to component

**Placement Option 1 (Hero Section):**
Add alongside property info in the gradient hero card

**Placement Option 2 (Stats Grid):**
Replace or add to existing stats overlay (Items | Contractors | Alerts)

**Recommended:** Option 2 - Add as 4th stat in overlay, expandable to full card

### 2.4 Testing Checklist

- [ ] New user (0 items) → Score 0, helpful message
- [ ] User with items but no maintenance → Profile score only
- [ ] User with all tasks current → Full maintenance score
- [ ] User with overdue tasks → Reduced score, count shown
- [ ] Score animation on load → Smooth count-up animation
- [ ] Color coding correct at boundaries (79/80, 59/60, 39/40)

---

## PHASE 3: My Contractors Section (Priority: HIGH)

### 3.1 Problem Statement
Contractors are embedded in records but there's no dedicated "My Contractors" view. Users can only see their contractors in the Pedigree Report.

### 3.2 Current State Analysis

**Existing Infrastructure:**
- `App.jsx` lines 87-100: `contractorsList` already deduplicates contractors
- `RebookProButton.jsx`: Full chat/rebook functionality exists
- `PedigreeReport.jsx` lines 176-197: ContractorDirectory component exists
- Contractors stored in records: `contractor`, `contractorId`, `contractorPhone`, `contractorEmail`

**Deduplication Logic (already in App.jsx):**
```javascript
const contractorsList = useMemo(() => {
  return Object.values(app.activePropertyRecords.reduce((acc, r) => {
    if (r.contractor && r.contractor.length > 2) {
      const key = r.contractor.toLowerCase().trim();
      if (!acc[key]) {
        acc[key] = { name: r.contractor, id: r.contractor, phone: r.contractorPhone || '', email: r.contractorEmail || '', jobs: [] };
      }
      // Aggregate jobs and fill missing contact info
      acc[key].jobs.push(r);
    }
    return acc;
  }, {}));
}, [app.activePropertyRecords]);
```

### 3.3 Implementation Plan

#### A. MyContractors Component

**File:** `src/features/contractors/MyContractors.jsx` (NEW)

**Component Structure:**
```jsx
MyContractors
├── Header
│   ├── Title: "My Pros"
│   ├── Count badge
│   └── Add Pro button (manual entry)
├── Search/Filter bar
├── Contractor Cards Grid
│   └── ContractorCard (for each contractor)
│       ├── Avatar/Initial
│       ├── Name
│       ├── Specialties (derived from job categories)
│       ├── Job count badge
│       ├── Last service date
│       ├── Contact buttons (Call, Email, Message)
│       └── "Request Service" button
└── Empty State (no contractors yet)
```

**Props Interface:**
```typescript
interface MyContractorsProps {
  contractors: Contractor[];
  userId: string;
  userProfile: UserProfile;
  propertyAddress: string;
  onRequestService: (contractor: Contractor) => void;
}

interface Contractor {
  name: string;
  id: string;
  phone: string;
  email: string;
  jobs: Record[];  // All jobs by this contractor
  categories: Set<string>;  // Unique categories
  lastServiceDate: string;
}
```

#### B. ContractorCard Component

**File:** `src/features/contractors/ContractorCard.jsx` (NEW)

**Features:**
- Shows contractor name, contact info
- Displays specialty badges (derived from job categories)
- Shows job count and last service date
- Quick action buttons: Call, Email, Message (via RebookProButton)
- "Request Service" creates pre-filled QuickServiceRequest

**Edge Cases:**
1. Contractor with no phone/email → Hide contact buttons, show "No contact info"
2. Contractor with only one job → "1 job" not "1 jobs"
3. Very long contractor name → Truncate with ellipsis
4. Duplicate contractors with different casing → Already handled by lowercase key

#### C. Integration into App Navigation

**File:** `src/App.jsx`

**Changes:**
1. Add new tab case for 'Contractors' that shows MyContractors (currently shows ProConnect)
2. Consider: Replace ProConnect entirely or add as sub-section

**Current Code (line 584):**
```jsx
{app.activeTab === 'Contractors' && <ProConnect ... />}
```

**Decision Needed:**
- Option A: Replace ProConnect with MyContractors + embedded service requests
- Option B: Add "My Pros" as sub-tab within Contractors view
- **Recommended: Option B** - Keep ProConnect for service requests, add "My Pros" section at top

#### D. Manual Contractor Addition

**File:** `src/features/contractors/AddContractorModal.jsx` (NEW)

**Purpose:** Allow users to add contractors they've used outside the app

**Fields:**
- Name (required)
- Phone (optional)
- Email (optional)
- Specialty/Category (optional, dropdown)
- Notes (optional)

**Storage:** Create record with minimal data or new collection?
- **Recommended:** Store as "ghost record" with category "Contractor" in house_records
- This keeps all contractor data in one place for deduplication

### 3.4 Testing Checklist

- [ ] User with no contractors → Empty state shown
- [ ] User with contractors → Cards display correctly
- [ ] Click Call → Phone app opens
- [ ] Click Email → Email app opens
- [ ] Click Message → RebookChatDrawer opens
- [ ] Click Request Service → QuickServiceRequest opens pre-filled
- [ ] Search works → Filters by name
- [ ] Specialties derived correctly → Based on job categories
- [ ] Manual add works → New contractor appears in list
- [ ] Contractor from scan appears → Deduplication works

---

## PHASE 4: Push Notifications Infrastructure (Priority: CRITICAL)

### 4.1 Problem Statement
Users must open the app to see notifications. No push notifications exist.

### 4.2 Current State Analysis

**Existing Infrastructure:**
- `NotificationSettingsModal.jsx` - UI for preferences exists
- `notificationPriority.js` - Priority calculation exists
- `dueTasks` state in `useAppLogic` - Task data exists
- No Firebase Cloud Messaging (FCM) setup
- No service worker for push

### 4.3 Implementation Plan

#### A. Firebase Cloud Messaging Setup

**Files to Create/Modify:**
1. `public/firebase-messaging-sw.js` (NEW) - Service worker
2. `src/lib/pushNotifications.js` (NEW) - FCM utilities
3. `src/config/firebase.js` (MODIFY) - Add messaging import
4. `src/hooks/useAppLogic.jsx` (MODIFY) - Request permission on auth

**Service Worker (`public/firebase-messaging-sw.js`):**
```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  // Config from environment
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: icon || '/logo192.png',
    badge: '/badge-icon.png',
    data: payload.data
  });
});
```

**Push Notifications Utility (`src/lib/pushNotifications.js`):**
```javascript
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { appId } from '../config/constants';

export const requestNotificationPermission = async (userId) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: process.env.VITE_FIREBASE_VAPID_KEY
    });

    // Store token in user profile
    await updateDoc(
      doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile'),
      { fcmToken: token, notificationsEnabled: true }
    );

    return token;
  } catch (error) {
    console.error('Push notification setup failed:', error);
    return null;
  }
};

export const subscribeToForegroundMessages = (callback) => {
  const messaging = getMessaging();
  return onMessage(messaging, callback);
};
```

#### B. Backend Cloud Function for Sending Notifications

**File:** `functions/sendMaintenanceReminders.js` (NEW - Firebase Functions)

**Logic:**
1. Run daily via Cloud Scheduler
2. Query all users with `notificationsEnabled: true`
3. For each user, check for tasks due within `reminderDays` setting
4. Batch send FCM messages (max 500 per batch)
5. Track last notification sent to avoid spam

**Notification Types:**
1. **Due Soon** - "Your AC filter is due in 3 days"
2. **Overdue** - "Your water heater service is 5 days overdue"
3. **Warranty Expiring** - "Your dishwasher warranty expires in 30 days"

#### C. Permission Request Flow

**File:** `src/hooks/useAppLogic.jsx`

**Changes:**
1. After successful auth + profile load, check if notifications enabled
2. If not prompted before, show permission request
3. Store preference regardless of choice

**Timing:** Request after user has added at least one item (not immediately on signup)

### 4.4 Edge Cases & Considerations

1. **Browser doesn't support push** → Gracefully degrade, hide notification settings
2. **User denies permission** → Store preference, don't ask again
3. **Token expires** → Refresh on app load
4. **Multiple devices** → Store array of FCM tokens per user
5. **Notification spam** → Max 1 notification per day per user
6. **User disables in settings** → Stop sending, but keep token for re-enable

### 4.5 Testing Checklist

- [ ] Permission prompt appears appropriately
- [ ] Token stored in Firestore on grant
- [ ] Foreground messages show toast (not push)
- [ ] Background messages show system notification
- [ ] Click notification opens app to relevant screen
- [ ] Disable in settings stops notifications
- [ ] Re-enable in settings resumes notifications
- [ ] Multiple devices receive notifications

---

## PHASE 5: Seasonal Campaigns (Priority: MEDIUM)

### 5.1 Problem Statement
Seasonal checklist exists but items aren't personalized or actionable.

### 5.2 Current State Analysis

**Existing Infrastructure:**
- `ModernDashboard.jsx` has seasonal checklist section
- Static checklist items hardcoded
- No personalization based on user's home systems

### 5.3 Implementation Plan

#### A. Seasonal Campaign Engine

**File:** `src/lib/seasonalCampaigns.js` (NEW)

**Logic:**
1. Determine current season based on date and hemisphere
2. Filter campaign items based on user's existing records
3. Track completed campaign items per season

**Campaign Data Structure:**
```javascript
const SEASONAL_CAMPAIGNS = {
  spring: {
    name: 'Spring Maintenance',
    months: [3, 4, 5],
    tasks: [
      {
        id: 'spring_ac_service',
        title: 'Service AC before summer',
        description: 'Schedule HVAC tune-up for cooling season',
        categories: ['HVAC & Systems'],
        priority: 'high'
      },
      // ...more tasks
    ]
  },
  // summer, fall, winter...
};
```

**Personalization Logic:**
```javascript
const getPersonalizedCampaign = (season, userRecords) => {
  const campaign = SEASONAL_CAMPAIGNS[season];
  const userCategories = new Set(userRecords.map(r => r.category));

  return campaign.tasks.filter(task =>
    task.categories.some(cat => userCategories.has(cat))
  );
};
```

#### B. Campaign Progress Tracking

**Storage:** User profile or separate collection
```javascript
{
  campaignProgress: {
    'spring_2024': {
      completedTasks: ['spring_ac_service'],
      startedAt: timestamp,
      completedAt: timestamp | null
    }
  }
}
```

#### C. Dashboard Integration

**File:** `src/features/dashboard/components/SeasonalCampaign.jsx` (NEW)

**Component Structure:**
```jsx
SeasonalCampaign
├── Campaign Header (season name, progress bar)
├── Task List
│   └── CampaignTask
│       ├── Checkbox
│       ├── Title & Description
│       ├── Related items from inventory
│       └── "Book Service" action
└── Completion Celebration
```

### 5.4 Testing Checklist

- [ ] Correct season detected for user's timezone
- [ ] Tasks filtered to user's home systems
- [ ] Completion persisted
- [ ] Progress bar accurate
- [ ] "Book Service" opens correct flow
- [ ] Campaign resets each year

---

## Integration Safety Checklist

### Before Each Phase:

- [ ] Create feature branch
- [ ] List all files to be modified
- [ ] Identify potential breaking changes
- [ ] Plan rollback strategy

### After Each Phase:

- [ ] Manual testing of new feature
- [ ] Regression testing of related features
- [ ] Performance check (no new memory leaks)
- [ ] Mobile responsiveness verified
- [ ] Dark mode compatibility (if applicable)

---

## File Change Summary

### New Files to Create:
1. `src/components/common/TaskCompletionModal.jsx`
2. `src/features/dashboard/components/HomeHealthCard.jsx`
3. `src/features/contractors/MyContractors.jsx`
4. `src/features/contractors/ContractorCard.jsx`
5. `src/features/contractors/AddContractorModal.jsx`
6. `src/lib/pushNotifications.js`
7. `src/lib/seasonalCampaigns.js`
8. `src/features/dashboard/components/SeasonalCampaign.jsx`
9. `public/firebase-messaging-sw.js`
10. `functions/sendMaintenanceReminders.js` (Firebase Functions)

### Files to Modify:
1. `src/App.jsx` - Add modal renders, update Contractors tab
2. `src/hooks/useAppLogic.jsx` - Add push notification setup
3. `src/features/dashboard/ModernDashboard.jsx` - Integrate new components
4. `src/features/dashboard/MaintenanceDashboard.jsx` - Wire up completion modal
5. `src/components/navigation/NotificationPanel.jsx` - Wire up completion modal
6. `src/config/firebase.js` - Add FCM messaging
7. `src/features/settings/NotificationSettingsModal.jsx` - Add push toggle

### Files NOT Modified (Preserved):
- All contractor-pro features
- Quote/Invoice system
- Job completion flow
- Scanner functionality
- Record editor
- Authentication flow

---

## Risk Assessment

| Feature | Risk Level | Mitigation |
|---------|------------|------------|
| Task Completion Modal | Low | Uses existing handlers |
| Home Health Score | Low | New component, no breaking changes |
| My Contractors | Medium | Modifies Contractors tab behavior |
| Push Notifications | High | Requires FCM setup, service worker |
| Seasonal Campaigns | Low | New feature, isolated |

---

## Recommended Implementation Order

1. **Week 1:** Task Completion Modal + Home Health Score
   - Low risk, high visibility improvements
   - Validates completion flow works end-to-end

2. **Week 2:** My Contractors Section
   - Medium complexity
   - High user value

3. **Week 3:** Push Notifications Infrastructure
   - Highest complexity
   - Requires backend work
   - Critical for retention

4. **Week 4:** Seasonal Campaigns
   - Polish feature
   - Builds on previous work

---

## Questions for Product Decision

1. **My Contractors:** Should this replace ProConnect entirely or be a sub-section?
2. **Push Notifications:** What's the maximum notifications per day?
3. **Home Health Score:** Should we show trends over time?
4. **Seasonal Campaigns:** Should completed campaigns affect Home Health Score?

---

*Document Version: 1.0*
*Created: January 2024*
*Last Updated: January 2024*
