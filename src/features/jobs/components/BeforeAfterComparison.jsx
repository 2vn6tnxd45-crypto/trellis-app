// src/features/jobs/components/BeforeAfterComparison.jsx
// ============================================
// BEFORE/AFTER PHOTO COMPARISON COMPONENT
// ============================================
// Interactive side-by-side and slider comparison views
// for job documentation photos

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Columns,
    SplitSquareHorizontal,
    Layers,
    X,
    Download,
    Share2,
    ZoomIn,
    Camera
} from 'lucide-react';
import { PHOTO_TYPES } from '../lib/jobPhotoService';

// ============================================
// COMPARISON MODES
// ============================================

const COMPARISON_MODES = {
    SIDE_BY_SIDE: 'side_by_side',
    SLIDER: 'slider',
    TOGGLE: 'toggle'
};

// ============================================
// MAIN COMPONENT
// ============================================

export const BeforeAfterComparison = ({
    beforePhotos = [],
    afterPhotos = [],
    jobTitle,
    completedDate,
    onClose,
    allowDownload = true,
    allowShare = true
}) => {
    const [mode, setMode] = useState(COMPARISON_MODES.SIDE_BY_SIDE);
    const [beforeIndex, setBeforeIndex] = useState(0);
    const [afterIndex, setAfterIndex] = useState(0);
    const [sliderPosition, setSliderPosition] = useState(50);
    const [showToggleBefore, setShowToggleBefore] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const currentBefore = beforePhotos[beforeIndex] || null;
    const currentAfter = afterPhotos[afterIndex] || null;

    const hasMultipleBefore = beforePhotos.length > 1;
    const hasMultipleAfter = afterPhotos.length > 1;

    // Handle share
    const handleShare = async () => {
        if (!navigator.share) {
            // Fallback: copy to clipboard
            const text = `Before/After: ${jobTitle || 'Job Completion'}`;
            await navigator.clipboard.writeText(text);
            return;
        }

        try {
            await navigator.share({
                title: `Before/After: ${jobTitle || 'Job'}`,
                text: `Check out this completed work${completedDate ? ` on ${completedDate}` : ''}`,
                url: window.location.href
            });
        } catch (err) {
            // User cancelled or error
            console.log('Share cancelled');
        }
    };

    // Handle download
    const handleDownload = (url, type) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}-photo-${Date.now()}.jpg`;
        link.click();
    };

    // No photos state
    if (beforePhotos.length === 0 && afterPhotos.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    No Photos Available
                </h3>
                <p className="text-gray-500">
                    Before and after photos will appear here once uploaded.
                </p>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-2xl shadow-lg overflow-hidden ${
            isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
        }`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white">
                            Before & After
                        </h3>
                        {jobTitle && (
                            <p className="text-slate-300 text-sm mt-0.5">
                                {jobTitle}
                                {completedDate && ` • ${completedDate}`}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {allowShare && navigator.share && (
                            <button
                                onClick={handleShare}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                title="Share"
                            >
                                <Share2 className="w-5 h-5 text-white" />
                            </button>
                        )}
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Fullscreen"
                        >
                            <ZoomIn className="w-5 h-5 text-white" />
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Mode Selector */}
            <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-center gap-2">
                <button
                    onClick={() => setMode(COMPARISON_MODES.SIDE_BY_SIDE)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        mode === COMPARISON_MODES.SIDE_BY_SIDE
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Columns className="w-4 h-4" />
                    Side by Side
                </button>
                <button
                    onClick={() => setMode(COMPARISON_MODES.SLIDER)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        mode === COMPARISON_MODES.SLIDER
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <SplitSquareHorizontal className="w-4 h-4" />
                    Slider
                </button>
                <button
                    onClick={() => setMode(COMPARISON_MODES.TOGGLE)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        mode === COMPARISON_MODES.TOGGLE
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    Toggle
                </button>
            </div>

            {/* Comparison View */}
            <div className={`relative ${isFullscreen ? 'h-[calc(100vh-180px)]' : 'aspect-video'}`}>
                {mode === COMPARISON_MODES.SIDE_BY_SIDE && (
                    <SideBySideView
                        before={currentBefore}
                        after={currentAfter}
                        onDownload={allowDownload ? handleDownload : null}
                    />
                )}

                {mode === COMPARISON_MODES.SLIDER && (
                    <SliderView
                        before={currentBefore}
                        after={currentAfter}
                        sliderPosition={sliderPosition}
                        onSliderChange={setSliderPosition}
                    />
                )}

                {mode === COMPARISON_MODES.TOGGLE && (
                    <ToggleView
                        before={currentBefore}
                        after={currentAfter}
                        showBefore={showToggleBefore}
                        onToggle={() => setShowToggleBefore(!showToggleBefore)}
                    />
                )}
            </div>

            {/* Photo Navigation */}
            {(hasMultipleBefore || hasMultipleAfter) && (
                <div className="px-5 py-4 border-t bg-gray-50">
                    <div className="flex items-center justify-between">
                        {/* Before Photos Navigation */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-orange-600">Before:</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setBeforeIndex(Math.max(0, beforeIndex - 1))}
                                    disabled={beforeIndex === 0}
                                    className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm text-gray-600 min-w-[3rem] text-center">
                                    {beforeIndex + 1} / {beforePhotos.length}
                                </span>
                                <button
                                    onClick={() => setBeforeIndex(Math.min(beforePhotos.length - 1, beforeIndex + 1))}
                                    disabled={beforeIndex === beforePhotos.length - 1}
                                    className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* After Photos Navigation */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-emerald-600">After:</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setAfterIndex(Math.max(0, afterIndex - 1))}
                                    disabled={afterIndex === 0}
                                    className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm text-gray-600 min-w-[3rem] text-center">
                                    {afterIndex + 1} / {afterPhotos.length}
                                </span>
                                <button
                                    onClick={() => setAfterIndex(Math.min(afterPhotos.length - 1, afterIndex + 1))}
                                    disabled={afterIndex === afterPhotos.length - 1}
                                    className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Thumbnail Strip */}
                    <div className="flex gap-4 mt-4">
                        {/* Before Thumbnails */}
                        <div className="flex-1">
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {beforePhotos.map((photo, idx) => (
                                    <button
                                        key={photo.id || idx}
                                        onClick={() => setBeforeIndex(idx)}
                                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                                            idx === beforeIndex
                                                ? 'border-orange-500 ring-2 ring-orange-200'
                                                : 'border-transparent hover:border-gray-300'
                                        }`}
                                    >
                                        <img
                                            src={photo.url}
                                            alt={`Before ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* After Thumbnails */}
                        <div className="flex-1">
                            <div className="flex gap-2 overflow-x-auto pb-2 justify-end">
                                {afterPhotos.map((photo, idx) => (
                                    <button
                                        key={photo.id || idx}
                                        onClick={() => setAfterIndex(idx)}
                                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                                            idx === afterIndex
                                                ? 'border-emerald-500 ring-2 ring-emerald-200'
                                                : 'border-transparent hover:border-gray-300'
                                        }`}
                                    >
                                        <img
                                            src={photo.url}
                                            alt={`After ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// SIDE BY SIDE VIEW
// ============================================

const SideBySideView = ({ before, after, onDownload }) => {
    return (
        <div className="flex h-full">
            {/* Before */}
            <div className="flex-1 relative border-r border-gray-200">
                {before ? (
                    <>
                        <img
                            src={before.url}
                            alt="Before"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                            Before
                        </div>
                        {onDownload && (
                            <button
                                onClick={() => onDownload(before.url, 'before')}
                                className="absolute bottom-3 left-3 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white transition-colors"
                            >
                                <Download className="w-4 h-4 text-gray-700" />
                            </button>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <div className="text-center">
                            <Camera className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">No before photo</p>
                        </div>
                    </div>
                )}
            </div>

            {/* After */}
            <div className="flex-1 relative">
                {after ? (
                    <>
                        <img
                            src={after.url}
                            alt="After"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 right-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                            After
                        </div>
                        {onDownload && (
                            <button
                                onClick={() => onDownload(after.url, 'after')}
                                className="absolute bottom-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white transition-colors"
                            >
                                <Download className="w-4 h-4 text-gray-700" />
                            </button>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <div className="text-center">
                            <Camera className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">No after photo</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================
// SLIDER VIEW
// ============================================

const SliderView = ({ before, after, sliderPosition, onSliderChange }) => {
    const containerRef = useRef(null);
    const isDragging = useRef(false);

    const handleMouseDown = () => {
        isDragging.current = true;
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleMouseMove = useCallback((e) => {
        if (!isDragging.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        onSliderChange(percentage);
    }, [onSliderChange]);

    const handleTouchMove = useCallback((e) => {
        if (!containerRef.current) return;

        const touch = e.touches[0];
        const rect = containerRef.current.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        onSliderChange(percentage);
    }, [onSliderChange]);

    useEffect(() => {
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousemove', handleMouseMove);

        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, [handleMouseMove]);

    if (!before && !after) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <p className="text-gray-400">No photos to compare</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden cursor-ew-resize select-none"
            onTouchMove={handleTouchMove}
        >
            {/* After Image (Full) */}
            {after && (
                <img
                    src={after.url}
                    alt="After"
                    className="absolute inset-0 w-full h-full object-cover"
                />
            )}

            {/* Before Image (Clipped) */}
            {before && (
                <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${sliderPosition}%` }}
                >
                    <img
                        src={before.url}
                        alt="Before"
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{
                            width: containerRef.current
                                ? `${containerRef.current.offsetWidth}px`
                                : '100vw',
                            maxWidth: 'none'
                        }}
                    />
                </div>
            )}

            {/* Slider Handle */}
            <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
                style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
            >
                {/* Handle Circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                    <div className="flex items-center gap-0.5">
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    </div>
                </div>
            </div>

            {/* Labels */}
            <div className="absolute top-3 left-3 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                Before
            </div>
            <div className="absolute top-3 right-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                After
            </div>
        </div>
    );
};

// ============================================
// TOGGLE VIEW
// ============================================

const ToggleView = ({ before, after, showBefore, onToggle }) => {
    const photo = showBefore ? before : after;
    const label = showBefore ? 'Before' : 'After';
    const bgColor = showBefore ? 'bg-orange-500' : 'bg-emerald-500';

    return (
        <div className="relative w-full h-full">
            {photo ? (
                <img
                    src={photo.url}
                    alt={label}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                        <Camera className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">No {label.toLowerCase()} photo</p>
                    </div>
                </div>
            )}

            {/* Label */}
            <div className={`absolute top-3 left-3 ${bgColor} text-white px-3 py-1 rounded-full text-sm font-bold`}>
                {label}
            </div>

            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg flex items-center gap-3 hover:bg-white transition-colors"
            >
                <span className={`w-3 h-3 rounded-full ${showBefore ? 'bg-orange-500' : 'bg-gray-300'}`} />
                <span className="font-medium text-gray-700">Tap to Toggle</span>
                <span className={`w-3 h-3 rounded-full ${!showBefore ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            </button>
        </div>
    );
};

// ============================================
// COMPACT COMPARISON (For cards/lists)
// ============================================

export const CompactBeforeAfter = ({ before, after, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex gap-1 w-full rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
        >
            {/* Before Thumbnail */}
            <div className="flex-1 relative aspect-square">
                {before ? (
                    <img
                        src={before.url}
                        alt="Before"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <Camera className="w-6 h-6 text-gray-400" />
                    </div>
                )}
                <span className="absolute bottom-1 left-1 text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-bold">
                    Before
                </span>
            </div>

            {/* After Thumbnail */}
            <div className="flex-1 relative aspect-square">
                {after ? (
                    <img
                        src={after.url}
                        alt="After"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <Camera className="w-6 h-6 text-gray-400" />
                    </div>
                )}
                <span className="absolute bottom-1 right-1 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">
                    After
                </span>
            </div>
        </button>
    );
};

export default BeforeAfterComparison;
