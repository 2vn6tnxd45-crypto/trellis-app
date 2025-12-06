// src/features/records/SmartScan.jsx
import React, { useRef, useState } from 'react';
import { ScanLine, Camera, ListChecks, Save, ChevronDown, XCircle, FileText, Loader2 } from 'lucide-react';
import { compressImage, fileToBase64 } from '../../lib/images';
import { useGemini } from '../../hooks/useGemini';
import { CATEGORIES, ROOMS } from '../../config/constants';

export const SmartScan = ({ onBatchSave, onAutoFill }) => {
    const fileInputRef = useRef(null);
    const { scanReceipt, isScanning } = useGemini();
    
    const [scannedItems, setScannedItems] = useState([]);
    const [scannedImagePreview, setScannedImagePreview] = useState(null);
    const [scannedImageBase64, setScannedImageBase64] = useState(null);
    const [isPdf, setIsPdf] = useState(false);
    const [isSaving, setIsSaving] = useState(false); // NEW LOCAL LOADING STATE
    
    const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
    const [globalStore, setGlobalStore] = useState("");
    const [globalArea, setGlobalArea] = useState("General");
    const [globalCategory, setGlobalCategory] = useState("");

    const handleScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

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

        setScannedImageBase64(base64Str);

        const data = await scanReceipt(file, base64Str);
        
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
                onAutoFill({
                    ...data.items[0],
                    category: data.items[0].category || data.primaryCategory,
                    area: data.items[0].area || data.primaryArea
                });
                setScannedItems([]);
            }
        } else {
            alert("No items detected.");
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleGlobalCategoryChange = (val) => {
        setGlobalCategory(val);
        setScannedItems(prev => prev.map(item => ({ ...item, category: val })));
    };

    const handleSaveAll = async () => {
        setIsSaving(true); // START LOADING
        try {
            const finalItems = scannedItems.map(item => ({
                ...item,
                dateInstalled: globalDate || item.dateInstalled,
                contractor: globalStore || item.contractor,
                area: item.area || globalArea,
                category: globalCategory || item.category,
                imageUrl: scannedImageBase64
            }));
            
            await onBatchSave(finalItems);
            
            // Only clear if successful
            setScannedItems([]);
            setScannedImagePreview(null);
            setScannedImageBase64(null);
            setIsPdf(false);
            setGlobalCategory("");
            setGlobalStore("");
            setGlobalArea("General");
        } catch (e) {
            console.error("SmartScan Save Error:", e);
            // We rely on App.jsx to alert the user, but we log it here too
        } finally {
            setIsSaving(false); // STOP LOADING
        }
    };

    const updateItem = (index, field, val) => {
        const newItems = [...scannedItems];
        newItems[index][field] = val;
        setScannedItems(newItems);
    };

    return (
        <div className="mb-8">
            <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="font-bold text-emerald-900 flex items-center"><ScanLine className="mr-2 h-5 w-5 text-emerald-600"/> Smart Scan</h3>
                    <p className="text-xs text-emerald-600 mt-1">Upload a receipt, invoice, or label (Image or PDF).</p>
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isScanning} className="px-5 py-3 bg-white text-emerald-700 font-bold rounded-xl shadow-sm border border-emerald-200 hover:bg-emerald-50 transition flex items-center">
                    {isScanning ? <span className="animate-pulse">Analyzing...</span> : <><Camera className="mr-2 h-4 w-4"/> Auto-Fill</>}
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleScan} />
            </div>

            {scannedItems.length > 0 && (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                        <h4 className="font-bold text-slate-800 flex items-center"><ListChecks className="mr-2 h-5 w-5 text-emerald-600"/> Review Scan Results</h4>
                        {/* TOP SAVE BUTTON */}
                        <button type="button" onClick={handleSaveAll} disabled={isSaving} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition flex items-center disabled:opacity-50">
                            {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Save className="mr-2 h-4 w-4"/>}
                            {isSaving ? 'Saving...' : 'Save All Items'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            {scannedImagePreview ? (
                                <img src={scannedImagePreview} alt="Receipt" className="rounded-2xl border border-slate-200 shadow-sm w-full object-cover" />
                            ) : isPdf ? (
                                <div className="aspect-[3/4] bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                                    <FileText className="h-16 w-16 mb-2 text-red-500" />
                                    <span className="font-bold text-slate-600">PDF Uploaded</span>
                                </div>
                            ) : null}
                        </div>
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Date</label><input type="date" value={globalDate} onChange={e=>setGlobalDate(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg"/></div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Store</label><input type="text" value={globalStore} onChange={e=>setGlobalStore(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg"/></div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Room</label><select value={globalArea} onChange={e=>setGlobalArea(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg"><option value="General">General</option>{ROOMS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Category</label>
                                    <select value={globalCategory} onChange={e=>handleGlobalCategoryChange(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg bg-emerald-50/50 text-emerald-900 font-bold">
                                        <option value="">Set All...</option>
                                        {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                                {scannedItems.map((item, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-3 relative">
                                        <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <input type="text" value={item.item} onChange={e=>updateItem(idx,'item',e.target.value)} className="w-full font-bold border-0 border-b border-slate-200 focus:ring-0 px-0 py-1 placeholder-slate-300" placeholder="Item Name"/>
                                                <div className="flex gap-2 mt-2">
                                                    <input type="text" placeholder="Brand" value={item.brand||''} onChange={e=>updateItem(idx,'brand',e.target.value)} className="w-1/2 text-xs border-0 border-b border-slate-100"/>
                                                    <input type="text" placeholder="Model" value={item.model||''} onChange={e=>updateItem(idx,'model',e.target.value)} className="w-1/2 text-xs border-0 border-b border-slate-100"/>
                                                </div>
                                            </div>
                                            <div>
                                                <select value={item.category || globalCategory} onChange={e=>updateItem(idx,'category',e.target.value)} className="w-full text-xs border-0 border-b border-slate-200 mb-2"><option>Select Category</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
                                                <select value={item.area || globalArea} onChange={e=>updateItem(idx,'area',e.target.value)} className="w-full text-xs border-0 border-b border-slate-200"><option value="">(Global)</option>{ROOMS.map(r=><option key={r} value={r}>{r}</option>)}</select>
                                            </div>
                                        </div>
                                        <button onClick={()=>setScannedItems(prev=>prev.filter((_,i)=>i!==idx))} className="text-slate-300 hover:text-red-500"><XCircle size={20}/></button>
                                    </div>
                                ))}
                            </div>

                            {/* BOTTOM SAVE BUTTON */}
                            <div className="pt-4 border-t border-slate-200">
                                <button type="button" onClick={handleSaveAll} disabled={isSaving} className="w-full bg-emerald-600 text-white px-4 py-4 rounded-xl text-base font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition flex items-center justify-center disabled:opacity-50">
                                    {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2"/> : <Save className="mr-2 h-5 w-5"/>}
                                    {isSaving ? 'Saving Items...' : 'Save All Items'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
