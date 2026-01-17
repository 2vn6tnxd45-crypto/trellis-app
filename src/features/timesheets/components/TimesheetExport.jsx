/**
 * TimesheetExport Component
 * Export timesheets to CSV for payroll systems
 */

import React, { useState } from 'react';
import {
  Download,
  Calendar,
  Users,
  FileText,
  CheckCircle,
  Loader2,
  Filter,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTimesheetExport } from '../hooks/useTimesheet';
import { getWeekStart, getWeekEnd } from '../lib/timesheetService';

export const TimesheetExport = ({
  contractorId,
  teamMembers = []
}) => {
  const [dateRange, setDateRange] = useState('last_week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedTech, setSelectedTech] = useState('all');
  const [includeDetails, setIncludeDetails] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { exportCSV, exporting, error } = useTimesheetExport(contractorId);

  // Calculate date ranges
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case 'this_week': {
        return {
          startDate: getWeekStart(today),
          endDate: getWeekEnd(today)
        };
      }
      case 'last_week': {
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        return {
          startDate: getWeekStart(lastWeek),
          endDate: getWeekEnd(lastWeek)
        };
      }
      case 'last_2_weeks': {
        const twoWeeksAgo = new Date(today);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        return {
          startDate: getWeekStart(twoWeeksAgo),
          endDate: getWeekEnd(today)
        };
      }
      case 'this_month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
          startDate: monthStart,
          endDate: monthEnd
        };
      }
      case 'last_month': {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          startDate: lastMonthStart,
          endDate: lastMonthEnd
        };
      }
      case 'custom': {
        return {
          startDate: customStartDate ? new Date(customStartDate) : getWeekStart(today),
          endDate: customEndDate ? new Date(customEndDate) : getWeekEnd(today)
        };
      }
      default:
        return {
          startDate: getWeekStart(today),
          endDate: getWeekEnd(today)
        };
    }
  };

  // Handle export
  const handleExport = async () => {
    const { startDate, endDate } = getDateRange();

    try {
      await exportCSV({
        startDate,
        endDate,
        techId: selectedTech === 'all' ? null : selectedTech,
        includeDetails,
        techs: teamMembers
      });
      toast.success('Timesheet exported successfully');
    } catch (err) {
      toast.error('Failed to export timesheet');
    }
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const { startDate, endDate } = getDateRange();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Export Timesheets</h2>
        <p className="text-slate-500 mt-1">
          Export timesheet data for payroll processing
        </p>
      </div>

      {/* Export Options Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <Calendar size={16} className="inline mr-2" />
            Date Range
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { value: 'this_week', label: 'This Week' },
              { value: 'last_week', label: 'Last Week' },
              { value: 'last_2_weeks', label: 'Last 2 Weeks' },
              { value: 'this_month', label: 'This Month' },
              { value: 'last_month', label: 'Last Month' },
              { value: 'custom', label: 'Custom Range' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  dateRange === option.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          {dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Selected Range Display */}
          <p className="text-sm text-slate-500 mt-2">
            Exporting: {formatDate(startDate)} - {formatDate(endDate)}
          </p>
        </div>

        {/* Team Member Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <Users size={16} className="inline mr-2" />
            Team Member
          </label>
          <div className="relative">
            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Team Members</option>
              {teamMembers.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={20}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </div>

        {/* Export Format */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <FileText size={16} className="inline mr-2" />
            Export Format
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="format"
                checked={!includeDetails}
                onChange={() => setIncludeDetails(false)}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <p className="font-medium text-slate-900">Summary (Weekly)</p>
                <p className="text-sm text-slate-500">
                  One row per tech per week with total hours
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="format"
                checked={includeDetails}
                onChange={() => setIncludeDetails(true)}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <p className="font-medium text-slate-900">Detailed (Daily)</p>
                <p className="text-sm text-slate-500">
                  One row per time entry with clock in/out times
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-medium text-slate-900">Export Preview</p>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-emerald-600 hover:text-emerald-700"
            >
              {showPreview ? 'Hide' : 'Show'} sample
            </button>
          </div>

          {showPreview && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    {includeDetails ? (
                      <>
                        <th className="px-2 py-1">Date</th>
                        <th className="px-2 py-1">Technician</th>
                        <th className="px-2 py-1">Clock In</th>
                        <th className="px-2 py-1">Clock Out</th>
                        <th className="px-2 py-1">Work Hours</th>
                      </>
                    ) : (
                      <>
                        <th className="px-2 py-1">Week Starting</th>
                        <th className="px-2 py-1">Technician</th>
                        <th className="px-2 py-1">Regular Hours</th>
                        <th className="px-2 py-1">Overtime Hours</th>
                        <th className="px-2 py-1">Total Hours</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {includeDetails ? (
                    <>
                      <tr>
                        <td className="px-2 py-1">1/15/2024</td>
                        <td className="px-2 py-1">John Smith</td>
                        <td className="px-2 py-1">8:00 AM</td>
                        <td className="px-2 py-1">5:00 PM</td>
                        <td className="px-2 py-1">9.00</td>
                      </tr>
                      <tr className="text-slate-400">
                        <td className="px-2 py-1">...</td>
                        <td className="px-2 py-1">...</td>
                        <td className="px-2 py-1">...</td>
                        <td className="px-2 py-1">...</td>
                        <td className="px-2 py-1">...</td>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr>
                        <td className="px-2 py-1">1/14/2024</td>
                        <td className="px-2 py-1">John Smith</td>
                        <td className="px-2 py-1">40.00</td>
                        <td className="px-2 py-1">5.50</td>
                        <td className="px-2 py-1">45.50</td>
                      </tr>
                      <tr className="text-slate-400">
                        <td className="px-2 py-1">...</td>
                        <td className="px-2 py-1">...</td>
                        <td className="px-2 py-1">...</td>
                        <td className="px-2 py-1">...</td>
                        <td className="px-2 py-1">...</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Generating CSV...
            </>
          ) : (
            <>
              <Download size={20} />
              Export to CSV
            </>
          )}
        </button>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}
      </div>

      {/* Common Payroll Integrations */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">Payroll System Compatibility</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { name: 'QuickBooks', compatible: true },
            { name: 'Gusto', compatible: true },
            { name: 'ADP', compatible: true },
            { name: 'Paychex', compatible: true }
          ].map((system) => (
            <div
              key={system.name}
              className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl"
            >
              <CheckCircle size={16} className="text-emerald-500" />
              <span className="text-sm text-slate-700">{system.name}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-500 mt-4">
          The exported CSV is compatible with most payroll systems. You may need to map columns during import.
        </p>
      </div>
    </div>
  );
};

/**
 * Quick Export Button
 */
export const QuickExportButton = ({ contractorId, teamMembers = [] }) => {
  const { exportCSV, exporting } = useTimesheetExport(contractorId);

  const handleQuickExport = async () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    try {
      await exportCSV({
        startDate: getWeekStart(lastWeek),
        endDate: getWeekEnd(lastWeek),
        includeDetails: false,
        techs: teamMembers
      });
      toast.success('Last week\'s timesheets exported');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  return (
    <button
      onClick={handleQuickExport}
      disabled={exporting}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
    >
      {exporting ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Download size={16} />
      )}
      Export Last Week
    </button>
  );
};

export default TimesheetExport;
