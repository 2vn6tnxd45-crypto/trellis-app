// src/features/quotes/components/QuoteDetailView.jsx
// ============================================
// QUOTE DETAIL VIEW
// ============================================
// Display quote details with timeline and actions

import React, { useState } from 'react';
import {
    ArrowLeft, Edit3, MoreHorizontal, Send, Mail, FileText,
    Copy, Printer, Trash2, CheckCircle, Eye, Clock, XCircle,
    User, MapPin, AlertCircle, Link as LinkIcon, Loader2,
    Building2, Calendar, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import { QuoteStatusBadge } from './QuotesListView';

// ============================================
// HELPERS
// ============================================

// Helper to safely extract string value (prevents React Error #310)
const safeString = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
        // Handle address objects
        if (val.formatted) return val.formatted;
        if (val.full) return val.full;
        if (val.street) return val.street;
        return '';
    }
    return String(val);
};

// ============================================
// TIMELINE STEP
// ============================================
const TimelineStep = ({ icon: Icon, label, date, isActive, isComplete }) => (
    <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isComplete ? 'bg-emerald-100' : isActive ? 'bg-blue-100' : 'bg-slate-100'
            }`}>
            <Icon size={16} className={
                isComplete ? 'text-emerald-600' : isActive ? 'text-blue-600' : 'text-slate-400'
            } />
        </div>
        <div>
            <p className="text-sm font-medium text-slate-800">{label}</p>
            <p className="text-xs text-slate-500">{date || '—'}</p>
        </div>
    </div>
);

// ============================================
// QUOTE PREVIEW (What customer sees)
// ============================================
const QuotePreview = ({ quote, contractorProfile, timeZone }) => {
    // Format date safely
    const formatDate = (timestamp) => {
        if (!timestamp) return '—';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            timeZone
        });
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
            {/* Header */}
            <div className="border-b border-slate-200 pb-6 mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                            <Building2 className="text-emerald-600" size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {contractorProfile?.companyName || 'Your Company'}
                        </h2>
                        {contractorProfile?.licenseNumber && (
                            <p className="text-sm text-slate-500">License #{contractorProfile.licenseNumber}</p>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-600">
                            ${(quote.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm text-slate-500">Quote Total</p>
                    </div>
                </div>
            </div>

            {/* Customer & Quote Info */}
            <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Bill To</p>
                    <p className="font-medium text-slate-800">{quote.customer?.name || 'Customer'}</p>
                    <p className="text-sm text-slate-500">{quote.customer?.email}</p>
                    <p className="text-sm text-slate-500">{quote.customer?.address}</p>
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Quote Details</p>
                    <p className="text-sm">
                        <span className="text-slate-500">Quote #:</span>{' '}
                        <span className="font-medium">{quote.quoteNumber}</span>
                    </p>
                    <p className="text-sm">
                        <span className="text-slate-500">Date:</span>{' '}
                        <span className="font-medium">{formatDate(quote.createdAt)}</span>
                    </p>
                    <p className="text-sm">
                        <span className="text-slate-500">Valid Until:</span>{' '}
                        <span className="font-medium">{formatDate(quote.expiresAt)}</span>
                    </p>
                </div>
            </div>

            {/* Description */}
            <div className="mb-6">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Description</p>
                <p className="text-slate-800 font-medium">{quote.title}</p>
            </div>

            {/* Line Items */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                <table className="w-full">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="text-left text-xs font-bold text-slate-500 uppercase px-4 py-3">Description</th>
                            <th className="text-center text-xs font-bold text-slate-500 uppercase px-4 py-3 w-16">Type</th>
                            <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-16">Qty</th>
                            <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-24">Rate</th>
                            <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-24">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(quote.lineItems || []).map((item, idx) => (
                            <tr key={item.id || idx}>
                                <td className="px-4 py-3 text-slate-800">{item.description}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${item.type === 'labor' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                        {item.type === 'labor' ? 'Labor' : 'Part'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">{item.quantity}</td>
                                <td className="px-4 py-3 text-right">${(item.unitPrice || 0).toFixed(2)}</td>
                                <td className="px-4 py-3 text-right font-medium">
                                    ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
                <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-medium">${(quote.subtotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Tax ({quote.taxRate || 0}%)</span>
                        <span className="font-medium">${(quote.taxAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg pt-2 border-t border-slate-200">
                        <span className="font-bold text-slate-800">Total</span>
                        <span className="font-bold text-emerald-600">${(quote.total || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Notes */}
            {quote.notes && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Notes</p>
                    <p className="text-sm text-slate-600">{quote.notes}</p>
                </div>
            )}

            {/* Terms */}
            {quote.terms && (
                <div className="mt-4">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Terms & Conditions</p>
                    <p className="text-xs text-slate-500">{quote.terms}</p>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const QuoteDetailView = ({
    quote,
    contractorProfile = null,
    onBack,
    onEdit,
    onDelete,
    onSendReminder,
    onConvertToInvoice,
    onCopyLink,
    getShareLink,
    timeZone // Add timeZone prop
}) => {
    const [showActions, setShowActions] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSendingReminder, setIsSendingReminder] = useState(false);

    // Format date safely
    const formatDate = (timestamp) => {
        if (!timestamp) return null;
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            timeZone
        });
    };

    // Determine timeline state
    const getTimelineState = () => {
        const states = {
            created: { complete: true, date: formatDate(quote.createdAt) },
            sent: {
                complete: ['sent', 'viewed', 'accepted', 'declined', 'expired'].includes(quote.status),
                date: formatDate(quote.sentAt)
            },
            viewed: {
                complete: ['viewed', 'accepted', 'declined'].includes(quote.status),
                active: quote.status === 'viewed',
                date: formatDate(quote.viewedAt)
            },
            accepted: {
                complete: quote.status === 'accepted',
                date: formatDate(quote.acceptedAt)
            }
        };
        return states;
    };

    const timeline = getTimelineState();

    // Handle copy link
    const handleCopyLink = () => {
        const link = getShareLink ? getShareLink(quote.id) : '';
        if (link) {
            navigator.clipboard.writeText(link);
            toast.success('Link copied to clipboard');
        }
        if (onCopyLink) onCopyLink(quote);
    };

    // Handle delete
    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this quote? This cannot be undone.')) {
            return;
        }

        setIsDeleting(true);
        try {
            await onDelete(quote.id);
            toast.success('Quote deleted');
            onBack();
        } catch (error) {
            toast.error('Failed to delete quote');
        } finally {
            setIsDeleting(false);
        }
    };

    // Handle send reminder
    const handleSendReminder = async () => {
        setIsSendingReminder(true);
        try {
            await onSendReminder(quote.id);
            toast.success('Reminder sent');
        } catch (error) {
            toast.error('Failed to send reminder');
        } finally {
            setIsSendingReminder(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <ArrowLeft size={20} className="text-slate-400" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold text-slate-800">{quote.quoteNumber}</h1>
                            <QuoteStatusBadge status={quote.status} />
                        </div>
                        <p className="text-slate-500">{quote.title}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                    {quote.status === 'accepted' && onConvertToInvoice && (
                        <button
                            onClick={() => onConvertToInvoice(quote)}
                            className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 transition-colors"
                        >
                            <FileText size={16} />
                            Convert to Invoice
                        </button>
                    )}
                    {quote.status === 'draft' && (
                        <button className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 transition-colors">
                            <Send size={16} />
                            Send Quote
                        </button>
                    )}
                    {['sent', 'viewed'].includes(quote.status) && (
                        <button
                            onClick={handleSendReminder}
                            disabled={isSendingReminder}
                            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
                        >
                            {isSendingReminder ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Mail size={16} />
                            )}
                            Send Reminder
                        </button>
                    )}
                    <button
                        onClick={onEdit}
                        className="px-4 py-2 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                        <Edit3 size={16} />
                        Edit
                    </button>

                    {/* More Actions Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowActions(!showActions)}
                            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            <MoreHorizontal size={20} className="text-slate-400" />
                        </button>
                        {showActions && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowActions(false)}
                                />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-20">
                                    <button
                                        onClick={handleCopyLink}
                                        className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                        <LinkIcon size={16} />
                                        Copy Share Link
                                    </button>
                                    <button className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                                        <Copy size={16} />
                                        Duplicate
                                    </button>
                                    <button className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                                        <Printer size={16} />
                                        Download PDF
                                    </button>
                                    <hr className="my-2 border-slate-100" />
                                    <button
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isDeleting ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={16} />
                                        )}
                                        Delete
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Timeline */}
            {quote.status !== 'draft' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-800 mb-4">Quote Timeline</h3>
                    <div className="flex items-center gap-4 overflow-x-auto pb-2">
                        <TimelineStep
                            icon={Calendar}
                            label="Created"
                            date={timeline.created.date}
                            isComplete={timeline.created.complete}
                        />
                        <div className={`flex-1 h-0.5 min-w-[40px] ${timeline.sent.complete ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                        <TimelineStep
                            icon={Send}
                            label="Sent"
                            date={timeline.sent.date}
                            isComplete={timeline.sent.complete}
                        />
                        <div className={`flex-1 h-0.5 min-w-[40px] ${timeline.viewed.complete ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                        <TimelineStep
                            icon={Eye}
                            label="Viewed"
                            date={timeline.viewed.date}
                            isComplete={timeline.viewed.complete}
                            isActive={timeline.viewed.active}
                        />
                        <div className={`flex-1 h-0.5 min-w-[40px] ${timeline.accepted.complete ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                        <TimelineStep
                            icon={CheckCircle}
                            label="Accepted"
                            date={timeline.accepted.date}
                            isComplete={timeline.accepted.complete}
                        />
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quote Preview - Left 2 cols */}
                <div className="lg:col-span-2">
                    <QuotePreview quote={quote} contractorProfile={contractorProfile} timeZone={timeZone} />
                </div>

                {/* Sidebar Info */}
                <div className="space-y-4">
                    {/* Customer Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-800 mb-4">Customer</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                                    <User size={18} className="text-slate-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800">{safeString(quote.customer?.name)}</p>
                                    <p className="text-sm text-slate-500">{safeString(quote.customer?.email)}</p>
                                </div>
                            </div>
                            {safeString(quote.customer?.phone) && (
                                <p className="text-sm text-slate-500">{safeString(quote.customer.phone)}</p>
                            )}
                            {safeString(quote.customer?.address) && (
                                <div className="pt-3 border-t border-slate-100">
                                    <p className="text-xs text-slate-500 flex items-center gap-2">
                                        <MapPin size={14} />
                                        {safeString(quote.customer.address)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* View Stats */}
                    {quote.viewCount > 0 && (
                        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                                <Eye size={18} className="text-purple-600" />
                                <div>
                                    <p className="font-medium text-purple-800">
                                        Viewed {quote.viewCount} time{quote.viewCount !== 1 ? 's' : ''}
                                    </p>
                                    <p className="text-sm text-purple-600">
                                        Last viewed {formatDate(quote.lastViewedAt)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Status-specific alerts */}
                    {quote.status === 'sent' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                                <Clock size={18} className="text-blue-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-blue-800">Awaiting Response</p>
                                    <p className="text-sm text-blue-700 mt-1">
                                        Quote expires on {formatDate(quote.expiresAt)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {quote.status === 'viewed' && (
                        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                                <Eye size={18} className="text-purple-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-purple-800">Customer Viewed Quote</p>
                                    <p className="text-sm text-purple-700 mt-1">
                                        Consider following up if no response within 48 hours.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {quote.status === 'accepted' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                                <CheckCircle size={18} className="text-emerald-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-emerald-800">Quote Accepted!</p>
                                    <p className="text-sm text-emerald-700 mt-1">
                                        Ready to convert to invoice and schedule the job.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {quote.status === 'declined' && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                                <XCircle size={18} className="text-red-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-red-800">Quote Declined</p>
                                    {quote.declineReason && (
                                        <p className="text-sm text-red-700 mt-1">
                                            Reason: {quote.declineReason}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {quote.status === 'expired' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle size={18} className="text-amber-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-amber-800">Quote Expired</p>
                                    <p className="text-sm text-amber-700 mt-1">
                                        This quote expired on {formatDate(quote.expiresAt)}.
                                        You can duplicate it to create a new one.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Conversion Links */}
                    {quote.convertedToInvoiceId && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Linked Invoice</p>
                            <p className="text-sm text-slate-700">
                                Invoice #{quote.convertedToInvoiceId}
                            </p>
                        </div>
                    )}

                    {quote.convertedToJobId && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Linked Job</p>
                            <p className="text-sm text-slate-700">
                                Job #{quote.convertedToJobId}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuoteDetailView;
