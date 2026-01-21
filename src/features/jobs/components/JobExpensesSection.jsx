import React, { useState, useEffect } from 'react';
import {
    Receipt, Plus, Trash2, Calendar, FileText,
    DollarSign, AlertCircle, Loader2, Save, X
} from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { addJobExpense, deleteJobExpense, getJobExpenses, EXPENSE_CATEGORIES } from '../lib/expenseService';
import toast from 'react-hot-toast';

export const JobExpensesSection = ({ job, appId }) => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        category: 'material',
        date: new Date().toISOString().split('T')[0],
        merchant: ''
    });

    // Load expenses
    useEffect(() => {
        if (job?.id && appId) {
            loadExpenses();
        }
    }, [job?.id, appId]);

    const loadExpenses = async () => {
        try {
            setLoading(true);
            const data = await getJobExpenses(appId, job.id);
            setExpenses(data);
        } catch (error) {
            console.error('Failed to load expenses:', error);
            toast.error('Could not load expenses');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.description || !formData.amount) {
            toast.error('Please fill in required fields');
            return;
        }

        setSubmitting(true);
        try {
            await addJobExpense(appId, job.id, formData);
            toast.success('Expense added');
            setIsAdding(false);
            setFormData({
                description: '',
                amount: '',
                category: 'material',
                date: new Date().toISOString().split('T')[0],
                merchant: ''
            });
            loadExpenses();
        } catch (error) {
            console.error(error);
            toast.error('Failed to add expense');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (expenseId) => {
        if (!window.confirm('Are you sure you want to delete this expense?')) return;

        try {
            await deleteJobExpense(appId, job.id, expenseId);
            toast.success('Expense deleted');
            loadExpenses();
        } catch (error) {
            toast.error('Failed to delete expense');
        }
    };

    const totalExpenses = expenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    // Calculate Profitability (Simple)
    // Revenue = job.total
    // Expenses = totalExpenses
    // Labor = job.estimatedDuration * (crewSize) * rate? (We don't have exact labor cost yet, simpler to just start with Revenue - Expenses)
    const revenue = job.total || 0;
    const grossProfit = revenue - totalExpenses;
    const profitMargin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0;

    return (
        <div className="mt-6 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="flex items-center gap-2 font-bold text-slate-800">
                        <Receipt size={20} className="text-slate-400" />
                        Expenses & Profitability
                    </h3>
                    <p className="text-xs text-slate-500">Track job costs and materials</p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                        <Plus size={14} /> Add Expense
                    </button>
                )}
            </div>

            {/* Profitability Summary Card */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-medium mb-1">Revenue</p>
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(revenue)}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-xs text-red-600 font-medium mb-1">Expenses</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className={`p-3 rounded-xl border ${grossProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
                    <p className={`text-xs font-medium mb-1 ${grossProfit >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>Gross Profit</p>
                    <p className={`text-lg font-bold ${grossProfit >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
                        {formatCurrency(grossProfit)}
                        <span className="text-xs ml-1 opacity-75">({profitMargin}%)</span>
                    </p>
                </div>
            </div>

            {/* Add Form */}
            {isAdding && (
                <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                            <input
                                type="text"
                                placeholder="e.g. Copper Pipe"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Category</label>
                            <div className="relative">
                                <select
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm appearance-none bg-white"
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                >
                                    {EXPENSE_CATEGORIES.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Date</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="px-3 py-2 text-slate-500 font-medium text-xs hover:bg-slate-200 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-3 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 flex items-center gap-2"
                        >
                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save Expense
                        </button>
                    </div>
                </form>
            )}

            {/* Expenses List */}
            {loading ? (
                <div className="flex justify-center py-4">
                    <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
            ) : expenses.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-sm text-slate-500">No expenses logged yet</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {expenses.map(expense => (
                        <div key={expense.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                                    <FileText size={16} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-700 text-sm">{expense.description}</p>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <span>{new Date(expense.date).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span className="capitalize">{expense.category}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-slate-800">{formatCurrency(expense.amount)}</span>
                                <button
                                    onClick={() => handleDelete(expense.id)}
                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default JobExpensesSection;
