// src/features/contractor-pro/lib/expenseService.js
// ============================================
// EXPENSE TRACKING SERVICE
// ============================================
// Firebase service functions for expense management

import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    serverTimestamp,
    getDocs,
    Timestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';

// ============================================
// CONSTANTS
// ============================================
export const EXPENSE_CATEGORIES = [
    { id: 'materials', label: 'Materials', icon: 'Package', color: '#3b82f6' },
    { id: 'labor', label: 'Labor/Subcontractor', icon: 'Users', color: '#8b5cf6' },
    { id: 'travel', label: 'Travel/Mileage', icon: 'Car', color: '#f59e0b' },
    { id: 'tools', label: 'Tools/Equipment', icon: 'Wrench', color: '#ef4444' },
    { id: 'supplies', label: 'Supplies', icon: 'ShoppingBag', color: '#10b981' },
    { id: 'permits', label: 'Permits/Fees', icon: 'FileText', color: '#ec4899' },
    { id: 'other', label: 'Other', icon: 'MoreHorizontal', color: '#64748b' },
];

export const EXPENSE_SUBCOLLECTION = 'expenses';

// ============================================
// CREATE EXPENSE
// ============================================
export async function createExpense(contractorId, expenseData) {
    if (!contractorId) throw new Error('Contractor ID required');
    
    const expensesRef = collection(
        db, 
        CONTRACTORS_COLLECTION_PATH, 
        contractorId, 
        EXPENSE_SUBCOLLECTION
    );
    
    const expense = {
        ...expenseData,
        amount: parseFloat(expenseData.amount) || 0,
        date: expenseData.date || new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(expensesRef, expense);
    return { success: true, expenseId: docRef.id };
}

// ============================================
// UPDATE EXPENSE
// ============================================
export async function updateExpense(contractorId, expenseId, expenseData) {
    if (!contractorId || !expenseId) throw new Error('Contractor ID and Expense ID required');
    
    const expenseRef = doc(
        db, 
        CONTRACTORS_COLLECTION_PATH, 
        contractorId, 
        EXPENSE_SUBCOLLECTION, 
        expenseId
    );
    
    await updateDoc(expenseRef, {
        ...expenseData,
        amount: parseFloat(expenseData.amount) || 0,
        updatedAt: serverTimestamp(),
    });
    
    return { success: true };
}

// ============================================
// DELETE EXPENSE
// ============================================
export async function deleteExpense(contractorId, expenseId) {
    if (!contractorId || !expenseId) throw new Error('Contractor ID and Expense ID required');
    
    const expenseRef = doc(
        db, 
        CONTRACTORS_COLLECTION_PATH, 
        contractorId, 
        EXPENSE_SUBCOLLECTION, 
        expenseId
    );
    
    await deleteDoc(expenseRef);
    return { success: true };
}

// ============================================
// SUBSCRIBE TO ALL EXPENSES
// ============================================
export function subscribeToExpenses(contractorId, callback) {
    if (!contractorId) {
        callback([]);
        return () => {};
    }
    
    const expensesRef = collection(
        db, 
        CONTRACTORS_COLLECTION_PATH, 
        contractorId, 
        EXPENSE_SUBCOLLECTION
    );
    
    const q = query(expensesRef, orderBy('date', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
        const expenses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(expenses);
    }, (error) => {
        console.error('Error subscribing to expenses:', error);
        callback([]);
    });
}

// ============================================
// GET EXPENSES BY JOB
// ============================================
export async function getExpensesByJob(contractorId, jobId) {
    if (!contractorId || !jobId) return [];
    
    const expensesRef = collection(
        db, 
        CONTRACTORS_COLLECTION_PATH, 
        contractorId, 
        EXPENSE_SUBCOLLECTION
    );
    
    const q = query(expensesRef, where('jobId', '==', jobId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

// ============================================
// GET EXPENSES BY DATE RANGE
// ============================================
export async function getExpensesByDateRange(contractorId, startDate, endDate) {
    if (!contractorId) return [];
    
    const expensesRef = collection(
        db, 
        CONTRACTORS_COLLECTION_PATH, 
        contractorId, 
        EXPENSE_SUBCOLLECTION
    );
    
    const q = query(
        expensesRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

// ============================================
// CALCULATE EXPENSE STATS
// ============================================
export function calculateExpenseStats(expenses) {
    const stats = {
        total: 0,
        byCategory: {},
        byJob: {},
        count: expenses.length,
    };
    
    // Initialize categories
    EXPENSE_CATEGORIES.forEach(cat => {
        stats.byCategory[cat.id] = 0;
    });
    
    expenses.forEach(expense => {
        const amount = parseFloat(expense.amount) || 0;
        stats.total += amount;
        
        // By category
        const category = expense.category || 'other';
        stats.byCategory[category] = (stats.byCategory[category] || 0) + amount;
        
        // By job
        if (expense.jobId) {
            stats.byJob[expense.jobId] = (stats.byJob[expense.jobId] || 0) + amount;
        }
    });
    
    return stats;
}

// ============================================
// CALCULATE JOB PROFIT
// ============================================
export function calculateJobProfit(job, expenses) {
    const revenue = job?.total || 0;
    const jobExpenses = expenses.filter(e => e.jobId === job?.id);
    const totalExpenses = jobExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const profit = revenue - totalExpenses;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    
    return {
        revenue,
        expenses: totalExpenses,
        profit,
        profitMargin,
        expenseCount: jobExpenses.length,
    };
}
