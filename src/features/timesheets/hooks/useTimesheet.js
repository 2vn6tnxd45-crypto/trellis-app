/**
 * Timesheet Hooks
 * React hooks for timesheet data management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  startTravel,
  endTravel,
  getActiveTimeEntry,
  getTechStatus,
  getWeeklyTimesheet,
  submitTimesheet,
  editTimeEntry,
  addManualEntry,
  deleteTimeEntry,
  getPendingTimesheets,
  approveTimesheet,
  rejectTimesheet,
  getPayrollSummary,
  exportTimesheetsCSV,
  subscribeToTechStatus,
  subscribeToActiveEntry,
  subscribeToPendingTimesheets,
  getWeekStart,
  getWeekId,
  formatDuration,
  formatDecimalHours,
  ENTRY_STATUS,
  TIMESHEET_STATUS
} from '../lib/timesheetService';

/**
 * Hook for time clock functionality (tech side)
 */
export const useTimeClock = (contractorId, techId) => {
  const [status, setStatus] = useState(null);
  const [activeEntry, setActiveEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Subscribe to real-time status and entry updates
  useEffect(() => {
    if (!contractorId || !techId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to tech status
    const unsubStatus = subscribeToTechStatus(contractorId, techId, (data) => {
      setStatus(data);
    });

    // Subscribe to active entry
    const unsubEntry = subscribeToActiveEntry(contractorId, techId, (data) => {
      setActiveEntry(data);
      setLoading(false);
    });

    return () => {
      unsubStatus();
      unsubEntry();
    };
  }, [contractorId, techId]);

  // Update elapsed time every second when clocked in
  useEffect(() => {
    if (!activeEntry?.clockIn) {
      setElapsedTime(0);
      return;
    }

    const updateElapsed = () => {
      const clockInTime = activeEntry.clockIn.toDate
        ? activeEntry.clockIn.toDate()
        : new Date(activeEntry.clockIn);
      const now = new Date();
      const breakMs = activeEntry.totalBreakMs || 0;

      // Account for active break
      let currentBreakMs = 0;
      if (activeEntry.status === ENTRY_STATUS.ON_BREAK) {
        const breaks = activeEntry.breaks || [];
        const lastBreak = breaks[breaks.length - 1];
        if (lastBreak && !lastBreak.end) {
          const breakStart = lastBreak.start.toDate
            ? lastBreak.start.toDate()
            : new Date(lastBreak.start);
          currentBreakMs = now - breakStart;
        }
      }

      setElapsedTime(now - clockInTime - breakMs - currentBreakMs);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeEntry]);

  // Clock in
  const handleClockIn = useCallback(async (options = {}) => {
    setError(null);
    try {
      const entry = await clockIn(contractorId, techId, options);
      return entry;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [contractorId, techId]);

  // Clock out
  const handleClockOut = useCallback(async (options = {}) => {
    setError(null);
    try {
      const entry = await clockOut(contractorId, techId, options);
      return entry;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [contractorId, techId]);

  // Start break
  const handleStartBreak = useCallback(async (breakType = 'break') => {
    setError(null);
    try {
      const entry = await startBreak(contractorId, techId, breakType);
      return entry;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [contractorId, techId]);

  // End break
  const handleEndBreak = useCallback(async () => {
    setError(null);
    try {
      const entry = await endBreak(contractorId, techId);
      return entry;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [contractorId, techId]);

  // Start travel
  const handleStartTravel = useCallback(async (jobId, location = null) => {
    setError(null);
    try {
      const entry = await startTravel(contractorId, techId, jobId, location);
      return entry;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [contractorId, techId]);

  // End travel
  const handleEndTravel = useCallback(async (location = null) => {
    setError(null);
    try {
      const entry = await endTravel(contractorId, techId, location);
      return entry;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [contractorId, techId]);

  return {
    // State
    status,
    activeEntry,
    loading,
    error,
    elapsedTime,
    elapsedTimeFormatted: formatDuration(elapsedTime),

    // Computed
    isClockedIn: status?.isClockedIn || false,
    isOnBreak: activeEntry?.status === ENTRY_STATUS.ON_BREAK,
    isTraveling: activeEntry?.status === ENTRY_STATUS.TRAVELING,
    currentJobId: status?.currentJobId,

    // Actions
    clockIn: handleClockIn,
    clockOut: handleClockOut,
    startBreak: handleStartBreak,
    endBreak: handleEndBreak,
    startTravel: handleStartTravel,
    endTravel: handleEndTravel
  };
};

/**
 * Hook for weekly timesheet view
 */
export const useWeeklyTimesheet = (contractorId, techId, initialWeek = new Date()) => {
  const [weekStart, setWeekStart] = useState(getWeekStart(initialWeek));
  const [timesheet, setTimesheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load timesheet
  const loadTimesheet = useCallback(async () => {
    if (!contractorId || !techId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getWeeklyTimesheet(contractorId, techId, weekStart);
      setTimesheet(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contractorId, techId, weekStart]);

  useEffect(() => {
    loadTimesheet();
  }, [loadTimesheet]);

  // Navigate weeks
  const goToPreviousWeek = useCallback(() => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  }, [weekStart]);

  const goToNextWeek = useCallback(() => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  }, [weekStart]);

  const goToCurrentWeek = useCallback(() => {
    setWeekStart(getWeekStart(new Date()));
  }, []);

  const goToWeek = useCallback((date) => {
    setWeekStart(getWeekStart(date));
  }, []);

  // Submit timesheet
  const submit = useCallback(async (notes = '') => {
    if (!timesheet) return;

    setSubmitting(true);
    setError(null);

    try {
      await submitTimesheet(contractorId, techId, timesheet.weekId, notes);
      await loadTimesheet();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [contractorId, techId, timesheet, loadTimesheet]);

  // Edit entry
  const editEntry = useCallback(async (entryId, updates, editedBy) => {
    setError(null);
    try {
      await editTimeEntry(contractorId, entryId, updates, editedBy);
      await loadTimesheet();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [contractorId, loadTimesheet]);

  // Add manual entry
  const addEntry = useCallback(async (data, addedBy) => {
    setError(null);
    try {
      await addManualEntry(contractorId, techId, data, addedBy);
      await loadTimesheet();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [contractorId, techId, loadTimesheet]);

  // Delete entry
  const removeEntry = useCallback(async (entryId, deletedBy, reason) => {
    setError(null);
    try {
      await deleteTimeEntry(contractorId, entryId, deletedBy, reason);
      await loadTimesheet();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [contractorId, loadTimesheet]);

  return {
    // State
    timesheet,
    weekStart,
    weekId: timesheet?.weekId || getWeekId(weekStart),
    loading,
    error,
    submitting,

    // Computed
    canSubmit: timesheet?.status === TIMESHEET_STATUS.DRAFT && timesheet?.entries?.length > 0,
    isCurrentWeek: getWeekId(weekStart) === getWeekId(new Date()),

    // Navigation
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    goToWeek,

    // Actions
    refresh: loadTimesheet,
    submit,
    editEntry,
    addEntry,
    removeEntry
  };
};

/**
 * Hook for timesheet approval (manager side)
 */
export const useTimesheetApproval = (contractorId) => {
  const [pendingTimesheets, setPendingTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Subscribe to pending timesheets
  useEffect(() => {
    if (!contractorId) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToPendingTimesheets(contractorId, (data) => {
      setPendingTimesheets(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [contractorId]);

  // Approve a timesheet
  const approve = useCallback(async (techId, weekId, approvedBy, notes = '') => {
    setProcessing(true);
    setError(null);

    try {
      await approveTimesheet(contractorId, techId, weekId, approvedBy, notes);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [contractorId]);

  // Reject a timesheet
  const reject = useCallback(async (techId, weekId, rejectedBy, reason) => {
    setProcessing(true);
    setError(null);

    try {
      await rejectTimesheet(contractorId, techId, weekId, rejectedBy, reason);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [contractorId]);

  // Bulk approve
  const bulkApprove = useCallback(async (timesheets, approvedBy) => {
    setProcessing(true);
    setError(null);

    try {
      await Promise.all(
        timesheets.map(ts => approveTimesheet(contractorId, ts.techId, ts.weekId, approvedBy))
      );
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [contractorId]);

  return {
    pendingTimesheets,
    pendingCount: pendingTimesheets.length,
    loading,
    error,
    processing,
    approve,
    reject,
    bulkApprove
  };
};

/**
 * Hook for payroll summary
 */
export const usePayrollSummary = (contractorId, weekId, techRates = {}) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!contractorId || !weekId) {
      setLoading(false);
      return;
    }

    const loadSummary = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getPayrollSummary(contractorId, weekId, techRates);
        setSummary(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [contractorId, weekId, JSON.stringify(techRates)]);

  return {
    summary,
    loading,
    error
  };
};

/**
 * Hook for timesheet export
 */
export const useTimesheetExport = (contractorId) => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const exportCSV = useCallback(async (options = {}) => {
    setExporting(true);
    setError(null);

    try {
      const csv = await exportTimesheetsCSV(contractorId, options);

      // Create download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timesheets-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return csv;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setExporting(false);
    }
  }, [contractorId]);

  return {
    exportCSV,
    exporting,
    error
  };
};

/**
 * Hook to get current location
 */
export const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return Promise.reject(new Error('Geolocation is not supported'));
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };
          setLocation(loc);
          setLoading(false);
          resolve(loc);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
          reject(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }, []);

  return {
    location,
    error,
    loading,
    getLocation
  };
};

export default {
  useTimeClock,
  useWeeklyTimesheet,
  useTimesheetApproval,
  usePayrollSummary,
  useTimesheetExport,
  useGeolocation
};
