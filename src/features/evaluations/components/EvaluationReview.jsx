// src/features/evaluations/components/EvaluationReview.jsx
// ============================================
// EVALUATION REVIEW (CONTRACTOR VIEW)
// ============================================
// Contractor interface for reviewing homeowner submissions,
// requesting additional info, recording findings, and
// converting evaluations to quotes.

import React, { useState, useCallback, useMemo } from 'react';
import {
    X, ChevronLeft, Camera, Video, FileText, Clock, CheckCircle,
    AlertCircle, MessageSquare, Send, Plus, Loader2, ExternalLink,
    User, Home, Phone, Mail, Calendar, DollarSign, ClipboardList,
    ArrowRight, Image, Play, Edit3, Trash2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { ButtonLoader } from '../../../components/common';
import { 
    EVALUATION_STATUS, 
    EVALUATION_TYPES,
    FEE_STATUS,
    getTimeRemaining 
} from '../lib/evaluationService';
import { PROMPT_TYPES, CATEGORY_LABELS } from '../lib/evaluationTemplates';
import { useEvaluationCountdown } from '../hooks/useEvaluations';
import { AIAnalysisSummary } from './AIAnalysisSummary';

// ============================================
// MAIN COMPONENT
// ============================================

export const EvaluationReview = ({
    evaluation,
    onRequestMoreInfo,
    onSendMessage,
    onSchedule,
    onComplete,
    onConvertToQuote,
    onCancel,
    onBack,
    isLoading = false
}) => {
    const [activeTab, setActiveTab] = useState('submissions');
    const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
    const [showFindingsModal, setShowFindingsModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const timeRemaining = useEvaluationCountdown(evaluation?.expiresAt);

    // ----------------------------------------
    // Status helpers
    // ----------------------------------------
    const statusConfig = useMemo(() => {
        switch (evaluation?.status) {
            case EVALUATION_STATUS.REQUESTED:
                return { 
                    color: 'amber', 
                    icon: Clock, 
                    label: 'Awaiting Response',
                    description: 'Customer has not yet submitted information'
                };
            case EVALUATION_STATUS.MEDIA_PENDING:
                return { 
                    color: 'blue', 
                    icon: Camera, 
                    label: 'Submission In Progress',
                    description: 'Customer is uploading photos/info'
                };
            case EVALUATION_STATUS.INFO_REQUESTED:
                return { 
                    color: 'purple', 
                    icon: MessageSquare, 
                    label: 'More Info Requested',
                    description: 'Waiting for customer to provide additional information'
                };
            case EVALUATION_STATUS.COMPLETED:
                return { 
                    color: 'emerald', 
                    icon: CheckCircle, 
                    label: 'Ready to Quote',
                    description: 'Evaluation complete - ready to create quote'
                };
            case EVALUATION_STATUS.QUOTED:
                return { 
                    color: 'indigo', 
                    icon: ClipboardList, 
                    label: 'Quote Created',
                    description: 'Quote has been generated from this evaluation'
                };
            case EVALUATION_STATUS.EXPIRED:
                return { 
                    color: 'red', 
                    icon: AlertTriangle, 
                    label: 'Expired',
                    description: 'Customer did not respond in time'
                };
            case EVALUATION_STATUS.CANCELLED:
                return { 
                    color: 'gray', 
                    icon: X, 
                    label: 'Cancelled',
                    description: 'This evaluation was cancelled'
                };
            default:
                return { 
                    color: 'gray', 
                    icon: Clock, 
                    label: 'Unknown',
                    description: ''
                };
        }
    }, [evaluation?.status]);

    const hasSubmissions = useMemo(() => {
        if (!evaluation?.submissions) return false;
        return (
            evaluation.submissions.photos?.length > 0 ||
            evaluation.submissions.videos?.length > 0 ||
            Object.keys(evaluation.submissions.answers || {}).length > 0
        );
    }, [evaluation]);

    const isActionable = useMemo(() => {
        return [
            EVALUATION_STATUS.MEDIA_PENDING,
            EVALUATION_STATUS.COMPLETED
        ].includes(evaluation?.status) && hasSubmissions;
    }, [evaluation?.status, hasSubmissions]);

    // ----------------------------------------
    // Handlers
    // ----------------------------------------
    const handleRequestMoreInfo = async (message, additionalPrompts) => {
        setIsSubmitting(true);
        try {
            await onRequestMoreInfo(evaluation.id, message, additionalPrompts);
            setShowRequestInfoModal(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCompleteFindgs = async (findings) => {
        setIsSubmitting(true);
        try {
            await onComplete(evaluation.id, findings);
            setShowFindingsModal(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConvertToQuote = () => {
        onConvertToQuote(evaluation);
    };

    const handleCancelConfirm = async (reason) => {
        setIsSubmitting(true);
        try {
            await onCancel(evaluation.id, reason || 'Cancelled by contractor');
            setShowCancelModal(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleScheduleConfirm = async (scheduleData) => {
        if (!onSchedule) return;
        setIsSubmitting(true);
        try {
            await onSchedule(evaluation.id, scheduleData);
            setShowScheduleModal(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Check if this is a site visit type evaluation that can be scheduled
    const canSchedule = evaluation?.type === EVALUATION_TYPES.SITE_VISIT &&
        !['scheduled', 'completed', 'quoted', 'cancelled', 'expired'].includes(evaluation?.status);

    if (!evaluation) return null;

    // ----------------------------------------
    // Render
    // ----------------------------------------
    return (
        <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`px-6 py-4 bg-gradient-to-r from-${statusConfig.color}-500 to-${statusConfig.color}-600`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-white" />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {evaluation.customerName}
                            </h2>
                            <p className="text-white/80 text-sm">
                                {CATEGORY_LABELS[evaluation.jobCategory] || evaluation.jobCategory}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {timeRemaining && !timeRemaining.expired && (
                            <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                                timeRemaining.urgent 
                                    ? 'bg-red-100 text-red-700' 
                                    : 'bg-white/20 text-white'
                            }`}>
                                <Clock className="w-4 h-4 inline mr-1" />
                                {timeRemaining.display}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <div className={`px-6 py-3 bg-${statusConfig.color}-50 border-b border-${statusConfig.color}-100 flex items-center gap-3`}>
                <statusConfig.icon className={`w-5 h-5 text-${statusConfig.color}-600`} />
                <div>
                    <span className={`font-semibold text-${statusConfig.color}-700`}>
                        {statusConfig.label}
                    </span>
                    <span className="text-sm text-slate-500 ml-2">
                        {statusConfig.description}
                    </span>
                </div>
            </div>

            {/* AI Analysis Summary - Show if available */}
            {evaluation?.aiAnalysis && (
                <div className="p-6 border-b border-slate-200">
                    <AIAnalysisSummary
                        analysis={evaluation.aiAnalysis}
                        variant="full"
                    />
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <div className="flex px-6">
                    <TabButton 
                        active={activeTab === 'submissions'} 
                        onClick={() => setActiveTab('submissions')}
                        badge={evaluation.submissions?.photos?.length || 0}
                    >
                        Submissions
                    </TabButton>
                    <TabButton 
                        active={activeTab === 'details'} 
                        onClick={() => setActiveTab('details')}
                    >
                        Details
                    </TabButton>
                    <TabButton 
                        active={activeTab === 'messages'} 
                        onClick={() => setActiveTab('messages')}
                        badge={evaluation.messages?.length || 0}
                    >
                        Messages
                    </TabButton>
                    {evaluation.findings?.notes && (
                        <TabButton 
                            active={activeTab === 'findings'} 
                            onClick={() => setActiveTab('findings')}
                        >
                            Findings
                        </TabButton>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'submissions' && (
                    <SubmissionsTab 
                        evaluation={evaluation} 
                        hasSubmissions={hasSubmissions}
                    />
                )}
                {activeTab === 'details' && (
                    <DetailsTab evaluation={evaluation} />
                )}
                {activeTab === 'messages' && (
                    <MessagesTab
                        evaluation={evaluation}
                        onSendMessage={onSendMessage}
                    />
                )}
                {activeTab === 'findings' && (
                    <FindingsTab evaluation={evaluation} />
                )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                        {evaluation.status !== EVALUATION_STATUS.QUOTED &&
                         evaluation.status !== EVALUATION_STATUS.CANCELLED && (
                            <button
                                onClick={() => setShowCancelModal(true)}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                            >
                                Cancel Request
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        {/* Schedule Site Visit button */}
                        {canSchedule && onSchedule && (
                            <button
                                onClick={() => setShowScheduleModal(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-indigo-300 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                            >
                                <Calendar className="w-4 h-4" />
                                Schedule Visit
                            </button>
                        )}
                        {isActionable && evaluation.status !== EVALUATION_STATUS.COMPLETED && (
                            <>
                                <button
                                    onClick={() => setShowRequestInfoModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors font-medium"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    Request More Info
                                </button>
                                <button
                                    onClick={() => setShowFindingsModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Complete Evaluation
                                </button>
                            </>
                        )}
                        {evaluation.status === EVALUATION_STATUS.COMPLETED && (
                            <button
                                onClick={handleConvertToQuote}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold"
                            >
                                <ClipboardList className="w-5 h-5" />
                                Create Quote
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                        {evaluation.status === EVALUATION_STATUS.QUOTED && evaluation.quoteId && (
                            <button
                                onClick={() => {/* Navigate to quote */}}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                            >
                                <ExternalLink className="w-4 h-4" />
                                View Quote
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showRequestInfoModal && (
                <RequestInfoModal
                    onSubmit={handleRequestMoreInfo}
                    onClose={() => setShowRequestInfoModal(false)}
                    isSubmitting={isSubmitting}
                />
            )}
            {showFindingsModal && (
                <FindingsModal
                    evaluation={evaluation}
                    onSubmit={handleCompleteFindgs}
                    onClose={() => setShowFindingsModal(false)}
                    isSubmitting={isSubmitting}
                />
            )}
            {showCancelModal && (
                <CancelEvaluationModal
                    evaluation={evaluation}
                    onConfirm={handleCancelConfirm}
                    onClose={() => setShowCancelModal(false)}
                    isSubmitting={isSubmitting}
                />
            )}
            {showScheduleModal && (
                <ScheduleVisitModal
                    evaluation={evaluation}
                    onConfirm={handleScheduleConfirm}
                    onClose={() => setShowScheduleModal(false)}
                    isSubmitting={isSubmitting}
                />
            )}
        </div>
    );
};

// ============================================
// TAB BUTTON
// ============================================

const TabButton = ({ children, active, onClick, badge }) => (
    <button
        onClick={onClick}
        className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors relative ${
            active 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
    >
        {children}
        {badge > 0 && (
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'
            }`}>
                {badge}
            </span>
        )}
    </button>
);

// ============================================
// SUBMISSIONS TAB
// ============================================

const SubmissionsTab = ({ evaluation, hasSubmissions }) => {
    const [selectedImage, setSelectedImage] = useState(null);

    if (!hasSubmissions) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Camera className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500">No submissions yet</p>
                <p className="text-sm text-slate-400 mt-1">
                    Customer hasn't uploaded any photos or information
                </p>
            </div>
        );
    }

    const { photos = [], videos = [], answers = {} } = evaluation.submissions || {};
    const prompts = evaluation.prompts || [];

    return (
        <div className="space-y-6">
            {/* Photos */}
            {photos.length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Image className="w-4 h-4" />
                        Photos ({photos.length})
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        {photos.map((photo, i) => {
                            const prompt = prompts.find(p => p.id === photo.promptId);
                            return (
                                <div 
                                    key={i}
                                    className="relative group cursor-pointer"
                                    onClick={() => setSelectedImage(photo)}
                                >
                                    <img
                                        src={photo.url}
                                        alt={prompt?.label || `Photo ${i + 1}`}
                                        className="w-full h-32 object-cover rounded-lg"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                        <span className="text-white text-sm font-medium">
                                            {prompt?.label || 'View'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Videos */}
            {videos.length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Play className="w-4 h-4" />
                        Videos ({videos.length})
                    </h3>
                    <div className="space-y-2">
                        {videos.map((video, i) => {
                            const prompt = prompts.find(p => p.id === video.promptId);
                            return (
                                <div 
                                    key={i}
                                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                                >
                                    <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Play className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-700">
                                            {prompt?.label || `Video ${i + 1}`}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {video.name} • {(video.size / (1024 * 1024)).toFixed(1)} MB
                                        </p>
                                    </div>
                                    <a
                                        href={video.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
                                    >
                                        Play
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Answers */}
            {Object.keys(answers).length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Responses
                    </h3>
                    <div className="space-y-3">
                        {Object.entries(answers).map(([promptId, answer]) => {
                            const prompt = prompts.find(p => p.id === promptId);
                            if (!prompt) return null;
                            
                            let displayValue = answer;
                            if (prompt.type === PROMPT_TYPES.SELECT && prompt.options) {
                                const option = prompt.options.find(o => o.value === answer);
                                displayValue = option?.label || answer;
                            } else if (prompt.type === PROMPT_TYPES.YES_NO) {
                                displayValue = answer ? 'Yes' : 'No';
                            }

                            return (
                                <div key={promptId} className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-xs font-medium text-slate-500 uppercase mb-1">
                                        {prompt.label}
                                    </p>
                                    <p className="text-slate-700">{displayValue}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Lightbox */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button 
                        className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={selectedImage.url}
                        alt="Full size"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

// ============================================
// DETAILS TAB
// ============================================

const DetailsTab = ({ evaluation }) => {
    return (
        <div className="space-y-6">
            {/* Customer Info */}
            <section>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Customer
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-slate-400" />
                        <span className="text-slate-700">{evaluation.customerName}</span>
                    </div>
                    {evaluation.customerEmail && (
                        <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-slate-400" />
                            <a 
                                href={`mailto:${evaluation.customerEmail}`}
                                className="text-indigo-600 hover:underline"
                            >
                                {evaluation.customerEmail}
                            </a>
                        </div>
                    )}
                    {evaluation.customerPhone && (
                        <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-slate-400" />
                            <a 
                                href={`tel:${evaluation.customerPhone}`}
                                className="text-indigo-600 hover:underline"
                            >
                                {evaluation.customerPhone}
                            </a>
                        </div>
                    )}
                    <div className="flex items-start gap-3">
                        <Home className="w-5 h-5 text-slate-400 mt-0.5" />
                        <span className="text-slate-700">{evaluation.propertyAddress}</span>
                    </div>
                </div>
            </section>

            {/* Job Info */}
            <section>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Job Details
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <div>
                        <p className="text-xs text-slate-500 uppercase mb-1">Category</p>
                        <p className="text-slate-700 font-medium">
                            {CATEGORY_LABELS[evaluation.jobCategory] || evaluation.jobCategory}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase mb-1">Description</p>
                        <p className="text-slate-700">{evaluation.jobDescription}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase mb-1">Evaluation Type</p>
                        <p className="text-slate-700 capitalize">
                            {evaluation.type === EVALUATION_TYPES.VIRTUAL ? 'Virtual (Photos/Video)' : 'Site Visit'}
                        </p>
                    </div>
                </div>
            </section>

            {/* Fee Info */}
            {evaluation.fee?.amount > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Evaluation Fee
                    </h3>
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <DollarSign className="w-5 h-5 text-slate-400" />
                                <span className="text-xl font-bold text-slate-700">
                                    ${evaluation.fee.amount}
                                </span>
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                evaluation.fee.status === FEE_STATUS.PAID
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : evaluation.fee.status === FEE_STATUS.WAIVED
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-amber-100 text-amber-700'
                            }`}>
                                {evaluation.fee.status === FEE_STATUS.PAID ? 'Paid' :
                                 evaluation.fee.status === FEE_STATUS.WAIVED ? 'Waived' : 'Pending'}
                            </span>
                        </div>
                        {evaluation.fee.waivedIfHired && (
                            <p className="text-sm text-slate-500 mt-2">
                                Fee will be waived if customer accepts quote
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* Timeline */}
            <section>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Timeline
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Created</span>
                        <span className="text-slate-700">
                            {evaluation.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                        </span>
                    </div>
                    {evaluation.expiresAt && (
                        <div className="flex justify-between">
                            <span className="text-slate-500">Expires</span>
                            <span className={`${
                                getTimeRemaining(evaluation.expiresAt)?.expired 
                                    ? 'text-red-600' 
                                    : 'text-slate-700'
                            }`}>
                                {evaluation.expiresAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                            </span>
                        </div>
                    )}
                    {evaluation.completedAt && (
                        <div className="flex justify-between">
                            <span className="text-slate-500">Completed</span>
                            <span className="text-emerald-600">
                                {evaluation.completedAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                            </span>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

// ============================================
// MESSAGES TAB
// ============================================

const MessagesTab = ({ evaluation, onSendMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messages = evaluation.messages || [];

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !onSendMessage) return;

        setIsSending(true);
        try {
            await onSendMessage(evaluation.id, newMessage.trim());
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Messages List */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <MessageSquare className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-slate-500 text-sm">No messages yet</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Send a message to the customer below
                        </p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`p-4 rounded-xl ${
                                msg.from === 'contractor'
                                    ? 'bg-indigo-50 border border-indigo-100 ml-8'
                                    : 'bg-slate-50 border border-slate-100 mr-8'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs font-semibold uppercase ${
                                    msg.from === 'contractor' ? 'text-indigo-600' : 'text-slate-600'
                                }`}>
                                    {msg.from === 'contractor' ? 'You' : 'Customer'}
                                </span>
                                <span className="text-xs text-slate-400">
                                    {new Date(msg.createdAt).toLocaleString()}
                                </span>
                            </div>
                            <p className="text-slate-700">{msg.message}</p>
                            {msg.additionalPrompts?.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <p className="text-xs font-medium text-slate-500 mb-2">
                                        Additional requests:
                                    </p>
                                    <ul className="space-y-1">
                                        {msg.additionalPrompts.map((p, i) => (
                                            <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                                                <Camera className="w-3 h-3" />
                                                {p.label}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Message Input */}
            <div className="border-t border-slate-200 pt-4">
                <div className="flex gap-2">
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message to the customer..."
                        rows={2}
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm"
                        disabled={isSending}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || isSending}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 self-end"
                    >
                        {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Send
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                    Press Enter to send, Shift+Enter for new line
                </p>
            </div>
        </div>
    );
};

// ============================================
// FINDINGS TAB
// ============================================

const FindingsTab = ({ evaluation }) => {
    const { findings } = evaluation;

    if (!findings?.notes) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">No findings recorded yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Notes
                </h3>
                <p className="text-slate-700 whitespace-pre-wrap">{findings.notes}</p>
            </section>

            {findings.recommendations && (
                <section>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Recommendations
                    </h3>
                    <p className="text-slate-700 whitespace-pre-wrap">{findings.recommendations}</p>
                </section>
            )}

            {findings.scopeAssessment && (
                <section>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Scope Assessment
                    </h3>
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        findings.scopeAssessment === 'larger_than_expected' 
                            ? 'bg-amber-100 text-amber-700'
                            : findings.scopeAssessment === 'smaller_than_expected'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-700'
                    }`}>
                        {findings.scopeAssessment === 'larger_than_expected' ? 'Larger than expected' :
                         findings.scopeAssessment === 'smaller_than_expected' ? 'Smaller than expected' :
                         'As expected'}
                    </span>
                </section>
            )}

            {findings.photos?.length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Your Photos
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                        {findings.photos.map((photo, i) => (
                            <img 
                                key={i}
                                src={photo.url}
                                alt={`Finding ${i + 1}`}
                                className="w-full h-20 object-cover rounded-lg"
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

// ============================================
// REQUEST INFO MODAL
// ============================================

const RequestInfoModal = ({ onSubmit, onClose, isSubmitting }) => {
    const [message, setMessage] = useState('');
    const [additionalPrompts, setAdditionalPrompts] = useState([]);

    const addPrompt = (type) => {
        setAdditionalPrompts(prev => [...prev, {
            id: `additional_${Date.now()}`,
            type,
            label: '',
            required: true
        }]);
    };

    const updatePrompt = (id, label) => {
        setAdditionalPrompts(prev => prev.map(p => 
            p.id === id ? { ...p, label } : p
        ));
    };

    const removePrompt = (id) => {
        setAdditionalPrompts(prev => prev.filter(p => p.id !== id));
    };

    const handleSubmit = () => {
        if (!message.trim()) return;
        const validPrompts = additionalPrompts.filter(p => p.label.trim());
        onSubmit(message, validPrompts);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Request More Information</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Message to Customer
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none"
                            placeholder="Explain what additional information you need..."
                        />
                    </div>

                    {additionalPrompts.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">
                                Additional Requests
                            </label>
                            {additionalPrompts.map((prompt) => (
                                <div key={prompt.id} className="flex items-center gap-2">
                                    <span className="text-slate-400">
                                        {prompt.type === PROMPT_TYPES.PHOTO ? <Camera className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                    </span>
                                    <input
                                        type="text"
                                        value={prompt.label}
                                        onChange={(e) => updatePrompt(prompt.id, e.target.value)}
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        placeholder={prompt.type === PROMPT_TYPES.PHOTO ? 'Photo of...' : 'Question...'}
                                    />
                                    <button
                                        onClick={() => removePrompt(prompt.id)}
                                        className="p-2 text-slate-400 hover:text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => addPrompt(PROMPT_TYPES.PHOTO)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        >
                            <Plus className="w-4 h-4" />
                            <Camera className="w-3.5 h-3.5" />
                            Photo
                        </button>
                        <button
                            type="button"
                            onClick={() => addPrompt(PROMPT_TYPES.TEXT)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        >
                            <Plus className="w-4 h-4" />
                            <FileText className="w-3.5 h-3.5" />
                            Question
                        </button>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!message.trim() || isSubmitting}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {isSubmitting ? <ButtonLoader size={16} /> : <Send className="w-4 h-4" />}
                        Send Request
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// FINDINGS MODAL
// ============================================

const FindingsModal = ({ evaluation, onSubmit, onClose, isSubmitting }) => {
    const [findings, setFindings] = useState({
        notes: '',
        recommendations: '',
        scopeAssessment: 'as_expected',
        photos: []
    });

    const handleSubmit = () => {
        if (!findings.notes.trim()) return;
        onSubmit(findings);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800">Complete Evaluation</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Your Notes *
                        </label>
                        <textarea
                            value={findings.notes}
                            onChange={(e) => setFindings(prev => ({ ...prev, notes: e.target.value }))}
                            rows={4}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none"
                            placeholder="What did you observe? Any issues or concerns?"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Recommendations
                        </label>
                        <textarea
                            value={findings.recommendations}
                            onChange={(e) => setFindings(prev => ({ ...prev, recommendations: e.target.value }))}
                            rows={3}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none"
                            placeholder="What do you recommend for this job?"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Scope Assessment
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'smaller_than_expected', label: 'Smaller', color: 'emerald' },
                                { value: 'as_expected', label: 'As Expected', color: 'slate' },
                                { value: 'larger_than_expected', label: 'Larger', color: 'amber' }
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setFindings(prev => ({ ...prev, scopeAssessment: option.value }))}
                                    className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                                        findings.scopeAssessment === option.value
                                            ? `border-${option.color}-500 bg-${option.color}-50 text-${option.color}-700`
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!findings.notes.trim() || isSubmitting}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {isSubmitting ? <ButtonLoader size={16} /> : <CheckCircle className="w-4 h-4" />}
                        Complete & Ready to Quote
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// SCHEDULE VISIT MODAL
// ============================================

const ScheduleVisitModal = ({ evaluation, onConfirm, onClose, isSubmitting }) => {
    // Default to tomorrow at 10am
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().split('T')[0];

    const [scheduledDate, setScheduledDate] = useState(defaultDate);
    const [scheduledTime, setScheduledTime] = useState('10:00');
    const [duration, setDuration] = useState(30);

    const handleConfirm = () => {
        // Combine date and time into ISO string
        const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}:00`);
        onConfirm({
            scheduledFor: scheduledFor.toISOString(),
            duration
        });
    };

    const isValid = scheduledDate && scheduledTime;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-100 rounded-xl">
                        <Calendar className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Schedule Site Visit</h3>
                        <p className="text-sm text-slate-500">Choose a date and time for the on-site evaluation.</p>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <p className="text-sm text-slate-600 mb-1">Customer:</p>
                    <p className="font-semibold text-slate-800">{evaluation?.customerName}</p>
                    {evaluation?.propertyAddress && (
                        <p className="text-sm text-slate-500 mt-1">{evaluation.propertyAddress}</p>
                    )}
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Date *
                        </label>
                        <input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            min={defaultDate}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Time *
                        </label>
                        <input
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Duration
                        </label>
                        <select
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={90}>1.5 hours</option>
                            <option value={120}>2 hours</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isValid || isSubmitting}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Calendar className="w-4 h-4" />
                        )}
                        Schedule Visit
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// CANCEL EVALUATION MODAL
// ============================================

const CancelEvaluationModal = ({ evaluation, onConfirm, onClose, isSubmitting }) => {
    const [reason, setReason] = useState('');

    const handleConfirm = () => {
        onConfirm(reason.trim() || 'Cancelled by contractor');
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-red-100 rounded-xl">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Cancel Evaluation?</h3>
                        <p className="text-sm text-slate-500">This action cannot be undone.</p>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <p className="text-sm text-slate-600 mb-1">Customer:</p>
                    <p className="font-semibold text-slate-800">{evaluation?.customerName}</p>
                    {evaluation?.jobDescription && (
                        <p className="text-sm text-slate-500 mt-1">{evaluation.jobDescription}</p>
                    )}
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Reason for cancellation (optional)
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 resize-none text-sm"
                        placeholder="e.g., Customer unresponsive, Job no longer needed..."
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                        Keep Request
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <X className="w-4 h-4" />
                        )}
                        Cancel Evaluation
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EvaluationReview;
