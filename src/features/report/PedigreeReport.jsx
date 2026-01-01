// src/features/report/PedigreeReport.jsx
// ============================================
// ENHANCED PROPERTY PEDIGREE REPORT
// Comprehensive home documentation with visualizations
// ============================================

import React, { useMemo } from 'react';
import { 
  Home, Calendar, DollarSign, Wrench, Shield, Award, 
  Printer, Clock, MapPin, PenTool, ShieldCheck, Users,
  Phone, Mail, FileText, AlertTriangle, CheckCircle
} from 'lucide-react';

// Import new visualization components
import { PropertyValueCard } from './components/PropertyValueCard';
import { WarrantyTimeline } from './components/WarrantyTimeline';
import { InvestmentBreakdown } from './components/InvestmentBreakdown';

// Import property data hook
import { useProperty } from '../../contexts/PropertyContext';

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDate = (dateStr) => {
  if (!dateStr) return '--';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return dateStr;
  }
};

const formatCurrency = (value) => {
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
};

// ============================================
// REPORT HEADER COMPONENT
// ============================================

const ReportHeader = ({ property, propertyData }) => {
  // Try to get address from property prop first, then fall back to propertyData
  const address = property?.address || {
    street: propertyData?.formattedAddress?.split(',')[0] || null,
    city: propertyData?.city || null,
    state: propertyData?.state || null,
    zip: propertyData?.zipCode || null,
  };
  
  const hasAddress = address.street || address.city;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white p-8 md:p-12">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        {/* Property Info */}
        <div>
          <div className="flex items-center gap-2 text-indigo-300 mb-2">
            <ShieldCheck size={20} />
            <span className="text-sm font-bold uppercase tracking-wider">Property Pedigree™</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2">
            {address.street || 'Your Property'}
          </h1>
          {hasAddress && (
            <p className="text-slate-300 flex items-center gap-2">
              <MapPin size={16} />
              {[address.city, address.state, address.zip].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        {/* Generated Date Badge */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <p className="text-xs text-indigo-300 uppercase tracking-widest font-bold mb-1">Report Generated</p>
          <p className="font-mono text-xl font-bold text-white">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// QUICK STATS BAR
// ============================================

const QuickStatsBar = ({ records, activeWarranties, uniqueContractors, totalInvestment }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50 print:bg-slate-50">
    <div className="p-6 text-center">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Items Tracked</p>
      <p className="text-3xl font-extrabold text-indigo-600">{records.length}</p>
    </div>
    <div className="p-6 text-center">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Investment</p>
      <p className="text-3xl font-extrabold text-emerald-600">{formatCurrency(totalInvestment)}</p>
    </div>
    <div className="p-6 text-center">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active Warranties</p>
      <p className="text-3xl font-extrabold text-blue-600">{activeWarranties}</p>
    </div>
    <div className="p-6 text-center">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Trusted Pros</p>
      <p className="text-3xl font-extrabold text-purple-600">{uniqueContractors}</p>
    </div>
  </div>
);

// ============================================
// MAJOR SYSTEMS HEALTH
// ============================================

const MajorSystemsHealth = ({ systemAges }) => {
  const systems = [
    { label: 'Roof', data: systemAges.roof, icon: Home, goodYears: 20 },
    { label: 'HVAC', data: systemAges.hvac, icon: Wrench, goodYears: 15 },
    { label: 'Water Heater', data: systemAges.waterHeater, icon: Clock, goodYears: 10 },
  ];

  return (
    <section className="print:break-inside-avoid">
      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
        <Award className="mr-3 text-indigo-600" size={24} />
        Major Systems Health
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {systems.map((sys) => {
          const age = sys.data?.age;
          const status = !age ? 'unknown' : age <= sys.goodYears * 0.5 ? 'excellent' : age <= sys.goodYears * 0.75 ? 'good' : 'aging';
          const statusConfig = {
            excellent: { color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Excellent' },
            good: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Good' },
            aging: { color: 'text-amber-600', bg: 'bg-amber-100', label: 'Aging' },
            unknown: { color: 'text-slate-400', bg: 'bg-slate-100', label: 'Not Tracked' },
          }[status];

          return (
            <div 
              key={sys.label} 
              className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${statusConfig.bg}`}>
                  <sys.icon size={20} className={statusConfig.color} />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{sys.label}</p>
              <p className="text-2xl font-extrabold text-slate-800">
                {sys.data ? `${sys.data.age} years` : 'Not tracked'}
              </p>
              {sys.data?.item && (
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {sys.data.item.brand && `${sys.data.item.brand} `}
                  {sys.data.item.model || ''}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ============================================
// CONTRACTOR DIRECTORY
// ============================================

const ContractorDirectory = ({ records }) => {
  const contractors = useMemo(() => {
    const byContractor = {};
    records.forEach(r => {
      if (!r.contractor || r.contractor.trim() === '') return;
      const key = r.contractor.toLowerCase().trim();
      if (!byContractor[key]) {
        byContractor[key] = {
          name: r.contractor,
          phone: r.contractorPhone || null,
          email: r.contractorEmail || null,
          jobs: [],
          categories: new Set(),
        };
      }
      byContractor[key].jobs.push(r);
      if (r.category) byContractor[key].categories.add(r.category);
      if (r.contractorPhone && !byContractor[key].phone) byContractor[key].phone = r.contractorPhone;
      if (r.contractorEmail && !byContractor[key].email) byContractor[key].email = r.contractorEmail;
    });
    return Object.values(byContractor).sort((a, b) => b.jobs.length - a.jobs.length);
  }, [records]);

  if (contractors.length === 0) return null;

  return (
    <section className="print:break-inside-avoid">
      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
        <Users className="mr-3 text-purple-600" size={24} />
        Trusted Contractor Directory
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contractors.slice(0, 6).map((contractor, idx) => (
          <div 
            key={idx}
            className="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-slate-800">{contractor.name}</h4>
                <p className="text-xs text-slate-500">
                  {contractor.jobs.length} job{contractor.jobs.length !== 1 ? 's' : ''} • 
                  {Array.from(contractor.categories).slice(0, 2).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {contractor.phone && (
                  <a 
                    href={`tel:${contractor.phone}`}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors print:hidden"
                  >
                    <Phone size={16} />
                  </a>
                )}
                {contractor.email && (
                  <a 
                    href={`mailto:${contractor.email}`}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors print:hidden"
                  >
                    <Mail size={16} />
                  </a>
                )}
              </div>
            </div>
            {/* Contact info for print */}
            <div className="hidden print:block mt-2 text-xs text-slate-500">
              {contractor.phone && <span className="mr-3">📞 {contractor.phone}</span>}
              {contractor.email && <span>✉️ {contractor.email}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ============================================
// CAPITAL IMPROVEMENTS TABLE
// ============================================

const CapitalImprovements = ({ records }) => {
  const improvements = useMemo(() => {
    return records
      .filter(r => (r.cost && parseFloat(r.cost) > 500) || ['Roof & Exterior', 'HVAC & Systems', 'Flooring'].includes(r.category))
      .sort((a, b) => new Date(b.dateInstalled) - new Date(a.dateInstalled))
      .slice(0, 10);
  }, [records]);

  if (improvements.length === 0) return null;

  return (
    <section className="print:break-inside-avoid">
      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
        <DollarSign className="mr-3 text-emerald-600" size={24} />
        Capital Improvements & Upgrades
      </h3>
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
            <tr>
              <th className="p-4">Date</th>
              <th className="p-4">Item / Project</th>
              <th className="p-4">Category</th>
              <th className="p-4 text-right">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {improvements.map((rec) => (
              <tr key={rec.id} className="hover:bg-slate-50/50">
                <td className="p-4 font-mono text-slate-500 text-xs">{formatDate(rec.dateInstalled)}</td>
                <td className="p-4">
                  <span className="font-bold text-slate-800">{rec.item}</span>
                  {rec.contractor && (
                    <span className="block text-xs font-normal text-slate-400 mt-0.5">
                      by {rec.contractor}
                    </span>
                  )}
                </td>
                <td className="p-4 text-slate-600">{rec.category}</td>
                <td className="p-4 text-right font-bold text-emerald-700">{formatCurrency(rec.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// ============================================
// COMPLETE HISTORY LOG
// ============================================

const HistoryLog = ({ records }) => {
  const timeline = useMemo(() => {
    return [...records].sort((a, b) => new Date(b.dateInstalled) - new Date(a.dateInstalled));
  }, [records]);

  return (
    <section>
      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
        <Calendar className="mr-3 text-slate-600" size={24} />
        Complete History Log
      </h3>
      <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pl-8 py-2">
        {timeline.map((rec) => (
          <div key={rec.id} className="relative group print:break-inside-avoid">
            {/* Timeline Dot */}
            <div className="absolute -left-[41px] top-1.5 h-5 w-5 rounded-full border-4 border-white bg-slate-300 group-hover:bg-indigo-500 transition-colors shadow-sm"></div>
            
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-2">
              <h4 className="font-bold text-slate-800 text-lg">{rec.item}</h4>
              <span className="font-mono text-xs text-slate-400">{formatDate(rec.dateInstalled)}</span>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600">
              <div className="flex flex-wrap gap-x-4 gap-y-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <span>{rec.category}</span>
                {rec.brand && <span>• {rec.brand} {rec.model}</span>}
                {rec.contractor && <span>• {rec.contractor}</span>}
              </div>
              {rec.notes ? (
                <p className="italic">"{rec.notes}"</p>
              ) : (
                <p className="text-slate-400 italic">No additional notes recorded.</p>
              )}
              
              {/* Warranty Badge */}
              {(rec.warranty || rec.warrantyDetails) && (
                <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2">
                  <Shield size={12} className="text-blue-500" />
                  <span className="text-xs text-blue-600">
                    {typeof rec.warranty === 'string' 
                      ? rec.warranty 
                      : rec.warrantyDetails?.partsMonths 
                        ? `${Math.floor(rec.warrantyDetails.partsMonths / 12)} year warranty`
                        : 'Warranty on file'
                    }
                  </span>
                </div>
              )}
              
              {/* Attachments */}
              {rec.attachments && rec.attachments.length > 0 && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200/60">
                  {rec.attachments.map((att, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-500">
                      <FileText size={10} className="mr-1" /> {att.type || 'Document'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ============================================
// REPORT FOOTER
// ============================================

const ReportFooter = () => (
  <div className="border-t border-slate-100 pt-8 text-center">
    <div className="inline-flex items-center gap-2 text-slate-400 text-sm font-medium mb-2">
      <ShieldCheck size={16} /> Authenticated by MyKrib
    </div>
    <p className="text-xs text-slate-400 max-w-2xl mx-auto leading-relaxed">
      This report is generated based on user-submitted data and records stored in the MyKrib Home Management Platform. 
      MyKrib verifies the existence of the digital record but does not physically inspect the property or guarantee accuracy of user-provided information.
    </p>
  </div>
);

// ============================================
// MAIN PEDIGREE REPORT COMPONENT
// ============================================

export const PedigreeReport = ({ property, records = [] }) => {
  // Get property data from context
  const { propertyData, isRealData } = useProperty();

  // Calculate system ages
  const systemAges = useMemo(() => {
    const calculateAge = (keywords) => {
      const items = records.filter(r => 
        r.item && keywords.some(k => r.item.toLowerCase().includes(k)) && r.dateInstalled
      );
      if (items.length === 0) return null;
      const latest = items.sort((a, b) => new Date(b.dateInstalled) - new Date(a.dateInstalled))[0];
      const age = new Date().getFullYear() - new Date(latest.dateInstalled).getFullYear();
      return { age, item: latest };
    };

    return {
      hvac: calculateAge(['hvac', 'ac', 'air condition', 'furnace', 'heat pump']),
      roof: calculateAge(['roof', 'shingle']),
      waterHeater: calculateAge(['water heater', 'hot water']),
    };
  }, [records]);

  // Calculate active warranties
  const activeWarranties = useMemo(() => {
    return records.filter(r => {
      const warranty = r.warrantyDetails || r.warranty;
      if (!warranty) return false;
      
      if (typeof warranty === 'object' && warranty.partsMonths) {
        const startDate = new Date(warranty.startDate || r.dateInstalled);
        const monthsElapsed = (new Date().getFullYear() - startDate.getFullYear()) * 12 + 
                             (new Date().getMonth() - startDate.getMonth());
        return warranty.partsMonths > monthsElapsed;
      }
      
      // For string warranties, assume active if present
      return typeof warranty === 'string' && warranty.trim() !== '';
    }).length;
  }, [records]);

  // Calculate unique contractors
  const uniqueContractors = useMemo(() => {
    return new Set(records.map(r => r.contractor).filter(Boolean)).size;
  }, [records]);

  // Calculate total investment
  const totalInvestment = useMemo(() => {
    return records.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
  }, [records]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 print:pb-0 print:max-w-none">
      
      {/* Action Bar (Hidden when printing) */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm print:hidden">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Property Pedigree™</h2>
          <p className="text-sm text-slate-500">Official history report for insurance or resale.</p>
        </div>
        <button 
          onClick={() => window.print()} 
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
        >
          <Printer size={18} />
          Print / Save PDF
        </button>
      </div>

      {/* REPORT DOCUMENT */}
      <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:border-none">
        
        {/* 1. HEADER */}
        <ReportHeader property={property} propertyData={propertyData} />

        {/* 2. QUICK STATS BAR */}
        <QuickStatsBar 
          records={records}
          activeWarranties={activeWarranties}
          uniqueContractors={uniqueContractors}
          totalInvestment={totalInvestment}
        />

        {/* REPORT CONTENT */}
        <div className="p-8 md:p-12 space-y-12 print:p-8 print:space-y-8">
          
          {/* 3. PROPERTY VALUE CARD - Only shows with real RentCast data */}
          <PropertyValueCard propertyData={propertyData} />

          {/* 4. WARRANTY TIMELINE */}
          <WarrantyTimeline records={records} />

          {/* 5. INVESTMENT BREAKDOWN */}
          <InvestmentBreakdown records={records} />

          {/* 6. MAJOR SYSTEMS HEALTH */}
          <MajorSystemsHealth systemAges={systemAges} />

          {/* 7. CONTRACTOR DIRECTORY */}
          <ContractorDirectory records={records} />

          {/* 8. CAPITAL IMPROVEMENTS */}
          <CapitalImprovements records={records} />

          {/* 9. COMPLETE HISTORY LOG */}
          <HistoryLog records={records} />

          {/* 10. FOOTER */}
          <ReportFooter />

        </div>
      </div>
    </div>
  );
};

export default PedigreeReport;
