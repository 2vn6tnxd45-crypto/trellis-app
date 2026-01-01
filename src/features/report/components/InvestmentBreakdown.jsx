// src/features/report/components/InvestmentBreakdown.jsx
// ============================================
// INVESTMENT BREAKDOWN VISUALIZATION
// SVG donut chart showing spending by category
// Pure CSS/SVG - works in both web and PDF print
// ============================================

import React, { useMemo, useState } from 'react';
import { DollarSign, TrendingUp, PieChart } from 'lucide-react';

// ============================================
// CATEGORY COLORS
// ============================================
const CATEGORY_COLORS = {
  'HVAC & Systems': { color: '#10b981', label: 'HVAC' },
  'Plumbing': { color: '#3b82f6', label: 'Plumbing' },
  'Electrical': { color: '#f59e0b', label: 'Electrical' },
  'Roof & Exterior': { color: '#8b5cf6', label: 'Roof & Exterior' },
  'Appliances': { color: '#ec4899', label: 'Appliances' },
  'Flooring': { color: '#14b8a6', label: 'Flooring' },
  'Kitchen & Bath': { color: '#f97316', label: 'Kitchen & Bath' },
  'Safety & Security': { color: '#ef4444', label: 'Safety' },
  'Windows & Doors': { color: '#06b6d4', label: 'Windows & Doors' },
  'Landscaping': { color: '#84cc16', label: 'Landscaping' },
  'Other': { color: '#64748b', label: 'Other' },
};

const getColorForCategory = (category) => {
  return CATEGORY_COLORS[category]?.color || CATEGORY_COLORS['Other'].color;
};

// ============================================
// DONUT CHART COMPONENT
// ============================================
const DonutChart = ({ data, total, hoveredIndex, onHover }) => {
  const size = 200;
  const strokeWidth = 35;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const centerX = size / 2;
  const centerY = size / 2;

  let cumulativePercent = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={centerX}
        cy={centerY}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={strokeWidth}
      />
      
      {/* Data segments */}
      {data.map((segment, index) => {
        const percent = segment.value / total;
        const dashLength = circumference * percent;
        const dashOffset = circumference * cumulativePercent;
        const isHovered = hoveredIndex === index;
        
        cumulativePercent += percent;

        return (
          <circle
            key={segment.category}
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={-dashOffset}
            strokeLinecap="butt"
            className="transition-all duration-200 cursor-pointer"
            style={{ 
              opacity: hoveredIndex === null || isHovered ? 1 : 0.5,
              filter: isHovered ? 'brightness(1.1)' : 'none'
            }}
            onMouseEnter={() => onHover?.(index)}
            onMouseLeave={() => onHover?.(null)}
          />
        );
      })}
    </svg>
  );
};

// ============================================
// LEGEND ITEM
// ============================================
const LegendItem = ({ segment, total, isHovered, onHover, index }) => {
  const percent = ((segment.value / total) * 100).toFixed(1);
  
  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg transition-all cursor-pointer ${
        isHovered ? 'bg-slate-100' : 'hover:bg-slate-50'
      }`}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div 
        className="w-4 h-4 rounded-full shrink-0"
        style={{ backgroundColor: segment.color }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">
          {segment.label}
        </p>
        <p className="text-xs text-slate-500">
          {segment.count} item{segment.count !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-slate-800">
          ${segment.value.toLocaleString()}
        </p>
        <p className="text-xs text-slate-400">
          {percent}%
        </p>
      </div>
    </div>
  );
};

// ============================================
// HORIZONTAL BAR (Alternative view for print)
// ============================================
const HorizontalBar = ({ segment, total, maxValue }) => {
  const percent = (segment.value / total) * 100;
  const barWidth = (segment.value / maxValue) * 100;
  
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-28 shrink-0">
        <p className="text-sm font-medium text-slate-700 truncate">{segment.label}</p>
      </div>
      <div className="flex-1">
        <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-500"
            style={{ 
              width: `${barWidth}%`,
              backgroundColor: segment.color 
            }}
          />
        </div>
      </div>
      <div className="w-24 text-right shrink-0">
        <span className="text-sm font-bold text-slate-800">
          ${segment.value.toLocaleString()}
        </span>
        <span className="text-xs text-slate-400 ml-1">
          ({percent.toFixed(0)}%)
        </span>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const InvestmentBreakdown = ({ records, className = '' }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Calculate spending by category
  const { categoryData, totalInvestment, topCategory } = useMemo(() => {
    const byCategory = {};
    
    records.forEach(record => {
      const cost = parseFloat(record.cost) || 0;
      if (cost <= 0) return;
      
      const category = record.category || 'Other';
      if (!byCategory[category]) {
        byCategory[category] = { value: 0, count: 0 };
      }
      byCategory[category].value += cost;
      byCategory[category].count += 1;
    });

    const data = Object.entries(byCategory)
      .map(([category, { value, count }]) => ({
        category,
        label: CATEGORY_COLORS[category]?.label || category,
        value: Math.round(value),
        count,
        color: getColorForCategory(category),
      }))
      .sort((a, b) => b.value - a.value);

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const top = data.length > 0 ? data[0] : null;

    return { categoryData: data, totalInvestment: total, topCategory: top };
  }, [records]);

  // Find max value for bar chart scaling
  const maxValue = useMemo(() => {
    return Math.max(...categoryData.map(d => d.value), 1);
  }, [categoryData]);

  if (categoryData.length === 0 || totalInvestment === 0) {
    return (
      <section className={`print:break-inside-avoid ${className}`}>
        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
          <PieChart className="mr-3 text-indigo-600" size={24} />
          Investment Breakdown
        </h3>
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center">
          <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No cost data recorded yet.</p>
          <p className="text-xs text-slate-400 mt-1">Add costs to your items to see spending breakdown.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`print:break-inside-avoid ${className}`}>
      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
        <PieChart className="mr-3 text-indigo-600" size={24} />
        Investment Breakdown
      </h3>

      <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-2xl border border-indigo-100 overflow-hidden">
        {/* Summary Header */}
        <div className="p-6 border-b border-indigo-100 bg-white/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Total Investment</p>
              <p className="text-4xl font-black text-slate-900">
                ${totalInvestment.toLocaleString()}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Across {records.filter(r => parseFloat(r.cost) > 0).length} documented items
              </p>
            </div>
            {topCategory && (
              <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200">
                <TrendingUp className="text-indigo-500" size={24} />
                <div>
                  <p className="text-xs text-slate-500">Largest Category</p>
                  <p className="font-bold text-slate-800">{topCategory.label}</p>
                  <p className="text-xs text-slate-500">
                    ${topCategory.value.toLocaleString()} ({((topCategory.value / totalInvestment) * 100).toFixed(0)}%)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart + Legend - Desktop Web View */}
        <div className="p-6 print:hidden">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Donut Chart */}
            <div className="relative shrink-0">
              <DonutChart 
                data={categoryData} 
                total={totalInvestment}
                hoveredIndex={hoveredIndex}
                onHover={setHoveredIndex}
              />
              {/* Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Categories</p>
                <p className="text-3xl font-bold text-slate-800">{categoryData.length}</p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 w-full max-w-sm">
              {categoryData.map((segment, index) => (
                <LegendItem
                  key={segment.category}
                  segment={segment}
                  total={totalInvestment}
                  isHovered={hoveredIndex === index}
                  onHover={setHoveredIndex}
                  index={index}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bar Chart - Print View */}
        <div className="hidden print:block p-6">
          <div className="space-y-1">
            {categoryData.map((segment) => (
              <HorizontalBar
                key={segment.category}
                segment={segment}
                total={totalInvestment}
                maxValue={maxValue}
              />
            ))}
          </div>
        </div>

        {/* Footer Stats */}
        <div className="grid grid-cols-3 divide-x divide-indigo-100 border-t border-indigo-100 bg-indigo-50/50">
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{categoryData.length}</p>
            <p className="text-xs text-slate-500">Categories</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">
              ${Math.round(totalInvestment / Math.max(records.filter(r => parseFloat(r.cost) > 0).length, 1)).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">Avg per Item</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">
              {records.filter(r => parseFloat(r.cost) > 1000).length}
            </p>
            <p className="text-xs text-slate-500">Items $1k+</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InvestmentBreakdown;
