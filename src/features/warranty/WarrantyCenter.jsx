// ============================================
// 🛡️ WARRANTY CENTER - Krib Feature
// ============================================
// A dedicated warranty dashboard showing coverage status,
// time remaining, contact info, and proactive alerts.

import React, { useState, useMemo } from 'react';

// ============================================
// SAMPLE DATA (demonstrates the enhanced schema)
// ============================================
const SAMPLE_WARRANTIES = [
  {
    id: '1',
    itemName: 'Trane XR14 Heat Pump',
    category: 'HVAC',
    installDate: '2022-10-15',
    warranty: {
      hasCoverage: true,
      type: 'parts_and_labor',
      partsMonths: 120,    // 10 years
      laborMonths: 12,     // 1 year
      startDate: '2022-10-15',
      provider: 'manufacturer',
      contactName: 'Trane Warranty Services',
      contactPhone: '1-800-945-5884',
      contactEmail: null,
      registrationNumber: 'TRN-2022-88441',
      transferable: true,
      requiresService: true,
      notes: 'Annual professional service required to maintain coverage'
    }
  },
  {
    id: '2',
    itemName: 'Rheem Water Heater',
    category: 'Plumbing',
    installDate: '2021-03-20',
    warranty: {
      hasCoverage: true,
      type: 'parts_only',
      partsMonths: 72,     // 6 years
      laborMonths: 0,
      startDate: '2021-03-20',
      provider: 'manufacturer',
      contactName: 'Rheem Consumer Services',
      contactPhone: '1-800-432-8373',
      contactEmail: 'warranty@rheem.com',
      registrationNumber: null,
      transferable: false,
      requiresService: false,
      notes: null
    }
  },
  {
    id: '3',
    itemName: 'Samsung Refrigerator',
    category: 'Appliances',
    installDate: '2024-06-01',
    warranty: {
      hasCoverage: true,
      type: 'parts_and_labor',
      partsMonths: 24,
      laborMonths: 24,
      startDate: '2024-06-01',
      provider: 'manufacturer',
      contactName: 'Samsung Support',
      contactPhone: '1-800-726-7864',
      contactEmail: null,
      registrationNumber: 'SAM-RF-2024-11928',
      transferable: false,
      requiresService: false,
      notes: null
    }
  },
  {
    id: '4',
    itemName: 'GAF Timberline Roof',
    category: 'Roofing',
    installDate: '2019-08-10',
    warranty: {
      hasCoverage: true,
      type: 'parts_only',
      partsMonths: 300,    // 25 years!
      laborMonths: 24,     // 2 years (expired)
      startDate: '2019-08-10',
      provider: 'manufacturer',
      contactName: 'GAF Warranty Dept',
      contactPhone: '1-877-423-7663',
      contactEmail: null,
      registrationNumber: 'GAF-2019-44821',
      transferable: true,
      requiresService: false,
      notes: 'Golden Pledge warranty - registered with GAF'
    }
  },
  {
    id: '5',
    itemName: 'Garbage Disposal',
    category: 'Plumbing',
    installDate: '2020-01-15',
    warranty: {
      hasCoverage: true,
      type: 'parts_and_labor',
      partsMonths: 36,
      laborMonths: 12,
      startDate: '2020-01-15',
      provider: 'contractor',
      contactName: 'Mike\'s Plumbing Co',
      contactPhone: '(555) 234-5678',
      contactEmail: 'service@mikesplumbing.com',
      registrationNumber: null,
      transferable: false,
      requiresService: false,
      notes: null
    }
  }
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

const calculateWarrantyStatus = (warranty, installDate) => {
  if (!warranty?.hasCoverage) {
    return { status: 'none', partsRemaining: 0, laborRemaining: 0 };
  }

  const now = new Date();
  const start = new Date(warranty.startDate || installDate);
  const monthsElapsed = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 30.44));

  const partsRemaining = Math.max(0, (warranty.partsMonths || 0) - monthsElapsed);
  const laborRemaining = Math.max(0, (warranty.laborMonths || 0) - monthsElapsed);

  // Determine overall status
  let status = 'expired';
  if (partsRemaining > 0 || laborRemaining > 0) {
    const minRemaining = Math.min(
      partsRemaining > 0 ? partsRemaining : Infinity,
      laborRemaining > 0 ? laborRemaining : Infinity
    );
    if (minRemaining <= 3) {
      status = 'critical';
    } else if (minRemaining <= 6) {
      status = 'expiring';
    } else {
      status = 'active';
    }
  }

  return { status, partsRemaining, laborRemaining, monthsElapsed };
};

const formatMonthsRemaining = (months) => {
  if (months <= 0) return 'Expired';
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} yr`;
  return `${years}y ${remainingMonths}m`;
};

const getStatusConfig = (status) => {
  const configs = {
    active: {
      label: 'Active',
      color: 'emerald',
      bg: 'bg-emerald-500',
      bgLight: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      ring: 'ring-emerald-500',
      icon: '✓'
    },
    expiring: {
      label: 'Expiring Soon',
      color: 'amber',
      bg: 'bg-amber-500',
      bgLight: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      ring: 'ring-amber-500',
      icon: '⚠'
    },
    critical: {
      label: 'Expires < 90 Days',
      color: 'rose',
      bg: 'bg-rose-500',
      bgLight: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      ring: 'ring-rose-500',
      icon: '!'
    },
    expired: {
      label: 'Expired',
      color: 'slate',
      bg: 'bg-slate-400',
      bgLight: 'bg-slate-50',
      text: 'text-slate-500',
      border: 'border-slate-200',
      ring: 'ring-slate-400',
      icon: '✗'
    },
    none: {
      label: 'No Warranty',
      color: 'slate',
      bg: 'bg-slate-300',
      bgLight: 'bg-slate-50',
      text: 'text-slate-400',
      border: 'border-slate-100',
      ring: 'ring-slate-300',
      icon: '—'
    }
  };
  return configs[status] || configs.none;
};

const getCoverageLabel = (type) => {
  const labels = {
    'parts_and_labor': 'Parts + Labor',
    'parts_only': 'Parts Only',
    'labor_only': 'Labor Only',
    'extended': 'Extended Coverage'
  };
  return labels[type] || 'Unknown';
};

const getCategoryIcon = (category) => {
  const icons = {
    'HVAC': '❄️',
    'Plumbing': '🔧',
    'Electrical': '⚡',
    'Appliances': '🏠',
    'Roofing': '🏗️',
    'Other': '📦'
  };
  return icons[category] || '📦';
};


// ============================================
// ARC GAUGE COMPONENT
// ============================================

const ArcGauge = ({ percentage, size = 80, strokeWidth = 8, status }) => {
  const config = getStatusConfig(status);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI; // Half circle
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size / 2 + 10 }}>
      <svg width={size} height={size / 2 + 10} className="transform -rotate-0">
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200"
          strokeLinecap="round"
        />
        {/* Foreground arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={config.text.replace('text-', 'text-').replace('700', '500')}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
    </div>
  );
};


// ============================================
// WARRANTY CARD COMPONENT
// ============================================

const WarrantyCard = ({ item, isExpanded, onToggle }) => {
  const { status, partsRemaining, laborRemaining } = calculateWarrantyStatus(
    item.warranty,
    item.installDate
  );
  const config = getStatusConfig(status);

  // Calculate percentage for gauge (based on parts warranty as primary)
  const totalParts = item.warranty?.partsMonths || 1;
  const partsPercentage = Math.min(100, (partsRemaining / totalParts) * 100);

  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl border-2 transition-all duration-300
        ${config.border} ${config.bgLight}
        ${isExpanded ? 'ring-2 ' + config.ring + '/30' : 'hover:shadow-lg hover:-translate-y-0.5'}
      `}
    >
      {/* Status indicator bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${config.bg}`} />

      <button
        onClick={onToggle}
        className="w-full text-left p-5 focus:outline-none"
      >
        <div className="flex items-start gap-4">
          {/* Category Icon */}
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center text-2xl
            ${status === 'active' ? 'bg-white shadow-sm' : 'bg-white/50'}
          `}>
            {getCategoryIcon(item.category)}
          </div>

          {/* Item Info */}
          <div className="flex-grow min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 truncate">{item.itemName}</h3>
                <p className="text-sm text-slate-500">{item.category}</p>
              </div>

              {/* Status Badge */}
              <span className={`
                shrink-0 px-3 py-1 rounded-full text-xs font-bold
                ${config.bg} text-white
              `}>
                {config.label}
              </span>
            </div>

            {/* Quick Stats */}
            <div className="mt-3 flex items-center gap-4">
              {partsRemaining > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">Parts</span>
                  <span className={`text-sm font-bold ${config.text}`}>
                    {formatMonthsRemaining(partsRemaining)}
                  </span>
                </div>
              )}
              {laborRemaining > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">Labor</span>
                  <span className={`text-sm font-bold ${config.text}`}>
                    {formatMonthsRemaining(laborRemaining)}
                  </span>
                </div>
              )}
              {partsRemaining === 0 && laborRemaining === 0 && (
                <span className="text-sm text-slate-400 italic">Coverage ended</span>
              )}
            </div>
          </div>

          {/* Mini Gauge */}
          <div className="hidden sm:block">
            <ArcGauge percentage={partsPercentage} size={64} strokeWidth={6} status={status} />
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-0 border-t border-slate-200/50 mt-0">
          <div className="pt-4 space-y-4">

            {/* Coverage Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Coverage Type</p>
                <p className="font-semibold text-slate-800 mt-1">{getCoverageLabel(item.warranty?.type)}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Provider</p>
                <p className="font-semibold text-slate-800 mt-1 capitalize">{item.warranty?.provider || 'Unknown'}</p>
              </div>
            </div>

            {/* Registration Number */}
            {item.warranty?.registrationNumber && (
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Registration #</p>
                <p className="font-mono font-semibold text-slate-800 mt-1">{item.warranty.registrationNumber}</p>
              </div>
            )}

            {/* Contact Section */}
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3">Contact for Claims</p>
              <p className="font-semibold text-slate-800">{item.warranty?.contactName}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.warranty?.contactPhone && (
                  <a
                    href={`tel:${item.warranty.contactPhone}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Call
                  </a>
                )}
                {item.warranty?.contactEmail && (
                  <a
                    href={`mailto:${item.warranty.contactEmail}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </a>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {item.warranty?.transferable && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Transferable
                </span>
              )}
              {item.warranty?.requiresService && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Service Required
                </span>
              )}
            </div>

            {/* Notes */}
            {item.warranty?.notes && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <p className="text-xs text-amber-800 italic">💡 {item.warranty.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// ============================================
// SUMMARY STAT CARD
// ============================================

const StatCard = ({ icon, value, label, color = 'slate', onClick, isActive }) => {
  const colorClasses = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-600'
  };

  return (
    <button
      onClick={onClick}
      className={`
        p-4 rounded-2xl border-2 transition-all text-left
        ${colorClasses[color]}
        ${isActive ? 'ring-2 ring-offset-2 ring-' + color + '-500 scale-105' : 'hover:scale-102 hover:shadow-md'}
      `}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</div>
    </button>
  );
};


// ============================================
// MAIN WARRANTY CENTER COMPONENT
// ============================================

export const WarrantyCenter = ({ records = [] }) => {
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  // Process warranties and calculate stats
  const processedItems = useMemo(() => {
    return records.map(item => ({
      ...item,
      ...calculateWarrantyStatus(item.warranty, item.installDate)
    }));
  }, [records]);

  // Calculate counts
  const counts = useMemo(() => {
    return processedItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      acc.total++;
      return acc;
    }, { total: 0, active: 0, expiring: 0, critical: 0, expired: 0 });
  }, [processedItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (filter === 'all') return processedItems;
    if (filter === 'attention') {
      return processedItems.filter(i => i.status === 'expiring' || i.status === 'critical');
    }
    return processedItems.filter(i => i.status === filter);
  }, [processedItems, filter]);

  // Sort: critical first, then expiring, then active, then expired
  const sortedItems = useMemo(() => {
    const order = { critical: 0, expiring: 1, active: 2, expired: 3, none: 4 };
    return [...filteredItems].sort((a, b) => order[a.status] - order[b.status]);
  }, [filteredItems]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Warranty Center</h1>
              <p className="text-sm text-slate-500">Track coverage, contact providers, never miss an expiration</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            icon="🛡️"
            value={counts.active}
            label="Active"
            color="emerald"
            onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}
            isActive={filter === 'active'}
          />
          <StatCard
            icon="⚠️"
            value={counts.expiring + counts.critical}
            label="Attention"
            color="amber"
            onClick={() => setFilter(filter === 'attention' ? 'all' : 'attention')}
            isActive={filter === 'attention'}
          />
          <StatCard
            icon="📋"
            value={counts.expired}
            label="Expired"
            color="slate"
            onClick={() => setFilter(filter === 'expired' ? 'all' : 'expired')}
            isActive={filter === 'expired'}
          />
          <StatCard
            icon="📦"
            value={counts.total}
            label="Total"
            color="slate"
            onClick={() => setFilter('all')}
            isActive={filter === 'all'}
          />
        </div>

        {/* Alert Banner (if items need attention) */}
        {(counts.critical > 0 || counts.expiring > 0) && filter !== 'attention' && (
          <button
            onClick={() => setFilter('attention')}
            className="w-full p-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl text-white flex items-center justify-between shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔔</span>
              <div className="text-left">
                <p className="font-bold">
                  {counts.critical > 0 && `${counts.critical} warranty expires soon!`}
                  {counts.critical === 0 && `${counts.expiring} warranties expiring in 6 months`}
                </p>
                <p className="text-sm text-white/80">Tap to review and take action</p>
              </div>
            </div>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {['all', 'active', 'attention', 'expired'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all
                ${filter === f
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }
              `}
            >
              {f === 'all' && 'All Items'}
              {f === 'active' && '✓ Active'}
              {f === 'attention' && '⚠ Needs Attention'}
              {f === 'expired' && 'Expired'}
            </button>
          ))}
        </div>

        {/* Warranty List */}
        <div className="space-y-3">
          {sortedItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-slate-500">No warranties match this filter</p>
            </div>
          ) : (
            sortedItems.map(item => (
              <WarrantyCard
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              />
            ))
          )}
        </div>

        {/* Empty State CTA */}
        {counts.total === 0 && (
          <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="text-5xl mb-4">🛡️</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No warranties tracked yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
              Add items with warranty info to see them here. Scan receipts to auto-extract coverage details.
            </p>
            <button className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
              Add Your First Item
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


// ============================================
// REVISED REPORT VITALS (No "Year Built" etc.)
// ============================================
// This replaces the old Property Vitals grid with
// data you ACTUALLY have access to.

export const RevisedReportVitals = ({
  records = [],
  warranties = [],
  contractors = []
}) => {
  // Calculate real stats from your data
  const totalInvestment = records.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
  const activeWarranties = warranties.filter(w => {
    const { status } = calculateWarrantyStatus(w.warranty, w.installDate);
    return status === 'active' || status === 'expiring';
  }).length;
  const uniqueContractors = new Set(records.map(r => r.contractor).filter(Boolean)).size;

  const formatCurrency = (val) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
      <div className="p-6 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Items Tracked</p>
        <p className="text-3xl font-black text-indigo-600">{records.length}</p>
      </div>
      <div className="p-6 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Invested</p>
        <p className="text-3xl font-black text-emerald-600">{formatCurrency(totalInvestment)}</p>
      </div>
      <div className="p-6 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Active Warranties</p>
        <p className="text-3xl font-black text-blue-600">{activeWarranties}</p>
      </div>
      <div className="p-6 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Trusted Pros</p>
        <p className="text-3xl font-black text-purple-600">{uniqueContractors}</p>
      </div>
    </div>
  );
};


// ============================================
// PROPOSED WARRANTY SCHEMA (for reference)
// ============================================
/*
  Current schema (just a string):
    warranty: "10 year parts, 1 year labor"
  
  Proposed enhanced schema:
    warranty: {
      hasCoverage: boolean,
      type: 'parts_and_labor' | 'parts_only' | 'labor_only' | 'extended',
      partsMonths: number,        // Duration in months
      laborMonths: number,        // Duration in months
      startDate: string,          // ISO date, usually = installDate
      provider: 'manufacturer' | 'contractor' | 'third_party',
      contactName: string,
      contactPhone: string | null,
      contactEmail: string | null,
      registrationNumber: string | null,
      transferable: boolean,
      requiresService: boolean,   // e.g., "annual service required"
      notes: string | null
    }
  
  Migration strategy:
    1. Keep the legacy `warranty` string field
    2. Add new `warrantyDetails` object field
    3. AI scanner attempts to parse into structured format
    4. UI shows structured data when available, falls back to string
*/

export default WarrantyCenter;
