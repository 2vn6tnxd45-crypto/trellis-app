// src/features/contractor-pro/components/ExpenseTracker.jsx
// ============================================
// EXPENSE TRACKER
// ============================================
// Comprehensive expense tracking for contractors
// Features:
// - Log expenses by category
// - Link expenses to jobs
// - See profit margins
// - Category breakdown charts
// - Date range filtering

import React, { useState, useMemo } from 'react';
import {
    DollarSign, Plus, X, Edit2, Trash2, Search,
    Calendar, Tag, FileText, Package, Users, Car,
    Wrench, ShoppingBag, MoreHorizontal, Filter,
    TrendingUp, TrendingDown, PieChart, Briefcase,
    ChevronDown, ChevronRight, Receipt, Camera,
    Check, AlertCircle, Loader2, Download
} from 'lucide-react';
import { Select } from '../../../components/ui/Select';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../../lib/utils';

// ============================================
// CONSTANTS
// ============================================
const EXPENSE_CATEGORIES = [
    { id: 'materials', label: 'Materials', icon: Package, color: '#3b82f6', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
    { id: 'labor', label: 'Labor/Subcontractor', icon: Users, color: '#8b5cf6', bgColor: 'bg-purple-50', textColor: 'text-purple-600' },
    { id: 'travel', label: 'Travel/Mileage', icon: Car, color: '#f59e0b', bgColor: 'bg-amber-50', textColor: 'text-amber-600' },
    { id: 'tools', label: 'Tools/Equipment', icon: Wrench, color: '#ef4444', bgColor: 'bg-red-50', textColor: 'text-red-600' },
    { id: 'supplies', label: 'Supplies', icon: ShoppingBag, color: '#10b981', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600' },
    { id: 'permits', label: 'Permits/Fees', icon: FileText, color: '#ec4899', bgColor: 'bg-pink-50', textColor: 'text-pink-600' },
    { id: 'other', label: 'Other', icon: MoreHorizontal, color: '#64748b', bgColor: 'bg-slate-50', textColor: 'text-slate-600' },
];

const TIME_FILTERS = [
    { id: 'all', label: 'All Time' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_quarter', label: 'This Quarter' },
    { id: 'this_year', label: 'This Year' },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================


const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getDateRange = (filterId) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    switch (filterId) {
        case 'this_week': {
            const start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            return { start: start.toISOString().split('T')[0], end: today };
        }
        case 'this_month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start: start.toISOString().split('T')[0], end: today };
        }
        case 'last_month': {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
        }
        case 'this_quarter': {
            const quarter = Math.floor(now.getMonth() / 3);
            const start = new Date(now.getFullYear(), quarter * 3, 1);
            return { start: start.toISOString().split('T')[0], end: today };
        }
        case 'this_year': {
            const start = new Date(now.getFullYear(), 0, 1);
            return { start: start.toISOString().split('T')[0], end: today };
        }
        default:
            return { start: null, end: null };
    }
};

const getCategoryConfig = (categoryId) => {
    return EXPENSE_CATEGORIES.find(c => c.id === categoryId) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
};

// ============================================
// STAT CARD COMPONENT
// ============================================
const StatCard = ({ icon: Icon, label, value, subValue, color = 'emerald', trend }) => {
    const colorClasses = {
        emerald: 'bg-emerald-50 text-emerald-600',
        blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600',
        amber: 'bg-amber-50 text-amber-600',
        red: 'bg-red-50 text-red-600',
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${colorClasses[color]}`}>
                    <Icon size={20} />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                        {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(trend).toFixed(0)}%
                    </div>
                )}
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-black text-slate-800">{value}</p>
            {subValue && <p className="text-sm text-slate-500 mt-1">{subValue}</p>}
        </div>
    );
};

// ============================================
// CATEGORY BREAKDOWN CHART
// ============================================
const CategoryBreakdown = ({ expenses, stats }) => {
    const categoryData = useMemo(() => {
        return EXPENSE_CATEGORIES
            .map(cat => ({
                ...cat,
                amount: stats.byCategory[cat.id] || 0,
                percentage: stats.total > 0 ? ((stats.byCategory[cat.id] || 0) / stats.total) * 100 : 0,
            }))
            .filter(cat => cat.amount > 0)
            .sort((a, b) => b.amount - a.amount);
    }, [stats]);

    if (categoryData.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Spending by Category</h3>
                <div className="text-center py-8">
                    <PieChart className="mx-auto text-slate-300 mb-3" size={40} />
                    <p className="text-slate-500">No expenses to show</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4">Spending by Category</h3>
            <div className="space-y-3">
                {categoryData.map(cat => {
                    const Icon = cat.icon;
                    return (
                        <div key={cat.id} className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${cat.bgColor}`}>
                                <Icon size={16} className={cat.textColor} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-slate-700">{cat.label}</span>
                                    <span className="text-sm font-bold text-slate-800">{formatCurrency(cat.amount)}</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${cat.percentage}%`,
                                            backgroundColor: cat.color
                                        }}
                                    />
                                </div>
                            </div>
                            <span className="text-xs text-slate-400 w-12 text-right">
                                {cat.percentage.toFixed(0)}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================
// JOB PROFIT CARD
// ============================================
const JobProfitCard = ({ job, expenses }) => {
    const jobExpenses = expenses.filter(e => e.jobId === job.id);
    const totalExpenses = jobExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const revenue = job.total || 0;
    const profit = revenue - totalExpenses;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const isProfit = profit >= 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="font-bold text-slate-800 truncate">{job.title || 'Job'}</p>
                    <p className="text-sm text-slate-500">{job.customer?.name || 'Customer'}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${isProfit ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                    {profitMargin.toFixed(0)}% margin
                </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-xs text-slate-500">Revenue</p>
                    <p className="font-bold text-slate-800">{formatCurrency(revenue)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-xs text-red-600">Expenses</p>
                    <p className="font-bold text-red-700">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className={`rounded-lg p-2 ${isProfit ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className={`text-xs ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>Profit</p>
                    <p className={`font-bold ${isProfit ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatCurrency(profit)}
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ADD/EDIT EXPENSE MODAL
// ============================================
const ExpenseModal = ({ expense, jobs, onSave, onClose, saving }) => {
    const [formData, setFormData] = useState({
        description: expense?.description || '',
        amount: expense?.amount || '',
        category: expense?.category || 'materials',
        date: expense?.date || new Date().toISOString().split('T')[0],
        vendor: expense?.vendor || '',
        jobId: expense?.jobId || '',
        quoteItemId: expense?.quoteItemId || '',
        notes: expense?.notes || '',
    });

    const isEditing = !!expense?.id;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.description || !formData.amount) {
            toast.error('Please fill in description and amount');
            return;
        }
        onSave({
            ...formData,
            amount: parseFloat(formData.amount) || 0,
        });
    };

    const selectedCategory = getCategoryConfig(formData.category);
    const CategoryIcon = selectedCategory.icon;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${selectedCategory.bgColor}`}>
                            <CategoryIcon size={20} className={selectedCategory.textColor} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">
                                {isEditing ? 'Edit Expense' : 'Add Expense'}
                            </h2>
                            <p className="text-sm text-slate-500">Track your business expenses</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                    {/* Description */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                            Description *
                        </label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="e.g., Copper pipes for bathroom remodel"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            required
                        />
                    </div>

                    {/* Amount & Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">
                                Amount *
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">
                                Date
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Category
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {EXPENSE_CATEGORIES.map(cat => {
                                const Icon = cat.icon;
                                const isSelected = formData.category === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, category: cat.id })}
                                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${isSelected
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <Icon size={18} style={{ color: cat.color }} />
                                        <span className="text-xs font-medium text-slate-600 truncate w-full text-center">
                                            {cat.label.split('/')[0]}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Vendor */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                            Vendor / Store
                        </label>
                        <input
                            type="text"
                            value={formData.vendor}
                            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                            placeholder="e.g., Home Depot, Ferguson"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        />
                    </div>

                    {/* Link to Job */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                            Link to Job (optional)
                        </label>
                        <Select
                            value={formData.jobId}
                            onChange={(val) => setFormData({ ...formData, jobId: val, quoteItemId: '' })}
                            options={[
                                { value: '', label: '-- General Business Expense --' },
                                ...(jobs || []).map(job => ({
                                    value: job.id,
                                    label: `${job.title || 'Job'} - ${job.customer?.name || 'Customer'}`
                                }))
                            ]}
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Link to a job to track profit margins
                        </p>
                    </div>

                    {/* Link to Quote Item (Condition: If Job Selected) */}
                    {formData.jobId && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">
                                Link to Quote Item (optional)
                            </label>
                            <Select
                                value={formData.quoteItemId}
                                onChange={(val) => setFormData({ ...formData, quoteItemId: val })}
                                options={[
                                    { value: '', label: '-- General Job Expense --' },
                                    ...(jobs.find(j => j.id === formData.jobId)?.lineItems || []).map(item => ({
                                        value: item.id,
                                        label: `${item.description} (${formatCurrency(item.unitPrice * item.quantity)})`
                                    }))
                                ]}
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                Attribute this cost to a specific line item for precise tracking
                            </p>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Any additional details..."
                            rows={2}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                        />
                    </div>
                </form>

                {/* Actions */}
                <div className="p-6 border-t border-slate-100 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !formData.description || !formData.amount}
                        className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                    >
                        {saving ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Check size={18} />
                        )}
                        {isEditing ? 'Save Changes' : 'Add Expense'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// EXPENSE ROW COMPONENT
// ============================================
const ExpenseRow = ({ expense, jobs, onEdit, onDelete }) => {
    const category = getCategoryConfig(expense.category);
    const Icon = category.icon;
    const linkedJob = jobs?.find(j => j.id === expense.jobId);

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-4">
                {/* Category Icon */}
                <div className={`p-3 rounded-xl ${category.bgColor} flex-shrink-0`}>
                    <Icon size={20} className={category.textColor} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{expense.description}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${category.bgColor} ${category.textColor}`}>
                                    {category.label}
                                </span>
                                {expense.vendor && (
                                    <span className="text-xs text-slate-500">{expense.vendor}</span>
                                )}
                                {linkedJob && (
                                    <span className="text-xs text-blue-600 flex items-center gap-1">
                                        <Briefcase size={10} />
                                        {linkedJob.title || 'Job'}
                                        {expense.quoteItemId && (
                                            <>
                                                <span className="text-slate-300">|</span>
                                                <span className="text-slate-500">
                                                    {linkedJob.lineItems?.find(i => i.id === expense.quoteItemId)?.description || 'Linked Item'}
                                                </span>
                                            </>
                                        )}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="font-bold text-red-600 text-lg">-{formatCurrency(expense.amount)}</p>
                            <p className="text-xs text-slate-400">{formatDate(expense.date)}</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                        onClick={() => onEdit(expense)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => onDelete(expense)}
                        className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// EMPTY STATE
// ============================================
const EmptyState = ({ onAddExpense }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt size={32} className="text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">No Expenses Tracked</h3>
        <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            Start tracking your business expenses to see real profit margins on your jobs.
        </p>
        <button
            onClick={onAddExpense}
            className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 inline-flex items-center gap-2"
        >
            <Plus size={18} />
            Add First Expense
        </button>
    </div>
);

// ============================================
// MAIN EXPENSE TRACKER COMPONENT
// ============================================
export const ExpenseTracker = ({
    expenses = [],
    jobs = [],
    loading = false,
    onAddExpense,
    onEditExpense,
    onDeleteExpense,
}) => {
    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [saving, setSaving] = useState(false);
    const [timeFilter, setTimeFilter] = useState('this_month');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState('expenses'); // 'expenses' | 'profits'

    // Filter expenses
    const filteredExpenses = useMemo(() => {
        let result = [...expenses];

        // Time filter
        if (timeFilter !== 'all') {
            const { start, end } = getDateRange(timeFilter);
            if (start && end) {
                result = result.filter(e => e.date >= start && e.date <= end);
            }
        }

        // Category filter
        if (categoryFilter !== 'all') {
            result = result.filter(e => e.category === categoryFilter);
        }

        // Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(e =>
                e.description?.toLowerCase().includes(query) ||
                e.vendor?.toLowerCase().includes(query)
            );
        }

        return result;
    }, [expenses, timeFilter, categoryFilter, searchQuery]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const byCategory = {};

        EXPENSE_CATEGORIES.forEach(cat => {
            byCategory[cat.id] = 0;
        });

        filteredExpenses.forEach(e => {
            const cat = e.category || 'other';
            byCategory[cat] = (byCategory[cat] || 0) + (parseFloat(e.amount) || 0);
        });

        // Jobs with expenses
        const jobIds = [...new Set(filteredExpenses.filter(e => e.jobId).map(e => e.jobId))];
        const jobsWithExpenses = jobs.filter(j => jobIds.includes(j.id));

        return {
            total,
            byCategory,
            count: filteredExpenses.length,
            jobsWithExpenses,
        };
    }, [filteredExpenses, jobs]);

    // Handle save
    const handleSave = async (expenseData) => {
        setSaving(true);
        try {
            if (editingExpense?.id) {
                await onEditExpense(editingExpense.id, expenseData);
                toast.success('Expense updated');
            } else {
                await onAddExpense(expenseData);
                toast.success('Expense added');
            }
            setShowModal(false);
            setEditingExpense(null);
        } catch (error) {
            toast.error('Failed to save expense');
        } finally {
            setSaving(false);
        }
    };

    // Handle delete
    const handleDelete = async (expense) => {
        if (!confirm('Delete this expense?')) return;
        try {
            await onDeleteExpense(expense.id);
            toast.success('Expense deleted');
        } catch (error) {
            toast.error('Failed to delete expense');
        }
    };

    // Handle edit
    const handleEdit = (expense) => {
        setEditingExpense(expense);
        setShowModal(true);
    };

    // Handle add new
    const handleAddNew = () => {
        setEditingExpense(null);
        setShowModal(true);
    };

    const selectedTimeFilter = TIME_FILTERS.find(f => f.id === timeFilter);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={40} className="animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Expense Tracker</h1>
                    <p className="text-slate-500">Track costs and see real profit margins</p>
                </div>
                <button
                    onClick={handleAddNew}
                    className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                    <Plus size={18} />
                    Add Expense
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={DollarSign}
                    label="Total Expenses"
                    value={formatCurrency(stats.total)}
                    subValue={`${stats.count} expense${stats.count !== 1 ? 's' : ''}`}
                    color="red"
                />
                <StatCard
                    icon={Package}
                    label="Materials"
                    value={formatCurrency(stats.byCategory.materials)}
                    color="blue"
                />
                <StatCard
                    icon={Users}
                    label="Labor"
                    value={formatCurrency(stats.byCategory.labor)}
                    color="purple"
                />
                <StatCard
                    icon={Car}
                    label="Travel"
                    value={formatCurrency(stats.byCategory.travel)}
                    color="amber"
                />
            </div>

            {/* View Toggle & Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                {/* View Toggle */}
                <div className="flex bg-slate-100 rounded-xl p-1">
                    <button
                        onClick={() => setViewMode('expenses')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'expenses'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Expenses
                    </button>
                    <button
                        onClick={() => setViewMode('profits')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'profits'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Job Profits
                    </button>
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search expenses..."
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                </div>

                {/* Time Filter */}
                <div className="relative">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:border-emerald-300 flex items-center gap-2"
                    >
                        <Calendar size={16} className="text-slate-400" />
                        {selectedTimeFilter?.label}
                        <ChevronDown size={16} className="text-slate-400" />
                    </button>

                    {showFilters && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-20">
                                {TIME_FILTERS.map(filter => (
                                    <button
                                        key={filter.id}
                                        onClick={() => {
                                            setTimeFilter(filter.id);
                                            setShowFilters(false);
                                        }}
                                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${timeFilter === filter.id ? 'text-emerald-600 font-medium bg-emerald-50' : 'text-slate-600'
                                            }`}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Category Filter */}
                <div className="w-48">
                    <Select
                        value={categoryFilter}
                        onChange={(val) => setCategoryFilter(val)}
                        options={[
                            { value: 'all', label: 'All Categories' },
                            ...EXPENSE_CATEGORIES.map(cat => ({ value: cat.id, label: cat.label }))
                        ]}
                    />
                </div>
            </div>

            {/* Content */}
            {viewMode === 'expenses' ? (
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Expense List */}
                    <div className="lg:col-span-2 space-y-3">
                        {filteredExpenses.length === 0 ? (
                            <EmptyState onAddExpense={handleAddNew} />
                        ) : (
                            filteredExpenses.map(expense => (
                                <ExpenseRow
                                    key={expense.id}
                                    expense={expense}
                                    jobs={jobs}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                />
                            ))
                        )}
                    </div>

                    {/* Category Breakdown */}
                    <div>
                        <CategoryBreakdown expenses={filteredExpenses} stats={stats} />
                    </div>
                </div>
            ) : (
                /* Job Profits View */
                <div className="space-y-4">
                    {stats.jobsWithExpenses.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                            <Briefcase className="mx-auto text-slate-300 mb-3" size={40} />
                            <h3 className="font-bold text-slate-800 mb-2">No Job Expenses Yet</h3>
                            <p className="text-slate-500">Link expenses to jobs to see profit margins.</p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {stats.jobsWithExpenses.map(job => (
                                <JobProfitCard
                                    key={job.id}
                                    job={job}
                                    expenses={filteredExpenses}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <ExpenseModal
                    expense={editingExpense}
                    jobs={jobs}
                    onSave={handleSave}
                    onClose={() => {
                        setShowModal(false);
                        setEditingExpense(null);
                    }}
                    saving={saving}
                />
            )}
        </div>
    );
};

export default ExpenseTracker;
