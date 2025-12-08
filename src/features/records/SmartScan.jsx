// src/features/records/SmartScan.jsx
import React, { useRef, useState } from 'react';
import { ScanLine, Camera, ListChecks, Save, XCircle, FileText, Loader2, Sparkles, Armchair, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { compressImage, fileToBase64 } from '../../lib/images';
import { useGemini } from '../../hooks/useGemini';
import { CATEGORIES, ROOMS } from '../../config/constants';

export const SmartScan = ({ onBatchSave, onAutoFill }) => {
    const fileInputRef = useRef(null);
    const roomInputRef = useRef(null);
    const { scanReceipt, scanRoom, isScanning } = useGemini();
    
    // Mode State: 'receipt' or 'room'
    const [scanMode, setScanMode] = useState('receipt');
    const [showRoomGuide, setShowRoomGuide] = useState(false);

    // Data State
    const [scannedItems, setScannedItems] = useState([]);
    const [scannedImagePreview, setScannedImagePreview] = useState(null);
    const [currentFile, setCurrentFile] = useState(null); 
    const [isPdf, setIsPdf] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Global Fields
    const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
    const [globalStore, setGlobalStore] = useState("");
    const [globalArea, setGlobalArea] = useState("General");
    const [globalCategory, setGlobalCategory] = useState("");

    // --- RECEIPT SCAN LOGIC ---
    const handleReceiptScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setCurrentFile(file);
        const loadingToast = toast.loading('Analyzing document for costs & items...');

        try {
            let base64Str = "";
            if (file.type === "application/pdf") {
                setIsPdf(true);
                setScannedImagePreview(null);
                base64Str = await fileToBase64(file);
            } else {
                setIsPdf(false);
                setScannedImagePreview(URL.createObjectURL(file));
                base64Str = await compressImage(file);
            }

            const data = await scanReceipt(file, base64Str);
            toast.dismiss(loadingToast);
            
            if (data && data.items) {
                setScannedItems(data.items);
                if (data.date) setGlobalDate(data.date);
                if (data.store) setGlobalStore(data.store);
                if (data.primaryCategory && CATEGORIES.includes(data.primaryCategory)) setGlobalCategory(data.primaryCategory);
                if (data.primaryArea && ROOMS.includes(data.primaryArea)) setGlobalArea(data.primaryArea);

                if (data.items.length === 1) {
                    onAutoFill({
                        ...data.items[0],
                        category: data.items[0].category || data.primaryCategory,
                        area: data.items[0].area || data.primaryArea,
                        cost: data.items[0].cost || ''
                    });
                    setScannedItems([]);
                    toast.success('Details filled automatically!', { icon: '✨' });
                } else {
                    toast.success(`Found ${data.items.length} items!`, { icon: '📝' });
                }
            } else {
                toast.error("Couldn't detect items. Try a clearer image.");
            }
        } catch (error) {
            console.error(error);
            toast.dismiss(loadingToast);
            toast.error("Scan failed.");
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // --- ROOM SCAN LOGIC ---
    const handleRoomScanTrigger = () => {
        setShowRoomGuide(true);
    };

    const handleRoomScanFiles = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        setShowRoomGuide(false);
        setCurrentFile(files[0]); // Keep reference to first file for batch save context
        setScannedImagePreview(URL.createObjectURL(files[0])); // Preview first image
        
        const loadingToast = toast.loading(`Analyzing ${files.length} photos & deduplicating...`);
        
        try {
            // Compress all images in parallel
            const base64Promises = files.map(f => compressImage(f));
            const base64Results = await Promise.all(base64Promises);
            
            const data = await scanRoom(files, base64Results);
            toast.dismiss(loadingToast);

            if (data && data.items) {
                setScannedItems(data.items);
                toast.success(`Identified ${data.items.length} unique items!`, { icon: '📸' });
            } else {
                toast.error("Could not identify items.");
            }
        } catch (err) {
            console.error(err);
            toast.dismiss(loadingToast);
            toast.error("Room scan failed.");
        }
        if (roomInputRef.current) roomInputRef.current.value = "";
    };

    // --- COMMON HELPERS ---
    const handleGlobalCategoryChange = (val) => {
        setGlobalCategory(val);
        setScannedItems(prev => prev.map(item => ({ ...item, category: val })));
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        const savingToast = toast.loading(`Saving ${scannedItems.length} items...`);
        try {
            const finalItems = scannedItems.map(item => ({
                ...item,
                dateInstalled: globalDate || item.dateInstalled,
                contractor: globalStore || item.contractor,
                area: item.area || globalArea,
                category: globalCategory || item.category
            }));
            
            await onBatchSave(finalItems, currentFile);
            
            // Reset
            setScannedItems([]);
            setScannedImagePreview(null);
            setCurrentFile(null);
            setGlobalCategory("");
            setGlobalStore("");
            setGlobalArea("General");
            
            toast.dismiss(savingToast);
        } catch (e) {
            console.error("SmartScan Save Error:", e);
            toast.dismiss(savingToast);
            toast.error("Failed to save items.");
        } finally {
            setIsSaving(false);
        }
    };

    const updateItem = (index, field, val) => {
        const newItems = [...scannedItems];
        newItems[index][field] = val;
        setScannedItems(newItems);
    };
    
    const removeItem = (index) => {
        setScannedItems(prev => prev.filter((_, i) => i !== index));
    };

    const totalExtractedValue = scannedItems.reduce((acc, item) => acc + (parseFloat(item.cost) || 0), 0);

    return (
        <div className="mb-8 h-full flex flex-col">
            {/* Guide Overlay for Room Scan */}
            {showRoomGuide && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
                        <div className="text-center mb-6">
                            <div className="bg-indigo-100 p-3 rounded-full inline-flex mb-3">
                                <Sparkles className="h-6 w-6 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Scan an Entire Area</h3>
                            <p className="text-slate-500 text-sm mt-2">
                                Take a series of photos to capture everything at once. Our AI will find the items and remove duplicates.
                            </p>
                        </div>
                        
                        <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600">
                            <div className="flex gap-3">
                                <span className="font-bold text-indigo-600">1.</span>
                                <span>Stand in the center and rotate.</span>
                            </div>
                            <div className="flex gap-3">
                                <span className="font-bold text-indigo-600">2.</span>
                                <span>Take 3-5 overlapping photos.</span>
                            </div>
                            <div className="flex gap-3">
                                <span className="font-bold text-indigo-600">3.</span>
                                <span>Open cabinets to scan inside.</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setShowRoomGuide(false)} className="py-3 px-4 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                                Cancel
                            </button>
                            <button onClick={() => roomInputRef.current?.click()} className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center">
                                <Camera className="mr-2 h-4 w-4"/> Start Camera
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SCAN TRIGGER AREA */}
            <div className="bg-white rounded-2xl p-1 border border-slate-200 shadow-sm mb-4 flex relative shrink-0">
                 {/* Tabs */}
                <button 
                    onClick={() => setScanMode('receipt')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center transition-all ${scanMode === 'receipt' ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <ScanLine className="mr-2 h-4 w-4"/> Scan Receipt
                </button>
                <button 
                    onClick={() => setScanMode('room')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center transition-all ${scanMode === 'room' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Armchair className="mr-2 h-4 w-4"/> Scan Area
                </button>
            </div>

            <div className={`rounded-2xl p-6 border flex flex-col justify-between gap-4 transition-colors flex-grow ${scanMode === 'receipt' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-bold ${scanMode === 'receipt' ? 'text-emerald-900' : 'text-indigo-900'}`}>
                            {scanMode === 'receipt' ? 'Upload Receipt or Invoice' : 'Upload Area Photos'}
                        </h3>
                        
                        {/* CENTERED BADGE IMPLEMENTATION */}
                        {scanMode === 'receipt' && <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase">AI Cost Extraction</span>}
                        {scanMode === 'room' && <span className="text-[10px] bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full font-bold uppercase flex items-center justify-center">Multi-Photo Support</span>}
                    </div>
                    
                    <p className={`text-xs mt-1 ${scanMode === 'receipt' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                        {scanMode === 'receipt' 
                            ? "We'll extract items, costs, and dates automatically." 
                            : "Upload multiple photos. We'll identify fixtures, appliances, and furniture."}
                    </p>
                </div>

                <div>
                    {scanMode === 'receipt' ? (
                        <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isScanning} 
                            className="w-full px-5 py-3 bg-white text-emerald-700 font-bold rounded-xl shadow-sm border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition flex items-center justify-center disabled:opacity-50"
                        >
                            {isScanning ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
                            {isScanning ? 'Analyzing...' : 'Select File'}
                        </button>
                    ) : (
                        <button 
                            type="button" 
                            onClick={handleRoomScanTrigger} 
                            disabled={isScanning} 
                            className="w-full px-5 py-3 bg-white text-indigo-700 font-bold rounded-xl shadow-sm border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition flex items-center justify-center disabled:opacity-50"
                        >
                            {isScanning ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                            {isScanning ? 'Scanning...' : 'Select Photos'}
                        </button>
                    )}
                </div>
                
                {/* Hidden Inputs */}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleReceiptScan} />
                <input type="file" ref={roomInputRef} className="hidden" accept="image/*" multiple onChange={handleRoomScanFiles} />
            </div>

            {/* REVIEW PANEL - (Same as before, not shown for brevity in this snippet as it handles result display) */}
            {scannedItems.length > 0 && (
               // ... (existing review panel code)
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 animate-in fade-in slide-in-from-top-4 mt-6">
                    {/* ... */}
               </div>
            )}
        </div>
    );
};
