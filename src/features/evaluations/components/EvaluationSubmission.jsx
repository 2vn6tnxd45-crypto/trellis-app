// src/features/evaluations/components/EvaluationSubmission.jsx
// ============================================
// EVALUATION SUBMISSION (HOMEOWNER VIEW)
// ============================================
// Public page where homeowners submit photos/info
// in response to a contractor's evaluation request.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    Camera, Video, FileText, Upload, X, Check, Clock, AlertCircle,
    ChevronRight, Loader2, CheckCircle, Home, User, Phone, Mail,
    MessageSquare, Send, Image, Play, Trash2, AlertTriangle
} from 'lucide-react';
import { useSingleEvaluation, useEvaluationCountdown } from '../hooks/useEvaluations';
import { PROMPT_TYPES } from '../lib/evaluationTemplates';
import { EVALUATION_STATUS } from '../lib/evaluationService';

// ============================================
// MAIN COMPONENT
// ============================================

export const EvaluationSubmission = ({ 
    contractorId, 
    evaluationId,
    contractor = null  // Contractor info for display
}) => {
    const {
        evaluation,
        loading,
        error,
        isExpired,
        canSubmit,
        hasSubmissions,
        submitMedia,
        markComplete
    } = useSingleEvaluation(contractorId, evaluationId);

    const [submissions, setSubmissions] = useState({
        photos: [],
        videos: [],
        answers: {}
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [submitted, setSubmitted] = useState(false);

    // Initialize from existing submissions
    useEffect(() => {
        if (evaluation?.submissions) {
            setSubmissions({
                photos: evaluation.submissions.photos || [],
                videos: evaluation.submissions.videos || [],
                answers: evaluation.submissions.answers || {}
            });
        }
    }, [evaluation]);

    // ----------------------------------------
    // Handlers
    // ----------------------------------------

    const handlePhotoAdd = useCallback((promptId, photoData) => {
        setSubmissions(prev => ({
            ...prev,
            photos: [...prev.photos, { promptId, ...photoData, addedAt: new Date().toISOString() }]
        }));
    }, []);

    const handlePhotoRemove = useCallback((index) => {
        setSubmissions(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    }, []);

    const handleVideoAdd = useCallback((promptId, videoData) => {
        setSubmissions(prev => ({
            ...prev,
            videos: [...prev.videos, { promptId, ...videoData, addedAt: new Date().toISOString() }]
        }));
    }, []);

    const handleVideoRemove = useCallback((index) => {
        setSubmissions(prev => ({
            ...prev,
            videos: prev.videos.filter((_, i) => i !== index)
        }));
    }, []);

    const handleAnswerChange = useCallback((promptId, value) => {
        setSubmissions(prev => ({
            ...prev,
            answers: { ...prev.answers, [promptId]: value }
        }));
    }, []);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            await submitMedia(submissions);
            await markComplete();
            setSubmitted(true);
        } catch (err) {
            console.error('Submission error:', err);
            setSubmitError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ----------------------------------------
    // Loading State
    // ----------------------------------------
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-slate-500">Loading evaluation request...</p>
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Not Found
    // ----------------------------------------
    if (!evaluation) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Request Not Found</h2>
                    <p className="text-slate-500">
                        This evaluation request doesn't exist or has been removed.
                    </p>
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Expired State
    // ----------------------------------------
    if (isExpired) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-8 h-8 text-amber-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Request Expired</h2>
                    <p className="text-slate-500 mb-6">
                        This evaluation request has expired. Please contact the contractor for a new request.
                    </p>
                    {contractor?.phone && (
                        <a
                            href={`tel:${contractor.phone}`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                        >
                            <Phone className="w-5 h-5" />
                            Call {contractor.companyName || 'Contractor'}
                        </a>
                    )}
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Already Submitted / Completed
    // ----------------------------------------
    if (submitted || evaluation.status === EVALUATION_STATUS.COMPLETED || evaluation.status === EVALUATION_STATUS.QUOTED) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Submission Received!</h2>
                    <p className="text-slate-500 mb-6">
                        {contractor?.companyName || 'The contractor'} will review your information and follow up with a quote.
                    </p>
                    <div className="p-4 bg-slate-50 rounded-xl text-left">
                        <p className="text-xs text-slate-500 uppercase font-semibold mb-2">What's Next</p>
                        <ul className="space-y-2 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                Contractor reviews your photos and info
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                You'll receive a detailed quote
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                Schedule work at your convenience
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Main Submission Form
    // ----------------------------------------
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="font-bold text-slate-800">
                                {contractor?.companyName || 'Contractor'} needs info
                            </h1>
                            <p className="text-sm text-slate-500">
                                {evaluation.jobCategory?.replace('_', ' ')} evaluation
                            </p>
                        </div>
                        <CountdownBadge expiresAt={evaluation.expiresAt} />
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
                {/* Job Description */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Home className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="font-medium text-slate-800">{evaluation.propertyAddress}</p>
                            <p className="text-sm text-slate-500 mt-1">{evaluation.jobDescription}</p>
                        </div>
                    </div>
                </div>

                {/* Messages from Contractor */}
                {evaluation.messages?.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Messages from Contractor
                        </h3>
                        <div className="space-y-3">
                            {evaluation.messages.map((msg) => (
                                <div key={msg.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <p className="text-sm text-amber-800">{msg.message}</p>
                                    <p className="text-xs text-amber-600 mt-2">
                                        {new Date(msg.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Prompts */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                        Please Provide
                    </h3>
                    
                    {evaluation.prompts?.map((prompt, index) => (
                        <PromptInput
                            key={prompt.id}
                            prompt={prompt}
                            index={index}
                            submissions={submissions}
                            onPhotoAdd={handlePhotoAdd}
                            onPhotoRemove={handlePhotoRemove}
                            onVideoAdd={handleVideoAdd}
                            onVideoRemove={handleVideoRemove}
                            onAnswerChange={handleAnswerChange}
                        />
                    ))}
                </div>

                {/* Error */}
                {submitError && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{submitError}</p>
                    </div>
                )}
            </main>

            {/* Fixed Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
                <div className="max-w-2xl mx-auto">
                    <SubmissionProgress 
                        prompts={evaluation.prompts || []}
                        submissions={submissions}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full mt-3 flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Send className="w-5 h-5" />
                                Submit to Contractor
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// COUNTDOWN BADGE
// ============================================

const CountdownBadge = ({ expiresAt }) => {
    const timeRemaining = useEvaluationCountdown(expiresAt);

    if (!timeRemaining) return null;

    return (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            timeRemaining.urgent 
                ? 'bg-red-100 text-red-700' 
                : 'bg-slate-100 text-slate-600'
        }`}>
            <Clock className="w-4 h-4" />
            {timeRemaining.display}
        </div>
    );
};

// ============================================
// SUBMISSION PROGRESS
// ============================================

const SubmissionProgress = ({ prompts, submissions }) => {
    const requiredPrompts = prompts.filter(p => p.required);
    const completedRequired = requiredPrompts.filter(p => {
        if (p.type === PROMPT_TYPES.PHOTO) {
            return submissions.photos.some(photo => photo.promptId === p.id);
        }
        if (p.type === PROMPT_TYPES.VIDEO) {
            return submissions.videos.some(video => video.promptId === p.id);
        }
        return submissions.answers[p.id] !== undefined && submissions.answers[p.id] !== '';
    });

    const progress = requiredPrompts.length > 0 
        ? Math.round((completedRequired.length / requiredPrompts.length) * 100)
        : 100;

    return (
        <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-slate-600">
                    {completedRequired.length} of {requiredPrompts.length} required items
                </span>
                <span className={`font-medium ${progress === 100 ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {progress}%
                </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-300 ${
                        progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

// ============================================
// PROMPT INPUT COMPONENT
// ============================================

const PromptInput = ({ 
    prompt, 
    index,
    submissions, 
    onPhotoAdd, 
    onPhotoRemove,
    onVideoAdd,
    onVideoRemove,
    onAnswerChange 
}) => {
    switch (prompt.type) {
        case PROMPT_TYPES.PHOTO:
            return (
                <PhotoPrompt
                    prompt={prompt}
                    index={index}
                    photos={submissions.photos.filter(p => p.promptId === prompt.id)}
                    onAdd={(data) => onPhotoAdd(prompt.id, data)}
                    onRemove={onPhotoRemove}
                    allPhotos={submissions.photos}
                />
            );
        case PROMPT_TYPES.VIDEO:
            return (
                <VideoPrompt
                    prompt={prompt}
                    index={index}
                    videos={submissions.videos.filter(v => v.promptId === prompt.id)}
                    onAdd={(data) => onVideoAdd(prompt.id, data)}
                    onRemove={onVideoRemove}
                    allVideos={submissions.videos}
                />
            );
        case PROMPT_TYPES.SELECT:
            return (
                <SelectPrompt
                    prompt={prompt}
                    index={index}
                    value={submissions.answers[prompt.id] || ''}
                    onChange={(value) => onAnswerChange(prompt.id, value)}
                />
            );
        case PROMPT_TYPES.YES_NO:
            return (
                <YesNoPrompt
                    prompt={prompt}
                    index={index}
                    value={submissions.answers[prompt.id]}
                    onChange={(value) => onAnswerChange(prompt.id, value)}
                />
            );
        case PROMPT_TYPES.NUMBER:
            return (
                <NumberPrompt
                    prompt={prompt}
                    index={index}
                    value={submissions.answers[prompt.id] || ''}
                    onChange={(value) => onAnswerChange(prompt.id, value)}
                />
            );
        default:
            return (
                <TextPrompt
                    prompt={prompt}
                    index={index}
                    value={submissions.answers[prompt.id] || ''}
                    onChange={(value) => onAnswerChange(prompt.id, value)}
                />
            );
    }
};

// ============================================
// PHOTO PROMPT
// ============================================

const PhotoPrompt = ({ prompt, index, photos, onAdd, onRemove, allPhotos }) => {
    const inputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsUploading(true);
        
        for (const file of files) {
            // In production, upload to storage and get URL
            // For now, create local preview
            const reader = new FileReader();
            reader.onload = () => {
                onAdd({
                    url: reader.result,
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
            };
            reader.readAsDataURL(file);
        }
        
        setIsUploading(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    const photoIndices = photos.map(p => allPhotos.indexOf(p));

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Camera className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1">
                    <p className="font-medium text-slate-800">
                        {prompt.label}
                        {prompt.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {prompt.hint && (
                        <p className="text-sm text-slate-500 mt-0.5">{prompt.hint}</p>
                    )}
                </div>
            </div>

            {/* Uploaded Photos */}
            {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {photos.map((photo, i) => (
                        <div key={i} className="relative group">
                            <img
                                src={photo.url}
                                alt={photo.name}
                                className="w-20 h-20 object-cover rounded-lg"
                            />
                            <button
                                onClick={() => onRemove(photoIndices[i])}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Button */}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
            />
            <button
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
            >
                {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        <Upload className="w-5 h-5" />
                        {photos.length > 0 ? 'Add More Photos' : 'Upload Photo'}
                    </>
                )}
            </button>
        </div>
    );
};

// ============================================
// VIDEO PROMPT
// ============================================

const VideoPrompt = ({ prompt, index, videos, onAdd, onRemove, allVideos }) => {
    const inputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        
        // In production, upload to storage
        const reader = new FileReader();
        reader.onload = () => {
            onAdd({
                url: reader.result,
                name: file.name,
                size: file.size,
                type: file.type,
                duration: null // Would get from video metadata
            });
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
        
        if (inputRef.current) inputRef.current.value = '';
    };

    const videoIndices = videos.map(v => allVideos.indexOf(v));

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Video className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1">
                    <p className="font-medium text-slate-800">
                        {prompt.label}
                        {prompt.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {prompt.hint && (
                        <p className="text-sm text-slate-500 mt-0.5">{prompt.hint}</p>
                    )}
                </div>
            </div>

            {/* Uploaded Videos */}
            {videos.length > 0 && (
                <div className="space-y-2 mb-3">
                    {videos.map((video, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Play className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">{video.name}</p>
                                <p className="text-xs text-slate-500">
                                    {(video.size / (1024 * 1024)).toFixed(1)} MB
                                </p>
                            </div>
                            <button
                                onClick={() => onRemove(videoIndices[i])}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Button */}
            <input
                ref={inputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
            />
            <button
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
            >
                {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        <Video className="w-5 h-5" />
                        {videos.length > 0 ? 'Replace Video' : 'Upload Video'}
                    </>
                )}
            </button>
        </div>
    );
};

// ============================================
// TEXT PROMPT
// ============================================

const TextPrompt = ({ prompt, index, value, onChange }) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                    <p className="font-medium text-slate-800">
                        {prompt.label}
                        {prompt.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {prompt.hint && (
                        <p className="text-sm text-slate-500 mt-0.5">{prompt.hint}</p>
                    )}
                </div>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                placeholder="Type your answer..."
            />
        </div>
    );
};

// ============================================
// SELECT PROMPT
// ============================================

const SelectPrompt = ({ prompt, index, value, onChange }) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ChevronRight className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1">
                    <p className="font-medium text-slate-800">
                        {prompt.label}
                        {prompt.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {prompt.hint && (
                        <p className="text-sm text-slate-500 mt-0.5">{prompt.hint}</p>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {prompt.options?.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                            value === option.value
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                    >
                        <span className="text-sm font-medium">{option.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

// ============================================
// YES/NO PROMPT
// ============================================

const YesNoPrompt = ({ prompt, index, value, onChange }) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                    <p className="font-medium text-slate-800">
                        {prompt.label}
                        {prompt.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                </div>
            </div>
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={() => onChange(true)}
                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                        value === true
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                >
                    Yes
                </button>
                <button
                    type="button"
                    onClick={() => onChange(false)}
                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                        value === false
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                >
                    No
                </button>
            </div>
        </div>
    );
};

// ============================================
// NUMBER PROMPT
// ============================================

const NumberPrompt = ({ prompt, index, value, onChange }) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-600 font-bold text-sm">#</span>
                </div>
                <div className="flex-1">
                    <p className="font-medium text-slate-800">
                        {prompt.label}
                        {prompt.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {prompt.hint && (
                        <p className="text-sm text-slate-500 mt-0.5">{prompt.hint}</p>
                    )}
                </div>
            </div>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter a number"
            />
        </div>
    );
};

export default EvaluationSubmission;
