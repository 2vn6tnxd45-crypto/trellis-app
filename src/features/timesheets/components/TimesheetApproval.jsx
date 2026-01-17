/**
 * TimesheetApproval Component
 * Manager approval workflow for submitted timesheets
 */

import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Eye,
  CheckCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTimesheetApproval } from '../hooks/useTimesheet';
import { formatDecimalHours, TIMESHEET_STATUS } from '../lib/timesheetService';

export const TimesheetApproval = ({
  contractorId,
  approverName,
  teamMembers = [],
  onViewTimesheet
}) => {
  const [selectedTimesheets, setSelectedTimesheets] = useState([]);
  const [expandedTimesheet, setExpandedTimesheet] = useState(null);
  const [rejectingTimesheet, setRejectingTimesheet] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const {
    pendingTimesheets,
    pendingCount,
    loading,
    error,
    processing,
    approve,
    reject,
    bulkApprove
  } = useTimesheetApproval(contractorId);

  // Get team member name
  const getTechName = (techId) => {
    const tech = teamMembers.find(t => t.id === techId);
    return tech?.name || techId;
  };

  // Format date range
  const formatWeekRange = (weekStart, weekEnd) => {
    const start = weekStart?.toDate ? weekStart.toDate() : new Date(weekStart);
    const end = weekEnd?.toDate ? weekEnd.toDate() : new Date(weekEnd);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  // Toggle timesheet selection
  const toggleSelect = (timesheetId) => {
    setSelectedTimesheets(prev =>
      prev.includes(timesheetId)
        ? prev.filter(id => id !== timesheetId)
        : [...prev, timesheetId]
    );
  };

  // Select all
  const selectAll = () => {
    if (selectedTimesheets.length === pendingTimesheets.length) {
      setSelectedTimesheets([]);
    } else {
      setSelectedTimesheets(pendingTimesheets.map(ts => ts.id));
    }
  };

  // Handle approve single
  const handleApprove = async (timesheet) => {
    try {
      await approve(timesheet.techId, timesheet.weekId, approverName);
      toast.success(`Timesheet approved for ${getTechName(timesheet.techId)}`);
    } catch (err) {
      toast.error('Failed to approve timesheet');
    }
  };

  // Handle bulk approve
  const handleBulkApprove = async () => {
    const timesheetsToApprove = pendingTimesheets.filter(ts =>
      selectedTimesheets.includes(ts.id)
    );

    try {
      await bulkApprove(timesheetsToApprove, approverName);
      toast.success(`${timesheetsToApprove.length} timesheets approved`);
      setSelectedTimesheets([]);
    } catch (err) {
      toast.error('Failed to approve timesheets');
    }
  };

  // Handle reject
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      await reject(
        rejectingTimesheet.techId,
        rejectingTimesheet.weekId,
        approverName,
        rejectionReason
      );
      toast.success(`Timesheet rejected for ${getTechName(rejectingTimesheet.techId)}`);
      setRejectingTimesheet(null);
      setRejectionReason('');
    } catch (err) {
      toast.error('Failed to reject timesheet');
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Timesheet Approval</h2>
          <p className="text-slate-500 mt-1">
            {pendingCount} timesheet{pendingCount !== 1 ? 's' : ''} pending approval
          </p>
        </div>

        {selectedTimesheets.length > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50"
          >
            {processing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCheck size={18} />
            )}
            Approve Selected ({selectedTimesheets.length})
          </button>
        )}
      </div>

      {/* Empty State */}
      {pendingTimesheets.length === 0 ? (
        <div className="bg-slate-50 rounded-xl p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">All Caught Up!</h3>
          <p className="text-slate-600">No timesheets pending approval.</p>
        </div>
      ) : (
        <>
          {/* Select All */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedTimesheets.length === pendingTimesheets.length && pendingTimesheets.length > 0}
              onChange={selectAll}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-600">Select all</span>
          </div>

          {/* Pending Timesheets */}
          <div className="space-y-4">
            {pendingTimesheets.map((timesheet) => (
              <TimesheetCard
                key={timesheet.id}
                timesheet={timesheet}
                techName={getTechName(timesheet.techId)}
                weekRange={formatWeekRange(timesheet.weekStart, timesheet.weekEnd)}
                isSelected={selectedTimesheets.includes(timesheet.id)}
                isExpanded={expandedTimesheet === timesheet.id}
                processing={processing}
                onToggleSelect={() => toggleSelect(timesheet.id)}
                onToggleExpand={() =>
                  setExpandedTimesheet(
                    expandedTimesheet === timesheet.id ? null : timesheet.id
                  )
                }
                onApprove={() => handleApprove(timesheet)}
                onReject={() => setRejectingTimesheet(timesheet)}
                onView={() => onViewTimesheet?.(timesheet)}
              />
            ))}
          </div>
        </>
      )}

      {/* Rejection Modal */}
      {rejectingTimesheet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Reject Timesheet</h3>
            <p className="text-slate-600 mb-4">
              Rejecting timesheet for <strong>{getTechName(rejectingTimesheet.techId)}</strong>
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Please provide a reason for rejection..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              rows={3}
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRejectingTimesheet(null);
                  setRejectionReason('');
                }}
                className="flex-1 px-4 py-2 text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? (
                  <Loader2 size={18} className="animate-spin mx-auto" />
                ) : (
                  'Reject Timesheet'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Timesheet Card
 */
const TimesheetCard = ({
  timesheet,
  techName,
  weekRange,
  isSelected,
  isExpanded,
  processing,
  onToggleSelect,
  onToggleExpand,
  onApprove,
  onReject,
  onView
}) => {
  const hasOvertime = timesheet.overtimeHours > 0;

  return (
    <div className={`bg-white rounded-xl border-2 transition-all ${
      isSelected ? 'border-emerald-500 shadow-md' : 'border-slate-200'
    }`}>
      {/* Main Row */}
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />

          {/* Tech Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <User size={16} className="text-slate-500" />
              </div>
              <div>
                <p className="font-medium text-slate-900">{techName}</p>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Calendar size={14} />
                  {weekRange}
                </div>
              </div>
            </div>
          </div>

          {/* Hours Summary */}
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">
              {timesheet.totalHours?.toFixed(1) || 0}
            </p>
            <p className="text-sm text-slate-500">hours</p>
          </div>

          {/* Expand Toggle */}
          <button
            onClick={onToggleExpand}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 mt-3 pl-8">
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <Clock size={14} />
            <span>Regular: {timesheet.regularHours?.toFixed(1) || 0}h</span>
          </div>
          {hasOvertime && (
            <div className="flex items-center gap-1 text-sm text-amber-600">
              <AlertCircle size={14} />
              <span>Overtime: {timesheet.overtimeHours?.toFixed(1) || 0}h</span>
            </div>
          )}
          <div className="text-sm text-slate-500">
            {timesheet.entryCount || 0} entries
          </div>
        </div>

        {/* Tech Notes */}
        {timesheet.techNotes && (
          <div className="mt-3 pl-8 p-2 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              <strong>Note:</strong> {timesheet.techNotes}
            </p>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Regular Hours</p>
              <p className="font-medium text-slate-900">{timesheet.regularHours?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-slate-500">Overtime Hours</p>
              <p className={`font-medium ${hasOvertime ? 'text-amber-600' : 'text-slate-900'}`}>
                {timesheet.overtimeHours?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Travel Time</p>
              <p className="font-medium text-slate-900">
                {formatDecimalHours(timesheet.totalTravelMs)?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Submitted</p>
              <p className="font-medium text-slate-900">
                {timesheet.submittedAt?.toDate
                  ? timesheet.submittedAt.toDate().toLocaleDateString()
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onView}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
        >
          <Eye size={16} />
          View Details
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
          >
            <XCircle size={18} />
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {processing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle size={18} />
            )}
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Approval Stats Summary
 */
export const ApprovalStats = ({ contractorId }) => {
  const { pendingCount, loading } = useTimesheetApproval(contractorId);

  if (loading) {
    return (
      <div className="animate-pulse bg-slate-100 rounded-xl h-20" />
    );
  }

  return (
    <div className={`rounded-xl p-4 ${
      pendingCount > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'
    }`}>
      <div className="flex items-center gap-3">
        {pendingCount > 0 ? (
          <>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="text-amber-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
              <p className="text-sm text-slate-600">Pending Approval</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-emerald-600" size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-900">All Clear</p>
              <p className="text-sm text-slate-600">No pending timesheets</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TimesheetApproval;
