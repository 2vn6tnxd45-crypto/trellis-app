// src/features/records/SmartScan.jsx
import React, { useRef, useState } from 'react';
import { ScanLine, Camera, ListChecks, Save, ChevronDown, XCircle, FileText, Loader2, Sparkles, CheckCircle, DollarSign, Armchair, HelpCircle, UploadCloud } from 'lucide-react';
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
                    toast.success(`Found ${data.items.length} items!`, { icon: '🎉' });
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
                toast.success(`Identified ${data.items.length} unique items!`, { icon: '🏘️' });
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
        <div className="mb-8">
            {/* Guide Overlay for Room Scan */}
            {showRoomGuide && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
                        <div className="text-center mb-6">
                            <div className="bg-indigo-100 p-3 rounded-full inline-flex mb-3">
                                <Sparkles className="h-6 w-6 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Scan an Entire Room</h3>
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
            <div className="bg-white rounded-2xl p-1 border border-slate-200 shadow-sm mb-6 flex relative">
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
                    <Armchair className="mr-2 h-4 w-4"/> Scan Room
                </button>
            </div>

            <div className={`rounded-2xl p-6 border flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 transition-colors ${scanMode === 'receipt' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <div>
                    <h3 className={`font-bold flex items-center ${scanMode === 'receipt' ? 'text-emerald-900' : 'text-indigo-900'}`}>
                        {scanMode === 'receipt' ? 'Upload Receipt or Invoice' : 'Upload Room Photos'}
                        {scanMode === 'receipt' && <span className="ml-2 text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase">AI Cost Extraction</span>}
                        {scanMode === 'room' && <span className="ml-2 text-[10px] bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full font-bold uppercase">Multi-Photo Support</span>}
                    </h3>
                    <p className={`text-xs mt-1 ${scanMode === 'receipt' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                        {scanMode === 'receipt' 
                            ? "We'll extract items, costs, and dates automatically." 
                            : "Upload multiple photos. We'll identify fixtures, appliances, and furniture."}
                    </p>
                </div>

                <div className="flex gap-2">
                    {scanMode === 'receipt' ? (
                        <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isScanning} 
                            className="px-5 py-3 bg-white text-emerald-700 font-bold rounded-xl shadow-sm border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition flex items-center disabled:opacity-50"
                        >
                            {isScanning ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
                            {isScanning ? 'Analyzing...' : 'Select File'}
                        </button>
                    ) : (
                        <button 
                            type="button" 
                            onClick={handleRoomScanTrigger} 
                            disabled={isScanning} 
                            className="px-5 py-3 bg-white text-indigo-700 font-bold rounded-xl shadow-sm border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition flex items-center disabled:opacity-50"
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

            {/* REVIEW PANEL */}
            {scannedItems.length > 0 && (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 animate-in fade-in slide-in-from-top-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                        <div>
                            <h4 className="font-bold text-slate-800 flex items-center">
                                <ListChecks className="mr-2 h-5 w-5 text-emerald-600"/> 
                                Review Items
                                <span className="ml-2 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                    {scannedItems.length} found
                                </span>
                            </h4>
                            {totalExtractedValue > 0 && (
                                <p className="text-xs text-slate-500 mt-1 ml-7">
                                    Total Detected: <span className="font-bold text-emerald-600">${totalExtractedValue.toFixed(2)}</span>
                                </p>
                            )}
                        </div>
                        <button 
                            type="button" 
                            onClick={handleSaveAll} 
                            disabled={isSaving} 
                            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition flex items-center disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Save className="mr-2 h-4 w-4"/>}
                            {isSaving ? 'Saving...' : 'Save All'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Preview Column */}
                        <div className="lg:col-span-1">
                            {scannedImagePreview ? (
                                <div className="relative">
                                    <img 
                                        src={scannedImagePreview} 
                                        alt="Scanned document" 
                                        className="rounded-2xl border border-slate-200 shadow-sm w-full object-cover" 
                                    />
                                    {scanMode === 'room' && (
                                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full font-bold">
                                            Cover Image
                                        </div>
                                    )}
                                </div>
                            ) : isPdf ? (
                                <div className="aspect-[3/4] bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                                    <FileText className="h-16 w-16 mb-2 text-red-500" />
                                    <span className="font-bold text-slate-600">PDF Uploaded</span>
                                    <span className="text-xs text-slate-400 mt-1">{currentFile?.name}</span>
                                </div>
                            ) : null}
                        </div>
                        
                        {/* Items Column */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Global Settings */}
                            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Apply to All Items</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                                        <input 
                                            type="date" 
                                            value={globalDate} 
                                            onChange={e => setGlobalDate(e.target.value)} 
                                            className="w-full text-sm border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Store/Contractor</label>
                                        <input 
                                            type="text" 
                                            value={globalStore} 
                                            onChange={e => setGlobalStore(e.target.value)} 
                                            placeholder="Home Depot"
                                            className="w-full text-sm border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Room</label>
                                        <select 
                                            value={globalArea} 
                                            onChange={e => setGlobalArea(e.target.value)} 
                                            className="w-full text-sm border-slate-200 rounded-lg"
                                        >
                                            <option value="General">General</option>
                                            {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Category</label>
                                        <select 
                                            value={globalCategory} 
                                            onChange={e => handleGlobalCategoryChange(e.target.value)} 
                                            className="w-full text-sm border-slate-200 rounded-lg bg-emerald-50/50 text-emerald-900 font-bold"
                                        >
                                            <option value="">Set All...</option>
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Item List */}
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                                {scannedItems.map((item, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group">
                                        <div className="flex gap-3">
                                            <div className="flex-grow grid grid-cols-1 sm:grid-cols-12 gap-3">
                                                {/* Item Name (5 cols) */}
                                                <div className="sm:col-span-5">
                                                    <input 
                                                        type="text" 
                                                        value={item.item} 
                                                        onChange={e => updateItem(idx, 'item', e.target.value)} 
                                                        className="w-full font-bold border-0 border-b border-slate-200 focus:ring-0 px-0 py-1 placeholder-slate-300" 
                                                        placeholder="Item Name"
                                                    />
                                                    <div className="flex gap-2 mt-2">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Brand" 
                                                            value={item.brand || ''} 
                                                            onChange={e => updateItem(idx, 'brand', e.target.value)} 
                                                            className="w-1/2 text-xs border-0 border-b border-slate-100"
                                                        />
                                                        <input 
                                                            type="text" 
                                                            placeholder="Model" 
                                                            value={item.model || ''} 
                                                            onChange={e => updateItem(idx, 'model', e.target.value)} 
                                                            className="w-1/2 text-xs border-0 border-b border-slate-100"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                {/* Cost (2 cols) */}
                                                <div className="sm:col-span-3">
                                                    <div className="relative">
                                                        <span className="absolute left-0 top-1 text-slate-400 text-sm">$</span>
                                                        <input 
                                                            type="number" 
                                                            value={item.cost} 
                                                            onChange={e => updateItem(idx, 'cost', e.target.value)} 
                                                            className="w-full text-sm font-bold text-emerald-600 border-0 border-b border-emerald-200 focus:ring-0 pl-3 py-1 placeholder-slate-300" 
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 mt-2">Cost</p>
                                                </div>

                                                {/* Category/Area (4 cols) */}
                                                <div className="sm:col-span-4">
                                                    <select 
                                                        value={item.category || globalCategory} 
                                                        onChange={e => updateItem(idx, 'category', e.target.value)} 
                                                        className="w-full text-xs border-0 border-b border-slate-200 mb-2"
                                                    >
                                                        <option>Select Category</option>
                                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                    <select 
                                                        value={item.area || globalArea} 
                                                        onChange={e => updateItem(idx, 'area', e.target.value)} 
                                                        className="w-full text-xs border-0 border-b border-slate-200"
                                                    >
                                                        <option value="">(Global)</option>
                                                        {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => removeItem(idx)} 
                                                className="text-slate-300 hover:text-red-500 transition-colors"
                                            >
                                                <XCircle size={20}/>
                                            </button>
                                        </div>
                                        
                                        {/* Notes preview if present */}
                                        {item.notes && (
                                            <p className="mt-2 text-xs text-slate-400 italic truncate">
                                                📝 {item.notes}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
