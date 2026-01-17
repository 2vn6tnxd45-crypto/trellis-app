// src/features/contractor-pro/components/ReviewSettings.jsx
// ============================================
// REVIEW SETTINGS PANEL
// ============================================
// Allows contractors to configure automated Google review requests
// after job completion is approved by the homeowner

import React, { useState, useEffect } from 'react';
import {
    Star,
    ExternalLink,
    Clock,
    Mail,
    Info,
    ChevronDown,
    ChevronUp,
    Check,
    AlertCircle,
    Link2,
    MessageSquare,
    Loader2
} from 'lucide-react';
import { updateReviewSettings } from '../lib/contractorService';
import toast from 'react-hot-toast';

// Google Business URL validation
const isValidGoogleUrl = (url) => {
    if (!url) return true; // Empty is valid (disabled)
    const patterns = [
        /^https:\/\/g\.page\/r\/[A-Za-z0-9_-]+\/review$/i,
        /^https:\/\/www\.google\.com\/maps\/place\/[^\/]+\/@[^\/]+\/[^\/]+/i,
        /^https:\/\/search\.google\.com\/local\/writereview\?placeid=/i
    ];
    return patterns.some(p => p.test(url));
};

// Yelp URL validation
const isValidYelpUrl = (url) => {
    if (!url) return true;
    return /^https:\/\/www\.yelp\.com\/biz\/[a-z0-9-]+$/i.test(url);
};

export const ReviewSettings = ({ contractorId, profile, onUpdate }) => {
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [settings, setSettings] = useState({
        googleBusinessUrl: '',
        yelpUrl: '',
        autoRequestReviews: true,
        delayHours: 24,
        customMessage: ''
    });

    // Load existing settings
    useEffect(() => {
        if (profile?.reviewSettings) {
            setSettings(prev => ({
                ...prev,
                ...profile.reviewSettings
            }));
        }
    }, [profile]);

    // Validation states
    const googleUrlValid = isValidGoogleUrl(settings.googleBusinessUrl);
    const yelpUrlValid = isValidYelpUrl(settings.yelpUrl);
    const canSave = googleUrlValid && yelpUrlValid;

    // Handle save
    const handleSave = async () => {
        if (!canSave) {
            toast.error('Please fix the invalid URLs before saving');
            return;
        }

        setSaving(true);
        try {
            await updateReviewSettings(contractorId, settings);
            toast.success('Review settings saved!');
            if (onUpdate) onUpdate(settings);
        } catch (error) {
            console.error('Error saving review settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    // Preview email content
    const previewMessage = settings.customMessage ||
        `Thank you for choosing us for your recent service! We hope you're satisfied with our work. If you have a moment, we'd really appreciate it if you could leave us a review on Google. Your feedback helps us improve and helps other homeowners find quality service.`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-amber-100 p-2.5 rounded-xl">
                    <Star className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Review Requests</h2>
                    <p className="text-sm text-slate-500">
                        Automatically request reviews after job completion
                    </p>
                </div>
            </div>

            {/* Enable Toggle */}
            <div className="bg-slate-50 rounded-xl p-4">
                <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-slate-400" />
                        <div>
                            <p className="font-medium text-slate-800">Auto-request reviews</p>
                            <p className="text-sm text-slate-500">
                                Send review request emails after job approval
                            </p>
                        </div>
                    </div>
                    <div className="relative">
                        <input
                            type="checkbox"
                            checked={settings.autoRequestReviews}
                            onChange={(e) => setSettings(prev => ({
                                ...prev,
                                autoRequestReviews: e.target.checked
                            }))}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                </label>
            </div>

            {/* Google Business URL */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Google Business Review Link
                    <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                    <input
                        type="url"
                        value={settings.googleBusinessUrl}
                        onChange={(e) => setSettings(prev => ({
                            ...prev,
                            googleBusinessUrl: e.target.value
                        }))}
                        placeholder="https://g.page/r/YOUR-ID/review"
                        className={`w-full px-4 py-3 pr-10 rounded-xl border ${
                            settings.googleBusinessUrl && !googleUrlValid
                                ? 'border-red-300 focus:ring-red-500'
                                : 'border-slate-200 focus:ring-emerald-500'
                        } focus:ring-2 focus:border-transparent outline-none transition-colors`}
                    />
                    {settings.googleBusinessUrl && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {googleUrlValid ? (
                                <Check className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <AlertCircle className="h-5 w-5 text-red-500" />
                            )}
                        </div>
                    )}
                </div>
                {settings.googleBusinessUrl && !googleUrlValid && (
                    <p className="text-red-500 text-sm mt-1">
                        Please enter a valid Google Business review URL
                    </p>
                )}

                {/* Helper tooltip */}
                <div className="mt-3 bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex gap-3">
                        <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-medium text-blue-800 mb-2">
                                How to find your Google review link:
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-blue-700">
                                <li>Go to <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Business Profile</a></li>
                                <li>Click "Get more reviews" or "Share review form"</li>
                                <li>Copy the short URL (starts with g.page/r/)</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>

            {/* Yelp URL (Optional) */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Yelp Business Page
                    <span className="text-slate-400 ml-1">(optional)</span>
                </label>
                <div className="relative">
                    <input
                        type="url"
                        value={settings.yelpUrl}
                        onChange={(e) => setSettings(prev => ({
                            ...prev,
                            yelpUrl: e.target.value
                        }))}
                        placeholder="https://www.yelp.com/biz/your-business-name"
                        className={`w-full px-4 py-3 pr-10 rounded-xl border ${
                            settings.yelpUrl && !yelpUrlValid
                                ? 'border-red-300 focus:ring-red-500'
                                : 'border-slate-200 focus:ring-emerald-500'
                        } focus:ring-2 focus:border-transparent outline-none transition-colors`}
                    />
                    {settings.yelpUrl && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {yelpUrlValid ? (
                                <Check className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <AlertCircle className="h-5 w-5 text-red-500" />
                            )}
                        </div>
                    )}
                </div>
                {settings.yelpUrl && !yelpUrlValid && (
                    <p className="text-red-500 text-sm mt-1">
                        Please enter a valid Yelp business URL
                    </p>
                )}
            </div>

            {/* Delay Setting */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Clock className="h-4 w-4 inline mr-1.5" />
                    Send review request after
                </label>
                <select
                    value={settings.delayHours}
                    onChange={(e) => setSettings(prev => ({
                        ...prev,
                        delayHours: parseInt(e.target.value)
                    }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                >
                    <option value={1}>1 hour</option>
                    <option value={6}>6 hours</option>
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours (recommended)</option>
                    <option value={48}>48 hours</option>
                    <option value={72}>3 days</option>
                </select>
                <p className="text-sm text-slate-500 mt-1">
                    After the homeowner approves the job completion
                </p>
            </div>

            {/* Custom Message */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                        <MessageSquare className="h-4 w-4 inline mr-1.5" />
                        Custom message
                        <span className="text-slate-400 ml-1">(optional)</span>
                    </label>
                    <button
                        type="button"
                        onClick={() => setShowPreview(!showPreview)}
                        className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                        {showPreview ? 'Hide' : 'Preview'}
                        {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
                <textarea
                    value={settings.customMessage}
                    onChange={(e) => setSettings(prev => ({
                        ...prev,
                        customMessage: e.target.value
                    }))}
                    placeholder="Leave blank to use the default message..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                />
                <p className="text-xs text-slate-400 text-right mt-1">
                    {settings.customMessage.length}/500
                </p>
            </div>

            {/* Email Preview */}
            {showPreview && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                        Email Preview
                    </p>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
                        <p className="font-medium text-slate-800 mb-2">
                            Hi [Customer Name],
                        </p>
                        <p className="text-slate-600 text-sm mb-4 whitespace-pre-wrap">
                            {previewMessage}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                                <Star size={14} />
                                Leave a Google Review
                            </span>
                            {settings.yelpUrl && (
                                <span className="inline-flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                                    Review on Yelp
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Stats (if available) */}
            {profile?.stats?.reviewRequestsSent > 0 && (
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-emerald-700 font-medium">
                                Review requests sent
                            </p>
                            <p className="text-2xl font-bold text-emerald-800">
                                {profile.stats.reviewRequestsSent}
                            </p>
                        </div>
                        <div className="bg-emerald-100 p-3 rounded-xl">
                            <Mail className="h-6 w-6 text-emerald-600" />
                        </div>
                    </div>
                </div>
            )}

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
                {saving ? (
                    <>
                        <Loader2 size={18} className="animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        <Check size={18} />
                        Save Review Settings
                    </>
                )}
            </button>

            {/* Link to test */}
            {settings.googleBusinessUrl && googleUrlValid && (
                <a
                    href={settings.googleBusinessUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                >
                    <Link2 size={14} />
                    Test your Google review link
                    <ExternalLink size={14} />
                </a>
            )}
        </div>
    );
};

export default ReviewSettings;
