// src/features/jobs/components/updates/CustomerSummaryModal.jsx
// ============================================
// CUSTOMER SUMMARY MODAL
// ============================================
// Modal to generate, edit, and send AI-powered customer summaries
// from informal crew notes

import React, { useState, useEffect } from 'react';
import {
    X,
    Loader2,
    RefreshCw,
    Mail,
    MessageSquare,
    Send,
    CheckCircle,
    AlertCircle,
    User,
    MapPin,
    Phone,
    Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { markUpdateSent } from '../../lib/jobUpdateService';
import { sendSMS, formatPhoneDisplay, isValidPhone, SMS_TYPES } from '../../../../lib/twilioService';

// ============================================
// HELPERS
// ============================================

// Safely extract address string
const safeAddress = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
        if (addr.formatted) return addr.formatted;
        if (addr.full) return addr.full;
        if (addr.street) return addr.street;
        return '';
    }
    return String(addr);
};

// Get first name from full name
const getFirstName = (fullName) => {
    if (!fullName) return '';
    return fullName.trim().split(' ')[0];
};

// ============================================
// MAIN COMPONENT
// ============================================

export const CustomerSummaryModal = ({
    job,
    update,
    contractorId,
    companyName,
    onClose,
    onSent
}) => {
    // State
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [summary, setSummary] = useState('');
    const [originalSummary, setOriginalSummary] = useState('');
    const [tone, setTone] = useState('friendly');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [sendingText, setSendingText] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState(null);

    // Customer info
    const customerName = job.customer?.name || job.customerName || 'Customer';
    const customerFirstName = getFirstName(customerName);
    const customerEmail = job.customer?.email || job.customerEmail || '';
    const customerPhone = job.customer?.phone || job.customerPhone || '';
    const customerAddress = safeAddress(job.customer?.address) || safeAddress(job.serviceAddress) || '';
    const jobTitle = job.title || job.serviceType || 'Service';

    // Generate summary on mount
    useEffect(() => {
        generateSummary();
    }, []);

    // Generate AI summary
    const generateSummary = async () => {
        setGenerating(true);
        setError(null);

        try {
            // Build photo descriptions if available
            const photoDescriptions = (update.photos || [])
                .filter(p => p.caption)
                .map(p => p.caption);

            const response = await fetch('/api/generate-customer-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crewNotes: update.notes,
                    customerName: customerFirstName,
                    jobTitle,
                    companyName: companyName || 'Our team',
                    photoDescriptions,
                    updateType: update.type
                })
            });

            const result = await response.json();

            if (result.success && result.summary) {
                setSummary(result.summary);
                setOriginalSummary(result.summary);
                setTone(result.tone || 'friendly');
            } else {
                // Fallback to formatted notes
                const fallback = `Hi ${customerFirstName}, we wanted to share an update on ${jobTitle}. ${update.notes} - ${companyName || 'Our team'}`;
                setSummary(fallback);
                setOriginalSummary(fallback);
                setError('AI generation unavailable. You can edit the message above.');
            }
        } catch (err) {
            console.error('[CustomerSummaryModal] Generate error:', err);
            // Fallback to formatted notes
            const fallback = `Hi ${customerFirstName}, we wanted to share an update on ${jobTitle}. ${update.notes} - ${companyName || 'Our team'}`;
            setSummary(fallback);
            setOriginalSummary(fallback);
            setError('AI generation failed. You can edit the message above.');
        } finally {
            setLoading(false);
            setGenerating(false);
        }
    };

    // Handle regenerate
    const handleRegenerate = () => {
        generateSummary();
    };

    // Handle send email
    const handleSendEmail = async () => {
        if (!customerEmail) {
            toast.error('No customer email available');
            return;
        }

        setSendingEmail(true);

        try {
            // Call email API endpoint
            const response = await fetch('/api/send-job-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerEmail,
                    customerName,
                    jobTitle,
                    companyName,
                    message: summary,
                    updateType: update.type,
                    jobId: job.id,
                    contractorId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to send email');
            }

            // Mark update as sent
            await markUpdateSent(job.id, update.id, {
                generatedText: originalSummary,
                editedText: summary !== originalSummary ? summary : null,
                sentVia: 'email'
            });

            toast.success('Email sent to customer!');
            setSent(true);

            // Delay before closing
            setTimeout(() => {
                if (onSent) onSent('email');
            }, 1500);

        } catch (err) {
            console.error('[CustomerSummaryModal] Email error:', err);
            toast.error(err.message || 'Failed to send email. Try again.');
        } finally {
            setSendingEmail(false);
        }
    };

    // Handle send text
    const handleSendText = async () => {
        console.log('[CustomerSummaryModal] Starting SMS send...');
        console.log('[CustomerSummaryModal] Customer phone:', customerPhone);

        if (!customerPhone) {
            console.error('[CustomerSummaryModal] No customer phone number');
            toast.error('No customer phone number available');
            return;
        }

        console.log('[CustomerSummaryModal] Validating phone format...');
        if (!isValidPhone(customerPhone)) {
            console.error('[CustomerSummaryModal] Invalid phone format:', customerPhone);
            toast.error('Invalid phone number format');
            return;
        }

        setSendingText(true);

        try {
            console.log('[CustomerSummaryModal] Calling sendSMS with:', {
                to: customerPhone,
                messageLength: summary.length,
                jobId: job.id,
                contractorId,
                type: SMS_TYPES.CUSTOM
            });

            const result = await sendSMS({
                to: customerPhone,
                message: summary,
                jobId: job.id,
                contractorId,
                type: SMS_TYPES.CUSTOM,
                metadata: {
                    updateId: update.id,
                    updateType: update.type
                }
            });

            console.log('[CustomerSummaryModal] sendSMS result:', result);

            if (result.skipped) {
                console.warn('[CustomerSummaryModal] SMS skipped:', result.reason);
                toast.error(result.reason || 'Customer has opted out of SMS');
                setSendingText(false);
                return;
            }

            if (!result.success) {
                console.error('[CustomerSummaryModal] SMS failed:', result);
                throw new Error(result.error || 'Failed to send SMS');
            }

            console.log('[CustomerSummaryModal] SMS sent successfully, marking update...');

            // Mark update as sent
            await markUpdateSent(job.id, update.id, {
                generatedText: originalSummary,
                editedText: summary !== originalSummary ? summary : null,
                sentVia: 'sms'
            });

            console.log('[CustomerSummaryModal] Update marked as sent');
            toast.success('Text sent to customer!');
            setSent(true);

            // Delay before closing
            setTimeout(() => {
                if (onSent) onSent('sms');
            }, 1500);

        } catch (err) {
            console.error('[CustomerSummaryModal] ===== SMS ERROR =====');
            console.error('[CustomerSummaryModal] Error name:', err.name);
            console.error('[CustomerSummaryModal] Error message:', err.message);
            console.error('[CustomerSummaryModal] Full error:', err);
            console.error('[CustomerSummaryModal] ===== END ERROR =====');
            toast.error(err.message || 'Failed to send text. Try again.');
        } finally {
            setSendingText(false);
        }
    };

    // Success State
    if (sent) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
                    <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Message Sent!</h3>
                    <p className="text-slate-600">
                        {customerFirstName} has been notified about the update.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-100">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-100 p-2 rounded-xl">
                                <Sparkles className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Customer Summary</h3>
                                <p className="text-sm text-slate-500">
                                    AI-generated message for {customerFirstName}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto flex-grow space-y-5">
                    {/* Job Info */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{customerName}</span>
                        </div>
                        {customerAddress && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                <span>{customerAddress}</span>
                            </div>
                        )}
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="text-center py-8">
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
                            <p className="text-slate-600">Generating summary...</p>
                        </div>
                    )}

                    {/* Summary Editor */}
                    {!loading && (
                        <>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Message <span className="text-slate-400 font-normal">(edit as needed)</span>
                                    </label>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        tone === 'friendly' ? 'bg-emerald-100 text-emerald-700' :
                                        tone === 'apologetic' ? 'bg-amber-100 text-amber-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                        {tone} tone
                                    </span>
                                </div>
                                <textarea
                                    value={summary}
                                    onChange={(e) => setSummary(e.target.value)}
                                    rows={5}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-slate-800"
                                />
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-slate-400">
                                        {summary.length} characters
                                    </p>
                                    <button
                                        onClick={handleRegenerate}
                                        disabled={generating}
                                        className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
                                    >
                                        {generating ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="w-4 h-4" />
                                        )}
                                        Regenerate
                                    </button>
                                </div>
                            </div>

                            {/* Error Notice */}
                            {error && (
                                <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700">{error}</p>
                                </div>
                            )}

                            {/* Recipient Info */}
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-slate-700">Send to</p>
                                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                                    {customerEmail && (
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-2 rounded-lg">
                                                <Mail className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <span className="text-sm text-slate-700">{customerEmail}</span>
                                        </div>
                                    )}
                                    {customerPhone && (
                                        <div className="flex items-center gap-3">
                                            <div className="bg-emerald-100 p-2 rounded-lg">
                                                <Phone className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <span className="text-sm text-slate-700">
                                                {formatPhoneDisplay(customerPhone)}
                                            </span>
                                        </div>
                                    )}
                                    {!customerEmail && !customerPhone && (
                                        <p className="text-sm text-slate-500 text-center py-2">
                                            No contact info available
                                        </p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!loading && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">
                        {/* Send Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleSendEmail}
                                disabled={sendingEmail || sendingText || !customerEmail || !summary.trim()}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {sendingEmail ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Mail className="w-5 h-5" />
                                )}
                                Send Email
                            </button>

                            <button
                                onClick={handleSendText}
                                disabled={sendingEmail || sendingText || !customerPhone || !summary.trim()}
                                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {sendingText ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <MessageSquare className="w-5 h-5" />
                                )}
                                Send Text
                            </button>
                        </div>

                        {/* Cancel Button */}
                        <button
                            onClick={onClose}
                            disabled={sendingEmail || sendingText}
                            className="w-full py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerSummaryModal;
