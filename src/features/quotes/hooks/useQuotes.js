// src/features/quotes/hooks/useQuotes.js
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

export const useQuotes = (contractorId) => {
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            setQuotes([]);
            return;
        }
        setLoading(true);
        const unsubscribe = subscribeToQuotes(contractorId, (data) => {
            setQuotes(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [contractorId]);

    const draftQuotes = useMemo(() => quotes.filter(q => q.status === 'draft'), [quotes]);
    const sentQuotes = useMemo(() => quotes.filter(q => q.status === 'sent'), [quotes]);
    const viewedQuotes = useMemo(() => quotes.filter(q => q.status === 'viewed'), [quotes]);
    const pendingQuotes = useMemo(() => quotes.filter(q => ['sent', 'viewed'].includes(q.status)), [quotes]);
    const acceptedQuotes = useMemo(() => quotes.filter(q => q.status === 'accepted'), [quotes]);
    const declinedQuotes = useMemo(() => quotes.filter(q => q.status === 'declined'), [quotes]);
    const expiredQuotes = useMemo(() => quotes.filter(q => q.status === 'expired'), [quotes]);

    return { quotes, draftQuotes, sentQuotes, viewedQuotes, pendingQuotes, acceptedQuotes, declinedQuotes, expiredQuotes, loading, error };
};

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
        if (!contractorId) throw new Error('Not authenticated');
        return createQuoteTemplate(contractorId, templateData);
    }, [contractorId]);

    const removeTemplate = useCallback(async (templateId) => {
        if (!contractorId) throw new Error('Not authenticated');
        return deleteQuoteTemplate(contractorId, templateId);
    }, [contractorId]);

    return { templates, loading, createTemplate, removeTemplate };
};

export const useQuoteStats = (contractorId) => {
    const [stats, setStats] = useState({
        total: 0, draft: 0, pending: 0, accepted: 0, declined: 0, expired: 0,
        totalValue: 0, acceptedValue: 0, conversionRate: 0
    });
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!contractorId) { setLoading(false); return; }
        setLoading(true);
        try {
            const newStats = await getQuoteStats(contractorId);
            setStats(newStats);
        } catch (err) {
            console.error('Error loading stats:', err);
        } finally {
            setLoading(false);
        }
    }, [contractorId]);

    useEffect(() => { refresh(); }, [refresh]);

    return { stats, loading, refresh };
};

export const useQuoteOperations = (contractorId) => {
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const create = useCallback(async (quoteData) => {
        if (!contractorId) throw new Error('Not authenticated');
        setIsCreating(true);
        try {
            return await createQuote(contractorId, quoteData);
        } finally {
            setIsCreating(false);
        }
    }, [contractorId]);

    const update = useCallback(async (quoteId, quoteData) => {
        if (!contractorId) throw new Error('Not authenticated');
        setIsUpdating(true);
        try {
            return await updateQuote(contractorId, quoteId, quoteData);
        } finally {
            setIsUpdating(false);
        }
    }, [contractorId]);

    const remove = useCallback(async (quoteId) => {
        if (!contractorId) throw new Error('Not authenticated');
        setIsDeleting(true);
        try {
            return await deleteQuote(contractorId, quoteId);
        } finally {
            setIsDeleting(false);
        }
    }, [contractorId]);

    const send = useCallback(async (quoteId) => {
        if (!contractorId) throw new Error('Not authenticated');
        setIsSending(true);
        try {
            return await sendQuote(contractorId, quoteId);
        } finally {
            setIsSending(false);
        }
    }, [contractorId]);

    const getShareLink = useCallback((quoteId) => {
        if (!contractorId) throw new Error('Not authenticated');
        return generateQuoteShareLink(contractorId, quoteId);
    }, [contractorId]);

    return { create, update, remove, send, getShareLink, isCreating, isUpdating, isDeleting, isSending };
};

export const useQuoteManagement = (contractorId) => {
    const quotesData = useQuotes(contractorId);
    const templatesData = useQuoteTemplates(contractorId);
    const statsData = useQuoteStats(contractorId);
    const operations = useQuoteOperations(contractorId);

    return {
        quotes: quotesData.quotes,
        draftQuotes: quotesData.draftQuotes,
        sentQuotes: quotesData.sentQuotes,
        viewedQuotes: quotesData.viewedQuotes,
        pendingQuotes: quotesData.pendingQuotes,
        acceptedQuotes: quotesData.acceptedQuotes,
        declinedQuotes: quotesData.declinedQuotes,
        expiredQuotes: quotesData.expiredQuotes,
        quotesLoading: quotesData.loading,
        templates: templatesData.templates,
        templatesLoading: templatesData.loading,
        createTemplate: templatesData.createTemplate,
        removeTemplate: templatesData.removeTemplate,
        stats: statsData.stats,
        statsLoading: statsData.loading,
        refreshStats: statsData.refresh,
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
