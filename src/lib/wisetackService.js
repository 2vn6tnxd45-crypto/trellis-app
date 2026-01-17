// src/lib/wisetackService.js
// ============================================
// WISETACK FINANCING SERVICE
// ============================================
// Client-side service for consumer financing integration
// Wisetack provides point-of-sale financing for home services

import { db } from '../config/firebase';
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';

// ============================================
// CONSTANTS
// ============================================

export const FINANCING_STATUS = {
    NOT_OFFERED: 'not_offered',
    OFFERED: 'offered',
    PENDING: 'pending',
    APPROVED: 'approved',
    DENIED: 'denied',
    FUNDED: 'funded',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
};

export const FINANCING_PROVIDER = {
    WISETACK: 'wisetack'
};

// Default financing settings
export const DEFAULT_FINANCING_SETTINGS = {
    enabled: false,
    provider: FINANCING_PROVIDER.WISETACK,
    merchantId: null,
    minAmount: 500,
    maxAmount: 25000,
    defaultTermMonths: 12,
    autoShowOnQuotes: true,
    terms: [6, 12, 18, 24, 36, 48, 60] // Available term options in months
};

// APR range for display (actual rates depend on customer credit)
export const APR_RANGE = {
    min: 0,
    max: 29.99,
    displayEstimate: 9.99 // Used for "as low as" calculations
};

// ============================================
// PAYMENT CALCULATIONS
// ============================================

/**
 * Calculate estimated monthly payment
 * @param {number} principal - Loan amount
 * @param {number} termMonths - Loan term in months
 * @param {number} apr - Annual percentage rate (decimal, e.g., 0.0999 for 9.99%)
 * @returns {number} Monthly payment rounded to nearest dollar
 */
export const calculateMonthlyPayment = (principal, termMonths = 12, apr = APR_RANGE.displayEstimate / 100) => {
    if (!principal || principal <= 0) return 0;
    if (apr === 0) return Math.round(principal / termMonths);

    const monthlyRate = apr / 12;
    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);

    return Math.round(payment);
};

/**
 * Calculate total cost of financing
 * @param {number} principal - Loan amount
 * @param {number} termMonths - Loan term in months
 * @param {number} apr - Annual percentage rate
 * @returns {Object} Total cost breakdown
 */
export const calculateFinancingCost = (principal, termMonths = 12, apr = APR_RANGE.displayEstimate / 100) => {
    const monthlyPayment = calculateMonthlyPayment(principal, termMonths, apr);
    const totalPayment = monthlyPayment * termMonths;
    const totalInterest = totalPayment - principal;

    return {
        principal,
        monthlyPayment,
        totalPayment,
        totalInterest,
        termMonths,
        apr: apr * 100
    };
};

/**
 * Get estimated payment for multiple terms
 * @param {number} principal - Loan amount
 * @returns {Array} Payment estimates for different terms
 */
export const getPaymentEstimates = (principal) => {
    const terms = [6, 12, 18, 24, 36, 48, 60];

    return terms.map(termMonths => ({
        termMonths,
        monthlyPayment: calculateMonthlyPayment(principal, termMonths),
        ...calculateFinancingCost(principal, termMonths)
    }));
};

/**
 * Format currency for display
 * @param {number} amount - Amount in dollars
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

// ============================================
// ELIGIBILITY CHECKS
// ============================================

/**
 * Check if a quote is eligible for financing
 * @param {Object} quote - Quote document
 * @param {Object} settings - Contractor's financing settings
 * @returns {Object} Eligibility result
 */
export const checkFinancingEligibility = (quote, settings = DEFAULT_FINANCING_SETTINGS) => {
    if (!settings.enabled) {
        return { eligible: false, reason: 'Financing not enabled' };
    }

    const total = quote.total || quote.grandTotal || 0;

    if (total < settings.minAmount) {
        return {
            eligible: false,
            reason: `Minimum amount is ${formatCurrency(settings.minAmount)}`,
            minAmount: settings.minAmount
        };
    }

    if (total > settings.maxAmount) {
        return {
            eligible: false,
            reason: `Maximum amount is ${formatCurrency(settings.maxAmount)}`,
            maxAmount: settings.maxAmount
        };
    }

    return {
        eligible: true,
        total,
        estimatedMonthly: calculateMonthlyPayment(total, settings.defaultTermMonths),
        defaultTermMonths: settings.defaultTermMonths
    };
};

// ============================================
// API CALLS
// ============================================

/**
 * Create a financing application
 * @param {Object} params - Application parameters
 * @returns {Promise<Object>} Application result with redirect URL
 */
export const createFinancingApplication = async ({
    quoteId,
    contractorId,
    amount,
    customerName,
    customerEmail,
    customerPhone,
    serviceDescription,
    serviceAddress
}) => {
    try {
        const response = await fetch('/api/financing/create-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteId,
                contractorId,
                amount,
                customer: {
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                    address: serviceAddress
                },
                serviceDescription
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to create financing application');
        }

        return result;
    } catch (error) {
        console.error('[Financing] Create application error:', error);
        throw error;
    }
};

/**
 * Get financing application status
 * @param {string} applicationId - Wisetack application ID
 * @returns {Promise<Object>} Application status
 */
export const getApplicationStatus = async (applicationId) => {
    try {
        const response = await fetch(`/api/financing/status?applicationId=${applicationId}`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to get application status');
        }

        return result;
    } catch (error) {
        console.error('[Financing] Get status error:', error);
        throw error;
    }
};

// ============================================
// FIRESTORE OPERATIONS
// ============================================

/**
 * Get contractor's financing settings
 * @param {string} contractorId - Contractor ID
 * @returns {Promise<Object>} Financing settings
 */
export const getFinancingSettings = async (contractorId) => {
    try {
        const contractorRef = doc(db, 'contractors', contractorId);
        const contractorDoc = await getDoc(contractorRef);

        if (!contractorDoc.exists()) {
            return DEFAULT_FINANCING_SETTINGS;
        }

        const data = contractorDoc.data();
        return {
            ...DEFAULT_FINANCING_SETTINGS,
            ...data.financing
        };
    } catch (error) {
        console.error('[Financing] Get settings error:', error);
        return DEFAULT_FINANCING_SETTINGS;
    }
};

/**
 * Update contractor's financing settings
 * @param {string} contractorId - Contractor ID
 * @param {Object} settings - New settings
 * @returns {Promise<void>}
 */
export const updateFinancingSettings = async (contractorId, settings) => {
    try {
        const contractorRef = doc(db, 'contractors', contractorId);
        await updateDoc(contractorRef, {
            financing: settings,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('[Financing] Update settings error:', error);
        throw error;
    }
};

/**
 * Update quote with financing information
 * @param {string} quoteId - Quote ID
 * @param {string} contractorId - Contractor ID
 * @param {Object} financingData - Financing data to add
 * @returns {Promise<void>}
 */
export const updateQuoteFinancing = async (quoteId, contractorId, financingData) => {
    try {
        const quoteRef = doc(db, 'contractors', contractorId, 'quotes', quoteId);
        await updateDoc(quoteRef, {
            financing: financingData,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('[Financing] Update quote error:', error);
        throw error;
    }
};

/**
 * Get financing applications for a contractor
 * @param {string} contractorId - Contractor ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Financing applications
 */
export const getFinancingApplications = async (contractorId, options = {}) => {
    try {
        const { status, limit: limitCount = 50 } = options;

        let applicationsQuery = query(
            collection(db, 'financingApplications'),
            where('contractorId', '==', contractorId),
            orderBy('createdAt', 'desc')
        );

        if (status) {
            applicationsQuery = query(applicationsQuery, where('status', '==', status));
        }

        const snapshot = await getDocs(applicationsQuery);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
        }));
    } catch (error) {
        console.error('[Financing] Get applications error:', error);
        return [];
    }
};

/**
 * Get financing statistics for a contractor
 * @param {string} contractorId - Contractor ID
 * @param {Date} startDate - Start of period
 * @param {Date} endDate - End of period
 * @returns {Promise<Object>} Financing statistics
 */
export const getFinancingStats = async (contractorId, startDate = null, endDate = null) => {
    try {
        const applications = await getFinancingApplications(contractorId);

        // Filter by date if provided
        const filteredApps = applications.filter(app => {
            if (!startDate && !endDate) return true;
            const appDate = new Date(app.createdAt);
            if (startDate && appDate < startDate) return false;
            if (endDate && appDate > endDate) return false;
            return true;
        });

        // Calculate stats
        const stats = {
            totalApplications: filteredApps.length,
            byStatus: {},
            totalRequested: 0,
            totalApproved: 0,
            totalFunded: 0,
            approvalRate: 0,
            fundingRate: 0,
            averageAmount: 0
        };

        filteredApps.forEach(app => {
            // Count by status
            stats.byStatus[app.status] = (stats.byStatus[app.status] || 0) + 1;

            // Sum amounts
            stats.totalRequested += app.requestedAmount || 0;

            if (app.status === FINANCING_STATUS.APPROVED || app.status === FINANCING_STATUS.FUNDED) {
                stats.totalApproved += app.approvedAmount || app.requestedAmount || 0;
            }

            if (app.status === FINANCING_STATUS.FUNDED) {
                stats.totalFunded += app.fundedAmount || app.approvedAmount || 0;
            }
        });

        // Calculate rates
        if (stats.totalApplications > 0) {
            const approvedCount = (stats.byStatus[FINANCING_STATUS.APPROVED] || 0) +
                (stats.byStatus[FINANCING_STATUS.FUNDED] || 0);
            stats.approvalRate = Math.round((approvedCount / stats.totalApplications) * 100);

            const fundedCount = stats.byStatus[FINANCING_STATUS.FUNDED] || 0;
            stats.fundingRate = Math.round((fundedCount / stats.totalApplications) * 100);

            stats.averageAmount = Math.round(stats.totalRequested / stats.totalApplications);
        }

        return stats;
    } catch (error) {
        console.error('[Financing] Get stats error:', error);
        return {
            totalApplications: 0,
            byStatus: {},
            totalRequested: 0,
            totalApproved: 0,
            totalFunded: 0,
            approvalRate: 0,
            fundingRate: 0,
            averageAmount: 0
        };
    }
};

/**
 * Log financing event for audit trail
 * @param {Object} eventData - Event data
 * @returns {Promise<string>} Event ID
 */
export const logFinancingEvent = async (eventData) => {
    try {
        const eventRef = await addDoc(collection(db, 'financingEvents'), {
            ...eventData,
            timestamp: serverTimestamp()
        });
        return eventRef.id;
    } catch (error) {
        console.error('[Financing] Log event error:', error);
        return null;
    }
};

// ============================================
// DISPLAY HELPERS
// ============================================

/**
 * Get status display info
 * @param {string} status - Financing status
 * @returns {Object} Display info (label, color, icon)
 */
export const getStatusDisplay = (status) => {
    const displays = {
        [FINANCING_STATUS.NOT_OFFERED]: {
            label: 'Not Offered',
            color: 'gray',
            bgColor: 'bg-gray-100',
            textColor: 'text-gray-600'
        },
        [FINANCING_STATUS.OFFERED]: {
            label: 'Financing Available',
            color: 'blue',
            bgColor: 'bg-blue-100',
            textColor: 'text-blue-600'
        },
        [FINANCING_STATUS.PENDING]: {
            label: 'Application Pending',
            color: 'amber',
            bgColor: 'bg-amber-100',
            textColor: 'text-amber-600'
        },
        [FINANCING_STATUS.APPROVED]: {
            label: 'Approved',
            color: 'emerald',
            bgColor: 'bg-emerald-100',
            textColor: 'text-emerald-600'
        },
        [FINANCING_STATUS.DENIED]: {
            label: 'Not Approved',
            color: 'gray',
            bgColor: 'bg-gray-100',
            textColor: 'text-gray-500'
        },
        [FINANCING_STATUS.FUNDED]: {
            label: 'Funded',
            color: 'emerald',
            bgColor: 'bg-emerald-100',
            textColor: 'text-emerald-700'
        },
        [FINANCING_STATUS.EXPIRED]: {
            label: 'Expired',
            color: 'gray',
            bgColor: 'bg-gray-100',
            textColor: 'text-gray-500'
        },
        [FINANCING_STATUS.CANCELLED]: {
            label: 'Cancelled',
            color: 'gray',
            bgColor: 'bg-gray-100',
            textColor: 'text-gray-500'
        }
    };

    return displays[status] || displays[FINANCING_STATUS.NOT_OFFERED];
};

/**
 * Generate financing disclaimer text
 * @returns {string} Legal disclaimer
 */
export const getFinancingDisclaimer = () => {
    return `*All financing is subject to credit approval. Your terms may vary. Payment options through Wisetack are provided by our lending partners. For example, a $1,000 purchase could cost $87.92/month for 12 months, based on a 9.99% APR, or $45.23/month for 24 months, based on a 9.99% APR. Offers range from 0-29.99% APR based on creditworthiness. No impact to credit score to check your rate.`;
};

/**
 * Get short disclaimer for compact displays
 * @returns {string} Short disclaimer
 */
export const getShortDisclaimer = () => {
    return `*Rate depends on credit. 0-29.99% APR. Checking rates won't affect your credit score.`;
};

export default {
    FINANCING_STATUS,
    FINANCING_PROVIDER,
    DEFAULT_FINANCING_SETTINGS,
    APR_RANGE,
    calculateMonthlyPayment,
    calculateFinancingCost,
    getPaymentEstimates,
    formatCurrency,
    checkFinancingEligibility,
    createFinancingApplication,
    getApplicationStatus,
    getFinancingSettings,
    updateFinancingSettings,
    updateQuoteFinancing,
    getFinancingApplications,
    getFinancingStats,
    logFinancingEvent,
    getStatusDisplay,
    getFinancingDisclaimer,
    getShortDisclaimer
};
