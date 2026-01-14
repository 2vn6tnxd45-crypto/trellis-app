// src/features/recurring/hooks/useRecurringServices.js
// ============================================
// RECURRING SERVICES HOOKS
// ============================================
// React hooks for managing recurring services

import { useState, useEffect, useCallback } from 'react';
import {
    subscribeToContractorRecurringServices,
    subscribeToCustomerRecurringServices,
    createRecurringService,
    updateRecurringService,
    cancelRecurringService,
    pauseRecurringService,
    resumeRecurringService,
    skipNextOccurrence
} from '../lib/recurringService';

/**
 * Hook for contractor to manage recurring services
 * @param {string} contractorId
 * @returns {Object} Recurring services state and actions
 */
export const useContractorRecurringServices = (contractorId) => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeToContractorRecurringServices(contractorId, (data) => {
            setServices(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [contractorId]);

    // Computed values
    const activeServices = services.filter(s => s.status === 'active');
    const pausedServices = services.filter(s => s.status === 'paused');
    const cancelledServices = services.filter(s => s.status === 'cancelled');

    // Actions
    const create = useCallback(async (serviceData) => {
        try {
            const id = await createRecurringService({
                ...serviceData,
                contractorId
            });
            return id;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [contractorId]);

    const update = useCallback(async (serviceId, updates) => {
        try {
            await updateRecurringService(serviceId, updates);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const cancel = useCallback(async (serviceId) => {
        try {
            await cancelRecurringService(serviceId);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const pause = useCallback(async (serviceId, resumeDate = null) => {
        try {
            await pauseRecurringService(serviceId, resumeDate);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const resume = useCallback(async (serviceId) => {
        try {
            await resumeRecurringService(serviceId);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    return {
        services,
        activeServices,
        pausedServices,
        cancelledServices,
        loading,
        error,
        // Actions
        create,
        update,
        cancel,
        pause,
        resume
    };
};

/**
 * Hook for homeowner to view and manage their recurring services
 * @param {string} customerId - The homeowner's user ID
 * @returns {Object} Recurring services state and actions
 */
export const useCustomerRecurringServices = (customerId) => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!customerId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeToCustomerRecurringServices(customerId, (data) => {
            setServices(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [customerId]);

    // Computed values
    const activeServices = services.filter(s => s.status === 'active');
    const pausedServices = services.filter(s => s.status === 'paused');

    // Customer actions (limited compared to contractor)
    const skip = useCallback(async (serviceId) => {
        try {
            await skipNextOccurrence(serviceId);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const pause = useCallback(async (serviceId, resumeDate = null) => {
        try {
            await pauseRecurringService(serviceId, resumeDate);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const resume = useCallback(async (serviceId) => {
        try {
            await resumeRecurringService(serviceId);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const requestCancel = useCallback(async (serviceId) => {
        // Customer can't directly cancel - sets a flag for contractor to review
        try {
            await updateRecurringService(serviceId, {
                cancellationRequested: true,
                cancellationRequestedAt: new Date().toISOString()
            });
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    return {
        services,
        activeServices,
        pausedServices,
        loading,
        error,
        // Actions
        skip,
        pause,
        resume,
        requestCancel
    };
};

/**
 * Hook to get the next scheduled date formatted for display
 * @param {Object} service - Recurring service object
 * @returns {Object} Formatted date info
 */
export const useNextScheduledDate = (service) => {
    if (!service?.nextScheduledDate) {
        return { formatted: 'Not scheduled', date: null, isUpcoming: false };
    }

    const date = new Date(service.nextScheduledDate);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

    let formatted;
    if (diffDays === 0) {
        formatted = 'Today';
    } else if (diffDays === 1) {
        formatted = 'Tomorrow';
    } else if (diffDays < 7) {
        formatted = date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
        formatted = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }

    // Add time if available
    if (service.preferredTime) {
        const [hours, minutes] = service.preferredTime.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour = hours % 12 || 12;
        formatted += ` @ ${hour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }

    return {
        formatted,
        date,
        isUpcoming: diffDays <= 7,
        daysUntil: diffDays
    };
};

export default {
    useContractorRecurringServices,
    useCustomerRecurringServices,
    useNextScheduledDate
};
