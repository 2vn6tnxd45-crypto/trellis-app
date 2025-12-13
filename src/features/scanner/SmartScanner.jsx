// src/features/scanner/SmartScanner.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
    Camera, X, Loader2, Sparkles, Check, Upload,
    RotateCcw, Zap, FileText, Tag, Paintbrush, Home,
    Package, AlertCircle, Image as ImageIcon
} from 'lucide-react';

// Content Types
const DETECTED_TYPES = {
    receipt: { icon: FileText, label: 'Receipt', color: 'emerald', description: 'Purchase details detected' },
    appliance_label: { icon: Tag, label: 'Appliance Label', color: 'blue', description: 'Model & serial number detected' },
    paint_can: { icon: Paintbrush, label: 'Paint', color: 'purple', description: 'Color information detected' },
    room_photo: { icon: Home, label: 'Room Photo', color: 'amber', description: 'Room documentation' },
    product: { icon: Package, label: 'Product', color: 'slate', description: 'Product information detected' }
};

// Overlay Component
const ScanningOverlay = ({ stage }) => {
    const stages = [
        { key: 'analyzing', label: 'Analyzing image...', icon: Zap },
        { key: 'detecting', label: 'Detecting content type...', icon: Sparkles },
        { key: 'extracting', label: 'Extracting information...', icon: FileText },
    ];
    const currentIndex = stages.findIndex(s => s.key === stage);
    
    return (
        <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center z-20 p-8">
            <div className="relative mb-8">
                <div className="w-24 h-24 border-4 border-emerald-500/30 rounded-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 to-transparent animate-scan" />
                </div>
                <div className="absolute -inset-2 border-2 border-emerald-500 rounded-3xl animate-pulse" />
            </div>
            <div className="space-y-3 w-full max-w-xs">
                {stages.map((s, i) => {
                    const isActive = i === currentIndex;
                    const isComplete = i < currentIndex;
                    const Icon = s.icon;
                    return (
                        <div key={s.key} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isActive ? 'bg-emerald-500/20 text-emerald-400' : isComplete ? 'bg-slate-800 text-emerald-500' : 'bg-slate-800/50 text-slate-500'}`}>
                            <div className={`p-2 rounded-lg ${isActive ? 'bg-emerald-500/30' : isComplete ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
                                {isComplete ? <Check className="h-4 w-4" /> : isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                            </div>
                            <span className={`text-sm font-medium ${isActive ? 'text-white' : ''}`}>{s.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Detection Result Component
const DetectionResult = ({ type, confidence, onConfirm, onRetry, onChangeType }) => {
    const typeInfo = DETECTED_TYPES[type] || DETECTED_TYPES.product;
    const Icon = typeInfo.icon;
    const colorClasses = {
        emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
        purple: 'bg-purple-50 border-purple-200 text-purple-700',
        amber: 'bg-amber-50 border-amber-200 text-amber-700',
        slate: 'bg-slate-50 border-slate-200 text-slate-700',
    };
    
    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6 z-20 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
                <div className={`flex items-center gap-3 px-4 py-2 rounded-full border ${colorClasses[typeInfo.color]}`}>
                    <Icon className="h-5 w-5" />
                    <span className="font-bold">{typeInfo.label}</span>
                    {confidence > 0.8 && <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">{Math.round(confidence * 100)}% match</span>}
                </div>
                <button onClick={onChangeType} className="text-sm text-slate-500 hover:text-slate-700 font-medium">Change type</button>
            </div>
            <p className="text-slate-600 mb-6">{typeInfo.description}</p>
            <div className="flex gap-3">
                <button onClick={onRetry} className="flex-1 py-4 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"><RotateCcw className="h-5 w-5" /> Retake</button>
                <button onClick={onConfirm} className="flex-[2] py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"><Sparkles className="h-5 w-5" /> Extract Details</button>
            </div>
        </div>
    );
};

// Type Selector Component
const TypeSelector = ({ onSelect, onClose }) => (
    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6 z-30 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">What did you scan?</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="h-5 w-5 text-slate-500" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
            {Object.entries(DETECTED_TYPES).map(([key, type]) => {
                const Icon = type.icon;
                return (
                    <button key={key} onClick={() => onSelect(key)} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left">
                        <div className={`p-2 rounded-xl bg-${type.color}-100`}><Icon className={`h-5 w-5 text-${type.color}-600`} /></div>
                        <div><p className="font-bold text-slate-800">{type.label}</p><p className="text-xs text-slate-500">{type.description}</p></div>
                    </button>
                );
            })}
        </div>
    </div>
);

// Main Component
export const SmartScanner = ({ onCapture, onClose, onProcessComplete, analyzeImage }) => {
    // Mode: 'select' (Initial), 'camera', 'upload'
    const [mode, setMode] = useState('select');
    const [capturedImage, setCapturedImage] = useState(null);
    const [scanStage, setScanStage] = useState(null);
    const [detectedType, setDetectedType] = useState(null);
    const [confidence, setConfidence] = useState(0);
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [error, setError] = useState(null);
    
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    
    // Start Camera
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            console.error('Camera error:', err);
            setError('Could not access camera. Please use file upload.');
        }
    }, []);
    
    // Stop Camera
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);
    
    // Manage Camera Lifecycle
    useEffect(() => {
        if (mode === 'camera') startCamera();
        else stopCamera();
        return () => stopCamera();
    }, [mode, startCamera, stopCamera]);
    
    const capturePhoto = useCallback(() => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageData);
        stopCamera();
        processImage(imageData);
    }, [stopCamera]);
    
    const handleFileUpload = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const imageData = event.target?.result;
            setCapturedImage(imageData);
            stopCamera();
            processImage(imageData);
        };
        reader.readAsDataURL(file);
    }, [stopCamera]);
    
    const processImage = async (imageData) => {
        setError(null);
        try {
            setScanStage('analyzing');
            await new Promise(r => setTimeout(r, 800));
            
            setScanStage('detecting');
            let detected = 'product';
            let conf = 0.85;
            
            if (analyzeImage) {
                try {
                    const result = await analyzeImage(imageData, 'detect_type');
                    // Heuristic: Multiple items usually mean room photo or long receipt
                    if (result?.items?.length > 1) detected = 'room_photo';
                    else if (result?.store) detected = 'receipt';
                    else detected = 'product';
                } catch (err) { console.warn('AI detection failed:', err); }
            } else {
                await new Promise(r => setTimeout(r, 1000));
            }
            
            setDetectedType(detected);
            setConfidence(conf);
            setScanStage(null);
        } catch (err) {
            console.error('Processing error:', err);
            setError('Failed to process image. Please try again.');
            setScanStage(null);
        }
    };
    
    const handleConfirm = async () => {
        setScanStage('extracting');
        try {
            let extractedData = {};
            if (analyzeImage) {
                extractedData = await analyzeImage(capturedImage, 'extract');
            } else {
                await new Promise(r => setTimeout(r, 1500));
                extractedData = { item: 'Detected Item', suggestedCategory: 'General' };
            }
            onProcessComplete?.({ image: capturedImage, type: detectedType, ...extractedData });
        } catch (err) {
            console.error('Extraction error:', err);
            setError('Failed to extract details. Please try manual entry.');
            setScanStage(null);
        }
    };
    
    const handleRetry = () => {
        setCapturedImage(null); setDetectedType(null); setConfidence(0); setScanStage(null); setError(null);
        if (mode === 'camera') startCamera();
        else setMode('select');
    };
    
    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            <div className="absolute top-0 left-0 right-0 z-30 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={onClose} className="p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"><X className="h-6 w-6 text-white" /></button>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full"><Sparkles className="h-4 w-4 text-emerald-400" /><span className="text-white text-sm font-medium">AI Scanner</span></div>
                <div className="w-12" />
            </div>
            
            <div className="flex-grow relative bg-slate-900 flex flex-col items-center justify-center">
                {/* Mode 1: Selection */}
                {mode === 'select' && (
                    <div className="w-full max-w-md p-6 space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="text-center space-y-2 mb-8"><h2 className="text-2xl font-bold text-white">Add Items</h2><p className="text-slate-400">Scan receipts, labels, or entire rooms.</p></div>
                        <button onClick={() => setMode('camera')} className="w-full p-6 bg-emerald-600 hover:bg-emerald-500 rounded-3xl flex items-center gap-6 transition-all group shadow-lg"><div className="bg-white/20 p-4 rounded-2xl group-hover:scale-110 transition-transform"><Camera className="h-8 w-8 text-white" /></div><div className="text-left"><h3 className="font-bold text-xl text-white">Use Camera</h3><p className="text-emerald-100/80 text-sm">Snap a photo directly</p></div></button>
                        <button onClick={() => fileInputRef.current?.click()} className="w-full p-6 bg-slate-800 hover:bg-slate-700 rounded-3xl flex items-center gap-6 transition-all group border border-slate-700"><div className="bg-slate-700 p-4 rounded-2xl group-hover:bg-slate-600 transition-colors border border-slate-600"><ImageIcon className="h-8 w-8 text-white" /></div><div className="text-left"><h3 className="font-bold text-xl text-white">Upload File</h3><p className="text-slate-400 text-sm">Use existing photo or PDF</p></div></button>
                    </div>
                )}

                {/* Mode 2: Camera */}
                {mode === 'camera' && !capturedImage && (
                    <>
                        <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 pointer-events-none"><div className="absolute inset-8 border-2 border-white/30 rounded-3xl" /></div>
                    </>
                )}

                {/* Mode 3: Preview */}
                {capturedImage && <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />}
                {scanStage && <ScanningOverlay stage={scanStage} />}
            </div>
            
            {error && <div className="absolute top-20 left-4 right-4 bg-red-500 text-white p-4 rounded-2xl flex items-center gap-3 z-40"><AlertCircle className="h-5 w-5 shrink-0" /><p className="text-sm">{error}</p><button onClick={() => setError(null)} className="ml-auto"><X className="h-5 w-5" /></button></div>}
            
            {mode === 'camera' && !capturedImage && !scanStage && (
                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center justify-center gap-8">
                        <button onClick={() => setMode('select')} className="p-4 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"><X className="h-6 w-6 text-white" /></button>
                        <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-2xl border-4 border-slate-900/20"><div className="w-16 h-16 bg-white border-4 border-slate-900 rounded-full" /></button>
                        <div className="w-14" />
                    </div>
                </div>
            )}
            
            {detectedType && !scanStage && !showTypeSelector && <DetectionResult type={detectedType} confidence={confidence} onConfirm={handleConfirm} onRetry={handleRetry} onChangeType={() => setShowTypeSelector(true)} />}
            {showTypeSelector && <TypeSelector onSelect={(t) => { setDetectedType(t); setShowTypeSelector(false); }} onClose={() => setShowTypeSelector(false)} />}
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
            <style jsx>{`@keyframes scan { 0%, 100% { transform: translateY(-100%); } 50% { transform: translateY(100%); } } .animate-scan { animation: scan 2s ease-in-out infinite; } @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } } .animate-slide-up { animation: slide-up 0.3s ease-out; }`}</style>
        </div>
    );
};

export default SmartScanner;
