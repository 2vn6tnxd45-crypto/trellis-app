/**
 * PayrollReport Component
 * Weekly payroll summary with hours and pay calculations
 */

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Edit3,
  Save,
  Loader2,
  Printer
} from 'lucide-react';
import { usePayrollSummary } from '../hooks/useTimesheet';
import {
  getWeekStart,
  getWeekId,
  formatDecimalHours,
  OVERTIME_THRESHOLD_HOURS,
  OVERTIME_MULTIPLIER
} from '../lib/timesheetService';

export const PayrollReport = ({
  contractorId,
  teamMembers = [],
  defaultHourlyRate = 25
}) => {
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [techRates, setTechRates] = useState({});
  const [editingRate, setEditingRate] = useState(null);
  const [tempRate, setTempRate] = useState('');

  const weekId = getWeekId(weekStart);

  // Initialize rates from team members
  useEffect(() => {
    const rates = {};
    teamMembers.forEach(tech => {
      rates[tech.id] = tech.hourlyRate || defaultHourlyRate;
    });
    setTechRates(rates);
  }, [teamMembers, defaultHourlyRate]);

  const { summary, loading, error } = usePayrollSummary(contractorId, weekId, techRates);

  // Week navigation
  const goToPreviousWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const goToCurrentWeek = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle rate edit
  const startEditRate = (techId, currentRate) => {
    setEditingRate(techId);
    setTempRate(currentRate.toString());
  };

  const saveRate = (techId) => {
    const rate = parseFloat(tempRate);
    if (!isNaN(rate) && rate > 0) {
      setTechRates(prev => ({
        ...prev,
        [techId]: rate
      }));
    }
    setEditingRate(null);
    setTempRate('');
  };

  // Print report
  const handlePrint = () => {
    window.print();
  };

  const isCurrentWeek = getWeekId(weekStart) === getWeekId(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Payroll Report</h2>
          <p className="text-slate-500 mt-1">
            Week of {formatDate(weekStart)} - {formatDate(weekEnd)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            <Printer size={16} />
            Print
          </button>

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

      {/* Print Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">Payroll Report</h1>
        <p className="text-slate-600">
          Week of {formatDate(weekStart)} - {formatDate(weekEnd)}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        <SummaryCard
          icon={Users}
          label="Team Members"
          value={summary?.techCount || 0}
          color="blue"
        />
        <SummaryCard
          icon={Clock}
          label="Total Hours"
          value={summary?.totals?.totalHours?.toFixed(1) || '0'}
          color="emerald"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Overtime Hours"
          value={summary?.totals?.totalOvertimeHours?.toFixed(1) || '0'}
          color="amber"
          highlight={summary?.totals?.totalOvertimeHours > 0}
        />
        <SummaryCard
          icon={DollarSign}
          label="Total Payroll"
          value={formatCurrency(summary?.totals?.totalPay)}
          color="purple"
        />
      </div>

      {/* Info Banner */}
      <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 print:hidden">
        <TrendingUp className="text-slate-400" size={20} />
        <p className="text-sm text-slate-600">
          Overtime calculated at <strong>{OVERTIME_MULTIPLIER}x</strong> rate after <strong>{OVERTIME_THRESHOLD_HOURS} hours</strong> per week.
          Click on hourly rates to edit.
        </p>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:border-black">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 print:bg-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Technician
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                  Regular Hours
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                  Overtime Hours
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                  Total Hours
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase print:hidden">
                  Hourly Rate
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                  Regular Pay
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                  Overtime Pay
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                  Total Pay
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary?.items?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No timesheet data for this week
                  </td>
                </tr>
              ) : (
                summary?.items?.map((item) => (
                  <tr key={item.techId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center print:hidden">
                          <Users size={16} className="text-slate-500" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{item.techName}</p>
                          <p className="text-xs text-slate-500 print:hidden">{item.techEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-900">
                      {item.regularHours?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={item.overtimeHours > 0 ? 'text-amber-600 font-medium' : 'text-slate-900'}>
                        {item.overtimeHours?.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-900">
                      {item.totalHours?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center print:hidden">
                      {editingRate === item.techId ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-slate-400">$</span>
                          <input
                            type="number"
                            value={tempRate}
                            onChange={(e) => setTempRate(e.target.value)}
                            className="w-16 px-2 py-1 border border-slate-200 rounded text-center"
                            autoFocus
                          />
                          <button
                            onClick={() => saveRate(item.techId)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Save size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditRate(item.techId, item.hourlyRate)}
                          className="flex items-center justify-center gap-1 text-slate-900 hover:text-emerald-600 mx-auto"
                        >
                          {formatCurrency(item.hourlyRate)}/hr
                          <Edit3 size={12} className="opacity-0 group-hover:opacity-100" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">
                      {formatCurrency(item.regularPay)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={item.overtimePay > 0 ? 'text-amber-600 font-medium' : 'text-slate-900'}>
                        {formatCurrency(item.overtimePay)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatCurrency(item.totalPay)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {summary?.items?.length > 0 && (
              <tfoot className="bg-slate-50 font-medium print:bg-slate-200">
                <tr>
                  <td className="px-4 py-3 text-slate-900">Totals</td>
                  <td className="px-4 py-3 text-center text-slate-900">
                    {summary?.totals?.totalRegularHours?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center text-amber-600">
                    {summary?.totals?.totalOvertimeHours?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-900">
                    {summary?.totals?.totalHours?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 print:hidden"></td>
                  <td className="px-4 py-3 text-right text-slate-900">
                    {formatCurrency(summary?.totals?.totalRegularPay)}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-600">
                    {formatCurrency(summary?.totals?.totalOvertimePay)}
                  </td>
                  <td className="px-4 py-3 text-right text-lg text-emerald-600">
                    {formatCurrency(summary?.totals?.totalPay)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Print Footer */}
      <div className="hidden print:block text-center text-sm text-slate-500 mt-8">
        <p>Generated on {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

/**
 * Summary Card
 */
const SummaryCard = ({ icon: Icon, label, value, color = 'slate', highlight = false }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-50 text-slate-600'
  };

  return (
    <div className={`bg-white rounded-xl border p-4 ${
      highlight ? 'border-amber-200 bg-amber-50' : 'border-slate-200'
    } print:border-black`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]} print:bg-slate-200`}>
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
 * Mini Payroll Summary
 */
export const PayrollMiniSummary = ({ contractorId, teamMembers = [] }) => {
  const weekId = getWeekId(new Date());
  const defaultRates = {};
  teamMembers.forEach(t => { defaultRates[t.id] = t.hourlyRate || 25; });

  const { summary, loading } = usePayrollSummary(contractorId, weekId, defaultRates);

  if (loading) {
    return <div className="animate-pulse bg-slate-100 rounded-xl h-24" />;
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-slate-900">This Week's Payroll</h3>
        <DollarSign className="text-emerald-500" size={20} />
      </div>
      <p className="text-3xl font-bold text-emerald-600">
        {formatCurrency(summary?.totals?.totalPay)}
      </p>
      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
        <span>{summary?.totals?.totalHours?.toFixed(1) || 0} hours</span>
        {summary?.totals?.totalOvertimeHours > 0 && (
          <span className="text-amber-600">
            +{summary?.totals?.totalOvertimeHours?.toFixed(1)} OT
          </span>
        )}
      </div>
    </div>
  );
};

export default PayrollReport;
