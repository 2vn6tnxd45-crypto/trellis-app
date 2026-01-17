/**
 * WeeklyTimesheetView Component
 * Weekly timesheet display with editing capabilities
 */

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Coffee,
  Car,
  Edit3,
  Trash2,
  Plus,
  Send,
  Check,
  X,
  AlertCircle,
  Loader2,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWeeklyTimesheet } from '../hooks/useTimesheet';
import {
  formatDuration,
  formatDecimalHours,
  TIMESHEET_STATUS
} from '../lib/timesheetService';

export const WeeklyTimesheetView = ({
  contractorId,
  techId,
  techName = 'Technician',
  isManager = false,
  onViewEntry
}) => {
  const [editingEntry, setEditingEntry] = useState(null);
  const [showAddEntry, setShowAddEntry] = useState(null); // Date for adding entry
  const [submitNotes, setSubmitNotes] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const {
    timesheet,
    weekStart,
    weekId,
    loading,
    error,
    submitting,
    canSubmit,
    isCurrentWeek,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    refresh,
    submit,
    editEntry,
    addEntry,
    removeEntry
  } = useWeeklyTimesheet(contractorId, techId);

  // Format date for display
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      [TIMESHEET_STATUS.DRAFT]: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Draft' },
      [TIMESHEET_STATUS.SUBMITTED]: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Submitted' },
      [TIMESHEET_STATUS.APPROVED]: { bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Approved' },
      [TIMESHEET_STATUS.REJECTED]: { bg: 'bg-red-100', text: 'text-red-600', label: 'Rejected' },
      [TIMESHEET_STATUS.PAID]: { bg: 'bg-purple-100', text: 'text-purple-600', label: 'Paid' }
    };
    const badge = badges[status] || badges[TIMESHEET_STATUS.DRAFT];
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  // Handle submit timesheet
  const handleSubmit = async () => {
    try {
      await submit(submitNotes);
      toast.success('Timesheet submitted for approval');
      setShowSubmitConfirm(false);
      setSubmitNotes('');
    } catch (err) {
      toast.error('Failed to submit timesheet');
    }
  };

  // Handle add manual entry
  const handleAddEntry = async (data) => {
    try {
      await addEntry(data, techId);
      toast.success('Entry added');
      setShowAddEntry(null);
    } catch (err) {
      toast.error(err.message || 'Failed to add entry');
    }
  };

  // Handle edit entry
  const handleEditEntry = async (entryId, updates) => {
    try {
      await editEntry(entryId, updates, techId);
      toast.success('Entry updated');
      setEditingEntry(null);
    } catch (err) {
      toast.error('Failed to update entry');
    }
  };

  // Handle delete entry
  const handleDeleteEntry = async (entryId) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await removeEntry(entryId, techId, 'Deleted by user');
      toast.success('Entry deleted');
    } catch (err) {
      toast.error('Failed to delete entry');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-xl text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700">{error}</p>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 text-sm text-red-600 hover:bg-red-100 rounded-lg"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{techName}'s Timesheet</h2>
          <div className="flex items-center gap-2 mt-1">
            {getStatusBadge(timesheet?.status)}
            <span className="text-sm text-slate-500">Week of {formatDate(weekStart)}</span>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousWeek}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={goToCurrentWeek}
            disabled={isCurrentWeek}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isCurrentWeek
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar size={16} className="inline mr-1" />
            This Week
          </button>

          <button
            onClick={goToNextWeek}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Weekly Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          icon={Clock}
          label="Total Hours"
          value={timesheet?.weeklyTotals?.totalHours?.toFixed(1) || '0'}
          color="blue"
        />
        <SummaryCard
          icon={Clock}
          label="Regular Hours"
          value={timesheet?.weeklyTotals?.regularHours?.toFixed(1) || '0'}
          color="emerald"
        />
        <SummaryCard
          icon={AlertCircle}
          label="Overtime"
          value={timesheet?.weeklyTotals?.overtimeHours?.toFixed(1) || '0'}
          color={timesheet?.weeklyTotals?.overtimeHours > 0 ? 'amber' : 'slate'}
        />
        <SummaryCard
          icon={Car}
          label="Travel Time"
          value={formatDecimalHours(timesheet?.weeklyTotals?.totalTravelMs)?.toFixed(1) || '0'}
          color="purple"
        />
      </div>

      {/* Daily Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Day</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clock In</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clock Out</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Work</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Break</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Travel</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {timesheet?.dailyTotals && Object.entries(timesheet.dailyTotals).map(([dateStr, day]) => (
                <React.Fragment key={dateStr}>
                  {/* Day Header Row */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={7} className="px-4 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{day.dayName}</span>
                          <span className="text-sm text-slate-500">{formatDate(day.date)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-slate-600">
                            <strong>{formatDecimalHours(day.totalWorkMs).toFixed(1)}</strong> hrs
                          </span>
                          {timesheet.status === TIMESHEET_STATUS.DRAFT && (
                            <button
                              onClick={() => setShowAddEntry(dateStr)}
                              className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                            >
                              <Plus size={14} />
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Entries */}
                  {day.entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-center text-sm text-slate-400">
                        No entries
                      </td>
                    </tr>
                  ) : (
                    day.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {entry.isManualEntry && (
                              <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                                Manual
                              </span>
                            )}
                            {entry.jobId && (
                              <span className="text-xs text-slate-500">Job</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {formatTime(entry.clockIn)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {formatTime(entry.clockOut)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-slate-900">
                          {formatDecimalHours(entry.totalWorkMs).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          {entry.totalBreakMs > 0 ? formatDuration(entry.totalBreakMs) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          {entry.totalTravelMs > 0 ? formatDuration(entry.totalTravelMs) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {timesheet.status === TIMESHEET_STATUS.DRAFT && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingEntry(entry)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Add Entry Form */}
                  {showAddEntry === dateStr && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 bg-emerald-50">
                        <AddEntryForm
                          date={dateStr}
                          onSave={handleAddEntry}
                          onCancel={() => setShowAddEntry(null)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rejection Reason */}
      {timesheet?.status === TIMESHEET_STATUS.REJECTED && timesheet?.rejectionReason && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Timesheet Rejected</p>
              <p className="text-sm text-red-700 mt-1">{timesheet.rejectionReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      {canSubmit && !isManager && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            <Send size={18} />
            Submit for Approval
          </button>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Submit Timesheet</h3>
            <p className="text-slate-600 mb-4">
              You're submitting <strong>{timesheet?.weeklyTotals?.totalHours?.toFixed(1)} hours</strong> for the week of {formatDate(weekStart)}.
            </p>

            <textarea
              value={submitNotes}
              onChange={(e) => setSubmitNotes(e.target.value)}
              placeholder="Add any notes for your manager (optional)"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
              rows={3}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 px-4 py-2 text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin mx-auto" />
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onSave={handleEditEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
};

/**
 * Summary Card
 */
const SummaryCard = ({ icon: Icon, label, value, color = 'slate' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-50 text-slate-600'
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Add Entry Form (inline)
 */
const AddEntryForm = ({ date, onSave, onCancel }) => {
  const [clockIn, setClockIn] = useState('09:00');
  const [clockOut, setClockOut] = useState('17:00');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const dateObj = new Date(date);

    const [inHours, inMinutes] = clockIn.split(':');
    const clockInDate = new Date(dateObj);
    clockInDate.setHours(parseInt(inHours), parseInt(inMinutes), 0, 0);

    const [outHours, outMinutes] = clockOut.split(':');
    const clockOutDate = new Date(dateObj);
    clockOutDate.setHours(parseInt(outHours), parseInt(outMinutes), 0, 0);

    onSave({
      date,
      clockIn: clockInDate.toISOString(),
      clockOut: clockOutDate.toISOString(),
      notes,
      reason: 'Manual entry'
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">In:</label>
        <input
          type="time"
          value={clockIn}
          onChange={(e) => setClockIn(e.target.value)}
          className="px-2 py-1 border border-slate-200 rounded-lg text-sm"
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">Out:</label>
        <input
          type="time"
          value={clockOut}
          onChange={(e) => setClockOut(e.target.value)}
          className="px-2 py-1 border border-slate-200 rounded-lg text-sm"
          required
        />
      </div>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        className="flex-1 px-2 py-1 border border-slate-200 rounded-lg text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg"
        >
          <Check size={18} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
        >
          <X size={18} />
        </button>
      </div>
    </form>
  );
};

/**
 * Edit Entry Modal
 */
const EditEntryModal = ({ entry, onSave, onClose }) => {
  const clockInDate = entry.clockIn?.toDate ? entry.clockIn.toDate() : new Date(entry.clockIn);
  const clockOutDate = entry.clockOut?.toDate ? entry.clockOut.toDate() : new Date(entry.clockOut);

  const [clockIn, setClockIn] = useState(
    `${String(clockInDate.getHours()).padStart(2, '0')}:${String(clockInDate.getMinutes()).padStart(2, '0')}`
  );
  const [clockOut, setClockOut] = useState(
    clockOutDate ? `${String(clockOutDate.getHours()).padStart(2, '0')}:${String(clockOutDate.getMinutes()).padStart(2, '0')}` : ''
  );
  const [notes, setNotes] = useState(entry.notes || '');
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const [inHours, inMinutes] = clockIn.split(':');
      const newClockIn = new Date(clockInDate);
      newClockIn.setHours(parseInt(inHours), parseInt(inMinutes), 0, 0);

      let newClockOut = null;
      if (clockOut) {
        const [outHours, outMinutes] = clockOut.split(':');
        newClockOut = new Date(clockOutDate || clockInDate);
        newClockOut.setHours(parseInt(outHours), parseInt(outMinutes), 0, 0);
      }

      await onSave(entry.id, {
        clockIn: newClockIn.toISOString(),
        clockOut: newClockOut?.toISOString() || null,
        notes,
        editReason
      });
    } catch (err) {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Time Entry</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Clock In</label>
              <input
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Clock Out</label>
              <input
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason for Edit <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="e.g., Forgot to clock out"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !editReason}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WeeklyTimesheetView;
