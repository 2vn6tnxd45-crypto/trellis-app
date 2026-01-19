/**
 * Timesheet Service
 * Complete time tracking and management for contractor technicians
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';

// Helper to get the correct contractor path
const getContractorPath = (contractorId) => `${CONTRACTORS_COLLECTION_PATH}/${contractorId}`;

// ============================================================================
// CONSTANTS
// ============================================================================

export const TIME_ENTRY_TYPES = {
  CLOCK_IN: 'clock_in',
  CLOCK_OUT: 'clock_out',
  BREAK_START: 'break_start',
  BREAK_END: 'break_end',
  TRAVEL_START: 'travel_start',
  TRAVEL_END: 'travel_end'
};

export const TIMESHEET_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid'
};

export const ENTRY_STATUS = {
  ACTIVE: 'active',      // Currently clocked in
  COMPLETED: 'completed', // Clocked out
  ON_BREAK: 'on_break',  // On break
  TRAVELING: 'traveling' // Traveling to job
};

// Default overtime threshold (40 hours)
export const OVERTIME_THRESHOLD_HOURS = 40;
export const OVERTIME_MULTIPLIER = 1.5;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the start of the week (Sunday) for a given date
 */
export const getWeekStart = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get the end of the week (Saturday) for a given date
 */
export const getWeekEnd = (date = new Date()) => {
  const d = getWeekStart(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Get week identifier string (YYYY-WW format)
 */
export const getWeekId = (date = new Date()) => {
  const d = new Date(date);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekStart = getWeekStart(d);
  const weekNumber = Math.ceil((((weekStart - startOfYear) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

/**
 * Format duration in milliseconds to HH:MM format
 */
export const formatDuration = (ms) => {
  if (!ms || ms < 0) return '0:00';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Format duration to decimal hours
 */
export const formatDecimalHours = (ms) => {
  if (!ms || ms < 0) return 0;
  return Number((ms / (1000 * 60 * 60)).toFixed(2));
};

/**
 * Convert Firestore timestamp to Date
 */
const toDate = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp.toDate) return timestamp.toDate();
  if (typeof timestamp === 'string') return new Date(timestamp);
  return new Date(timestamp);
};

/**
 * Calculate distance between two coordinates in miles
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ============================================================================
// TIME ENTRY OPERATIONS
// ============================================================================

/**
 * Clock in to start work
 * Uses transaction to prevent race conditions from multiple tabs/devices
 */
export const clockIn = async (contractorId, techId, data = {}) => {
  const {
    jobId = null,
    location = null,
    notes = '',
    isTravelTime = false
  } = data;

  const entryId = `${techId}-${Date.now()}`;
  const now = Timestamp.now();
  const dateStr = new Date().toISOString().split('T')[0];

  const entryRef = doc(db, getContractorPath(contractorId), 'timeEntries', `${techId}-${dateStr}-${entryId}`);
  const techStatusRef = doc(db, getContractorPath(contractorId), 'techStatuses', techId);

  const entry = await runTransaction(db, async (transaction) => {
    // Check current tech status within transaction
    const techStatusDoc = await transaction.get(techStatusRef);
    const techStatus = techStatusDoc.exists() ? techStatusDoc.data() : {};

    if (techStatus.isClockedIn) {
      throw new Error('Already clocked in. Please clock out first.');
    }

    const entryData = {
      id: entryId,
      techId,
      jobId,
      date: now,
      clockIn: now,
      clockOut: null,
      breaks: [],
      travelTime: isTravelTime ? { start: now, end: null } : null,
      totalWorkMs: 0,
      totalBreakMs: 0,
      totalTravelMs: 0,
      status: isTravelTime ? ENTRY_STATUS.TRAVELING : ENTRY_STATUS.ACTIVE,
      location: location ? {
        clockIn: location,
        clockOut: null
      } : null,
      notes,
      createdAt: now,
      updatedAt: now
    };

    // Write entry and update status atomically
    transaction.set(entryRef, entryData);
    transaction.set(techStatusRef, {
      ...techStatus,
      isClockedIn: true,
      currentEntryId: entryId,
      clockedInAt: now,
      currentJobId: jobId,
      status: isTravelTime ? 'traveling' : 'working',
      updatedAt: now
    }, { merge: true });

    return entryData;
  });

  return entry;
};

/**
 * Clock out to end work
 */
export const clockOut = async (contractorId, techId, data = {}) => {
  const { location = null, notes = '' } = data;

  const activeEntry = await getActiveTimeEntry(contractorId, techId);
  if (!activeEntry) {
    throw new Error('Not clocked in. Please clock in first.');
  }

  // End any active break
  if (activeEntry.status === ENTRY_STATUS.ON_BREAK) {
    await endBreak(contractorId, techId);
  }

  const now = Timestamp.now();
  const clockInTime = toDate(activeEntry.clockIn);
  const clockOutTime = now.toDate();

  // Calculate totals
  let totalBreakMs = activeEntry.totalBreakMs || 0;
  let totalTravelMs = activeEntry.totalTravelMs || 0;

  // If was traveling, calculate travel time
  if (activeEntry.travelTime?.start && !activeEntry.travelTime.end) {
    const travelStart = toDate(activeEntry.travelTime.start);
    totalTravelMs += clockOutTime - travelStart;
  }

  // Calculate total work time (excluding breaks)
  const totalMs = clockOutTime - clockInTime;
  const totalWorkMs = totalMs - totalBreakMs;

  // Get the entry document reference
  const dateStr = clockInTime.toISOString().split('T')[0];
  const entriesRef = collection(db, getContractorPath(contractorId), 'timeEntries');
  const q = query(
    entriesRef,
    where('techId', '==', techId),
    where('id', '==', activeEntry.id)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Time entry not found');
  }

  const entryDoc = snapshot.docs[0];

  await updateDoc(entryDoc.ref, {
    clockOut: now,
    totalWorkMs,
    totalBreakMs,
    totalTravelMs,
    status: ENTRY_STATUS.COMPLETED,
    'location.clockOut': location,
    notes: notes || activeEntry.notes,
    updatedAt: now
  });

  // Update tech status
  await updateTechStatus(contractorId, techId, {
    isClockedIn: false,
    currentEntryId: null,
    clockedInAt: null,
    currentJobId: null,
    status: 'available'
  });

  return {
    ...activeEntry,
    clockOut: now,
    totalWorkMs,
    totalBreakMs,
    totalTravelMs,
    status: ENTRY_STATUS.COMPLETED
  };
};

/**
 * Start a break
 */
export const startBreak = async (contractorId, techId, breakType = 'break') => {
  const activeEntry = await getActiveTimeEntry(contractorId, techId);
  if (!activeEntry) {
    throw new Error('Not clocked in. Please clock in first.');
  }

  if (activeEntry.status === ENTRY_STATUS.ON_BREAK) {
    throw new Error('Already on break.');
  }

  const now = Timestamp.now();
  const breaks = activeEntry.breaks || [];
  breaks.push({
    start: now,
    end: null,
    type: breakType
  });

  // Find and update the entry
  const entriesRef = collection(db, getContractorPath(contractorId), 'timeEntries');
  const q = query(
    entriesRef,
    where('techId', '==', techId),
    where('id', '==', activeEntry.id)
  );
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    await updateDoc(snapshot.docs[0].ref, {
      breaks,
      status: ENTRY_STATUS.ON_BREAK,
      updatedAt: now
    });
  }

  // Update tech status
  await updateTechStatus(contractorId, techId, {
    status: 'on_break'
  });

  return { ...activeEntry, breaks, status: ENTRY_STATUS.ON_BREAK };
};

/**
 * End a break
 */
export const endBreak = async (contractorId, techId) => {
  const activeEntry = await getActiveTimeEntry(contractorId, techId);
  if (!activeEntry) {
    throw new Error('Not clocked in.');
  }

  if (activeEntry.status !== ENTRY_STATUS.ON_BREAK) {
    throw new Error('Not currently on break.');
  }

  const now = Timestamp.now();
  const breaks = activeEntry.breaks || [];
  const lastBreak = breaks[breaks.length - 1];

  if (lastBreak && !lastBreak.end) {
    lastBreak.end = now;
    const breakStart = toDate(lastBreak.start);
    const breakMs = now.toDate() - breakStart;
    const totalBreakMs = (activeEntry.totalBreakMs || 0) + breakMs;

    // Find and update the entry
    const entriesRef = collection(db, getContractorPath(contractorId), 'timeEntries');
    const q = query(
      entriesRef,
      where('techId', '==', techId),
      where('id', '==', activeEntry.id)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      await updateDoc(snapshot.docs[0].ref, {
        breaks,
        totalBreakMs,
        status: ENTRY_STATUS.ACTIVE,
        updatedAt: now
      });
    }

    // Update tech status
    await updateTechStatus(contractorId, techId, {
      status: 'working'
    });

    return { ...activeEntry, breaks, totalBreakMs, status: ENTRY_STATUS.ACTIVE };
  }

  return activeEntry;
};

/**
 * Start travel to a job
 */
export const startTravel = async (contractorId, techId, jobId, location = null) => {
  const activeEntry = await getActiveTimeEntry(contractorId, techId);

  if (!activeEntry) {
    // Clock in with travel
    return clockIn(contractorId, techId, { jobId, location, isTravelTime: true });
  }

  if (activeEntry.status === ENTRY_STATUS.TRAVELING) {
    throw new Error('Already traveling.');
  }

  const now = Timestamp.now();

  // Find and update the entry
  const entriesRef = collection(db, getContractorPath(contractorId), 'timeEntries');
  const q = query(
    entriesRef,
    where('techId', '==', techId),
    where('id', '==', activeEntry.id)
  );
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    await updateDoc(snapshot.docs[0].ref, {
      travelTime: { start: now, end: null },
      status: ENTRY_STATUS.TRAVELING,
      jobId,
      updatedAt: now
    });
  }

  // Update tech status
  await updateTechStatus(contractorId, techId, {
    status: 'traveling',
    currentJobId: jobId
  });

  return { ...activeEntry, status: ENTRY_STATUS.TRAVELING };
};

/**
 * End travel (arrived at job)
 */
export const endTravel = async (contractorId, techId, location = null) => {
  const activeEntry = await getActiveTimeEntry(contractorId, techId);
  if (!activeEntry) {
    throw new Error('Not clocked in.');
  }

  if (activeEntry.status !== ENTRY_STATUS.TRAVELING) {
    throw new Error('Not currently traveling.');
  }

  const now = Timestamp.now();
  const travelStart = toDate(activeEntry.travelTime?.start);
  const travelMs = travelStart ? now.toDate() - travelStart : 0;
  const totalTravelMs = (activeEntry.totalTravelMs || 0) + travelMs;

  // Find and update the entry
  const entriesRef = collection(db, getContractorPath(contractorId), 'timeEntries');
  const q = query(
    entriesRef,
    where('techId', '==', techId),
    where('id', '==', activeEntry.id)
  );
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    await updateDoc(snapshot.docs[0].ref, {
      'travelTime.end': now,
      'travelTime.location': location,
      totalTravelMs,
      status: ENTRY_STATUS.ACTIVE,
      updatedAt: now
    });
  }

  // Update tech status
  await updateTechStatus(contractorId, techId, {
    status: 'working'
  });

  return { ...activeEntry, totalTravelMs, status: ENTRY_STATUS.ACTIVE };
};

/**
 * Get active time entry for a tech
 */
export const getActiveTimeEntry = async (contractorId, techId) => {
  const entriesRef = collection(db, getContractorPath(contractorId), 'timeEntries');
  const q = query(
    entriesRef,
    where('techId', '==', techId),
    where('status', 'in', [ENTRY_STATUS.ACTIVE, ENTRY_STATUS.ON_BREAK, ENTRY_STATUS.TRAVELING]),
    orderBy('clockIn', 'desc')
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};

/**
 * Update tech status document
 */
const updateTechStatus = async (contractorId, techId, status) => {
  const techStatusRef = doc(db, getContractorPath(contractorId), 'techStatus', techId);
  await setDoc(techStatusRef, {
    ...status,
    updatedAt: Timestamp.now()
  }, { merge: true });
};

/**
 * Get tech's current status
 */
export const getTechStatus = async (contractorId, techId) => {
  const techStatusRef = doc(db, getContractorPath(contractorId), 'techStatus', techId);
  const snapshot = await getDoc(techStatusRef);
  return snapshot.exists() ? snapshot.data() : null;
};

// ============================================================================
// TIME ENTRY MANAGEMENT
// ============================================================================

/**
 * Edit a time entry (manual correction)
 */
export const editTimeEntry = async (contractorId, entryId, updates, editedBy) => {
  const entriesRef = collection(db, getContractorPath(contractorId), 'timeEntries');
  const q = query(entriesRef, where('id', '==', entryId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Time entry not found');
  }

  const entryDoc = snapshot.docs[0];
  const entry = entryDoc.data();

  // Calculate new totals if times changed
  let totalWorkMs = entry.totalWorkMs;
  let totalBreakMs = entry.totalBreakMs;

  if (updates.clockIn || updates.clockOut) {
    const clockIn = updates.clockIn ? toDate(updates.clockIn) : toDate(entry.clockIn);
    const clockOut = updates.clockOut ? toDate(updates.clockOut) : toDate(entry.clockOut);

    if (clockIn && clockOut) {
      totalWorkMs = clockOut - clockIn - totalBreakMs;
    }
  }

  // Track edit history
  const editHistory = entry.editHistory || [];
  editHistory.push({
    editedAt: Timestamp.now(),
    editedBy,
    previousValues: {
      clockIn: entry.clockIn,
      clockOut: entry.clockOut,
      notes: entry.notes
    },
    newValues: updates,
    reason: updates.editReason || 'Manual correction'
  });

  await updateDoc(entryDoc.ref, {
    ...updates,
    totalWorkMs,
    editHistory,
    updatedAt: Timestamp.now()
  });

  return { ...entry, ...updates, totalWorkMs, editHistory };
};

/**
 * Add a manual time entry
 */
export const addManualEntry = async (contractorId, techId, data, addedBy) => {
  const {
    date,
    clockIn,
    clockOut,
    jobId = null,
    notes = '',
    reason = 'Manual entry'
  } = data;

  const entryId = `${techId}-manual-${Date.now()}`;
  const clockInDate = new Date(clockIn);
  const clockOutDate = new Date(clockOut);

  if (clockOutDate <= clockInDate) {
    throw new Error('Clock out time must be after clock in time');
  }

  const totalWorkMs = clockOutDate - clockInDate;
  const dateStr = new Date(date).toISOString().split('T')[0];

  const entry = {
    id: entryId,
    techId,
    jobId,
    date: Timestamp.fromDate(new Date(date)),
    clockIn: Timestamp.fromDate(clockInDate),
    clockOut: Timestamp.fromDate(clockOutDate),
    breaks: [],
    totalWorkMs,
    totalBreakMs: 0,
    totalTravelMs: 0,
    status: ENTRY_STATUS.COMPLETED,
    isManualEntry: true,
    manualEntryReason: reason,
    addedBy,
    notes,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  await setDoc(
    doc(db, getContractorPath(contractorId), 'timeEntries', `${techId}-${dateStr}-${entryId}`),
    entry
  );

  return entry;
};

/**
 * Delete a time entry
 */
export const deleteTimeEntry = async (contractorId, entryId, deletedBy, reason) => {
  const entriesRef = collection(db, getContractorPath(contractorId), 'timeEntries');
  const q = query(entriesRef, where('id', '==', entryId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Time entry not found');
  }

  const entryDoc = snapshot.docs[0];

  // Soft delete - mark as deleted rather than removing
  await updateDoc(entryDoc.ref, {
    deleted: true,
    deletedAt: Timestamp.now(),
    deletedBy,
    deletionReason: reason,
    updatedAt: Timestamp.now()
  });

  return true;
};

// ============================================================================
// TIMESHEET OPERATIONS
// ============================================================================

/**
 * Get weekly timesheet for a tech
 */
export const getWeeklyTimesheet = async (contractorId, techId, weekStart = new Date()) => {
  const start = getWeekStart(weekStart);
  const end = getWeekEnd(weekStart);
  const weekId = getWeekId(weekStart);

  // Get time entries for the week
  const entriesRef = collection(db, getContractorPath(contractorId), 'timeEntries');
  const q = query(
    entriesRef,
    where('techId', '==', techId),
    where('date', '>=', Timestamp.fromDate(start)),
    where('date', '<=', Timestamp.fromDate(end)),
    orderBy('date', 'asc')
  );

  const snapshot = await getDocs(q);
  const entries = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(entry => !entry.deleted);

  // Group entries by day
  const dailyTotals = {};
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    const dayStr = day.toISOString().split('T')[0];

    dailyTotals[dayStr] = {
      date: day,
      dayName: days[i],
      entries: [],
      totalWorkMs: 0,
      totalBreakMs: 0,
      totalTravelMs: 0
    };
  }

  // Populate daily totals
  entries.forEach(entry => {
    const entryDate = toDate(entry.date);
    const dayStr = entryDate.toISOString().split('T')[0];

    if (dailyTotals[dayStr]) {
      dailyTotals[dayStr].entries.push(entry);
      dailyTotals[dayStr].totalWorkMs += entry.totalWorkMs || 0;
      dailyTotals[dayStr].totalBreakMs += entry.totalBreakMs || 0;
      dailyTotals[dayStr].totalTravelMs += entry.totalTravelMs || 0;
    }
  });

  // Calculate weekly totals
  const weeklyTotals = Object.values(dailyTotals).reduce(
    (acc, day) => ({
      totalWorkMs: acc.totalWorkMs + day.totalWorkMs,
      totalBreakMs: acc.totalBreakMs + day.totalBreakMs,
      totalTravelMs: acc.totalTravelMs + day.totalTravelMs
    }),
    { totalWorkMs: 0, totalBreakMs: 0, totalTravelMs: 0 }
  );

  // Calculate overtime
  const regularHoursMs = OVERTIME_THRESHOLD_HOURS * 60 * 60 * 1000;
  const overtimeMs = Math.max(0, weeklyTotals.totalWorkMs - regularHoursMs);
  const regularMs = weeklyTotals.totalWorkMs - overtimeMs;

  // Check for existing timesheet record
  const timesheetRef = doc(db, getContractorPath(contractorId), 'timesheets', `${techId}-${weekId}`);
  const timesheetSnap = await getDoc(timesheetRef);
  const existingTimesheet = timesheetSnap.exists() ? timesheetSnap.data() : null;

  return {
    weekId,
    techId,
    weekStart: start,
    weekEnd: end,
    dailyTotals,
    weeklyTotals: {
      ...weeklyTotals,
      regularMs,
      overtimeMs,
      regularHours: formatDecimalHours(regularMs),
      overtimeHours: formatDecimalHours(overtimeMs),
      totalHours: formatDecimalHours(weeklyTotals.totalWorkMs)
    },
    entries,
    status: existingTimesheet?.status || TIMESHEET_STATUS.DRAFT,
    submittedAt: existingTimesheet?.submittedAt,
    approvedAt: existingTimesheet?.approvedAt,
    approvedBy: existingTimesheet?.approvedBy,
    rejectedAt: existingTimesheet?.rejectedAt,
    rejectionReason: existingTimesheet?.rejectionReason
  };
};

/**
 * Submit timesheet for approval
 */
export const submitTimesheet = async (contractorId, techId, weekId, techNotes = '') => {
  const timesheetRef = doc(db, getContractorPath(contractorId), 'timesheets', `${techId}-${weekId}`);

  // Get current timesheet data
  const timesheet = await getWeeklyTimesheet(contractorId, techId, new Date(weekId.split('-W')[0], 0, 1 + (parseInt(weekId.split('-W')[1]) - 1) * 7));

  await setDoc(timesheetRef, {
    techId,
    weekId,
    weekStart: Timestamp.fromDate(timesheet.weekStart),
    weekEnd: Timestamp.fromDate(timesheet.weekEnd),
    ...timesheet.weeklyTotals,
    entryCount: timesheet.entries.length,
    status: TIMESHEET_STATUS.SUBMITTED,
    techNotes,
    submittedAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  }, { merge: true });

  return { ...timesheet, status: TIMESHEET_STATUS.SUBMITTED };
};

/**
 * Approve a timesheet
 */
export const approveTimesheet = async (contractorId, techId, weekId, approvedBy, notes = '') => {
  const timesheetRef = doc(db, getContractorPath(contractorId), 'timesheets', `${techId}-${weekId}`);

  await updateDoc(timesheetRef, {
    status: TIMESHEET_STATUS.APPROVED,
    approvedAt: Timestamp.now(),
    approvedBy,
    approvalNotes: notes,
    updatedAt: Timestamp.now()
  });

  return { success: true };
};

/**
 * Reject a timesheet
 */
export const rejectTimesheet = async (contractorId, techId, weekId, rejectedBy, reason) => {
  const timesheetRef = doc(db, getContractorPath(contractorId), 'timesheets', `${techId}-${weekId}`);

  await updateDoc(timesheetRef, {
    status: TIMESHEET_STATUS.REJECTED,
    rejectedAt: Timestamp.now(),
    rejectedBy,
    rejectionReason: reason,
    updatedAt: Timestamp.now()
  });

  return { success: true };
};

/**
 * Mark timesheet as paid
 */
export const markTimesheetPaid = async (contractorId, techId, weekId, paymentDetails = {}) => {
  const timesheetRef = doc(db, getContractorPath(contractorId), 'timesheets', `${techId}-${weekId}`);

  await updateDoc(timesheetRef, {
    status: TIMESHEET_STATUS.PAID,
    paidAt: Timestamp.now(),
    paymentDetails,
    updatedAt: Timestamp.now()
  });

  return { success: true };
};

// ============================================================================
// REPORTING & EXPORT
// ============================================================================

/**
 * Get timesheets for a date range
 */
export const getTimesheetsByDateRange = async (contractorId, startDate, endDate, techId = null) => {
  const timesheetsRef = collection(db, getContractorPath(contractorId), 'timesheets');

  let q;
  if (techId) {
    q = query(
      timesheetsRef,
      where('techId', '==', techId),
      where('weekStart', '>=', Timestamp.fromDate(startDate)),
      where('weekStart', '<=', Timestamp.fromDate(endDate)),
      orderBy('weekStart', 'desc')
    );
  } else {
    q = query(
      timesheetsRef,
      where('weekStart', '>=', Timestamp.fromDate(startDate)),
      where('weekStart', '<=', Timestamp.fromDate(endDate)),
      orderBy('weekStart', 'desc')
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Get all pending timesheets for approval
 */
export const getPendingTimesheets = async (contractorId) => {
  const timesheetsRef = collection(db, getContractorPath(contractorId), 'timesheets');
  const q = query(
    timesheetsRef,
    where('status', '==', TIMESHEET_STATUS.SUBMITTED),
    orderBy('submittedAt', 'asc'),
    limit(100)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Export timesheets to CSV format
 */
export const exportTimesheetsCSV = async (contractorId, options = {}) => {
  const {
    startDate = getWeekStart(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    endDate = new Date(),
    techId = null,
    includeDetails = false,
    techs = []
  } = options;

  // Get all time entries for the range
  const entriesRef = collection(db, getContractorPath(contractorId), 'timeEntries');
  let q;

  if (techId) {
    q = query(
      entriesRef,
      where('techId', '==', techId),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'asc')
    );
  } else {
    q = query(
      entriesRef,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'asc')
    );
  }

  const snapshot = await getDocs(q);
  const entries = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(entry => !entry.deleted);

  // Create tech lookup
  const techLookup = {};
  techs.forEach(tech => {
    techLookup[tech.id] = tech;
  });

  // Build CSV rows
  const rows = [];

  if (includeDetails) {
    // Detailed export - one row per entry
    rows.push([
      'Date',
      'Technician',
      'Clock In',
      'Clock Out',
      'Work Hours',
      'Break Hours',
      'Travel Hours',
      'Job ID',
      'Notes',
      'Entry Type'
    ].join(','));

    entries.forEach(entry => {
      const tech = techLookup[entry.techId];
      const clockIn = toDate(entry.clockIn);
      const clockOut = toDate(entry.clockOut);

      rows.push([
        clockIn?.toLocaleDateString() || '',
        tech?.name || entry.techId,
        clockIn?.toLocaleTimeString() || '',
        clockOut?.toLocaleTimeString() || '',
        formatDecimalHours(entry.totalWorkMs),
        formatDecimalHours(entry.totalBreakMs),
        formatDecimalHours(entry.totalTravelMs),
        entry.jobId || '',
        `"${(entry.notes || '').replace(/"/g, '""')}"`,
        entry.isManualEntry ? 'Manual' : 'Clock'
      ].join(','));
    });
  } else {
    // Summary export - grouped by tech and week
    rows.push([
      'Week Starting',
      'Technician',
      'Regular Hours',
      'Overtime Hours',
      'Total Hours',
      'Travel Hours',
      'Status'
    ].join(','));

    // Group by tech and week
    const grouped = {};
    entries.forEach(entry => {
      const weekId = getWeekId(toDate(entry.date));
      const key = `${entry.techId}-${weekId}`;

      if (!grouped[key]) {
        grouped[key] = {
          techId: entry.techId,
          weekId,
          weekStart: getWeekStart(toDate(entry.date)),
          totalWorkMs: 0,
          totalTravelMs: 0
        };
      }

      grouped[key].totalWorkMs += entry.totalWorkMs || 0;
      grouped[key].totalTravelMs += entry.totalTravelMs || 0;
    });

    // Convert to rows
    Object.values(grouped).forEach(group => {
      const tech = techLookup[group.techId];
      const regularHoursMs = OVERTIME_THRESHOLD_HOURS * 60 * 60 * 1000;
      const overtimeMs = Math.max(0, group.totalWorkMs - regularHoursMs);
      const regularMs = group.totalWorkMs - overtimeMs;

      rows.push([
        group.weekStart.toLocaleDateString(),
        tech?.name || group.techId,
        formatDecimalHours(regularMs),
        formatDecimalHours(overtimeMs),
        formatDecimalHours(group.totalWorkMs),
        formatDecimalHours(group.totalTravelMs),
        'Exported'
      ].join(','));
    });
  }

  return rows.join('\n');
};

/**
 * Calculate payroll for a tech
 */
export const calculatePayroll = async (contractorId, techId, weekId, hourlyRate, overtimeRate = null) => {
  const timesheet = await getWeeklyTimesheet(
    contractorId,
    techId,
    new Date(weekId.split('-W')[0], 0, 1 + (parseInt(weekId.split('-W')[1]) - 1) * 7)
  );

  const effectiveOvertimeRate = overtimeRate || (hourlyRate * OVERTIME_MULTIPLIER);

  const regularPay = timesheet.weeklyTotals.regularHours * hourlyRate;
  const overtimePay = timesheet.weeklyTotals.overtimeHours * effectiveOvertimeRate;
  const totalPay = regularPay + overtimePay;

  return {
    techId,
    weekId,
    hourlyRate,
    overtimeRate: effectiveOvertimeRate,
    regularHours: timesheet.weeklyTotals.regularHours,
    overtimeHours: timesheet.weeklyTotals.overtimeHours,
    totalHours: timesheet.weeklyTotals.totalHours,
    regularPay,
    overtimePay,
    totalPay,
    travelHours: formatDecimalHours(timesheet.weeklyTotals.totalTravelMs)
  };
};

/**
 * Get payroll summary for all techs
 */
export const getPayrollSummary = async (contractorId, weekId, techRates = {}) => {
  // Get all techs
  const techsRef = collection(db, getContractorPath(contractorId), 'team');
  const techsSnapshot = await getDocs(techsRef);
  const techs = techsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const payrollItems = await Promise.all(
    techs.map(async tech => {
      const rate = techRates[tech.id] || tech.hourlyRate || 25;
      const payroll = await calculatePayroll(contractorId, tech.id, weekId, rate);
      return {
        ...payroll,
        techName: tech.name,
        techEmail: tech.email
      };
    })
  );

  const totals = payrollItems.reduce(
    (acc, item) => ({
      totalRegularHours: acc.totalRegularHours + item.regularHours,
      totalOvertimeHours: acc.totalOvertimeHours + item.overtimeHours,
      totalHours: acc.totalHours + item.totalHours,
      totalRegularPay: acc.totalRegularPay + item.regularPay,
      totalOvertimePay: acc.totalOvertimePay + item.overtimePay,
      totalPay: acc.totalPay + item.totalPay
    }),
    {
      totalRegularHours: 0,
      totalOvertimeHours: 0,
      totalHours: 0,
      totalRegularPay: 0,
      totalOvertimePay: 0,
      totalPay: 0
    }
  );

  return {
    weekId,
    items: payrollItems,
    totals,
    techCount: techs.length
  };
};

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to tech status changes
 */
export const subscribeToTechStatus = (contractorId, techId, callback) => {
  const statusRef = doc(db, getContractorPath(contractorId), 'techStatus', techId);
  return onSnapshot(statusRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null);
  });
};

/**
 * Subscribe to active time entry
 */
export const subscribeToActiveEntry = (contractorId, techId, callback) => {
  const entriesRef = collection(db, getContractorPath(contractorId), 'timeEntries');
  const q = query(
    entriesRef,
    where('techId', '==', techId),
    where('status', 'in', [ENTRY_STATUS.ACTIVE, ENTRY_STATUS.ON_BREAK, ENTRY_STATUS.TRAVELING])
  );

  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null);
    } else {
      callback({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    }
  });
};

/**
 * Subscribe to pending timesheets
 */
export const subscribeToPendingTimesheets = (contractorId, callback) => {
  const timesheetsRef = collection(db, getContractorPath(contractorId), 'timesheets');
  const q = query(
    timesheetsRef,
    where('status', '==', TIMESHEET_STATUS.SUBMITTED),
    orderBy('submittedAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

// ============================================================================
// GEOLOCATION VERIFICATION
// ============================================================================

/**
 * Verify clock in location is near job site
 */
export const verifyClockInLocation = async (userLocation, jobLocation, maxDistanceMiles = 0.5) => {
  if (!userLocation || !jobLocation) {
    return { valid: true, distance: null, message: 'Location not available' };
  }

  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    jobLocation.latitude,
    jobLocation.longitude
  );

  const valid = distance <= maxDistanceMiles;

  return {
    valid,
    distance: distance.toFixed(2),
    message: valid
      ? 'Location verified'
      : `You are ${distance.toFixed(2)} miles from the job site. Expected within ${maxDistanceMiles} miles.`
  };
};

export default {
  // Time entry operations
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  startTravel,
  endTravel,
  getActiveTimeEntry,
  getTechStatus,

  // Entry management
  editTimeEntry,
  addManualEntry,
  deleteTimeEntry,

  // Timesheet operations
  getWeeklyTimesheet,
  submitTimesheet,
  approveTimesheet,
  rejectTimesheet,
  markTimesheetPaid,

  // Reporting
  getTimesheetsByDateRange,
  getPendingTimesheets,
  exportTimesheetsCSV,
  calculatePayroll,
  getPayrollSummary,

  // Subscriptions
  subscribeToTechStatus,
  subscribeToActiveEntry,
  subscribeToPendingTimesheets,

  // Utilities
  verifyClockInLocation,
  getWeekStart,
  getWeekEnd,
  getWeekId,
  formatDuration,
  formatDecimalHours
};
