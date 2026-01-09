// src/features/contractor-pro/components/ReportingDashboard.jsx
// ============================================
// COMPREHENSIVE REPORTING DASHBOARD
// ============================================
// Full business analytics for contractors including:
// - Revenue tracking & trends
// - Quote conversion funnel
// - Job pipeline visualization
// - Customer analytics
// - Time period comparisons

import React, { useState, useMemo } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, FileText, Briefcase,
    Users, Calendar, Clock, Target, Award, ChevronDown, ChevronUp,
    ArrowUpRight, ArrowDownRight, Filter, Download, RefreshCw,
    PieChart, BarChart3, Activity, Zap, CheckCircle, XCircle,
    Eye, Send, AlertCircle, Star, Loader2
} from 'lucide-react';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    ComposedChart, Funnel, FunnelChart, LabelList
} from 'recharts';
import { GoalTracker } from './GoalTracker';

// ============================================
// CONSTANTS
// ============================================
const TIME_PERIODS = [
    { id: 'this_week', label: 'This Week', days: 7 },
    { id: 'this_month', label: 'This Month', days: 30 },
    { id: 'last_month', label: 'Last Month', days: 30, offset: 30 },
    { id: 'this_quarter', label: 'This Quarter', days: 90 },
    { id: 'this_year', label: 'This Year', days: 365 },
    { id: 'all_time', label: 'All Time', days: null },
];

const COLORS = {
    primary: '#10b981',
    secondary: '#3b82f6',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
    slate: '#64748b',
    emerald: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    chart: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'],
};

const STATUS_COLORS = {
    draft: '#94a3b8',
    sent: '#3b82f6',
    viewed: '#8b5cf6',
    accepted: '#10b981',
    declined: '#ef4444',
    expired: '#f59e0b',
    pending_schedule: '#f59e0b',
    scheduled: '#3b82f6',
    in_progress: '#8b5cf6',
    completed: '#10b981',
    cancelled: '#ef4444',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toLocaleString()}`;
};

const formatNumber = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
};

const formatPercent = (value) => `${value.toFixed(1)}%`;

const getDateRange = (periodId) => {
    const now = new Date();
    const period = TIME_PERIODS.find(p => p.id === periodId);
    
    if (!period || !period.days) {
        return { start: null, end: now };
    }
    
    const start = new Date();
    if (period.offset) {
        start.setDate(start.getDate() - period.offset - period.days);
    } else {
        start.setDate(start.getDate() - period.days);
    }
    
    const end = period.offset ? new Date(now.getTime() - period.offset * 24 * 60 * 60 * 1000) : now;
    
    return { start, end };
};

const isInDateRange = (timestamp, start, end) => {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (!start) return true;
    return date >= start && date <= end;
};

const getMonthName = (monthIndex) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex];
};

// ============================================
// KPI CARD COMPONENT
// ============================================
const KPICard = ({ 
    icon: Icon, 
    label, 
    value, 
    subValue,
    trend, 
    trendLabel,
    color = 'emerald',
    size = 'default'
}) => {
    const colorClasses = {
        emerald: 'bg-emerald-50 text-emerald-600',
        blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600',
        amber: 'bg-amber-50 text-amber-600',
        red: 'bg-red-50 text-red-600',
        slate: 'bg-slate-50 text-slate-600',
    };

    const isPositiveTrend = trend > 0;
    const TrendIcon = isPositiveTrend ? TrendingUp : TrendingDown;

    return (
        <div className={`bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-emerald-200 transition-all ${size === 'large' ? 'col-span-2' : ''}`}>
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${colorClasses[color]}`}>
                    <Icon size={20} />
                </div>
                {trend !== undefined && trend !== null && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                        isPositiveTrend ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                        <TrendIcon size={12} />
                        {Math.abs(trend).toFixed(1)}%
                    </div>
                )}
            </div>
            
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-black text-slate-800">{value}</p>
            
            {subValue && (
                <p className="text-sm text-slate-500 mt-1">{subValue}</p>
            )}
            
            {trendLabel && (
                <p className="text-xs text-slate-400 mt-2">{trendLabel}</p>
            )}
        </div>
    );
};

// ============================================
// MINI SPARKLINE
// ============================================
const MiniSparkline = ({ data, color = COLORS.primary, height = 40 }) => {
    if (!data || data.length === 0) return null;
    
    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                    <linearGradient id={`sparklineGradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={color} 
                    strokeWidth={2}
                    fill={`url(#sparklineGradient-${color})`}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

// ============================================
// REVENUE CHART
// ============================================
const RevenueChart = ({ data, loading }) => {
    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="animate-pulse">
                    <div className="h-6 w-40 bg-slate-200 rounded mb-4"></div>
                    <div className="h-64 bg-slate-100 rounded-xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Revenue Trend</h3>
                    <p className="text-sm text-slate-500">Monthly revenue over time</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <span className="text-slate-500">Revenue</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-slate-500">Jobs</span>
                    </div>
                </div>
            </div>
            
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                    />
                    <YAxis 
                        yAxisId="left"
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickFormatter={(value) => `$${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
                    />
                    <YAxis 
                        yAxisId="right"
                        orientation="right"
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '12px 16px',
                        }}
                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}
                        itemStyle={{ color: '#fff', fontSize: '14px' }}
                        formatter={(value, name) => [
                            name === 'revenue' ? formatCurrency(value) : value,
                            name === 'revenue' ? 'Revenue' : 'Jobs'
                        ]}
                    />
                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={3}
                        fill="url(#revenueGradient)"
                    />
                    <Bar
                        yAxisId="right"
                        dataKey="jobs"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                        barSize={20}
                        opacity={0.8}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

// ============================================
// QUOTE FUNNEL
// ============================================
const QuoteFunnel = ({ data }) => {
    const funnelData = [
        { name: 'Sent', value: data.sent, fill: '#3b82f6' },
        { name: 'Viewed', value: data.viewed, fill: '#8b5cf6' },
        { name: 'Accepted', value: data.accepted, fill: '#10b981' },
    ];

    const conversionRates = {
        sentToViewed: data.sent > 0 ? ((data.viewed / data.sent) * 100).toFixed(0) : 0,
        viewedToAccepted: data.viewed > 0 ? ((data.accepted / data.viewed) * 100).toFixed(0) : 0,
        overall: data.sent > 0 ? ((data.accepted / data.sent) * 100).toFixed(0) : 0,
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Quote Funnel</h3>
                    <p className="text-sm text-slate-500">Conversion through stages</p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black text-emerald-600">{conversionRates.overall}%</p>
                    <p className="text-xs text-slate-500">Overall conversion</p>
                </div>
            </div>
            
            {/* Visual Funnel */}
            <div className="space-y-3 mb-6">
                {funnelData.map((stage, index) => {
                    const maxValue = Math.max(...funnelData.map(s => s.value), 1);
                    const width = (stage.value / maxValue) * 100;
                    
                    return (
                        <div key={stage.name} className="relative">
                            <div className="flex items-center gap-3">
                                <div className="w-20 text-sm font-medium text-slate-600">{stage.name}</div>
                                <div className="flex-1 h-10 bg-slate-100 rounded-lg overflow-hidden">
                                    <div 
                                        className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                                        style={{ 
                                            width: `${Math.max(width, 10)}%`,
                                            backgroundColor: stage.fill 
                                        }}
                                    >
                                        <span className="text-white font-bold text-sm">{stage.value}</span>
                                    </div>
                                </div>
                            </div>
                            {index < funnelData.length - 1 && (
                                <div className="ml-20 pl-4 py-1 text-xs text-slate-400">
                                    ↓ {index === 0 ? conversionRates.sentToViewed : conversionRates.viewedToAccepted}% converted
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">{data.sent}</p>
                    <p className="text-xs text-slate-500">Sent</p>
                </div>
                <div className="text-center">
                    <p className="text-lg font-bold text-purple-600">{data.viewed}</p>
                    <p className="text-xs text-slate-500">Viewed</p>
                </div>
                <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600">{data.accepted}</p>
                    <p className="text-xs text-slate-500">Won</p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// JOB PIPELINE
// ============================================
const JobPipeline = ({ data }) => {
    const stages = [
        { key: 'pending_schedule', label: 'Needs Scheduling', color: '#f59e0b', icon: Clock },
        { key: 'scheduled', label: 'Scheduled', color: '#3b82f6', icon: Calendar },
        { key: 'in_progress', label: 'In Progress', color: '#8b5cf6', icon: Zap },
        { key: 'completed', label: 'Completed', color: '#10b981', icon: CheckCircle },
    ];

    const totalActive = stages.slice(0, 3).reduce((sum, s) => sum + (data[s.key] || 0), 0);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Job Pipeline</h3>
                    <p className="text-sm text-slate-500">{totalActive} active jobs</p>
                </div>
            </div>
            
            <div className="space-y-4">
                {stages.map((stage) => {
                    const count = data[stage.key] || 0;
                    const Icon = stage.icon;
                    
                    return (
                        <div key={stage.key} className="flex items-center gap-4">
                            <div 
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: `${stage.color}15` }}
                            >
                                <Icon size={18} style={{ color: stage.color }} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-slate-700">{stage.label}</span>
                                    <span className="text-sm font-bold" style={{ color: stage.color }}>{count}</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ 
                                            width: `${Math.min((count / Math.max(totalActive, 1)) * 100, 100)}%`,
                                            backgroundColor: stage.color 
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================
// TOP CUSTOMERS
// ============================================
const TopCustomers = ({ customers }) => {
    const topCustomers = [...customers]
        .sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0))
        .slice(0, 5);

    const maxSpend = Math.max(...topCustomers.map(c => c.totalSpend || 0), 1);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Top Customers</h3>
                    <p className="text-sm text-slate-500">By total revenue</p>
                </div>
                <Award className="text-amber-500" size={24} />
            </div>
            
            {topCustomers.length === 0 ? (
                <div className="text-center py-8">
                    <Users className="mx-auto text-slate-300 mb-3" size={40} />
                    <p className="text-slate-500">No customer data yet</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {topCustomers.map((customer, index) => {
                        const percentage = ((customer.totalSpend || 0) / maxSpend) * 100;
                        
                        return (
                            <div key={customer.id} className="flex items-center gap-3">
                                {/* Rank Badge */}
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                    index === 0 ? 'bg-amber-100 text-amber-700' :
                                    index === 1 ? 'bg-slate-200 text-slate-700' :
                                    index === 2 ? 'bg-orange-100 text-orange-700' :
                                    'bg-slate-100 text-slate-500'
                                }`}>
                                    {index + 1}
                                </div>
                                
                                {/* Customer Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-slate-700 truncate">
                                            {customer.customerName || 'Customer'}
                                        </span>
                                        <span className="text-sm font-bold text-emerald-600">
                                            {formatCurrency(customer.totalSpend || 0)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {customer.totalJobs || 0} job{(customer.totalJobs || 0) !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ============================================
// QUOTE STATUS BREAKDOWN
// ============================================
const QuoteStatusBreakdown = ({ quotes }) => {
    const statusCounts = useMemo(() => {
        const counts = {
            draft: 0,
            sent: 0,
            viewed: 0,
            accepted: 0,
            declined: 0,
            expired: 0,
        };
        
        quotes.forEach(quote => {
            const status = quote.status || 'draft';
            if (counts[status] !== undefined) {
                counts[status]++;
            }
        });
        
        return counts;
    }, [quotes]);

    const pieData = [
        { name: 'Draft', value: statusCounts.draft, color: '#94a3b8' },
        { name: 'Sent', value: statusCounts.sent, color: '#3b82f6' },
        { name: 'Viewed', value: statusCounts.viewed, color: '#8b5cf6' },
        { name: 'Accepted', value: statusCounts.accepted, color: '#10b981' },
        { name: 'Declined', value: statusCounts.declined, color: '#ef4444' },
        { name: 'Expired', value: statusCounts.expired, color: '#f59e0b' },
    ].filter(d => d.value > 0);

    const total = pieData.reduce((sum, d) => sum + d.value, 0);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Quote Status</h3>
                    <p className="text-sm text-slate-500">{total} total quotes</p>
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                {/* Pie Chart */}
                <div className="w-32 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={30}
                                outerRadius={50}
                                dataKey="value"
                                strokeWidth={0}
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                        </RechartsPie>
                    </ResponsiveContainer>
                </div>
                
                {/* Legend */}
                <div className="flex-1 grid grid-cols-2 gap-2">
                    {pieData.map((item) => (
                        <div key={item.name} className="flex items-center gap-2">
                            <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="text-xs text-slate-600">{item.name}</span>
                            <span className="text-xs font-bold text-slate-800 ml-auto">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ============================================
// PERFORMANCE METRICS
// ============================================
const PerformanceMetrics = ({ quotes, jobs }) => {
    const metrics = useMemo(() => {
        const acceptedQuotes = quotes.filter(q => q.status === 'accepted');
        const completedJobs = jobs.filter(j => j.status === 'completed');
        
        // Average quote value
        const avgQuoteValue = quotes.length > 0 
            ? quotes.reduce((sum, q) => sum + (q.total || 0), 0) / quotes.length 
            : 0;
        
        // Average job value
        const avgJobValue = completedJobs.length > 0
            ? completedJobs.reduce((sum, j) => sum + (j.total || 0), 0) / completedJobs.length
            : 0;
        
        // Win rate
        const decidedQuotes = quotes.filter(q => ['accepted', 'declined'].includes(q.status));
        const winRate = decidedQuotes.length > 0
            ? (acceptedQuotes.length / decidedQuotes.length) * 100
            : 0;
        
        // Average response time (sent to viewed)
        const viewedQuotes = quotes.filter(q => q.sentAt && q.viewedAt);
        const avgResponseTime = viewedQuotes.length > 0
            ? viewedQuotes.reduce((sum, q) => {
                const sent = q.sentAt?.toDate?.() || new Date(q.sentAt);
                const viewed = q.viewedAt?.toDate?.() || new Date(q.viewedAt);
                return sum + (viewed - sent) / (1000 * 60 * 60); // hours
            }, 0) / viewedQuotes.length
            : 0;
        
        return {
            avgQuoteValue,
            avgJobValue,
            winRate,
            avgResponseTime,
            totalQuotes: quotes.length,
            totalJobs: jobs.length,
            completedJobs: completedJobs.length,
        };
    }, [quotes, jobs]);

    return (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-lg">Performance Metrics</h3>
                    <p className="text-sm text-slate-400">Key business indicators</p>
                </div>
                <Activity className="text-emerald-400" size={24} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Win Rate</p>
                    <p className="text-2xl font-black text-emerald-400">{metrics.winRate.toFixed(0)}%</p>
                    <p className="text-xs text-slate-500 mt-1">of decided quotes</p>
                </div>
                
                <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Avg Quote</p>
                    <p className="text-2xl font-black text-blue-400">{formatCurrency(metrics.avgQuoteValue)}</p>
                    <p className="text-xs text-slate-500 mt-1">per quote sent</p>
                </div>
                
                <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Avg Job Value</p>
                    <p className="text-2xl font-black text-purple-400">{formatCurrency(metrics.avgJobValue)}</p>
                    <p className="text-xs text-slate-500 mt-1">completed jobs</p>
                </div>
                
                <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Response Time</p>
                    <p className="text-2xl font-black text-amber-400">
                        {metrics.avgResponseTime < 24 
                            ? `${metrics.avgResponseTime.toFixed(0)}h`
                            : `${(metrics.avgResponseTime / 24).toFixed(1)}d`
                        }
                    </p>
                    <p className="text-xs text-slate-500 mt-1">avg to view</p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// RECENT ACTIVITY FEED
// ============================================
const RecentActivityFeed = ({ quotes, jobs }) => {
    const activities = useMemo(() => {
        const items = [];
        
        // Add quote activities
        quotes.slice(0, 10).forEach(quote => {
            if (quote.acceptedAt) {
                items.push({
                    type: 'quote_accepted',
                    title: `Quote accepted`,
                    subtitle: quote.customer?.name || quote.title,
                    value: quote.total,
                    timestamp: quote.acceptedAt,
                    icon: CheckCircle,
                    color: 'emerald',
                });
            } else if (quote.sentAt) {
                items.push({
                    type: 'quote_sent',
                    title: `Quote sent`,
                    subtitle: quote.customer?.name || quote.title,
                    value: quote.total,
                    timestamp: quote.sentAt,
                    icon: Send,
                    color: 'blue',
                });
            }
        });
        
        // Add job activities
        jobs.slice(0, 10).forEach(job => {
            if (job.completedAt) {
                items.push({
                    type: 'job_completed',
                    title: `Job completed`,
                    subtitle: job.customer?.name || job.title,
                    value: job.total,
                    timestamp: job.completedAt,
                    icon: CheckCircle,
                    color: 'emerald',
                });
            } else if (job.scheduledAt) {
                items.push({
                    type: 'job_scheduled',
                    title: `Job scheduled`,
                    subtitle: job.customer?.name || job.title,
                    timestamp: job.scheduledAt,
                    icon: Calendar,
                    color: 'blue',
                });
            }
        });
        
        // Sort by timestamp and take top 8
        return items
            .sort((a, b) => {
                const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
                const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
                return bTime - aTime;
            })
            .slice(0, 8);
    }, [quotes, jobs]);

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const colorClasses = {
        emerald: 'bg-emerald-50 text-emerald-600',
        blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600',
        amber: 'bg-amber-50 text-amber-600',
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Recent Activity</h3>
                    <p className="text-sm text-slate-500">Latest updates</p>
                </div>
            </div>
            
            {activities.length === 0 ? (
                <div className="text-center py-8">
                    <Activity className="mx-auto text-slate-300 mb-3" size={40} />
                    <p className="text-slate-500">No recent activity</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {activities.map((activity, index) => {
                        const Icon = activity.icon;
                        
                        return (
                            <div key={index} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClasses[activity.color]}`}>
                                    <Icon size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800">{activity.title}</p>
                                    <p className="text-xs text-slate-500 truncate">{activity.subtitle}</p>
                                </div>
                                <div className="text-right">
                                    {activity.value && (
                                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(activity.value)}</p>
                                    )}
                                    <p className="text-xs text-slate-400">{formatTimeAgo(activity.timestamp)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN REPORTING DASHBOARD COMPONENT
// ============================================
export const ReportingDashboard = ({
    contractorId,
    profile,
    quotes = [],
    jobs = [],
    invoices = [],
    customers = [],
    loading = false,
}) => {
    const [selectedPeriod, setSelectedPeriod] = useState('this_month');
    const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

    // Filter data by selected period
    const filteredData = useMemo(() => {
        const { start, end } = getDateRange(selectedPeriod);
        
        return {
            quotes: quotes.filter(q => isInDateRange(q.createdAt, start, end)),
            jobs: jobs.filter(j => isInDateRange(j.createdAt, start, end)),
            invoices: invoices.filter(i => isInDateRange(i.createdAt, start, end)),
        };
    }, [quotes, jobs, invoices, selectedPeriod]);

    // Calculate KPIs
    const kpis = useMemo(() => {
        const acceptedQuotes = filteredData.quotes.filter(q => q.status === 'accepted');
        const completedJobs = filteredData.jobs.filter(j => j.status === 'completed');
        const paidInvoices = filteredData.invoices.filter(i => i.status === 'paid');
        
        // Revenue from accepted quotes
        const revenue = acceptedQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
        
        // Revenue from completed jobs
        const jobRevenue = completedJobs.reduce((sum, j) => sum + (j.total || 0), 0);
        
        // Pending revenue (sent but not yet accepted/declined)
        const pendingQuotes = filteredData.quotes.filter(q => ['sent', 'viewed'].includes(q.status));
        const pendingRevenue = pendingQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
        
        // Conversion rate
        const sentQuotes = filteredData.quotes.filter(q => q.status !== 'draft');
        const conversionRate = sentQuotes.length > 0 
            ? (acceptedQuotes.length / sentQuotes.length) * 100 
            : 0;
        
        // Average job value
        const avgJobValue = completedJobs.length > 0
            ? jobRevenue / completedJobs.length
            : 0;

        return {
            revenue,
            jobRevenue,
            pendingRevenue,
            conversionRate,
            avgJobValue,
            totalQuotes: filteredData.quotes.length,
            acceptedQuotes: acceptedQuotes.length,
            completedJobs: completedJobs.length,
            activeJobs: filteredData.jobs.filter(j => !['completed', 'cancelled'].includes(j.status)).length,
        };
    }, [filteredData]);

    // Quote funnel data
    const funnelData = useMemo(() => ({
        sent: filteredData.quotes.filter(q => q.status !== 'draft').length,
        viewed: filteredData.quotes.filter(q => ['viewed', 'accepted', 'declined'].includes(q.status)).length,
        accepted: filteredData.quotes.filter(q => q.status === 'accepted').length,
    }), [filteredData]);

    // Job pipeline data
    const pipelineData = useMemo(() => {
        const pipeline = {
            pending_schedule: 0,
            scheduled: 0,
            in_progress: 0,
            completed: 0,
        };
        
        jobs.forEach(job => {
            const status = job.status || 'pending_schedule';
            if (['pending_schedule', 'slots_offered', 'quoted', 'accepted'].includes(status)) {
                pipeline.pending_schedule++;
            } else if (pipeline[status] !== undefined) {
                pipeline[status]++;
            }
        });
        
        return pipeline;
    }, [jobs]);

    // Monthly revenue data for chart
    const monthlyData = useMemo(() => {
        const months = {};
        const now = new Date();
        
        // Initialize last 6 months
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            months[key] = {
                month: getMonthName(date.getMonth()),
                revenue: 0,
                jobs: 0,
            };
        }
        
        // Aggregate quote revenue (accepted)
        quotes.forEach(quote => {
            if (quote.status === 'accepted' && quote.acceptedAt) {
                const date = quote.acceptedAt.toDate ? quote.acceptedAt.toDate() : new Date(quote.acceptedAt);
                const key = `${date.getFullYear()}-${date.getMonth()}`;
                if (months[key]) {
                    months[key].revenue += quote.total || 0;
                }
            }
        });
        
        // Count completed jobs
        jobs.forEach(job => {
            if (job.status === 'completed' && job.completedAt) {
                const date = job.completedAt.toDate ? job.completedAt.toDate() : new Date(job.completedAt);
                const key = `${date.getFullYear()}-${date.getMonth()}`;
                if (months[key]) {
                    months[key].jobs++;
                }
            }
        });
        
        return Object.values(months);
    }, [quotes, jobs]);

    const selectedPeriodLabel = TIME_PERIODS.find(p => p.id === selectedPeriod)?.label || 'This Month';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 size={40} className="animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Business Reports</h1>
                    <p className="text-slate-500">Track your performance and growth</p>
                </div>
                
                {/* Period Selector */}
                <div className="relative">
                    <button
                        onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:border-emerald-300 flex items-center gap-2 transition-colors"
                    >
                        <Calendar size={16} className="text-slate-400" />
                        {selectedPeriodLabel}
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${showPeriodDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showPeriodDropdown && (
                        <>
                            <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setShowPeriodDropdown(false)} 
                            />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-20">
                                {TIME_PERIODS.map(period => (
                                    <button
                                        key={period.id}
                                        onClick={() => {
                                            setSelectedPeriod(period.id);
                                            setShowPeriodDropdown(false);
                                        }}
                                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                                            selectedPeriod === period.id ? 'text-emerald-600 font-medium bg-emerald-50' : 'text-slate-600'
                                        }`}
                                    >
                                        {period.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Top Row: Goal + KPIs */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Goal Tracker - Compact */}
                <div className="lg:col-span-1">
                    <GoalTracker
                        contractorId={contractorId}
                        profile={profile}
                        quotes={quotes}
                        jobs={jobs}
                        variant="compact"
                    />
                </div>
                
                {/* KPI Cards */}
                <KPICard
                    icon={DollarSign}
                    label="Revenue"
                    value={formatCurrency(kpis.revenue)}
                    subValue={`${kpis.acceptedQuotes} quotes won`}
                    color="emerald"
                />
                <KPICard
                    icon={Target}
                    label="Conversion Rate"
                    value={`${kpis.conversionRate.toFixed(0)}%`}
                    subValue={`${kpis.totalQuotes} quotes sent`}
                    color="blue"
                />
                <KPICard
                    icon={Briefcase}
                    label="Jobs Completed"
                    value={kpis.completedJobs}
                    subValue={`${kpis.activeJobs} in progress`}
                    color="purple"
                />
            </div>
            </div>

            {/* Pending Revenue Banner */}
            {kpis.pendingRevenue > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl">
                            <Clock className="text-amber-600" size={20} />
                        </div>
                        <div>
                            <p className="font-medium text-amber-900">Pending Revenue</p>
                            <p className="text-sm text-amber-700">
                                {filteredData.quotes.filter(q => ['sent', 'viewed'].includes(q.status)).length} quotes awaiting response
                            </p>
                        </div>
                    </div>
                    <p className="text-2xl font-black text-amber-600">{formatCurrency(kpis.pendingRevenue)}</p>
                </div>
            )}

            {/* Charts Row */}
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <RevenueChart data={monthlyData} loading={loading} />
                </div>
                <QuoteFunnel data={funnelData} />
            </div>

            {/* Second Row */}
            <div className="grid lg:grid-cols-3 gap-6">
                <JobPipeline data={pipelineData} />
                <TopCustomers customers={customers} />
                <QuoteStatusBreakdown quotes={quotes} />
            </div>

            {/* Third Row */}
            <div className="grid lg:grid-cols-2 gap-6">
                <PerformanceMetrics quotes={quotes} jobs={jobs} />
                <RecentActivityFeed quotes={quotes} jobs={jobs} />
            </div>
        </div>
    );
};

export default ReportingDashboard;
