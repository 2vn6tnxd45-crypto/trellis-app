// src/features/recurring/components/RecurringServiceCard.jsx
// ============================================
// RECURRING SERVICE CARD
// ============================================
// Display card for recurring services (used by both contractor and homeowner)

import React, { useState } from 'react';
import {
    RotateCcw, Calendar, Clock, MapPin, User, Building2,
    ChevronRight, Pause, Play, X, SkipForward,
    MoreVertical, DollarSign
} from 'lucide-react';
import { formatFrequency } from '../lib/recurringService';
import { useNextScheduledDate } from '../hooks/useRecurringServices';

// Status badge configurations
const STATUS_CONFIG = {
    active: {
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        label: 'Active'
    },
    paused: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        label: 'Paused'
    },
    cancelled: {
        bg: 'bg-slate-100',
        text: 'text-slate-500',
        label: 'Cancelled'
    }
};

/**
 * RecurringServiceCard - Display card for a recurring service
 */
export const RecurringServiceCard = ({
    service,
    variant = 'default', // 'default' | 'compact' | 'homeowner'
    onSelect,
    onPause,
    onResume,
    onCancel,
    onSkipNext,
    onEdit
}) => {
    const [showActions, setShowActions] = useState(false);
    const nextDate = useNextScheduledDate(service);
    const statusConfig = STATUS_CONFIG[service.status] || STATUS_CONFIG.active;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    // Compact variant for sidebar/lists
    if (variant === 'compact') {
        return (
            <button
                onClick={() => onSelect?.(service)}
                className="w-full text-left p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg">
                        <RotateCcw size={16} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">
                            {service.serviceName}
                        </p>
                        <p className="text-xs text-slate-500">
                            {formatFrequency(service.frequency)} • {nextDate.formatted}
                        </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                </div>
            </button>
        );
    }

    // Homeowner variant - simplified view with customer actions
    if (variant === 'homeowner') {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Header with repeat icon */}
                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-emerald-50 rounded-xl shrink-0">
                            <RotateCcw size={20} className="text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-slate-800 truncate">
                                    {service.serviceName}
                                </h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                                    {statusConfig.label}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 flex items-center gap-1">
                                <Building2 size={12} />
                                {service.contractorName || 'Contractor'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                {formatFrequency(service.frequency)} • {formatCurrency(service.basePrice)}/visit
                            </p>
                        </div>
                    </div>

                    {/* Next visit info */}
                    {service.status === 'active' && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs font-medium text-slate-500 mb-1">Next visit</p>
                            <p className="font-bold text-slate-800">{nextDate.formatted}</p>
                        </div>
                    )}

                    {/* Paused info */}
                    {service.status === 'paused' && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <p className="text-xs font-medium text-amber-600 mb-1">Service paused</p>
                            {service.pausedUntil && (
                                <p className="text-sm text-amber-700">
                                    Resumes {new Date(service.pausedUntil).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions for homeowner */}
                {service.status === 'active' && (
                    <div className="px-4 pb-4 flex gap-2">
                        <button
                            onClick={() => onSkipNext?.(service.id)}
                            className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <SkipForward size={14} />
                            Skip Next
                        </button>
                        <button
                            onClick={() => onPause?.(service.id)}
                            className="flex-1 px-3 py-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <Pause size={14} />
                            Pause
                        </button>
                        <button
                            onClick={() => onSelect?.(service)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <MoreVertical size={18} />
                        </button>
                    </div>
                )}

                {service.status === 'paused' && (
                    <div className="px-4 pb-4">
                        <button
                            onClick={() => onResume?.(service.id)}
                            className="w-full px-3 py-2.5 text-sm font-bold text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <Play size={14} />
                            Resume Service
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Default variant - full contractor view
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-emerald-50 rounded-xl">
                            <RotateCcw size={20} className="text-emerald-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-slate-800">
                                    {service.serviceName}
                                </h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                                    {statusConfig.label}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500">
                                {service.customerName}
                            </p>
                        </div>
                    </div>

                    {/* Actions dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowActions(!showActions)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <MoreVertical size={18} className="text-slate-400" />
                        </button>

                        {showActions && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-10 min-w-[140px]">
                                {service.status === 'active' && (
                                    <>
                                        <button
                                            onClick={() => { onEdit?.(service); setShowActions(false); }}
                                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                        >
                                            Edit Service
                                        </button>
                                        <button
                                            onClick={() => { onPause?.(service.id); setShowActions(false); }}
                                            className="w-full px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50"
                                        >
                                            Pause Service
                                        </button>
                                        <button
                                            onClick={() => { onCancel?.(service.id); setShowActions(false); }}
                                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                        >
                                            Cancel Service
                                        </button>
                                    </>
                                )}
                                {service.status === 'paused' && (
                                    <button
                                        onClick={() => { onResume?.(service.id); setShowActions(false); }}
                                        className="w-full px-4 py-2 text-left text-sm text-emerald-600 hover:bg-emerald-50"
                                    >
                                        Resume Service
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Details */}
            <div className="p-4 space-y-3">
                {/* Schedule info */}
                <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                        <Calendar size={14} className="text-slate-400" />
                        {formatFrequency(service.frequency)}
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                        <DollarSign size={14} className="text-slate-400" />
                        {formatCurrency(service.basePrice)}/visit
                    </div>
                    {service.assignedTechName && (
                        <div className="flex items-center gap-2 text-slate-600">
                            <User size={14} className="text-slate-400" />
                            {service.assignedTechName}
                        </div>
                    )}
                </div>

                {/* Address */}
                {service.propertyAddress && (
                    <div className="flex items-start gap-2 text-sm text-slate-500">
                        <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                        <span className="truncate">{service.propertyAddress}</span>
                    </div>
                )}

                {/* Next scheduled date */}
                {service.status === 'active' && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-400 font-medium">Next scheduled</p>
                            <p className="font-bold text-slate-800">{nextDate.formatted}</p>
                        </div>
                        <button
                            onClick={() => onSelect?.(service)}
                            className="px-4 py-2 bg-emerald-50 text-emerald-700 font-medium text-sm rounded-xl hover:bg-emerald-100 transition-colors"
                        >
                            View Schedule
                        </button>
                    </div>
                )}

                {/* Paused state */}
                {service.status === 'paused' && (
                    <div className="pt-3 border-t border-slate-100">
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-amber-700">Service Paused</p>
                                {service.pausedUntil && (
                                    <p className="text-xs text-amber-600">
                                        Auto-resumes {new Date(service.pausedUntil).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => onResume?.(service.id)}
                                className="px-3 py-1.5 bg-amber-100 text-amber-700 font-medium text-sm rounded-lg hover:bg-amber-200 transition-colors flex items-center gap-1"
                            >
                                <Play size={14} />
                                Resume
                            </button>
                        </div>
                    </div>
                )}

                {/* Stats */}
                {service.totalCompletedJobs > 0 && (
                    <div className="pt-2 text-xs text-slate-400">
                        {service.totalCompletedJobs} visit{service.totalCompletedJobs !== 1 ? 's' : ''} completed
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecurringServiceCard;
