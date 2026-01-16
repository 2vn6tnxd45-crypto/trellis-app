// src/features/jobs/components/JobProgressStepper.jsx
// ============================================
// JOB PROGRESS STEPPER
// ============================================
// Visual progress indicator showing job journey stages

import React from 'react';
import {
    FileText, Calendar, CalendarCheck, Wrench,
    ClipboardCheck, CheckCircle2, Check, XCircle
} from 'lucide-react';
import {
    JOB_STAGES,
    getCurrentStage,
    getNextStepGuidance,
    requiresUserAction
} from '../lib/jobProgressStages';

// Icon mapping
const ICON_MAP = {
    FileText,
    Calendar,
    CalendarCheck,
    Wrench,
    ClipboardCheck,
    CheckCircle2
};

/**
 * Get icon component for a stage
 */
const getStageIcon = (iconName, size = 16) => {
    const IconComponent = ICON_MAP[iconName] || FileText;
    return <IconComponent size={size} />;
};

// ============================================
// FULL VARIANT - For job detail views
// ============================================
const FullStepper = ({ currentStatus, showDescriptions = true, animated = true }) => {
    const { index: currentIndex, isCancelled } = getCurrentStage(currentStatus);
    const guidance = getNextStepGuidance(currentStatus);

    if (isCancelled) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-full">
                        <XCircle className="text-red-500" size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-red-700">Job Cancelled</p>
                        <p className="text-sm text-red-600">This job is no longer active</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            {/* Stepper Track */}
            <div className="relative">
                {/* Connection Line */}
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-200" />
                <div
                    className="absolute top-5 left-5 h-0.5 bg-emerald-500 transition-all duration-500"
                    style={{
                        width: `${(currentIndex / (JOB_STAGES.length - 1)) * 100}%`,
                        maxWidth: 'calc(100% - 40px)'
                    }}
                />

                {/* Stage Circles */}
                <div className="relative flex justify-between">
                    {JOB_STAGES.map((stage, index) => {
                        const isCompleted = index < currentIndex;
                        const isCurrent = index === currentIndex;
                        const isFuture = index > currentIndex;
                        const needsAction = isCurrent && requiresUserAction(currentStatus);

                        return (
                            <div
                                key={stage.id}
                                className="flex flex-col items-center"
                                style={{ width: `${100 / JOB_STAGES.length}%` }}
                            >
                                {/* Circle */}
                                <div
                                    className={`
                                        relative w-10 h-10 rounded-full flex items-center justify-center
                                        transition-all duration-300 z-10
                                        ${isCompleted
                                            ? 'bg-emerald-500 text-white'
                                            : isCurrent
                                                ? needsAction
                                                    ? 'bg-amber-500 text-white'
                                                    : 'bg-blue-500 text-white'
                                                : 'bg-slate-100 text-slate-400 border-2 border-slate-200'
                                        }
                                    `}
                                >
                                    {isCompleted ? (
                                        <Check size={18} strokeWidth={3} />
                                    ) : (
                                        getStageIcon(stage.icon, 18)
                                    )}

                                    {/* Pulse animation for current */}
                                    {isCurrent && animated && (
                                        <span className={`absolute inset-0 rounded-full animate-ping opacity-30 ${
                                            needsAction ? 'bg-amber-500' : 'bg-blue-500'
                                        }`} />
                                    )}
                                </div>

                                {/* Label */}
                                <p className={`
                                    mt-2 text-xs font-medium text-center
                                    ${isCompleted
                                        ? 'text-emerald-600'
                                        : isCurrent
                                            ? needsAction
                                                ? 'text-amber-700'
                                                : 'text-blue-700'
                                            : 'text-slate-400'
                                    }
                                `}>
                                    {stage.shortLabel}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Current Stage Description */}
            {showDescriptions && guidance && (
                <div className={`mt-4 p-3 rounded-lg ${
                    requiresUserAction(currentStatus)
                        ? 'bg-amber-50 border border-amber-200'
                        : 'bg-slate-50 border border-slate-100'
                }`}>
                    <p className={`text-sm ${
                        requiresUserAction(currentStatus)
                            ? 'text-amber-700'
                            : 'text-slate-600'
                    }`}>
                        {guidance}
                    </p>
                </div>
            )}
        </div>
    );
};

// ============================================
// COMPACT VARIANT - For job cards
// ============================================
const CompactStepper = ({ currentStatus, showLabels = true }) => {
    const { index: currentIndex, total, isCancelled } = getCurrentStage(currentStatus);
    const needsAction = requiresUserAction(currentStatus);

    if (isCancelled) {
        return (
            <div className="flex items-center gap-2 text-red-500">
                <XCircle size={14} />
                <span className="text-xs font-medium">Cancelled</span>
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            {/* Progress Bar */}
            <div className="flex gap-1">
                {JOB_STAGES.map((stage, index) => {
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;

                    return (
                        <div
                            key={stage.id}
                            className={`
                                h-1.5 flex-1 rounded-full transition-all duration-300
                                ${isCompleted
                                    ? 'bg-emerald-500'
                                    : isCurrent
                                        ? needsAction
                                            ? 'bg-amber-500'
                                            : 'bg-blue-500'
                                        : 'bg-slate-200'
                                }
                            `}
                        />
                    );
                })}
            </div>

            {/* Label */}
            {showLabels && (
                <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${
                        needsAction ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                        Step {currentIndex + 1} of {total}
                    </span>
                    <span className={`text-xs ${
                        needsAction ? 'text-amber-600' : 'text-slate-400'
                    }`}>
                        {JOB_STAGES[currentIndex]?.label || 'Unknown'}
                    </span>
                </div>
            )}
        </div>
    );
};

// ============================================
// MINI VARIANT - For tight spaces
// ============================================
const MiniStepper = ({ currentStatus }) => {
    const { index: currentIndex, total, isCancelled } = getCurrentStage(currentStatus);
    const needsAction = requiresUserAction(currentStatus);

    if (isCancelled) {
        return (
            <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                Cancelled
            </span>
        );
    }

    // Color based on progress
    const getProgressColor = () => {
        if (needsAction) return 'text-amber-700 bg-amber-100';
        if (currentIndex === total - 1) return 'text-emerald-700 bg-emerald-100';
        if (currentIndex >= total / 2) return 'text-blue-700 bg-blue-100';
        return 'text-slate-600 bg-slate-100';
    };

    return (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getProgressColor()}`}>
            {currentIndex + 1}/{total}
        </span>
    );
};

// ============================================
// MAIN EXPORT
// ============================================

/**
 * JobProgressStepper - Visual progress indicator
 *
 * @param {Object} props
 * @param {string} props.currentStatus - Job's current status
 * @param {'full'|'compact'|'mini'} props.variant - Display variant
 * @param {boolean} props.showLabels - Show text labels (compact/full)
 * @param {boolean} props.showDescriptions - Show guidance text (full)
 * @param {boolean} props.animated - Show pulse animation on current (full)
 */
export const JobProgressStepper = ({
    currentStatus,
    variant = 'compact',
    showLabels = true,
    showDescriptions = true,
    animated = true
}) => {
    switch (variant) {
        case 'full':
            return (
                <FullStepper
                    currentStatus={currentStatus}
                    showDescriptions={showDescriptions}
                    animated={animated}
                />
            );
        case 'mini':
            return <MiniStepper currentStatus={currentStatus} />;
        case 'compact':
        default:
            return (
                <CompactStepper
                    currentStatus={currentStatus}
                    showLabels={showLabels}
                />
            );
    }
};

// Also export individual variants for direct use
export { FullStepper, CompactStepper, MiniStepper };

export default JobProgressStepper;
