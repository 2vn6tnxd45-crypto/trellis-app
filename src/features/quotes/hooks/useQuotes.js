// src/features/quotes/hooks/useQuotes.js
// ============================================
// QUOTE HOOKS
// ============================================
// React hooks for managing quote state and operations

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    subscribeToQuotes,
    subscribeToQuoteTemplates,
    createQuote,
    updateQuote,
    deleteQuote,
    sendQuote,
    getQuoteStats,
    createQuoteTemplate,
    deleteQuoteTemplate,
    generateQuoteShareLink
} from '../lib/quoteService';

// ============================================
// QUOTES LIST HOOK
// ============================================

/**
 * Hook for managing the quotes list with real-time updates
 */
export const useQuotes = (contractorId) => {
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const unsubscribe = subscribeToQuotes(contractorId, (data) => {
            setQuotes(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [contractorId]);

    // Derived states for convenience
    const draftQuotes = useMemo(() => 
        quotes.filter(q => q.status === 'draft'), 
        [quotes]
    );
    
    const sentQuotes = useMemo(() => 
        quotes.filter(q => q.status === 'sent'), 
        [quotes]
    );
    
    const viewedQuotes = useMemo(() => 
        quotes.filter(q => q.status === 'viewed'), 
        [quotes]
    );
    
    const pendingQuotes = useMemo(() => 
        quotes.filter(q => ['sent', 'viewed'].includes(q.status)), 
        [quotes]
    );
    
    const acceptedQuotes = useMemo(() => 
        quotes.filter(q => q.status === 'accepted'), 
        [quotes]
    );
    
    const declinedQuotes = useMemo(() => 
        quotes.filter(q => q.status === 'declined'), 
        [quotes]
    );
    
    const expiredQuotes = useMemo(() => 
        quotes.filter(q => q.status === 'expired'), 
        [quotes]
    );

    return {
        quotes,
        draftQuotes,
        sentQuotes,
        viewedQuotes,
        pendingQuotes,
        acceptedQuotes,
        declinedQuotes,
        expiredQuotes,
        loading,
        error
    };
};

// ============================================
// QUOTE TEMPLATES HOOK
// ============================================

/**
 * Hook for managing quote templates
 */
export const useQuoteTemplates = (contractorId) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeToQuoteTemplates(contractorId, (data) => {
            setTemplates(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [contractorId]);

    const createTemplate = useCallback(async (templateData) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await createQuoteTemplate(contractorId, templateData);
    }, [contractorId]);

    const removeTemplate = useCallback(async (templateId) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await deleteQuoteTemplate(contractorId, templateId);
    }, [contractorId]);

    return {
        templates,
        loading,
        createTemplate,
        removeTemplate
    };
};

// ============================================
// QUOTE STATS HOOK
// ============================================

/**
 * Hook for quote statistics
 */
export const useQuoteStats = (contractorId) => {
    const [stats, setStats] = useState({
        total: 0,
        draft: 0,
        pending: 0,
        accepted: 0,
        declined: 0,
        expired: 0,
        totalValue: 0,
        acceptedValue: 0,
        conversionRate: 0
    });
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!contractorId) return;
        
        setLoading(true);
        try {
            const newStats = await getQuoteStats(contractorId);
            setStats(newStats);
        } catch (error) {
            console.error('Error loading quote stats:', error);
        } finally {
            setLoading(false);
        }
    }, [contractorId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { stats, loading, refresh };
};

// ============================================
// QUOTE OPERATIONS HOOK
// ============================================

/**
 * Hook for quote CRUD operations
 */
export const useQuoteOperations = (contractorId) => {
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const create = useCallback(async (quoteData) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        
        setIsCreating(true);
        try {
            const result = await createQuote(contractorId, quoteData);
            return result;
        } finally {
            setIsCreating(false);
        }
    }, [contractorId]);

    const update = useCallback(async (quoteId, quoteData) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        
        setIsUpdating(true);
        try {
            const result = await updateQuote(contractorId, quoteId, quoteData);
            return result;
        } finally {
            setIsUpdating(false);
        }
    }, [contractorId]);

    const remove = useCallback(async (quoteId) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        
        setIsDeleting(true);
        try {
            const result = await deleteQuote(contractorId, quoteId);
            return result;
        } finally {
            setIsDeleting(false);
        }
    }, [contractorId]);

    const send = useCallback(async (quoteId) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        
        setIsSending(true);
        try {
            const result = await sendQuote(contractorId, quoteId);
            return result;
        } finally {
            setIsSending(false);
        }
    }, [contractorId]);

    const getShareLink = useCallback((quoteId) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return generateQuoteShareLink(contractorId, quoteId);
    }, [contractorId]);

    return {
        create,
        update,
        remove,
        send,
        getShareLink,
        isCreating,
        isUpdating,
        isDeleting,
        isSending
    };
};

// ============================================
// COMBINED QUOTE MANAGEMENT HOOK
// ============================================

/**
 * All-in-one hook for complete quote management
 * Use this when you need everything in one place
 */
export const useQuoteManagement = (contractorId) => {
    const quotesData = useQuotes(contractorId);
    const templatesData = useQuoteTemplates(contractorId);
    const statsData = useQuoteStats(contractorId);
    const operations = useQuoteOperations(contractorId);

    return {
        // Quotes data
        quotes: quotesData.quotes,
        draftQuotes: quotesData.draftQuotes,
        sentQuotes: quotesData.sentQuotes,
        viewedQuotes: quotesData.viewedQuotes,
        pendingQuotes: quotesData.pendingQuotes,
        acceptedQuotes: quotesData.acceptedQuotes,
        declinedQuotes: quotesData.declinedQuotes,
        expiredQuotes: quotesData.expiredQuotes,
        quotesLoading: quotesData.loading,
        
        // Templates
        templates: templatesData.templates,
        templatesLoading: templatesData.loading,
        createTemplate: templatesData.createTemplate,
        removeTemplate: templatesData.removeTemplate,
        
        // Stats
        stats: statsData.stats,
        statsLoading: statsData.loading,
        refreshStats: statsData.refresh,
        
        // Operations
        createQuote: operations.create,
        updateQuote: operations.update,
        deleteQuote: operations.remove,
        sendQuote: operations.send,
        getShareLink: operations.getShareLink,
        isCreating: operations.isCreating,
        isUpdating: operations.isUpdating,
        isDeleting: operations.isDeleting,
        isSending: operations.isSending
    };
};

export default {
    useQuotes,
    useQuoteTemplates,
    useQuoteStats,
    useQuoteOperations,
    useQuoteManagement
};
