// src/features/contractor-pro/components/CustomerETAPage.jsx
// ============================================
// CUSTOMER ETA TRACKING PAGE
// ============================================
// Quick Win #4: Live ETA page for customers

import React, { useState, useEffect } from 'react';
import {
    Clock, MapPin, User, CheckCircle, Truck, AlertTriangle,
    Calendar, Phone, RefreshCw, XCircle
} from 'lucide-react';

// Status configurations
const STATUS_CONFIG = {
    pending_schedule: {
        icon: Clock,
        color: 'text-slate-500',
        bgColor: 'bg-slate-100',
        label: 'Pending'
    },
    scheduled: {
        icon: Calendar,
        color: 'text-blue-500',
        bgColor: 'bg-blue-100',
        label: 'Scheduled'
    },
    en_route: {
        icon: Truck,
        color: 'text-purple-500',
        bgColor: 'bg-purple-100',
        label: 'On the Way'
    },
    on_site: {
        icon: MapPin,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-100',
        label: 'Arrived'
    },
    in_progress: {
        icon: Clock,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-100',
        label: 'In Progress'
    },
    running_late: {
        icon: AlertTriangle,
        color: 'text-orange-500',
        bgColor: 'bg-orange-100',
        label: 'Running Late'
    },
    waiting: {
        icon: Clock,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-100',
        label: 'Waiting'
    },
    completed: {
        icon: CheckCircle,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-100',
        label: 'Completed'
    },
    cancelled: {
        icon: XCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-100',
        label: 'Cancelled'
    }
};

// Progress steps
const PROGRESS_STEPS = [
    { status: 'scheduled', label: 'Scheduled' },
    { status: 'en_route', label: 'On the Way' },
    { status: 'on_site', label: 'Arrived' },
    { status: 'completed', label: 'Complete' }
];

/**
 * Customer-facing ETA tracking page
 */
export const CustomerETAPage = ({ jobId, contractorId, token }) => {
    const [etaData, setEtaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);

    // Fetch ETA data
    const fetchETA = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                jobId,
                contractorId,
                ...(token && { token })
            });

            const response = await fetch(`/api/customer-eta?${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch ETA');
            }

            const data = await response.json();
            setEtaData(data);
            setLastRefresh(new Date());
            setError(null);
        } catch (err) {
            console.error('ETA fetch error:', err);
            setError('Unable to load tracking information');
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch and polling
    useEffect(() => {
        fetchETA();

        // Poll every 30 seconds for updates
        const interval = setInterval(fetchETA, 30000);

        return () => clearInterval(interval);
    }, [jobId, contractorId, token]);

    // Get current progress step
    const getCurrentStep = (status) => {
        const statusOrder = ['scheduled', 'en_route', 'on_site', 'in_progress', 'completed'];
        const currentIndex = statusOrder.indexOf(status);
        return currentIndex >= 0 ? currentIndex : 0;
    };

    // Format date
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    };

    // Format time
    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    if (loading && !etaData) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-slate-500">Loading tracking information...</p>
                </div>
            </div>
        );
    }

    if (error && !etaData) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
                    <AlertTriangle className="mx-auto h-12 w-12 text-orange-500 mb-4" />
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Unable to Load</h2>
                    <p className="text-slate-500 mb-4">{error}</p>
                    <button
                        onClick={fetchETA}
                        className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const statusConfig = STATUS_CONFIG[etaData?.status] || STATUS_CONFIG.scheduled;
    const StatusIcon = statusConfig.icon;
    const currentStep = getCurrentStep(etaData?.status);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-4 py-4">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Service Appointment</h1>
                        <p className="text-sm text-slate-500">#{etaData?.jobNumber}</p>
                    </div>
                    <button
                        onClick={fetchETA}
                        disabled={loading}
                        className="p-2 text-slate-400 hover:text-emerald-600 disabled:opacity-50"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
                {/* Status Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className={`p-6 ${statusConfig.bgColor}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 bg-white rounded-full ${statusConfig.color}`}>
                                <StatusIcon size={28} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-600">Current Status</p>
                                <p className={`text-2xl font-bold ${statusConfig.color}`}>
                                    {statusConfig.label}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ETA Message */}
                    <div className="p-6 border-t border-slate-100">
                        <p className="text-lg text-slate-700">{etaData?.etaMessage}</p>
                        {lastRefresh && (
                            <p className="text-xs text-slate-400 mt-2">
                                Last updated: {lastRefresh.toLocaleTimeString()}
                            </p>
                        )}
                    </div>
                </div>

                {/* Progress Tracker */}
                {etaData?.status !== 'cancelled' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-800 mb-4">Progress</h3>
                        <div className="relative">
                            {/* Progress Line */}
                            <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200" />
                            <div
                                className="absolute top-4 left-4 h-0.5 bg-emerald-500 transition-all duration-500"
                                style={{ width: `${(currentStep / (PROGRESS_STEPS.length - 1)) * 100}%` }}
                            />

                            {/* Steps */}
                            <div className="relative flex justify-between">
                                {PROGRESS_STEPS.map((step, index) => {
                                    const isComplete = index <= currentStep;
                                    const isCurrent = index === currentStep;

                                    return (
                                        <div key={step.status} className="flex flex-col items-center">
                                            <div className={`
                                                w-8 h-8 rounded-full flex items-center justify-center
                                                ${isComplete ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}
                                                ${isCurrent ? 'ring-4 ring-emerald-100' : ''}
                                            `}>
                                                {isComplete ? (
                                                    <CheckCircle size={16} />
                                                ) : (
                                                    <span className="text-xs font-bold">{index + 1}</span>
                                                )}
                                            </div>
                                            <p className={`text-xs mt-2 ${isComplete ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                                                {step.label}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Appointment Details */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <h3 className="font-bold text-slate-800">Appointment Details</h3>

                    {/* Date & Time */}
                    <div className="flex items-start gap-3">
                        <Calendar className="text-slate-400 flex-shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="font-medium text-slate-800">
                                {formatDate(etaData?.scheduledDate)}
                            </p>
                            <p className="text-sm text-slate-500">
                                {formatTime(etaData?.scheduledStartTime)} - {formatTime(etaData?.scheduledEndTime)}
                            </p>
                        </div>
                    </div>

                    {/* Address */}
                    <div className="flex items-start gap-3">
                        <MapPin className="text-slate-400 flex-shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="font-medium text-slate-800">{etaData?.serviceAddress}</p>
                        </div>
                    </div>

                    {/* Service */}
                    {etaData?.title && (
                        <div className="pt-3 border-t border-slate-100">
                            <p className="text-sm text-slate-500">Service</p>
                            <p className="font-medium text-slate-800">{etaData?.title}</p>
                            {etaData?.description && (
                                <p className="text-sm text-slate-600 mt-1">{etaData?.description}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Tech Info */}
                {etaData?.tech && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-800 mb-3">Your Technician</h3>
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                                {etaData.tech.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                                <p className="font-medium text-slate-800">{etaData.tech.name}</p>
                                <p className="text-sm text-slate-500">Certified Technician</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Need Help */}
                <div className="bg-slate-100 rounded-2xl p-6 text-center">
                    <p className="text-sm text-slate-600 mb-3">Need to reschedule or have questions?</p>
                    <a
                        href="tel:+1234567890"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl text-slate-700 font-medium shadow-sm hover:shadow"
                    >
                        <Phone size={16} />
                        Contact Us
                    </a>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 px-4 py-4 mt-8">
                <div className="max-w-lg mx-auto text-center">
                    <p className="text-xs text-slate-400">
                        Powered by <span className="font-bold text-emerald-600">krib</span>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default CustomerETAPage;
