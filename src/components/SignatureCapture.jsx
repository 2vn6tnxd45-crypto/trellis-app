// src/components/SignatureCapture.jsx
// ============================================
// DIGITAL SIGNATURE CAPTURE COMPONENT
// ============================================
// Reusable signature pad for job completion, contracts, etc.
// Captures signature as image with metadata (timestamp, GPS, device)

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    PenTool, RotateCcw, Check, X, Smartphone,
    MapPin, Clock, AlertCircle, Maximize2, Minimize2
} from 'lucide-react';

// ============================================
// SIGNATURE PAD CANVAS
// ============================================

const SignaturePad = ({
    onSignatureChange,
    width = 400,
    height = 200,
    lineColor = '#1e293b',
    lineWidth = 2,
    disabled = false
}) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const lastPoint = useRef(null);

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Set canvas size accounting for device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);

        // Reset stroke style after scaling
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, [width, height, lineColor, lineWidth]);

    // Get position from mouse or touch event
    const getPosition = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }, []);

    // Drawing handlers
    const startDrawing = useCallback((e) => {
        if (disabled) return;
        e.preventDefault();

        const pos = getPosition(e);
        if (!pos) return;

        setIsDrawing(true);
        lastPoint.current = pos;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }, [disabled, getPosition]);

    const draw = useCallback((e) => {
        if (!isDrawing || disabled) return;
        e.preventDefault();

        const pos = getPosition(e);
        if (!pos || !lastPoint.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Smooth line drawing using quadratic curves
        const midX = (lastPoint.current.x + pos.x) / 2;
        const midY = (lastPoint.current.y + pos.y) / 2;

        ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(midX, midY);

        lastPoint.current = pos;
        setHasSignature(true);
    }, [isDrawing, disabled, getPosition]);

    const stopDrawing = useCallback(() => {
        if (!isDrawing) return;

        setIsDrawing(false);
        lastPoint.current = null;

        // Notify parent of signature change
        if (hasSignature && onSignatureChange) {
            const canvas = canvasRef.current;
            const dataUrl = canvas.toDataURL('image/png');
            onSignatureChange(dataUrl);
        }
    }, [isDrawing, hasSignature, onSignatureChange]);

    // Clear signature
    const clear = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        setHasSignature(false);
        if (onSignatureChange) {
            onSignatureChange(null);
        }
    }, [onSignatureChange]);

    return (
        <div className="relative">
            <canvas
                ref={canvasRef}
                className={`border-2 border-dashed rounded-xl bg-white touch-none ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'
                } ${hasSignature ? 'border-emerald-300' : 'border-slate-300'}`}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
            />

            {/* Signature line hint */}
            {!hasSignature && (
                <div className="absolute bottom-8 left-8 right-8 border-b border-slate-300 pointer-events-none">
                    <span className="absolute -bottom-5 left-0 text-xs text-slate-400">
                        Sign here
                    </span>
                </div>
            )}

            {/* Clear button */}
            {hasSignature && !disabled && (
                <button
                    type="button"
                    onClick={clear}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-sm border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                    title="Clear signature"
                >
                    <RotateCcw size={16} />
                </button>
            )}
        </div>
    );
};

// ============================================
// MAIN SIGNATURE CAPTURE COMPONENT
// ============================================

export const SignatureCapture = ({
    onCapture,
    onCancel,
    title = "Customer Signature",
    description = "Please sign below to confirm",
    legalText = "By signing, I acknowledge that the work described has been completed to my satisfaction.",
    signerNameLabel = "Signer Name",
    signerName: initialSignerName = "",
    signerRelationship: initialRelationship = "homeowner",
    showRelationship = true,
    captureLocation = true,
    documents = [], // List of documents being signed
    disabled = false,
    fullscreen = false
}) => {
    const [signatureData, setSignatureData] = useState(null);
    const [signerName, setSignerName] = useState(initialSignerName);
    const [signerRelationship, setSignerRelationship] = useState(initialRelationship);
    const [location, setLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [isCapturingLocation, setIsCapturingLocation] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(fullscreen);
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    // Capture geolocation on mount
    useEffect(() => {
        if (!captureLocation) return;

        setIsCapturingLocation(true);

        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported');
            setIsCapturingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
                setIsCapturingLocation(false);
            },
            (error) => {
                console.warn('Geolocation error:', error);
                setLocationError('Location unavailable');
                setIsCapturingLocation(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }, [captureLocation]);

    // Get device info
    const getDeviceInfo = useCallback(() => {
        const ua = navigator.userAgent;
        let device = 'Unknown';
        let browser = 'Unknown';

        // Detect device
        if (/iPhone/.test(ua)) device = 'iPhone';
        else if (/iPad/.test(ua)) device = 'iPad';
        else if (/Android/.test(ua)) device = 'Android';
        else if (/Windows/.test(ua)) device = 'Windows';
        else if (/Mac/.test(ua)) device = 'Mac';

        // Detect browser
        if (/Chrome/.test(ua)) browser = 'Chrome';
        else if (/Safari/.test(ua)) browser = 'Safari';
        else if (/Firefox/.test(ua)) browser = 'Firefox';
        else if (/Edge/.test(ua)) browser = 'Edge';

        return `${device}, ${browser}`;
    }, []);

    // Handle signature submission
    const handleSubmit = useCallback(() => {
        if (!signatureData || !signerName.trim() || !agreedToTerms) return;

        const captureData = {
            signatureImage: signatureData,
            signerName: signerName.trim(),
            signerRelationship,
            signedAt: new Date().toISOString(),
            deviceInfo: getDeviceInfo(),
            gpsLocation: location,
            documentsSigned: documents,
            legalTextAgreed: legalText,
            captureMethod: 'digital_signature_pad'
        };

        onCapture(captureData);
    }, [signatureData, signerName, signerRelationship, agreedToTerms, location, documents, legalText, getDeviceInfo, onCapture]);

    const isValid = signatureData && signerName.trim() && agreedToTerms;

    const relationshipOptions = [
        { value: 'homeowner', label: 'Homeowner' },
        { value: 'tenant', label: 'Tenant' },
        { value: 'property_manager', label: 'Property Manager' },
        { value: 'authorized_agent', label: 'Authorized Agent' },
        { value: 'family_member', label: 'Family Member' },
        { value: 'other', label: 'Other' }
    ];

    const containerClass = isFullscreen
        ? 'fixed inset-0 z-50 bg-white overflow-auto'
        : 'bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden';

    return (
        <div className={containerClass}>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <PenTool className="text-emerald-600" size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{title}</h3>
                            <p className="text-sm text-slate-500">{description}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                        >
                            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className={`p-4 space-y-4 ${isFullscreen ? 'max-w-2xl mx-auto' : ''}`}>
                {/* Documents being signed */}
                {documents.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs font-medium text-slate-500 mb-2">Documents being signed:</p>
                        <ul className="space-y-1">
                            {documents.map((doc, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                                    <Check size={14} className="text-emerald-500" />
                                    {doc}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Signer Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            {signerNameLabel} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                            placeholder="Full name"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            disabled={disabled}
                        />
                    </div>

                    {showRelationship && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Relationship to Property
                            </label>
                            <select
                                value={signerRelationship}
                                onChange={(e) => setSignerRelationship(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                disabled={disabled}
                            >
                                {relationshipOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Signature Pad */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Signature <span className="text-red-500">*</span>
                    </label>
                    <SignaturePad
                        onSignatureChange={setSignatureData}
                        width={isFullscreen ? 500 : 380}
                        height={isFullscreen ? 250 : 180}
                        disabled={disabled}
                    />
                </div>

                {/* Legal Agreement */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="mt-1 w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                            disabled={disabled}
                        />
                        <span className="text-sm text-slate-700">
                            {legalText}
                        </span>
                    </label>
                </div>

                {/* Capture Metadata */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>{new Date().toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Smartphone size={12} />
                        <span>{getDeviceInfo()}</span>
                    </div>
                    {captureLocation && (
                        <div className="flex items-center gap-1">
                            <MapPin size={12} />
                            {isCapturingLocation ? (
                                <span className="text-slate-400">Getting location...</span>
                            ) : location ? (
                                <span className="text-emerald-600">Location captured</span>
                            ) : (
                                <span className="text-amber-600">{locationError || 'No location'}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Validation Message */}
                {!isValid && signatureData && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle size={16} />
                        {!signerName.trim() && "Please enter signer name"}
                        {signerName.trim() && !agreedToTerms && "Please agree to the terms"}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                        disabled={disabled}
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!isValid || disabled}
                    className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Check size={18} />
                    Confirm Signature
                </button>
            </div>
        </div>
    );
};

// ============================================
// INLINE SIGNATURE (Compact Version)
// ============================================

export const InlineSignature = ({
    value,
    onChange,
    signerName,
    onSignerNameChange,
    label = "Signature",
    required = false,
    disabled = false
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (value) {
        // Show captured signature
        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
                <div className="flex items-center gap-4">
                    <div className="border-2 border-emerald-300 rounded-lg p-2 bg-emerald-50">
                        <img
                            src={value}
                            alt="Signature"
                            className="h-16 max-w-[200px] object-contain"
                        />
                    </div>
                    <div className="text-sm text-slate-600">
                        <p className="font-medium">{signerName}</p>
                        <p className="text-slate-400">Signed</p>
                    </div>
                    {!disabled && (
                        <button
                            type="button"
                            onClick={() => {
                                onChange(null);
                                onSignerNameChange?.('');
                            }}
                            className="text-sm text-red-600 hover:text-red-700"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (isExpanded) {
        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
                <SignatureCapture
                    title="Capture Signature"
                    description="Sign to confirm"
                    signerName={signerName}
                    onCapture={(data) => {
                        onChange(data.signatureImage);
                        onSignerNameChange?.(data.signerName);
                        setIsExpanded(false);
                    }}
                    onCancel={() => setIsExpanded(false)}
                    showRelationship={false}
                    captureLocation={false}
                />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <button
                type="button"
                onClick={() => setIsExpanded(true)}
                disabled={disabled}
                className="w-full p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 text-slate-500 hover:text-emerald-600"
            >
                <PenTool size={20} />
                <span>Tap to sign</span>
            </button>
        </div>
    );
};

export default SignatureCapture;
