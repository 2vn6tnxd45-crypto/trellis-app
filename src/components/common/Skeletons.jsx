// src/components/common/Skeletons.jsx
import React from 'react';

const Shimmer = ({ className }) => (
    <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`}></div>
);

export const RecordCardSkeleton = () => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
        <Shimmer className="h-12 w-12 shrink-0" />
        <div className="flex-grow space-y-2">
            <Shimmer className="h-5 w-3/4" />
            <Shimmer className="h-3 w-1/2" />
        </div>
        <div className="flex flex-col gap-2 items-end">
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 w-10" />
        </div>
    </div>
);

export const DashboardSkeleton = () => (
    <div className="space-y-6">
        <div className="flex gap-4 overflow-hidden">
            <Shimmer className="h-32 w-full rounded-[2rem]" />
            <Shimmer className="h-32 w-full rounded-[2rem]" />
        </div>
        <div className="space-y-4">
            <Shimmer className="h-20 w-full" />
            <Shimmer className="h-20 w-full" />
            <Shimmer className="h-20 w-full" />
        </div>
    </div>
);

export const AppShellSkeleton = () => (
    <div className="min-h-screen bg-emerald-50 pb-20">
        <div className="bg-white h-20 border-b border-slate-100 mb-8 sticky top-0 z-40"></div>
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex gap-4 mb-8">
                <Shimmer className="h-14 flex-grow" />
                <Shimmer className="h-14 w-32" />
            </div>
            <RecordCardSkeleton />
            <RecordCardSkeleton />
            <RecordCardSkeleton />
        </div>
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md h-20 bg-white rounded-full shadow-xl"></div>
    </div>
);

// Quote/Job card skeleton
export const QuoteCardSkeleton = () => (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
            <Shimmer className="h-5 w-2/3" />
            <Shimmer className="h-6 w-16 rounded-full" />
        </div>
        <Shimmer className="h-4 w-1/2" />
        <div className="flex justify-between items-center pt-2">
            <Shimmer className="h-6 w-24" />
            <Shimmer className="h-8 w-20 rounded-lg" />
        </div>
    </div>
);

// List item skeleton (generic)
export const ListItemSkeleton = () => (
    <div className="flex items-center gap-3 p-3">
        <Shimmer className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-3 w-1/2" />
        </div>
    </div>
);

// Form skeleton
export const FormSkeleton = () => (
    <div className="space-y-4">
        <div>
            <Shimmer className="h-4 w-24 mb-2" />
            <Shimmer className="h-12 w-full" />
        </div>
        <div>
            <Shimmer className="h-4 w-32 mb-2" />
            <Shimmer className="h-12 w-full" />
        </div>
        <div>
            <Shimmer className="h-4 w-20 mb-2" />
            <Shimmer className="h-24 w-full" />
        </div>
        <Shimmer className="h-12 w-full mt-6" />
    </div>
);

// Table skeleton
export const TableSkeleton = ({ rows = 5 }) => (
    <div className="space-y-2">
        {/* Header */}
        <div className="flex gap-4 p-3 border-b border-slate-200">
            <Shimmer className="h-4 w-1/4" />
            <Shimmer className="h-4 w-1/4" />
            <Shimmer className="h-4 w-1/4" />
            <Shimmer className="h-4 w-1/4" />
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 p-3">
                <Shimmer className="h-4 w-1/4" />
                <Shimmer className="h-4 w-1/4" />
                <Shimmer className="h-4 w-1/4" />
                <Shimmer className="h-4 w-1/4" />
            </div>
        ))}
    </div>
);

// Export the Shimmer component for custom skeletons
export { Shimmer };
