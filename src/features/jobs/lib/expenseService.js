
import { db } from '../../../config/firebase';
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp,
    query,
    orderBy
} from 'firebase/firestore';

const EXPENSES_COLLECTION = 'expenses';
const JOB_COLLECTION = 'jobs';

export const EXPENSE_CATEGORIES = [
    { id: 'material', label: 'Material' },
    { id: 'rental', label: 'Equipment Rental' },
    { id: 'permit', label: 'Permit & Fees' },
    { id: 'subcontractor', label: 'Subcontractor' },
    { id: 'travel', label: 'Travel/Fuel' },
    { id: 'other', label: 'Other' }
];

/**
 * Add an expense to a specific job
 * @param {string} appId 
 * @param {string} jobId 
 * @param {Object} expenseData 
 */
export const addJobExpense = async (appId, jobId, expenseData) => {
    try {
        const expensesRef = collection(db, 'artifacts', appId, JOB_COLLECTION, jobId, EXPENSES_COLLECTION);

        const docRef = await addDoc(expensesRef, {
            ...expenseData,
            amount: parseFloat(expenseData.amount),
            date: expenseData.date ? new Date(expenseData.date) : new Date(),
            createdAt: serverTimestamp()
        });

        return { id: docRef.id, ...expenseData };
    } catch (error) {
        console.error('Error adding expense:', error);
        throw error;
    }
};

/**
 * Get all expenses for a job
 * @param {string} appId 
 * @param {string} jobId 
 */
export const getJobExpenses = async (appId, jobId) => {
    try {
        const expensesRef = collection(db, 'artifacts', appId, JOB_COLLECTION, jobId, EXPENSES_COLLECTION);
        const q = query(expensesRef, orderBy('date', 'desc'));

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert timestamps to Date objects if needed
            date: doc.data().date?.toDate?.() || new Date(doc.data().date)
        }));
    } catch (error) {
        console.error('Error fetching expenses:', error);
        throw error;
    }
};

/**
 * Delete an expense
 * @param {string} appId 
 * @param {string} jobId 
 * @param {string} expenseId 
 */
export const deleteJobExpense = async (appId, jobId, expenseId) => {
    try {
        const expenseRef = doc(db, 'artifacts', appId, JOB_COLLECTION, jobId, EXPENSES_COLLECTION, expenseId);
        await deleteDoc(expenseRef);
        return true;
    } catch (error) {
        console.error('Error deleting expense:', error);
        throw error;
    }
};
