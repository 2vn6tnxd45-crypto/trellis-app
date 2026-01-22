// src/features/contractor-pro/components/ProfitabilityDashboard.jsx
// ============================================
// PROFITABILITY DASHBOARD
// ============================================
// Priority 3.5: Out-of-box dashboards connecting schedule, travel, outcomes, financials

import React, { useState, useEffect, useMemo } from 'react';
import {
    DollarSign, TrendingUp, TrendingDown, Clock, Users, Truck,
    Target, AlertTriangle, CheckCircle, Calendar, BarChart3,
    ArrowUp, ArrowDown, Minus, Filter, Download, RefreshCw
} from 'lucide-react';
import { useJobs } from '../hooks/useJobs';
import { useTeam } from '../hooks/useTeam';

// ============================================
// METRIC CARD
// ============================================
const MetricCard = ({ title, value, subtitle, trend, trendValue, icon: Icon, color = 'emerald' }) => {
    const colorClasses = {
        emerald: 'bg-emerald-50 text-emerald-600',
        blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600',
        orange: 'bg-orange-50 text-orange-600',
        red: 'bg-red-50 text-red-600',
        slate: 'bg-slate-50 text-slate-600'
    };

    const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
    const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-slate-400';

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon size={20} />
                </div>
                {trendValue !== undefined && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${trendColor}`}>
                        <TrendIcon size={14} />
                        <span>{Math.abs(trendValue)}%</span>
                    </div>
                )}
            </div>
            <div className="mt-3">
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-sm text-slate-500">{title}</p>
                {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
            </div>
        </div>
    );
};

// ============================================
// TECH SCORECARD
// ============================================
const TechScorecard = ({ tech, jobs, periodLabel }) => {
    // Calculate metrics for this tech
    const techJobs = jobs.filter(j => j.assignedTechId === tech.id);
    const completedJobs = techJobs.filter(j => j.status === 'completed');

    const metrics = useMemo(() => {
        const totalRevenue = completedJobs.reduce((sum, j) => sum + (j.actualCost || j.estimatedCost || 0), 0);
        const totalHours = completedJobs.reduce((sum, j) => sum + ((j.actualDurationMinutes || j.estimatedDurationMinutes || 60) / 60), 0);
        const laborCost = totalHours * (tech.hourlyRate || 25);

        // First-time fix rate (jobs completed without return visits)
        const firstTimeFixes = completedJobs.filter(j => !j.isCallback).length;
        const firstTimeFixRate = completedJobs.length > 0 ? (firstTimeFixes / completedJobs.length) * 100 : 0;

        // On-time rate
        const onTimeJobs = completedJobs.filter(j => {
            if (!j.actualStartTime || !j.scheduledStartTime) return true;
            const scheduled = new Date(`2000-01-01T${j.scheduledStartTime}`);
            const actual = new Date(j.actualStartTime);
            return actual <= new Date(scheduled.getTime() + 15 * 60000); // 15 min grace
        }).length;
        const onTimeRate = completedJobs.length > 0 ? (onTimeJobs / completedJobs.length) * 100 : 0;

        // Revenue per hour
        const revenuePerHour = totalHours > 0 ? totalRevenue / totalHours : 0;

        // Profit (simplified: revenue - labor)
        const profit = totalRevenue - laborCost;
        const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

        return {
            totalJobs: techJobs.length,
            completedJobs: completedJobs.length,
            totalRevenue,
            totalHours: Math.round(totalHours * 10) / 10,
            laborCost,
            profit,
            profitMargin,
            revenuePerHour,
            firstTimeFixRate,
            onTimeRate,
            avgRating: tech.stats?.averageRating || 0
        };
    }, [techJobs, completedJobs, tech]);

    // Score calculation (weighted average of key metrics)
    const score = useMemo(() => {
        const weights = {
            firstTimeFixRate: 0.3,
            onTimeRate: 0.25,
            profitMargin: 0.25,
            avgRating: 0.2
        };

        const normalizedRating = (metrics.avgRating / 5) * 100;

        return Math.round(
            metrics.firstTimeFixRate * weights.firstTimeFixRate +
            metrics.onTimeRate * weights.onTimeRate +
            Math.max(0, Math.min(100, metrics.profitMargin)) * weights.profitMargin +
            normalizedRating * weights.avgRating
        );
    }, [metrics]);

    const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';
    const scoreBg = score >= 80 ? 'bg-emerald-50' : score >= 60 ? 'bg-yellow-50' : 'bg-red-50';

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                            {tech.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">{tech.name}</p>
                            <p className="text-xs text-slate-500 capitalize">{tech.role}</p>
                        </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full ${scoreBg}`}>
                        <span className={`text-lg font-bold ${scoreColor}`}>{score}</span>
                        <span className="text-xs text-slate-500 ml-1">score</span>
                    </div>
                </div>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="text-slate-500">Jobs Completed</p>
                    <p className="font-bold text-slate-800">{metrics.completedJobs}</p>
                </div>
                <div>
                    <p className="text-slate-500">Revenue</p>
                    <p className="font-bold text-slate-800">${metrics.totalRevenue.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-slate-500">First-Time Fix</p>
                    <p className={`font-bold ${metrics.firstTimeFixRate >= 80 ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {metrics.firstTimeFixRate.toFixed(0)}%
                    </p>
                </div>
                <div>
                    <p className="text-slate-500">On-Time Rate</p>
                    <p className={`font-bold ${metrics.onTimeRate >= 90 ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {metrics.onTimeRate.toFixed(0)}%
                    </p>
                </div>
                <div>
                    <p className="text-slate-500">Revenue/Hour</p>
                    <p className="font-bold text-slate-800">${metrics.revenuePerHour.toFixed(0)}</p>
                </div>
                <div>
                    <p className="text-slate-500">Profit Margin</p>
                    <p className={`font-bold ${metrics.profitMargin >= 30 ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {metrics.profitMargin.toFixed(0)}%
                    </p>
                </div>
            </div>

            {/* Hours bar */}
            <div className="px-4 pb-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Utilization</span>
                    <span>{metrics.totalHours}h / 40h</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, (metrics.totalHours / 40) * 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

// ============================================
// PROFIT BY CATEGORY CHART
// ============================================
const ProfitByCategory = ({ jobs }) => {
    const categoryData = useMemo(() => {
        const categories = {};

        jobs.filter(j => j.status === 'completed').forEach(job => {
            const cat = job.category || 'General';
            if (!categories[cat]) {
                categories[cat] = { revenue: 0, cost: 0, count: 0 };
            }
            categories[cat].revenue += job.actualCost || job.estimatedCost || 0;
            categories[cat].cost += (job.actualDurationMinutes || 60) / 60 * 25; // Assume $25/hr labor
            categories[cat].count += 1;
        });

        return Object.entries(categories)
            .map(([name, data]) => ({
                name,
                revenue: data.revenue,
                profit: data.revenue - data.cost,
                margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
                count: data.count
            }))
            .sort((a, b) => b.profit - a.profit);
    }, [jobs]);

    const maxProfit = Math.max(...categoryData.map(c => c.profit), 1);

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 mb-4">Profit by Category</h3>
            <div className="space-y-3">
                {categoryData.slice(0, 6).map(cat => (
                    <div key={cat.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium text-slate-700">{cat.name}</span>
                            <span className={`font-bold ${cat.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                ${cat.profit.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${cat.profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.abs(cat.profit / maxProfit) * 100}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400 mt-0.5">
                            <span>{cat.count} jobs</span>
                            <span>{cat.margin.toFixed(0)}% margin</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// ALERTS PANEL
// ============================================
const AlertsPanel = ({ jobs, team }) => {
    const alerts = useMemo(() => {
        const alertList = [];

        // High callback rate techs
        team.forEach(tech => {
            const techJobs = jobs.filter(j => j.assignedTechId === tech.id && j.status === 'completed');
            const callbacks = techJobs.filter(j => j.isCallback).length;
            if (techJobs.length >= 5 && callbacks / techJobs.length > 0.15) {
                alertList.push({
                    type: 'warning',
                    message: `${tech.name} has ${Math.round(callbacks / techJobs.length * 100)}% callback rate`,
                    action: 'Review training needs'
                });
            }
        });

        // Low margin jobs
        const lowMarginJobs = jobs.filter(j => {
            if (j.status !== 'completed') return false;
            const revenue = j.actualCost || j.estimatedCost || 0;
            const cost = (j.actualDurationMinutes || 60) / 60 * 25;
            return revenue > 0 && (revenue - cost) / revenue < 0.2;
        });
        if (lowMarginJobs.length > 3) {
            alertList.push({
                type: 'alert',
                message: `${lowMarginJobs.length} jobs with <20% margin this period`,
                action: 'Review pricing strategy'
            });
        }

        // Running late jobs
        const lateJobs = jobs.filter(j => j.status === 'running_late');
        if (lateJobs.length > 0) {
            alertList.push({
                type: 'urgent',
                message: `${lateJobs.length} job(s) currently running late`,
                action: 'Check dispatch board'
            });
        }

        // Overtime risk
        const today = new Date().toISOString().split('T')[0];
        team.forEach(tech => {
            const todayJobs = jobs.filter(j => j.assignedTechId === tech.id && j.scheduledDate === today);
            const totalMinutes = todayJobs.reduce((sum, j) => sum + (j.estimatedDurationMinutes || 60), 0);
            if (totalMinutes > 480) { // 8 hours
                alertList.push({
                    type: 'warning',
                    message: `${tech.name} scheduled for ${Math.round(totalMinutes / 60)}h today`,
                    action: 'Risk of overtime'
                });
            }
        });

        return alertList.slice(0, 5);
    }, [jobs, team]);

    if (alerts.length === 0) {
        return (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center">
                <CheckCircle className="mx-auto text-emerald-500 mb-2" size={24} />
                <p className="font-medium text-emerald-700">All clear!</p>
                <p className="text-sm text-emerald-600">No alerts at this time</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <AlertTriangle size={16} className="text-orange-500" />
                <h3 className="font-bold text-slate-800">Alerts</h3>
                <span className="ml-auto bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {alerts.length}
                </span>
            </div>
            <div className="divide-y divide-slate-100">
                {alerts.map((alert, i) => (
                    <div key={i} className="px-4 py-3 flex items-start gap-3">
                        <div className={`p-1 rounded ${
                            alert.type === 'urgent' ? 'bg-red-100' : 'bg-yellow-100'
                        }`}>
                            <AlertTriangle size={14} className={
                                alert.type === 'urgent' ? 'text-red-500' : 'text-yellow-500'
                            } />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800">{alert.message}</p>
                            <p className="text-xs text-slate-500">{alert.action}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// MAIN DASHBOARD
// ============================================
export const ProfitabilityDashboard = ({ contractorId }) => {
    const [period, setPeriod] = useState('week'); // week, month, quarter
    const [loading, setLoading] = useState(false);

    const { jobs } = useJobs(contractorId, { realtime: true });
    const { members: team } = useTeam(contractorId);

    // Filter jobs by period
    const filteredJobs = useMemo(() => {
        const now = new Date();
        let startDate;

        switch (period) {
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case 'quarter':
                startDate = new Date(now.setMonth(now.getMonth() - 3));
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 7));
        }

        return jobs.filter(j => {
            if (!j.scheduledDate) return false;
            return new Date(j.scheduledDate) >= startDate;
        });
    }, [jobs, period]);

    // Calculate summary metrics
    const metrics = useMemo(() => {
        const completed = filteredJobs.filter(j => j.status === 'completed');

        const totalRevenue = completed.reduce((sum, j) => sum + (j.actualCost || j.estimatedCost || 0), 0);
        const totalHours = completed.reduce((sum, j) => sum + ((j.actualDurationMinutes || 60) / 60), 0);
        const totalLaborCost = team.reduce((sum, tech) => {
            const techJobs = completed.filter(j => j.assignedTechId === tech.id);
            const hours = techJobs.reduce((h, j) => h + ((j.actualDurationMinutes || 60) / 60), 0);
            return sum + (hours * (tech.hourlyRate || 25));
        }, 0);

        // Estimate drive cost ($0.67/mile)
        const totalDriveCost = completed.reduce((sum, j) => sum + ((j.travelTimeMinutes || 15) / 30 * 15 * 0.67), 0);

        const totalCost = totalLaborCost + totalDriveCost;
        const profit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

        // Utilization (actual hours / available hours)
        const availableHours = team.length * (period === 'week' ? 40 : period === 'month' ? 160 : 480);
        const utilization = availableHours > 0 ? (totalHours / availableHours) * 100 : 0;

        // First-time fix rate
        const firstTimeFixes = completed.filter(j => !j.isCallback).length;
        const firstTimeFixRate = completed.length > 0 ? (firstTimeFixes / completed.length) * 100 : 0;

        return {
            totalRevenue,
            totalCost,
            profit,
            profitMargin,
            totalJobs: filteredJobs.length,
            completedJobs: completed.length,
            totalHours: Math.round(totalHours),
            utilization: Math.round(utilization),
            firstTimeFixRate: Math.round(firstTimeFixRate),
            revenuePerJob: completed.length > 0 ? totalRevenue / completed.length : 0,
            laborCost: totalLaborCost,
            driveCost: totalDriveCost
        };
    }, [filteredJobs, team, period]);

    const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'This Quarter';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Profitability</h1>
                    <p className="text-slate-500">{periodLabel} performance overview</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        {['week', 'month', 'quarter'].map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    period === p ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                            </button>
                        ))}
                    </div>
                    <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Revenue"
                    value={`$${metrics.totalRevenue.toLocaleString()}`}
                    subtitle={`${metrics.completedJobs} completed jobs`}
                    icon={DollarSign}
                    color="emerald"
                    trend="up"
                    trendValue={12}
                />
                <MetricCard
                    title="Profit"
                    value={`$${metrics.profit.toLocaleString()}`}
                    subtitle={`${metrics.profitMargin.toFixed(0)}% margin`}
                    icon={TrendingUp}
                    color={metrics.profit >= 0 ? 'emerald' : 'red'}
                    trend={metrics.profit >= 0 ? 'up' : 'down'}
                    trendValue={8}
                />
                <MetricCard
                    title="Utilization"
                    value={`${metrics.utilization}%`}
                    subtitle={`${metrics.totalHours}h billable`}
                    icon={Clock}
                    color="blue"
                />
                <MetricCard
                    title="First-Time Fix"
                    value={`${metrics.firstTimeFixRate}%`}
                    subtitle="No return visits"
                    icon={Target}
                    color={metrics.firstTimeFixRate >= 80 ? 'emerald' : 'orange'}
                />
            </div>

            {/* Cost Breakdown */}
            <div className="grid md:grid-cols-3 gap-4">
                <MetricCard
                    title="Labor Cost"
                    value={`$${metrics.laborCost.toLocaleString()}`}
                    subtitle={`${Math.round(metrics.laborCost / metrics.totalRevenue * 100 || 0)}% of revenue`}
                    icon={Users}
                    color="purple"
                />
                <MetricCard
                    title="Drive Cost"
                    value={`$${Math.round(metrics.driveCost).toLocaleString()}`}
                    subtitle="Estimated fuel & mileage"
                    icon={Truck}
                    color="orange"
                />
                <MetricCard
                    title="Revenue per Job"
                    value={`$${Math.round(metrics.revenuePerJob).toLocaleString()}`}
                    subtitle="Average ticket"
                    icon={BarChart3}
                    color="slate"
                />
            </div>

            {/* Alerts + Category Breakdown */}
            <div className="grid md:grid-cols-2 gap-6">
                <AlertsPanel jobs={filteredJobs} team={team} />
                <ProfitByCategory jobs={filteredJobs} />
            </div>

            {/* Tech Scorecards */}
            <div>
                <h2 className="text-lg font-bold text-slate-800 mb-4">Tech Performance</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {team.map(tech => (
                        <TechScorecard
                            key={tech.id}
                            tech={tech}
                            jobs={filteredJobs}
                            periodLabel={periodLabel}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProfitabilityDashboard;
