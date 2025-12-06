// src/features/records/SmartScan.jsx
// ============================================
// 📸 SMART SCAN - AI Receipt Scanning
// ============================================
// This component uses AI to extract items from receipts/invoices.
// Updated to use toast notifications.

import React, { useRef, useState } from 'react';
import { ScanLine, Camera, ListChecks, Save, ChevronDown, XCircle, FileText, Loader2, Sparkles, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { compressImage, fileToBase64 } from '../../lib/images';
import { useGemini } from '../../hooks/useGemini';
import { CATEGORIES, ROOMS } from '../../config/constants';

export const SmartScan = ({ onBatchSave, onAutoFill }) => {
    const fileInputRef = useRef(null);
    const { scanReceipt, isScanning } = useGemini();
    
    const [scannedItems, setScannedItems] = useState([]);
    const [scannedImagePreview, setScannedImagePreview] = useState(null);
    const [currentFile, setCurrentFile] = useState(null); 
    const [isPdf, setIsPdf] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
    const [globalStore, setGlobalStore] = useState("");
    const [globalArea, setGlobalArea] = useState("General");
    const [globalCategory, setGlobalCategory] = useState("");

    const handleScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setCurrentFile(file);
        
        // Show loading toast
        const loadingToast = toast.loading('Analyzing document...');

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
        
        // Dismiss loading toast
        toast.dismiss(loadingToast);
        
        if (data && data.items) {
            setScannedItems(data.items);
            
            if (data.date) setGlobalDate(data.date);
            if (data.store) setGlobalStore(data.store);
            
            if (data.primaryCategory && CATEGORIES.includes(data.primaryCategory)) {
                setGlobalCategory(data.primaryCategory);
            }
            
            if (data.primaryArea && ROOMS.includes(data.primaryArea)) {
                setGlobalArea(data.primaryArea);
            } else {
                setGlobalArea("General"); 
            }

            if (data.items.length === 1) {
                // Single item - auto-fill the form
                onAutoFill({
                    ...data.items[0],
                    category: data.items[0].category || data.primaryCategory,
                    area: data.items[0].area || data.primaryArea
                });
                setScannedItems([]);
                toast.success('Item detected! Details filled in below.', {
                    icon: '✨',
                    duration: 3000,
                });
            } else {
                // Multiple items found
                toast.success(`Found ${data.items.length} items! Review them below.`, {
                    icon: '🎉',
                    duration: 4000,
                });
            }
        } else {
            toast.error("Couldn't detect any items. Try a clearer image.", {
                duration: 4000,
            });
        }
        
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleGlobalCategoryChange = (val) => {
        setGlobalCategory(val);
        setScannedItems(prev => prev.map(item => ({ ...item, category: val })));
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        
        // Show saving toast
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
            
            // Clear state
            setScannedItems([]);
            setScannedImagePreview(null);
            setCurrentFile(null);
            setIsPdf(false);
            setGlobalCategory("");
            setGlobalStore("");
            setGlobalArea("General");
            
            // Dismiss loading and show success
            toast.dismiss(savingToast);
            // Note: success toast is shown by the parent component
            
        } catch (e) {
            console.error("SmartScan Save Error:", e);
            toast.dismiss(savingToast);
            toast.error("Failed to save items. Please try again.");
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
        const item = scannedItems[index];
        setScannedItems(prev => prev.filter((_, i) => i !== index));
        toast(`Removed: ${item.item}`, {
            icon: '🗑️',
            duration: 2000,
        });
    };

    return (
        <div className="mb-8">
            {/* Scan Trigger Area */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="font-bold text-emerald-900 flex items-center">
                        <ScanLine className="mr-2 h-5 w-5 text-emerald-600"/> 
                        Smart Scan
                        <span className="ml-2 text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase">
                            AI
                        </span>
                    </h3>
                    <p className="text-xs text-emerald-600 mt-1">
                        Upload a receipt, invoice, or label — we'll extract the details.
                    </p>
                </div>
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isScanning} 
                    className="px-5 py-3 bg-white text-emerald-700 font-bold rounded-xl shadow-sm border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition flex items-center disabled:opacity-50"
                >
                    {isScanning ? (
                        <>
                            <Loader2 className="animate-spin mr-2 h-4 w-4" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <Camera className="mr-2 h-4 w-4" /> 
                            Scan Document
                        </>
                    )}
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*,application/pdf" 
                    onChange={handleScan} 
                />
            </div>

            {/* Scanned Items Review Panel */}
            {scannedItems.length > 0 && (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 animate-in fade-in slide-in-from-top-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                        <h4 className="font-bold text-slate-800 flex items-center">
                            <ListChecks className="mr-2 h-5 w-5 text-emerald-600"/> 
                            Review Scanned Items
                            <span className="ml-2 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                {scannedItems.length} found
                            </span>
                        </h4>
                        <button 
                            type="button" 
                            onClick={handleSaveAll} 
                            disabled={isSaving} 
                            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition flex items-center disabled:opacity-50"
                        >
                            {isSaving ? (
                                <Loader2 className="animate-spin h-4 w-4 mr-2"/>
                            ) : (
                                <Save className="mr-2 h-4 w-4"/>
                            )}
                            {isSaving ? 'Saving...' : 'Save All'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Preview Column */}
                        <div className="lg:col-span-1">
                            {scannedImagePreview ? (
                                <img 
                                    src={scannedImagePreview} 
                                    alt="Scanned document" 
                                    className="rounded-2xl border border-slate-200 shadow-sm w-full object-cover" 
                                />
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
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Store</label>
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
                                            <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
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
                                                <div>
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

                            {/* Save Button (Mobile) */}
                            <div className="pt-4 border-t border-slate-200 lg:hidden">
                                <button 
                                    type="button" 
                                    onClick={handleSaveAll} 
                                    disabled={isSaving} 
                                    className="w-full bg-emerald-600 text-white px-4 py-4 rounded-xl text-base font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition flex items-center justify-center disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <Loader2 className="animate-spin h-5 w-5 mr-2"/>
                                    ) : (
                                        <Save className="mr-2 h-5 w-5"/>
                                    )}
                                    {isSaving ? 'Saving Items...' : `Save All ${scannedItems.length} Items`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
