// src/features/contractor-pro/components/SMSLog.jsx
// ============================================
// SMS LOG COMPONENT
// ============================================
// View and filter SMS message history

import React, { useState, useEffect } from 'react';
import {
    MessageSquare, ArrowUpRight, ArrowDownLeft, Check, X, Clock,
    AlertCircle, Phone, Calendar, Filter, Search, RefreshCw,
    ChevronLeft, ChevronRight, Loader2, ExternalLink, User
} from 'lucide-react';
import {
    getSMSLogs,
    getSMSStats,
    SMS_STATUS,
    SMS_TYPES,
    formatPhoneDisplay
} from '../../../lib/twilioService';

// Status badge styles
const STATUS_STYLES = {
    queued: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Queued' },
    sending: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Sending' },
    sent: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Sent' },
    delivered: { bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Delivered' },
    failed: { bg: 'bg-red-100', text: 'text-red-600', label: 'Failed' },
    undelivered: { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Undelivered' }
};

// Type labels
const TYPE_LABELS = {
    reminder_24h: '24h Reminder',
    reminder_2h: '2h Reminder',
    on_the_way: 'On The Way',
    confirmation: 'Confirmation',
    reschedule: 'Reschedule',
    cancellation: 'Cancellation',
    custom: 'Custom'
};

export const SMSLog = ({ contractorId }) => {
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState({
        type: 'all',
        status: 'all',
        direction: 'all',
        search: ''
    });
    const [page, setPage] = useState(1);
    const [selectedLog, setSelectedLog] = useState(null);

    const ITEMS_PER_PAGE = 20;

    // Load logs
    useEffect(() => {
        loadData();
    }, [contractorId]);

    const loadData = async () => {
        if (!contractorId) return;

        try {
            const [logsData, statsData] = await Promise.all([
                getSMSLogs(contractorId, { limitCount: 100 }),
                getSMSStats(contractorId)
            ]);
            setLogs(logsData);
            setStats(statsData);
        } catch (error) {
            console.error('Error loading SMS logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    // Filter logs
    const filteredLogs = logs.filter(log => {
        if (filter.type !== 'all' && log.type !== filter.type) return false;
        if (filter.status !== 'all' && log.status !== filter.status) return false;
        if (filter.direction !== 'all' && log.direction !== filter.direction) return false;
        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            const matchesPhone = log.to?.includes(filter.search) || log.from?.includes(filter.search);
            const matchesMessage = log.message?.toLowerCase().includes(searchLower);
            if (!matchesPhone && !matchesMessage) return false;
        }
        return true;
    });

    // Pagination
    const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
    const paginatedLogs = filteredLogs.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    // Format date
    const formatDate = (date) => {
        if (!date) return 'N/A';
        const d = new Date(date);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const isYesterday = new Date(now - 86400000).toDateString() === d.toDateString();

        if (isToday) {
            return `Today at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        } else if (isYesterday) {
            return `Yesterday at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        } else {
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2.5 rounded-xl">
                        <MessageSquare className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">SMS History</h2>
                        <p className="text-sm text-gray-500">{filteredLogs.length} messages</p>
                    </div>
                </div>

                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatCard
                        label="Total"
                        value={stats.total}
                        color="gray"
                    />
                    <StatCard
                        label="Delivered"
                        value={stats.delivered}
                        color="emerald"
                    />
                    <StatCard
                        label="Pending"
                        value={stats.pending}
                        color="blue"
                    />
                    <StatCard
                        label="Failed"
                        value={stats.failed}
                        color="red"
                    />
                    <StatCard
                        label="Delivery Rate"
                        value={`${stats.deliveryRate}%`}
                        color="purple"
                    />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 bg-white rounded-xl p-4 border border-gray-200">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search phone or message..."
                            value={filter.search}
                            onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Type Filter */}
                <select
                    value={filter.type}
                    onChange={(e) => setFilter(f => ({ ...f, type: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Types</option>
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>

                {/* Status Filter */}
                <select
                    value={filter.status}
                    onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Status</option>
                    {Object.entries(STATUS_STYLES).map(([value, { label }]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>

                {/* Direction Filter */}
                <select
                    value={filter.direction}
                    onChange={(e) => setFilter(f => ({ ...f, direction: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Direction</option>
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                </select>
            </div>

            {/* Log List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {paginatedLogs.length === 0 ? (
                    <div className="py-12 text-center">
                        <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No SMS messages found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {paginatedLogs.map((log) => (
                            <LogItem
                                key={log.id}
                                log={log}
                                onClick={() => setSelectedLog(log)}
                                formatDate={formatDate}
                            />
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <p className="text-sm text-gray-500">
                            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-gray-600">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedLog && (
                <LogDetailModal
                    log={selectedLog}
                    onClose={() => setSelectedLog(null)}
                    formatDate={formatDate}
                />
            )}
        </div>
    );
};

// Stat Card Component
const StatCard = ({ label, value, color }) => {
    const colorClasses = {
        gray: 'bg-gray-50 text-gray-800',
        emerald: 'bg-emerald-50 text-emerald-700',
        blue: 'bg-blue-50 text-blue-700',
        red: 'bg-red-50 text-red-700',
        purple: 'bg-purple-50 text-purple-700'
    };

    return (
        <div className={`rounded-xl p-4 ${colorClasses[color]}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm opacity-75">{label}</p>
        </div>
    );
};

// Log Item Component
const LogItem = ({ log, onClick, formatDate }) => {
    const isInbound = log.direction === 'inbound';
    const statusStyle = STATUS_STYLES[log.status] || STATUS_STYLES.queued;
    const typeLabel = TYPE_LABELS[log.type] || log.type;

    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 text-left"
        >
            {/* Direction Icon */}
            <div className={`p-2 rounded-xl ${isInbound ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                {isInbound ? (
                    <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                ) : (
                    <ArrowUpRight className="w-5 h-5 text-blue-600" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">
                        {formatPhoneDisplay(isInbound ? log.from : log.to)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                        {statusStyle.label}
                    </span>
                </div>
                <p className="text-sm text-gray-600 truncate mt-1">
                    {log.message || log.body || 'No message content'}
                </p>
                <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">{formatDate(log.createdAt)}</span>
                    {typeLabel && (
                        <span className="text-xs text-gray-400">• {typeLabel}</span>
                    )}
                </div>
            </div>

            {/* Status Icon */}
            <div className="flex-shrink-0">
                {log.status === 'delivered' && <Check className="w-5 h-5 text-emerald-500" />}
                {log.status === 'failed' && <X className="w-5 h-5 text-red-500" />}
                {(log.status === 'queued' || log.status === 'sending' || log.status === 'sent') && (
                    <Clock className="w-5 h-5 text-gray-400" />
                )}
            </div>
        </button>
    );
};

// Log Detail Modal
const LogDetailModal = ({ log, onClose, formatDate }) => {
    const isInbound = log.direction === 'inbound';
    const statusStyle = STATUS_STYLES[log.status] || STATUS_STYLES.queued;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${isInbound ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                                {isInbound ? (
                                    <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                                ) : (
                                    <ArrowUpRight className="w-5 h-5 text-blue-600" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">
                                    {isInbound ? 'Inbound SMS' : 'Outbound SMS'}
                                </h3>
                                <p className="text-sm text-gray-500">{formatDate(log.createdAt)}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 rounded-lg"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Phone Number */}
                    <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                            <p className="text-sm text-gray-500">{isInbound ? 'From' : 'To'}</p>
                            <p className="font-medium text-gray-800">
                                {formatPhoneDisplay(isInbound ? log.from : log.to)}
                            </p>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-3">
                        {log.status === 'delivered' ? (
                            <Check className="w-5 h-5 text-emerald-500" />
                        ) : log.status === 'failed' ? (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : (
                            <Clock className="w-5 h-5 text-gray-400" />
                        )}
                        <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm ${statusStyle.bg} ${statusStyle.text}`}>
                                {statusStyle.label}
                            </span>
                        </div>
                    </div>

                    {/* Message Type */}
                    {log.type && (
                        <div className="flex items-center gap-3">
                            <MessageSquare className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Type</p>
                                <p className="font-medium text-gray-800">
                                    {TYPE_LABELS[log.type] || log.type}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Message Content */}
                    <div>
                        <p className="text-sm text-gray-500 mb-2">Message</p>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-gray-700 whitespace-pre-wrap">
                                {log.message || log.body || 'No message content'}
                            </p>
                        </div>
                    </div>

                    {/* Error Info */}
                    {log.errorCode && (
                        <div className="bg-red-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-red-700 mb-1">
                                <AlertCircle className="w-4 h-4" />
                                <span className="font-medium">Error</span>
                            </div>
                            <p className="text-sm text-red-600">
                                Code: {log.errorCode}
                                {log.errorMessage && ` - ${log.errorMessage}`}
                            </p>
                        </div>
                    )}

                    {/* Job Link */}
                    {log.jobId && (
                        <div className="flex items-center gap-3">
                            <ExternalLink className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Related Job</p>
                                <p className="font-medium text-blue-600">{log.jobId}</p>
                            </div>
                        </div>
                    )}

                    {/* Message SID */}
                    {log.messageSid && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                            Message SID: {log.messageSid}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SMSLog;
