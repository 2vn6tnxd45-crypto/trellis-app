// src/features/contractor-pro/hooks/useExpenses.js
// ============================================
// EXPENSE TRACKING HOOK
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    subscribeToExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    calculateExpenseStats,
    calculateJobProfit,
    EXPENSE_CATEGORIES
} from '../lib/expenseService';

export const useExpenses = (contractorId) => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Subscribe to expenses
    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            setExpenses([]);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeToExpenses(contractorId, (data) => {
            setExpenses(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [contractorId]);

    // Calculate stats
    const stats = useMemo(() => {
        return calculateExpenseStats(expenses);
    }, [expenses]);

    // Filter by category
    const getByCategory = useCallback((category) => {
        return expenses.filter(e => e.category === category);
    }, [expenses]);

    // Filter by job
    const getByJob = useCallback((jobId) => {
        return expenses.filter(e => e.jobId === jobId);
    }, [expenses]);

    // Filter by date range
    const getByDateRange = useCallback((startDate, endDate) => {
        return expenses.filter(e => {
            const expenseDate = e.date;
            return expenseDate >= startDate && expenseDate <= endDate;
        });
    }, [expenses]);

    // Get this month's expenses
    const thisMonthExpenses = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        return expenses.filter(e => e.date >= startOfMonth && e.date <= endOfMonth);
    }, [expenses]);

    // This month's stats
    const thisMonthStats = useMemo(() => {
        return calculateExpenseStats(thisMonthExpenses);
    }, [thisMonthExpenses]);

    // CRUD operations
    const addExpense = useCallback(async (expenseData) => {
        if (!contractorId) throw new Error('Not authenticated');
        return createExpense(contractorId, expenseData);
    }, [contractorId]);

    const editExpense = useCallback(async (expenseId, expenseData) => {
        if (!contractorId) throw new Error('Not authenticated');
        return updateExpense(contractorId, expenseId, expenseData);
    }, [contractorId]);

    const removeExpense = useCallback(async (expenseId) => {
        if (!contractorId) throw new Error('Not authenticated');
        return deleteExpense(contractorId, expenseId);
    }, [contractorId]);

    // Calculate profit for a job
    const getJobProfit = useCallback((job) => {
        return calculateJobProfit(job, expenses);
    }, [expenses]);

    return {
        expenses,
        loading,
        error,
        stats,
        thisMonthExpenses,
        thisMonthStats,
        getByCategory,
        getByJob,
        getByDateRange,
        getJobProfit,
        addExpense,
        editExpense,
        removeExpense,
        categories: EXPENSE_CATEGORIES,
    };
};

export default useExpenses;
