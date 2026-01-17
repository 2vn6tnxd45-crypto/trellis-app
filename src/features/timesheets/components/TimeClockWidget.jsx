/**
 * TimeClockWidget Component
 * Floating time tracker widget for technicians
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Square,
  Coffee,
  Car,
  MapPin,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Check,
  Loader2,
  X
} from 'lucide-react';
import { useTimeClock, useGeolocation } from '../hooks/useTimesheet';
import { verifyClockInLocation, formatDuration } from '../lib/timesheetService';

export const TimeClockWidget = ({
  contractorId,
  techId,
  currentJob = null,
  onClockIn,
  onClockOut,
  position = 'bottom-right', // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
  minimized: initialMinimized = false
}) => {
  const [minimized, setMinimized] = useState(initialMinimized);
  const [showJobSelector, setShowJobSelector] = useState(false);
  const [selectedJob, setSelectedJob] = useState(currentJob);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [locationWarning, setLocationWarning] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const {
    status,
    activeEntry,
    loading,
    error,
    elapsedTime,
    elapsedTimeFormatted,
    isClockedIn,
    isOnBreak,
    isTraveling,
    currentJobId,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    startTravel,
    endTravel
  } = useTimeClock(contractorId, techId);

  const { location, getLocation, loading: locationLoading } = useGeolocation();

  // Update selected job when current job changes
  useEffect(() => {
    if (currentJob) {
      setSelectedJob(currentJob);
    }
  }, [currentJob]);

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  // Handle clock in
  const handleClockIn = async (withTravel = false) => {
    setActionLoading('clockIn');
    setLocationWarning(null);

    try {
      // Get location
      let loc = null;
      try {
        loc = await getLocation();

        // Verify location if job has address
        if (selectedJob?.address && loc) {
          const verification = await verifyClockInLocation(loc, selectedJob.location);
          if (!verification.valid) {
            setLocationWarning(verification.message);
          }
        }
      } catch (e) {
        // Continue without location
        console.log('Location not available:', e.message);
      }

      await clockIn({
        jobId: selectedJob?.id,
        location: loc,
        notes,
        isTravelTime: withTravel
      });

      onClockIn?.();
      setNotes('');
      setShowNotes(false);
    } catch (err) {
      console.error('Clock in error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle clock out
  const handleClockOut = async () => {
    setActionLoading('clockOut');

    try {
      let loc = null;
      try {
        loc = await getLocation();
      } catch (e) {
        console.log('Location not available:', e.message);
      }

      await clockOut({ location: loc, notes });
      onClockOut?.();
      setNotes('');
      setShowNotes(false);
    } catch (err) {
      console.error('Clock out error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle break toggle
  const handleBreakToggle = async () => {
    setActionLoading('break');
    try {
      if (isOnBreak) {
        await endBreak();
      } else {
        await startBreak();
      }
    } catch (err) {
      console.error('Break error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle travel toggle
  const handleTravelToggle = async () => {
    setActionLoading('travel');
    try {
      if (isTraveling) {
        let loc = null;
        try {
          loc = await getLocation();
        } catch (e) {}
        await endTravel(loc);
      } else {
        let loc = null;
        try {
          loc = await getLocation();
        } catch (e) {}
        await startTravel(selectedJob?.id, loc);
      }
    } catch (err) {
      console.error('Travel error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Get status color
  const getStatusColor = () => {
    if (isOnBreak) return 'bg-amber-500';
    if (isTraveling) return 'bg-blue-500';
    if (isClockedIn) return 'bg-emerald-500';
    return 'bg-slate-400';
  };

  // Get status text
  const getStatusText = () => {
    if (isOnBreak) return 'On Break';
    if (isTraveling) return 'Traveling';
    if (isClockedIn) return 'Working';
    return 'Clocked Out';
  };

  if (loading) {
    return (
      <div className={`fixed ${positionClasses[position]} z-50`}>
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Minimized view
  if (minimized) {
    return (
      <div className={`fixed ${positionClasses[position]} z-50`}>
        <button
          onClick={() => setMinimized(false)}
          className={`flex items-center gap-3 px-4 py-3 rounded-full shadow-lg border border-slate-200 transition-all hover:shadow-xl ${
            isClockedIn ? 'bg-emerald-50' : 'bg-white'
          }`}
        >
          <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${isClockedIn && !isOnBreak ? 'animate-pulse' : ''}`} />
          {isClockedIn ? (
            <>
              <span className="font-mono font-bold text-slate-900">{elapsedTimeFormatted}</span>
              <span className="text-sm text-slate-500">{getStatusText()}</span>
            </>
          ) : (
            <span className="text-sm text-slate-600">Time Clock</span>
          )}
          <ChevronUp size={16} className="text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden w-80">
        {/* Header */}
        <div className={`px-4 py-3 flex items-center justify-between ${
          isClockedIn ? 'bg-emerald-50' : 'bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${isClockedIn && !isOnBreak ? 'animate-pulse' : ''}`} />
            <div>
              <p className="font-medium text-slate-900">{getStatusText()}</p>
              {isClockedIn && (
                <p className="text-xs text-slate-500">
                  {selectedJob?.title || currentJobId || 'General work'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setMinimized(true)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/50"
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Timer Display */}
        <div className="px-4 py-6 text-center bg-white">
          <div className="text-5xl font-mono font-bold text-slate-900 tracking-tight">
            {elapsedTimeFormatted}
          </div>
          {isClockedIn && activeEntry && (
            <div className="flex items-center justify-center gap-4 mt-3 text-sm text-slate-500">
              {activeEntry.totalBreakMs > 0 && (
                <span className="flex items-center gap-1">
                  <Coffee size={14} />
                  {formatDuration(activeEntry.totalBreakMs)} break
                </span>
              )}
              {activeEntry.totalTravelMs > 0 && (
                <span className="flex items-center gap-1">
                  <Car size={14} />
                  {formatDuration(activeEntry.totalTravelMs)} travel
                </span>
              )}
            </div>
          )}
        </div>

        {/* Location Warning */}
        {locationWarning && (
          <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-800">{locationWarning}</p>
              <button
                onClick={() => setLocationWarning(null)}
                className="text-xs text-amber-600 hover:text-amber-800 mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mx-4 mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="px-4 pb-4 space-y-3">
          {!isClockedIn ? (
            <>
              {/* Clock In Options */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleClockIn(false)}
                  disabled={actionLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'clockIn' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Play size={18} />
                  )}
                  Clock In
                </button>
                <button
                  onClick={() => handleClockIn(true)}
                  disabled={actionLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'clockIn' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Car size={18} />
                  )}
                  Start Travel
                </button>
              </div>

              {/* Job Selector */}
              {selectedJob && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Selected Job</p>
                  <p className="font-medium text-slate-900">{selectedJob.title}</p>
                  <p className="text-sm text-slate-600 truncate">{selectedJob.address}</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Clocked In Actions */}
              <div className="grid grid-cols-2 gap-2">
                {/* Break Button */}
                <button
                  onClick={handleBreakToggle}
                  disabled={actionLoading}
                  className={`flex items-center justify-center gap-2 px-4 py-3 font-medium rounded-xl transition-colors disabled:opacity-50 ${
                    isOnBreak
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  {actionLoading === 'break' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Coffee size={18} />
                  )}
                  {isOnBreak ? 'End Break' : 'Take Break'}
                </button>

                {/* Travel Button */}
                <button
                  onClick={handleTravelToggle}
                  disabled={actionLoading || isOnBreak}
                  className={`flex items-center justify-center gap-2 px-4 py-3 font-medium rounded-xl transition-colors disabled:opacity-50 ${
                    isTraveling
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  {actionLoading === 'travel' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Car size={18} />
                  )}
                  {isTraveling ? 'Arrived' : 'Travel'}
                </button>
              </div>

              {/* Clock Out */}
              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'clockOut' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Square size={18} />
                )}
                Clock Out
              </button>
            </>
          )}

          {/* Notes Toggle */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="w-full text-sm text-slate-500 hover:text-slate-700 py-1"
          >
            {showNotes ? 'Hide notes' : 'Add notes'}
          </button>

          {/* Notes Input */}
          {showNotes && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about your work..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={2}
            />
          )}

          {/* Location Status */}
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <MapPin size={12} />
            {locationLoading ? (
              'Getting location...'
            ) : location ? (
              <span className="flex items-center gap-1">
                <Check size={12} className="text-emerald-500" />
                Location tracked
              </span>
            ) : (
              'Location not available'
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Compact Time Clock Button for navigation
 */
export const TimeClockButton = ({
  contractorId,
  techId,
  onClick
}) => {
  const { isClockedIn, elapsedTimeFormatted, isOnBreak, isTraveling } = useTimeClock(contractorId, techId);

  const getStatusColor = () => {
    if (isOnBreak) return 'bg-amber-500';
    if (isTraveling) return 'bg-blue-500';
    if (isClockedIn) return 'bg-emerald-500';
    return 'bg-slate-400';
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
        isClockedIn
          ? 'bg-emerald-50 hover:bg-emerald-100'
          : 'bg-slate-50 hover:bg-slate-100'
      }`}
    >
      <Clock size={18} className={isClockedIn ? 'text-emerald-600' : 'text-slate-500'} />
      <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${isClockedIn && !isOnBreak ? 'animate-pulse' : ''}`} />
      {isClockedIn && (
        <span className="font-mono text-sm font-medium text-slate-900">
          {elapsedTimeFormatted}
        </span>
      )}
    </button>
  );
};

export default TimeClockWidget;
