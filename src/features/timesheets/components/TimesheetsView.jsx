/**
 * TimesheetsView Component
 * Main timesheet dashboard for contractors
 */

import React, { useState } from 'react';
import {
  Clock,
  Users,
  FileText,
  DollarSign,
  CheckCircle,
  Download,
  Settings,
  RefreshCw,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

import { WeeklyTimesheetView } from './WeeklyTimesheetView';
import { TimesheetApproval, ApprovalStats } from './TimesheetApproval';
import { TimesheetExport, QuickExportButton } from './TimesheetExport';
import { PayrollReport, PayrollMiniSummary } from './PayrollReport';
import { TimeClockWidget } from './TimeClockWidget';
import { useTimesheetApproval } from '../hooks/useTimesheet';

export const TimesheetsView = ({
  contractorId,
  teamMembers = [],
  currentTechId = null, // If viewing as a tech
  currentTechName = 'Technician',
  isManager = true,
  currentJob = null,
  loading = false,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState(isManager ? 'approval' : 'my-timesheet');
  const [selectedTechId, setSelectedTechId] = useState(currentTechId || teamMembers[0]?.id);
  const [showTimeClock, setShowTimeClock] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { pendingCount } = useTimesheetApproval(contractorId);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
      toast.success('Data refreshed');
    } catch (err) {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get selected tech name
  const getSelectedTechName = () => {
    if (selectedTechId === currentTechId) return currentTechName;
    const tech = teamMembers.find(t => t.id === selectedTechId);
    return tech?.name || 'Technician';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading timesheets...</p>
        </div>
      </div>
    );
  }

  // Tab definitions based on role
  const tabs = isManager
    ? [
        { id: 'approval', label: 'Approval', icon: CheckCircle, badge: pendingCount > 0 ? pendingCount : null },
        { id: 'team', label: 'Team Timesheets', icon: Users },
        { id: 'payroll', label: 'Payroll', icon: DollarSign },
        { id: 'export', label: 'Export', icon: Download }
      ]
    : [
        { id: 'my-timesheet', label: 'My Timesheet', icon: Clock },
        { id: 'export', label: 'Export', icon: Download }
      ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="text-emerald-600" size={28} />
            Timesheets
          </h1>
          <p className="text-slate-500 mt-1">
            {isManager ? 'Manage team time tracking and payroll' : 'Track your work hours'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {isManager && <QuickExportButton contractorId={contractorId} teamMembers={teamMembers} />}

          {!isManager && currentTechId && (
            <button
              onClick={() => setShowTimeClock(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
            >
              <Clock size={18} />
              Time Clock
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats (Manager View) */}
      {isManager && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ApprovalStats contractorId={contractorId} />
          <PayrollMiniSummary contractorId={contractorId} teamMembers={teamMembers} />
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-slate-900">Team Members</h3>
              <Users className="text-blue-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-blue-600">{teamMembers.length}</p>
            <p className="text-sm text-slate-500 mt-1">Active technicians</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.badge && (
              <span className="px-1.5 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* My Timesheet (Tech View) */}
        {activeTab === 'my-timesheet' && currentTechId && (
          <WeeklyTimesheetView
            contractorId={contractorId}
            techId={currentTechId}
            techName={currentTechName}
            isManager={false}
          />
        )}

        {/* Approval Tab (Manager) */}
        {activeTab === 'approval' && isManager && (
          <TimesheetApproval
            contractorId={contractorId}
            approverName="Manager"
            teamMembers={teamMembers}
            onViewTimesheet={(timesheet) => {
              setSelectedTechId(timesheet.techId);
              setActiveTab('team');
            }}
          />
        )}

        {/* Team Timesheets Tab (Manager) */}
        {activeTab === 'team' && isManager && (
          <div className="space-y-6">
            {/* Tech Selector */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700">View timesheet for:</label>
              <select
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {teamMembers.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedTechId && (
              <WeeklyTimesheetView
                contractorId={contractorId}
                techId={selectedTechId}
                techName={getSelectedTechName()}
                isManager={true}
              />
            )}
          </div>
        )}

        {/* Payroll Tab (Manager) */}
        {activeTab === 'payroll' && isManager && (
          <PayrollReport
            contractorId={contractorId}
            teamMembers={teamMembers}
          />
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <TimesheetExport
            contractorId={contractorId}
            teamMembers={teamMembers}
          />
        )}
      </div>

      {/* Floating Time Clock Widget */}
      {showTimeClock && currentTechId && (
        <TimeClockWidget
          contractorId={contractorId}
          techId={currentTechId}
          currentJob={currentJob}
          position="bottom-right"
          onClockIn={() => toast.success('Clocked in!')}
          onClockOut={() => toast.success('Clocked out!')}
        />
      )}
    </div>
  );
};

/**
 * Timesheet Stats Widget
 */
export const TimesheetStatsWidget = ({ contractorId }) => {
  const { pendingCount } = useTimesheetApproval(contractorId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          pendingCount > 0 ? 'bg-amber-50' : 'bg-emerald-50'
        }`}>
          {pendingCount > 0 ? (
            <Clock className="text-amber-600" size={20} />
          ) : (
            <CheckCircle className="text-emerald-600" size={20} />
          )}
        </div>
        <div>
          {pendingCount > 0 ? (
            <>
              <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
              <p className="text-sm text-slate-500">Pending Timesheets</p>
            </>
          ) : (
            <>
              <p className="font-bold text-slate-900">All Clear</p>
              <p className="text-sm text-slate-500">No pending approvals</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimesheetsView;
