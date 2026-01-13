// src/features/report/components/WarrantyTimeline.jsx
// ============================================
// WARRANTY TIMELINE VISUALIZATION
// Interactive horizontal bar chart showing warranty coverage
// Web: Click to expand details
// Print: All expanded, static view
// ============================================

import React, { useState, useMemo } from 'react';
import { Shield, AlertTriangle, Check, Clock, ChevronDown, ChevronUp, Phone, FileText } from 'lucide-react';

// ============================================
// WARRANTY CALCULATION HELPERS
// ============================================

const calculateWarrantyStatus = (warranty, installDate) => {
  if (!warranty) {
    return { status: 'none', partsRemaining: 0, laborRemaining: 0, percentRemaining: 0 };
  }

  const isStructured = typeof warranty === 'object' && warranty !== null;

  // Parse dates
  const startDate = new Date(isStructured ? (warranty.startDate || installDate) : installDate);
  const now = new Date();
  const monthsElapsed = Math.max(0,
    (now.getFullYear() - startDate.getFullYear()) * 12 +
    (now.getMonth() - startDate.getMonth())
  );

  // Get durations
  let partsMonths = 0;
  let laborMonths = 0;

  if (isStructured) {
    partsMonths = warranty.partsMonths || 0;
    laborMonths = warranty.laborMonths || 0;
  } else if (typeof warranty === 'string') {
    // Parse string like "10 year parts, 1 year labor"
    // Regex improvements to handle "warranty on labor", "limited warranty", etc.
    const partsMatch = warranty.match(/(\d+)\s*years?[\s\w]*(?:parts|shingles|materials|composition|limited)/i);
    const laborMatch = warranty.match(/(\d+)\s*years?[\s\w]*labor/i);
    const genericMatch = warranty.match(/(\d+)\s*years?/i);


    if (partsMatch) partsMonths = parseInt(partsMatch[1]) * 12;
    if (laborMatch) laborMonths = parseInt(laborMatch[1]) * 12;

    // Fallback: if we found a generic "50 years" but didn't explicitly find "parts" or "labor" keywords,
    // assume it's the main parts coverage (unless we already found parts coverage)
    if (!partsMatch && !laborMatch && genericMatch) {
      partsMonths = parseInt(genericMatch[1]) * 12;
    }
    // Edge case: We found labor, but no specific parts keyword, but there is a generic number left?
    // For now, this logic is safe for "50 year shingles, 10 year labor" -> parts gets 50 (via partsMatch/shingles), labor gets 10.
  }

  const partsRemaining = Math.max(0, partsMonths - monthsElapsed);
  const laborRemaining = Math.max(0, laborMonths - monthsElapsed);
  const maxTotal = Math.max(partsMonths, laborMonths);
  const maxRemaining = Math.max(partsRemaining, laborRemaining);
  const percentRemaining = maxTotal > 0 ? (maxRemaining / maxTotal) * 100 : 0;

  // Determine status
  let status = 'active';
  if (maxRemaining === 0) status = 'expired';
  else if (maxRemaining <= 6) status = 'critical';
  else if (maxRemaining <= 12) status = 'expiring';

  return {
    status,
    partsRemaining,
    laborRemaining,
    partsMonths,
    laborMonths,
    percentRemaining,
    monthsElapsed,
    startDate,
  };
};

const formatDuration = (months) => {
  if (months <= 0) return 'Expired';
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remaining = months % 12;
    if (remaining > 0) return `${years}y ${remaining}mo`;
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
  return `${months} month${months !== 1 ? 's' : ''}`;
};

const STATUS_CONFIG = {
  active: {
    color: 'bg-emerald-500',
    lightBg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    label: 'Active',
    icon: Check,
  },
  expiring: {
    color: 'bg-amber-500',
    lightBg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    label: 'Expiring Soon',
    icon: Clock,
  },
  critical: {
    color: 'bg-red-500',
    lightBg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    label: 'Critical',
    icon: AlertTriangle,
  },
  expired: {
    color: 'bg-slate-300',
    lightBg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-500',
    label: 'Expired',
    icon: Shield,
  },
  none: {
    color: 'bg-slate-200',
    lightBg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-400',
    label: 'No Warranty',
    icon: Shield,
  },
};

// ============================================
// INDIVIDUAL WARRANTY BAR COMPONENT
// ============================================

const WarrantyBar = ({ item, isExpanded, onToggle, isPrintMode = false }) => {
  const warranty = item.warrantyDetails || item.warranty;
  const calc = calculateWarrantyStatus(warranty, item.dateInstalled);
  const config = STATUS_CONFIG[calc.status];
  const StatusIcon = config.icon;

  const isStructured = typeof warranty === 'object' && warranty !== null;

  // Always expanded in print mode
  const showExpanded = isPrintMode || isExpanded;

  return (
    <div className={`rounded-xl border ${config.border} ${config.lightBg} overflow-hidden transition-all print:break-inside-avoid`}>
      {/* Main Bar Row */}
      <button
        onClick={() => !isPrintMode && onToggle?.()}
        className={`w-full p-4 flex items-center gap-4 text-left ${!isPrintMode ? 'hover:bg-white/50 cursor-pointer' : ''} print:cursor-default`}
      >
        {/* Status Icon */}
        <div className={`shrink-0 w-10 h-10 rounded-xl ${config.color} flex items-center justify-center`}>
          <StatusIcon size={20} className="text-white" />
        </div>

        {/* Item Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-800 truncate">{item.item}</h4>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.color} text-white`}>
              {config.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {item.brand && `${item.brand} `}{item.model && item.model}
            {!item.brand && !item.model && item.category}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="hidden sm:block flex-1 max-w-[200px]">
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${config.color} rounded-full transition-all duration-500`}
              style={{ width: `${Math.max(calc.percentRemaining, 2)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1 text-right">
            {calc.status === 'expired' ? 'Coverage ended' : `${formatDuration(Math.max(calc.partsRemaining, calc.laborRemaining))} left`}
          </p>
        </div>

        {/* Expand Arrow (hidden in print) */}
        {!isPrintMode && (
          <div className="shrink-0 text-slate-400">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        )}
      </button>

      {/* Expanded Details */}
      {showExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-white/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {/* Parts Coverage */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parts Coverage</p>
              <p className="text-lg font-bold text-slate-800">
                {calc.partsMonths > 0 ? formatDuration(calc.partsMonths) : '--'}
              </p>
              {calc.partsRemaining > 0 && (
                <p className={`text-xs ${config.text}`}>
                  {formatDuration(calc.partsRemaining)} remaining
                </p>
              )}
            </div>

            {/* Labor Coverage */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Labor Coverage</p>
              <p className="text-lg font-bold text-slate-800">
                {calc.laborMonths > 0 ? formatDuration(calc.laborMonths) : '--'}
              </p>
              {calc.laborRemaining > 0 && (
                <p className={`text-xs ${config.text}`}>
                  {formatDuration(calc.laborRemaining)} remaining
                </p>
              )}
            </div>

            {/* Start Date */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Coverage Started</p>
              <p className="text-lg font-bold text-slate-800">
                {item.dateInstalled
                  ? new Date(item.dateInstalled).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : '--'
                }
              </p>
            </div>

            {/* Expiration */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expires</p>
              <p className={`text-lg font-bold ${calc.status === 'expired' ? 'text-slate-400' : config.text}`}>
                {calc.partsMonths > 0 && item.dateInstalled
                  ? (() => {
                    const expDate = new Date(item.dateInstalled);
                    expDate.setMonth(expDate.getMonth() + Math.max(calc.partsMonths, calc.laborMonths));
                    return expDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                  })()
                  : '--'
                }
              </p>
            </div>
          </div>

          {/* Additional Info */}
          {isStructured && (warranty.transferable || warranty.requiresService || warranty.contactPhone || warranty.registrationNumber) && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-3">
              {warranty.transferable && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                  <Check size={12} /> Transferable
                </span>
              )}
              {warranty.requiresService && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                  <Clock size={12} /> Annual service required
                </span>
              )}
              {warranty.contactPhone && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                  <Phone size={12} /> {warranty.contactPhone}
                </span>
              )}
              {warranty.registrationNumber && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                  <FileText size={12} /> Reg: {warranty.registrationNumber}
                </span>
              )}
            </div>
          )}

          {/* Notes */}
          {isStructured && warranty.notes && (
            <p className="mt-3 text-sm text-slate-500 italic">
              "{warranty.notes}"
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN WARRANTY TIMELINE COMPONENT
// ============================================

export const WarrantyTimeline = ({ records, className = '' }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [isPrintMode, setIsPrintMode] = useState(false);

  // Detect print mode
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('print');
    setIsPrintMode(mediaQuery.matches);

    const handler = (e) => setIsPrintMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Filter records with warranty info and calculate status
  const warrantyItems = useMemo(() => {
    return records
      .filter(r => r.warranty || r.warrantyDetails)
      .map(r => {
        const calc = calculateWarrantyStatus(r.warrantyDetails || r.warranty, r.dateInstalled);
        return { ...r, _calc: calc };
      })
      .sort((a, b) => {
        // Sort by status priority, then by remaining time
        const statusOrder = { critical: 0, expiring: 1, active: 2, expired: 3, none: 4 };
        const statusDiff = statusOrder[a._calc.status] - statusOrder[b._calc.status];
        if (statusDiff !== 0) return statusDiff;
        return a._calc.partsRemaining - b._calc.partsRemaining;
      });
  }, [records]);

  // Summary stats
  const stats = useMemo(() => {
    const counts = { active: 0, expiring: 0, critical: 0, expired: 0 };
    warrantyItems.forEach(item => {
      if (counts[item._calc.status] !== undefined) {
        counts[item._calc.status]++;
      }
    });
    return counts;
  }, [warrantyItems]);

  if (warrantyItems.length === 0) {
    return (
      <section className={`print:break-inside-avoid ${className}`}>
        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
          <Shield className="mr-3 text-blue-600" size={24} />
          Warranty Coverage
        </h3>
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center">
          <Shield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No warranty information recorded.</p>
          <p className="text-xs text-slate-400 mt-1">Add warranty details when scanning receipts.</p>
        </div>
      </section>
    );
  }

  const needsAttention = stats.critical + stats.expiring;

  return (
    <section className={`print:break-inside-avoid ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-xl font-bold text-slate-900 flex items-center">
          <Shield className="mr-3 text-blue-600" size={24} />
          Warranty Coverage
        </h3>

        {/* Summary Badges */}
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
            {stats.active} Active
          </span>
          {needsAttention > 0 && (
            <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center gap-1">
              <AlertTriangle size={12} />
              {needsAttention} Need Attention
            </span>
          )}
          {stats.expired > 0 && (
            <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
              {stats.expired} Expired
            </span>
          )}
        </div>
      </div>

      {/* Critical Alert */}
      {stats.critical > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold text-red-800">
              {stats.critical} warrant{stats.critical !== 1 ? 'ies expire' : 'y expires'} within 6 months
            </p>
            <p className="text-sm text-red-600">
              Consider scheduling repairs or purchasing extended coverage.
            </p>
          </div>
        </div>
      )}

      {/* Warranty List */}
      <div className="space-y-3">
        {warrantyItems.map((item) => (
          <WarrantyBar
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            isPrintMode={isPrintMode}
          />
        ))}
      </div>

      {/* Legend (print only) */}
      <div className="hidden print:flex mt-4 pt-4 border-t border-slate-200 justify-center gap-6 text-xs">
        {Object.entries(STATUS_CONFIG).slice(0, 4).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${config.color}`} />
            <span className="text-slate-600">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Click hint (web only) */}
      <p className="mt-3 text-xs text-slate-400 text-center print:hidden">
        Click any item to expand details
      </p>
    </section>
  );
};

export default WarrantyTimeline;
