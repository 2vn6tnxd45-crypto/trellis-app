// src/features/quotes/index.js
// ============================================
// QUOTES FEATURE - EXPORTS
// ============================================

// Components
export { QuotesListView, QuoteStatusBadge } from './components/QuotesListView';
export { QuoteBuilder } from './components/QuoteBuilder';
export { QuoteDetailView } from './components/QuoteDetailView';
export { PublicQuoteView } from './components/PublicQuoteView';

// Hooks
export { 
    useQuotes,
    useQuoteTemplates,
    useQuoteStats,
    useQuoteOperations,
    useQuoteManagement
} from './hooks/useQuotes';

// Service functions
export {
    generateQuoteNumber,
    createQuote,
    updateQuote,
    deleteQuote,
    getQuote,
    getQuotes,
    subscribeToQuotes,
    sendQuote,
    markQuoteViewed,
    acceptQuote,
    declineQuote,
    checkExpiredQuotes,
    createQuoteTemplate,
    getQuoteTemplates,
    subscribeToQuoteTemplates,
    deleteQuoteTemplate,
    linkQuoteToInvoice,
    linkQuoteToJob,
    getQuoteStats,
    getQuoteByShareToken,
    generateQuoteShareLink,
    claimQuote,
    unclaimQuote,
    addContractorToProsList,
    createQuoteChatChannel
} from './lib/quoteService';
