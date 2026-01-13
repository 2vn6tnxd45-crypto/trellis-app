// src/features/contractor-pro/components/CascadeWarningModal.jsx
// ============================================
// CASCADE WARNING MODAL
// ============================================
// Displays impact warnings before confirming schedule changes

import React from 'react';
import {
    AlertTriangle,
    AlertCircle,
    Info,
    X,
    Calendar,
    Clock,
    MapPin,
    ChevronRight,
    Route
} from 'lucide-react';

/**
 * CascadeWarningModal - Shows impact analysis before confirming an action
 * @param {Object} props
 * @param {Object} props.impact - Impact analysis from analyzeCancellationImpact
 * @param {string} props.actionType - 'cancel' | 'reschedule' | 'delete'
 * @param {Object} props.job - The job being acted upon
 * @param {Function} props.onConfirm - Called when user confirms
 * @param {Function} props.onCancel - Called when user cancels
 * @param {boolean} props.isProcessing - Loading state
 */
export const CascadeWarningModal = ({
    impact,
    actionType = 'cancel',
    job,
    onConfirm,
    onCancel,
    isProcessing = false
}) => {
    const getSeverityStyles = () => {
        switch (impact?.severity) {
            case 'high':
                return {
                    bg: 'bg-red-50',
                    border: 'border-red-200',
                    icon: AlertTriangle,
                    iconColor: 'text-red-600',
                    buttonBg: 'bg-red-600 hover:bg-red-700'
                };
            case 'medium':
                return {
                    bg: 'bg-amber-50',
                    border: 'border-amber-200',
                    icon: AlertCircle,
                    iconColor: 'text-amber-600',
                    buttonBg: 'bg-amber-600 hover:bg-amber-700'
                };
            default:
                return {
                    bg: 'bg-blue-50',
                    border: 'border-blue-200',
                    icon: Info,
                    iconColor: 'text-blue-600',
                    buttonBg: 'bg-blue-600 hover:bg-blue-700'
                };
        }
    };

    const styles = getSeverityStyles();
    const IconComponent = styles.icon;

    const getActionText = () => {
        switch (actionType) {
            case 'cancel': return 'Cancel Job';
            case 'reschedule': return 'Reschedule';
            case 'delete': return 'Delete';
            default: return 'Confirm';
        }
    };

    const getTitle = () => {
        switch (actionType) {
            case 'cancel': return 'Cancel This Job?';
            case 'reschedule': return 'Reschedule This Job?';
            case 'delete': return 'Delete This Job?';
            default: return 'Confirm Action';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                {/* Header */}
                <div className={`p-4 ${styles.bg} ${styles.border} border-b`}>
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${styles.bg}`}>
                            <IconComponent size={24} className={styles.iconColor} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800 text-lg">{getTitle()}</h3>
                            {job && (
                                <p className="text-sm text-slate-600 mt-1">
                                    {job.title || job.description || 'Job'} - {job.customer?.name || 'Customer'}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-1 hover:bg-white/50 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Impact Summary */}
                    {impact?.summary && (
                        <p className="text-slate-700">{impact.summary}</p>
                    )}

                    {/* Warnings */}
                    {impact?.warnings?.length > 0 && (
                        <div className="space-y-2">
                            {impact.warnings.map((warning, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
                                        warning.severity === 'high'
                                            ? 'bg-red-50 text-red-700 border border-red-200'
                                            : warning.severity === 'medium'
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                            : 'bg-slate-50 text-slate-600 border border-slate-200'
                                    }`}
                                >
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    <span>{warning.message}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Route Impact */}
                    {impact?.routeImpact?.hasImpact && (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                                <Route size={16} className="text-slate-500" />
                                Route Impact
                            </h4>

                            <div className="space-y-2 text-sm">
                                {impact.routeImpact.previousJob && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <span className="text-xs bg-slate-200 px-2 py-0.5 rounded">Before</span>
                                        <span className="truncate">{impact.routeImpact.previousJob.title}</span>
                                    </div>
                                )}

                                {job && (
                                    <div className="flex items-center gap-2 text-red-600 font-medium">
                                        <span className="text-xs bg-red-100 px-2 py-0.5 rounded">Removing</span>
                                        <span className="truncate">{job.title || job.description}</span>
                                    </div>
                                )}

                                {impact.routeImpact.nextJob && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <span className="text-xs bg-slate-200 px-2 py-0.5 rounded">After</span>
                                        <span className="truncate">{impact.routeImpact.nextJob.title}</span>
                                    </div>
                                )}

                                {impact.routeImpact.estimatedTimeRecovered > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-emerald-600">
                                        <Clock size={14} />
                                        <span>
                                            ~{Math.round(impact.routeImpact.estimatedTimeRecovered)} min freed up
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Affected Jobs Count */}
                    {impact?.affectedJobs?.length > 0 && (
                        <div className="text-sm text-slate-500">
                            <span className="font-medium">{impact.affectedJobs.length}</span> other job{impact.affectedJobs.length > 1 ? 's' : ''} on this day may be affected
                        </div>
                    )}

                    {/* Re-optimization suggestion */}
                    {impact?.affectedJobs?.length >= 3 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700 flex items-start gap-2">
                            <Info size={16} className="shrink-0 mt-0.5" />
                            <span>Consider re-optimizing your route after this change for better efficiency.</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-3 text-slate-700 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Keep Job
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className={`flex-1 px-4 py-3 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${styles.buttonBg}`}
                    >
                        {isProcessing ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                {getActionText()}
                                <ChevronRight size={16} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Hook for using cascade warnings
 */
export const useCascadeWarning = () => {
    const [showWarning, setShowWarning] = React.useState(false);
    const [warningData, setWarningData] = React.useState(null);
    const [isProcessing, setIsProcessing] = React.useState(false);

    const showCascadeWarning = (impact, job, actionType, onConfirm) => {
        setWarningData({ impact, job, actionType, onConfirm });
        setShowWarning(true);
    };

    const handleConfirm = async () => {
        if (!warningData?.onConfirm) return;

        setIsProcessing(true);
        try {
            await warningData.onConfirm();
            setShowWarning(false);
            setWarningData(null);
        } catch (error) {
            console.error('Action failed:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancel = () => {
        setShowWarning(false);
        setWarningData(null);
    };

    return {
        showWarning,
        showCascadeWarning,
        WarningModal: showWarning ? (
            <CascadeWarningModal
                impact={warningData?.impact}
                job={warningData?.job}
                actionType={warningData?.actionType}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                isProcessing={isProcessing}
            />
        ) : null
    };
};

export default CascadeWarningModal;
