// src/components/common/LoadingStates.test.jsx
// ============================================
// VISUAL DEMO PAGE - FOR DEVELOPMENT TESTING ONLY
// ============================================
// This file is for visually testing the loading components.
// It can be safely deleted once the components are verified.
//
// To use: Import this component and render it in your app temporarily
// Example: import LoadingStatesDemo from './components/common/LoadingStates.test';

import React, { useState } from 'react';
import {
    FullPageLoader,
    SectionLoader,
    ButtonLoader,
    SkeletonCard,
    SkeletonText,
    SkeletonList,
    InlineLoader
} from './LoadingStates';

const DemoSection = ({ title, children, className = "" }) => (
    <div className={`mb-8 ${className}`}>
        <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">
            {title}
        </h2>
        {children}
    </div>
);

const LoadingStatesDemo = () => {
    const [showFullPage, setShowFullPage] = useState(false);
    const [buttonLoading, setButtonLoading] = useState(false);

    const handleButtonClick = () => {
        setButtonLoading(true);
        setTimeout(() => setButtonLoading(false), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        Loading Components Demo
                    </h1>
                    <p className="text-slate-600">
                        Visual test page for shared loading components. Delete this file after verification.
                    </p>
                </div>

                {/* FullPageLoader */}
                <DemoSection title="1. FullPageLoader">
                    <p className="text-sm text-slate-500 mb-4">
                        Full-screen overlay for initial app load. Click button to preview (click anywhere to dismiss).
                    </p>
                    <button
                        onClick={() => setShowFullPage(true)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                        Show FullPageLoader
                    </button>
                    {showFullPage && (
                        <div onClick={() => setShowFullPage(false)} className="cursor-pointer">
                            <FullPageLoader message="Loading your dashboard..." />
                        </div>
                    )}
                </DemoSection>

                {/* SectionLoader - All Sizes */}
                <DemoSection title="2. SectionLoader (3 sizes)">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200">
                            <p className="text-xs font-medium text-slate-500 p-2 border-b">size="sm"</p>
                            <SectionLoader size="sm" message="Loading..." />
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200">
                            <p className="text-xs font-medium text-slate-500 p-2 border-b">size="md" (default)</p>
                            <SectionLoader size="md" message="Loading data..." />
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200">
                            <p className="text-xs font-medium text-slate-500 p-2 border-b">size="lg"</p>
                            <SectionLoader size="lg" message="Please wait..." />
                        </div>
                    </div>
                </DemoSection>

                {/* ButtonLoader */}
                <DemoSection title="3. ButtonLoader">
                    <p className="text-sm text-slate-500 mb-4">
                        Inline spinner for buttons. Click to see loading state (2 second demo).
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={handleButtonClick}
                            disabled={buttonLoading}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-70 flex items-center gap-2"
                        >
                            {buttonLoading ? (
                                <>
                                    <ButtonLoader size={18} />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                        <button
                            disabled
                            className="px-6 py-3 bg-slate-800 text-white rounded-xl font-medium flex items-center gap-2"
                        >
                            <ButtonLoader size={18} />
                            Processing...
                        </button>
                        <button
                            disabled
                            className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium flex items-center gap-2"
                        >
                            <ButtonLoader size={16} />
                            Deleting...
                        </button>
                    </div>
                </DemoSection>

                {/* SkeletonCard */}
                <DemoSection title="4. SkeletonCard">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">Default (3 lines, no image)</p>
                            <SkeletonCard />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">With image placeholder</p>
                            <SkeletonCard showImage={true} />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">2 lines</p>
                            <SkeletonCard lines={2} />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">5 lines with image</p>
                            <SkeletonCard lines={5} showImage={true} />
                        </div>
                    </div>
                </DemoSection>

                {/* SkeletonText */}
                <DemoSection title="5. SkeletonText">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Default (w-full, h-4)</p>
                            <SkeletonText />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">width="w-3/4"</p>
                            <SkeletonText width="w-3/4" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">width="w-1/2", height="h-6"</p>
                            <SkeletonText width="w-1/2" height="h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">width="w-1/4", height="h-3"</p>
                            <SkeletonText width="w-1/4" height="h-3" />
                        </div>
                    </div>
                </DemoSection>

                {/* SkeletonList */}
                <DemoSection title="6. SkeletonList">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <p className="text-xs font-medium text-slate-500 mb-3">Default (3 items, no avatar)</p>
                            <SkeletonList />
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <p className="text-xs font-medium text-slate-500 mb-3">With avatars (5 items)</p>
                            <SkeletonList count={5} showAvatar={true} />
                        </div>
                    </div>
                </DemoSection>

                {/* InlineLoader */}
                <DemoSection title="7. InlineLoader">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">Default (no message)</p>
                            <InlineLoader />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">With message</p>
                            <InlineLoader message="Fetching results..." />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">In a paragraph context</p>
                            <p className="text-slate-700">
                                Your data is being processed. <InlineLoader message="Please wait" size={12} />
                            </p>
                        </div>
                    </div>
                </DemoSection>

                {/* Usage Examples */}
                <DemoSection title="Usage Examples" className="bg-slate-100 rounded-xl p-6">
                    <pre className="text-sm text-slate-700 overflow-x-auto">
{`// Import from the barrel export
import {
    FullPageLoader,
    SectionLoader,
    ButtonLoader,
    SkeletonCard,
    SkeletonText
} from '@/components/common';

// Or import directly
import { SectionLoader } from '@/components/common/LoadingStates';

// Full page loading
if (isLoading) return <FullPageLoader message="Loading..." />;

// Section loading
<div className="card">
    {loading ? <SectionLoader size="sm" /> : <Content />}
</div>

// Button loading
<button disabled={saving}>
    {saving ? <><ButtonLoader /> Saving...</> : 'Save'}
</button>

// Skeleton placeholders
{loading ? (
    <SkeletonCard lines={3} showImage />
) : (
    <ActualCard data={data} />
)}`}
                    </pre>
                </DemoSection>
            </div>
        </div>
    );
};

export default LoadingStatesDemo;
