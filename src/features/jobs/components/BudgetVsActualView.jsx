// src/features/jobs/components/BudgetVsActualView.jsx
// ============================================
// BUDGET VS ACTUAL COMPARISON VIEW
// ============================================
// Compares quoted line items against actual expenses
// to show profit margins and budget variances

import React, { useMemo, useState } from 'react';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle,
    Package,
    Wrench,
    Clock,
    ChevronDown,
    ChevronUp,
    BarChart3,
    Target,
    Receipt,
    Percent
} from 'lucide-react';

// ============================================
// UTILITIES
// ============================================

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
};

const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

// ============================================
// MAIN COMPONENT
// ============================================

export const BudgetVsActualView = ({
    job,
    expenses = [], // Array of expenses from ExpenseTracker
    lineItems = [], // Quote line items (job.lineItems or from quote)
    compact = false
}) => {
    const [expandedCategory, setExpandedCategory] = useState(null);

    // ----------------------------------------
    // Calculate budget vs actual data
    // ----------------------------------------
    const analysis = useMemo(() => {
        // Group line items by type
        const budgetByType = {
            material: { budgeted: 0, items: [] },
            labor: { budgeted: 0, items: [] },
            service: { budgeted: 0, items: [] },
            other: { budgeted: 0, items: [] }
        };

        // Sum up budgeted amounts from line items
        lineItems.forEach(item => {
            const type = item.type || 'service';
            const amount = (item.unitPrice || 0) * (item.quantity || 1);
            const category = budgetByType[type] || budgetByType.other;
            category.budgeted += amount;
            category.items.push({
                id: item.id,
                name: item.description || item.name,
                budgeted: amount,
                actual: 0, // Will be filled from expenses
                expenses: []
            });
        });

        // Map expense categories to budget types
        const expenseCategoryMap = {
            material: 'material',
            rental: 'other',
            permit: 'other',
            subcontractor: 'labor',
            travel: 'other',
            other: 'other'
        };

        // Group expenses by type and link to line items
        const actualByType = {
            material: 0,
            labor: 0,
            service: 0,
            other: 0
        };

        expenses.forEach(expense => {
            const expenseType = expenseCategoryMap[expense.category] || 'other';
            actualByType[expenseType] += expense.amount || 0;

            // If expense is linked to a quote item, add to that item's actuals
            if (expense.quoteItemId) {
                Object.values(budgetByType).forEach(category => {
                    const linkedItem = category.items.find(i => i.id === expense.quoteItemId);
                    if (linkedItem) {
                        linkedItem.actual += expense.amount || 0;
                        linkedItem.expenses.push(expense);
                    }
                });
            }
        });

        // Calculate totals and variances
        const totalBudgeted = Object.values(budgetByType).reduce((sum, c) => sum + c.budgeted, 0);
        const totalActual = Object.values(actualByType).reduce((sum, a) => sum + a, 0);
        const totalVariance = totalBudgeted - totalActual;
        const variancePercent = totalBudgeted > 0 ? (totalVariance / totalBudgeted) * 100 : 0;

        // Build category summaries
        const categories = ['material', 'labor', 'service', 'other'].map(type => ({
            type,
            label: type.charAt(0).toUpperCase() + type.slice(1),
            budgeted: budgetByType[type].budgeted,
            actual: actualByType[type],
            variance: budgetByType[type].budgeted - actualByType[type],
            variancePercent: budgetByType[type].budgeted > 0
                ? ((budgetByType[type].budgeted - actualByType[type]) / budgetByType[type].budgeted) * 100
                : 0,
            items: budgetByType[type].items,
            isOverBudget: actualByType[type] > budgetByType[type].budgeted
        })).filter(c => c.budgeted > 0 || c.actual > 0);

        // Calculate profit metrics
        const jobRevenue = job?.total || totalBudgeted;
        const grossProfit = jobRevenue - totalActual;
        const grossMargin = jobRevenue > 0 ? (grossProfit / jobRevenue) * 100 : 0;

        return {
            totalBudgeted,
            totalActual,
            totalVariance,
            variancePercent,
            categories,
            grossProfit,
            grossMargin,
            jobRevenue,
            isOverBudget: totalActual > totalBudgeted,
            hasExpenses: expenses.length > 0,
            linkedExpenseCount: expenses.filter(e => e.quoteItemId).length,
            unlinkedExpenseCount: expenses.filter(e => !e.quoteItemId).length
        };
    }, [job, expenses, lineItems]);

    // ----------------------------------------
    // Compact summary view
    // ----------------------------------------
    if (compact) {
        return (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={16} className="text-slate-600" />
                        <span className="text-sm font-semibold text-slate-700">Budget vs Actual</span>
                    </div>
                    <StatusBadge analysis={analysis} />
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                        <p className="text-xs text-slate-500">Budgeted</p>
                        <p className="text-lg font-bold text-slate-700">
                            {formatCurrency(analysis.totalBudgeted)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Actual</p>
                        <p className={`text-lg font-bold ${analysis.isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(analysis.totalActual)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Margin</p>
                        <p className={`text-lg font-bold ${analysis.grossMargin >= 30 ? 'text-emerald-600' : analysis.grossMargin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                            {analysis.grossMargin.toFixed(0)}%
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Full view
    // ----------------------------------------
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BarChart3 size={20} />
                        <h3 className="font-bold">Budget vs Actual</h3>
                    </div>
                    <StatusBadge analysis={analysis} />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 border-b border-slate-200">
                <MetricCard
                    label="Total Budgeted"
                    value={formatCurrency(analysis.totalBudgeted)}
                    icon={Target}
                    color="slate"
                />
                <MetricCard
                    label="Actual Spend"
                    value={formatCurrency(analysis.totalActual)}
                    icon={Receipt}
                    color={analysis.isOverBudget ? 'red' : 'emerald'}
                    subtext={`${analysis.linkedExpenseCount}/${expenses.length} linked`}
                />
                <MetricCard
                    label="Variance"
                    value={formatCurrency(Math.abs(analysis.totalVariance))}
                    icon={analysis.totalVariance >= 0 ? TrendingUp : TrendingDown}
                    color={analysis.totalVariance >= 0 ? 'emerald' : 'red'}
                    subtext={formatPercent(analysis.variancePercent)}
                    prefix={analysis.totalVariance >= 0 ? '+' : '-'}
                />
                <MetricCard
                    label="Gross Margin"
                    value={`${analysis.grossMargin.toFixed(1)}%`}
                    icon={Percent}
                    color={analysis.grossMargin >= 30 ? 'emerald' : analysis.grossMargin >= 15 ? 'amber' : 'red'}
                    subtext={`${formatCurrency(analysis.grossProfit)} profit`}
                />
            </div>

            {/* Category Breakdown */}
            <div className="p-4">
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Cost Breakdown by Category
                </h4>

                {analysis.categories.length === 0 ? (
                    <p className="text-center text-slate-400 py-6">
                        No budget data available. Add line items to the quote to track costs.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {analysis.categories.map(category => (
                            <CategoryRow
                                key={category.type}
                                category={category}
                                expanded={expandedCategory === category.type}
                                onToggle={() => setExpandedCategory(
                                    expandedCategory === category.type ? null : category.type
                                )}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Unlinked Expenses Warning */}
            {analysis.unlinkedExpenseCount > 0 && (
                <div className="mx-4 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-800">
                            {analysis.unlinkedExpenseCount} expense{analysis.unlinkedExpenseCount !== 1 ? 's' : ''} not linked to quote items
                        </p>
                        <p className="text-xs text-amber-600 mt-1">
                            Link expenses to specific line items for more accurate cost tracking
                        </p>
                    </div>
                </div>
            )}

            {/* Profit Summary */}
            <div className="px-4 pb-4">
                <div className={`p-4 rounded-xl ${
                    analysis.grossMargin >= 30
                        ? 'bg-emerald-50 border border-emerald-200'
                        : analysis.grossMargin >= 15
                            ? 'bg-amber-50 border border-amber-200'
                            : 'bg-red-50 border border-red-200'
                }`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-600">Estimated Gross Profit</p>
                            <p className={`text-2xl font-bold ${
                                analysis.grossMargin >= 30
                                    ? 'text-emerald-700'
                                    : analysis.grossMargin >= 15
                                        ? 'text-amber-700'
                                        : 'text-red-700'
                            }`}>
                                {formatCurrency(analysis.grossProfit)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-slate-500">on {formatCurrency(analysis.jobRevenue)} revenue</p>
                            <p className={`text-lg font-bold ${
                                analysis.grossMargin >= 30
                                    ? 'text-emerald-600'
                                    : analysis.grossMargin >= 15
                                        ? 'text-amber-600'
                                        : 'text-red-600'
                            }`}>
                                {analysis.grossMargin.toFixed(1)}% margin
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// SUB-COMPONENTS
// ============================================

const StatusBadge = ({ analysis }) => {
    if (!analysis.hasExpenses) {
        return (
            <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
                No expenses yet
            </span>
        );
    }

    if (analysis.isOverBudget) {
        return (
            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                <AlertTriangle size={12} />
                Over Budget
            </span>
        );
    }

    return (
        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full flex items-center gap-1">
            <CheckCircle size={12} />
            On Track
        </span>
    );
};

const MetricCard = ({ label, value, icon: Icon, color, subtext, prefix }) => (
    <div className="bg-white rounded-xl p-3 border border-slate-200">
        <div className="flex items-center gap-2 mb-1">
            <Icon size={14} className={`text-${color}-500`} />
            <span className="text-xs text-slate-500">{label}</span>
        </div>
        <p className={`text-xl font-bold text-${color}-600`}>
            {prefix}{value}
        </p>
        {subtext && (
            <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>
        )}
    </div>
);

const CategoryRow = ({ category, expanded, onToggle }) => {
    const progressPercent = category.budgeted > 0
        ? Math.min(100, (category.actual / category.budgeted) * 100)
        : 0;

    const CategoryIcon = {
        material: Package,
        labor: Wrench,
        service: Clock,
        other: DollarSign
    }[category.type] || DollarSign;

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
            >
                <CategoryIcon size={18} className="text-slate-500" />
                <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">{category.label}</span>
                        <div className="flex items-center gap-3 text-sm">
                            <span className="text-slate-500">
                                {formatCurrency(category.actual)} / {formatCurrency(category.budgeted)}
                            </span>
                            <span className={category.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                {category.variance >= 0 ? '+' : ''}{formatCurrency(category.variance)}
                            </span>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                        <div
                            className={`h-1.5 rounded-full transition-all ${
                                category.isOverBudget ? 'bg-red-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
                {category.items.length > 0 && (
                    expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />
                )}
            </button>

            {expanded && category.items.length > 0 && (
                <div className="px-4 pb-3 pt-1 bg-slate-50 border-t border-slate-100">
                    <div className="space-y-2">
                        {category.items.map(item => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"
                            >
                                <span className="text-slate-600">{item.name}</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-slate-400">
                                        {formatCurrency(item.actual)} / {formatCurrency(item.budgeted)}
                                    </span>
                                    <span className={`font-medium ${
                                        item.budgeted - item.actual >= 0 ? 'text-emerald-600' : 'text-red-600'
                                    }`}>
                                        {item.budgeted - item.actual >= 0 ? '+' : ''}{formatCurrency(item.budgeted - item.actual)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetVsActualView;
