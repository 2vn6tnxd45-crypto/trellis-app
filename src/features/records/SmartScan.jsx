// src/features/records/SmartScan.jsx
import React, { useRef, useState } from 'react';
import { ScanLine, Camera, ListChecks, Save, ChevronDown, XCircle } from 'lucide-react';
import { compressImage } from '../../lib/images';
import { useGemini } from '../../hooks/useGemini';
import { CATEGORIES, ROOMS } from '../../config/constants';

export const SmartScan = ({ onBatchSave, onAutoFill }) => {
    const fileInputRef = useRef(null);
    const { scanReceipt, isScanning } = useGemini();
    
    const [scannedItems, setScannedItems] = useState([]);
    const [scannedImagePreview, setScannedImagePreview] = useState(null);
    const [scannedImageBase64, setScannedImageBase64] = useState(null);
    
    // Global batch fields
    const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
    const [globalStore, setGlobalStore] = useState("");
    const [globalArea, setGlobalArea] = useState("General");

    const handleScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setScannedImagePreview(URL.createObjectURL(file));
        const base64Str = await compressImage(file);
        setScannedImageBase64(base64Str);

        const data = await scanReceipt(file, base64Str);
        if (data && data.items) {
            setScannedItems(data.items);
            if (data.items[0]?.dateInstalled) setGlobalDate(data.items[0].dateInstalled);
            if (data.items[0]?.contractor) setGlobalStore(data.items[0].contractor);
            
            // If only 1 item, just auto-fill the main form instead of showing the batch UI
            if (data.items.length === 1) {
                onAutoFill(data.items[0]);
                setScannedItems([]); // Clear batch UI
            }
        } else {
            alert("No items detected.");
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSaveAll = () => {
        const finalItems = scannedItems.map(item => ({
            ...item,
            dateInstalled: globalDate || item.dateInstalled,
            contractor: globalStore || item.contractor,
            area: item.area || globalArea,
            imageUrl: scannedImageBase64
        }));
        onBatchSave(finalItems);
        setScannedItems([]);
        setScannedImagePreview(null);
    };

    const updateItem = (index, field, val) => {
        const newItems = [...scannedItems];
        newItems[index][field] = val;
        setScannedItems(newItems);
    };

    return (
        <div className="mb-8">
            <div className="bg-sky-50 rounded-2xl p-6 border border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="font-bold text-sky-900 flex items-center"><ScanLine className="mr-2 h-5 w-5 text-sky-600"/> Smart Scan</h3>
                    <p className="text-xs text-sky-600 mt-1">Take a photo of a label or receipt to auto-fill.</p>
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isScanning} className="px-5 py-3 bg-white text-sky-700 font-bold rounded-xl shadow-sm border border-sky-200 hover:bg-sky-50 transition flex items-center">
                    {isScanning ? <span className="animate-pulse">Analyzing...</span> : <><Camera className="mr-2 h-4 w-4"/> Auto-Fill from Photo</>}
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleScan} />
            </div>

            {scannedItems.length > 0 && (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                        <h4 className="font-bold text-slate-800 flex items-center"><ListChecks className="mr-2 h-5 w-5 text-sky-600"/> Review Scan Results</h4>
                        <button type="button" onClick={handleSaveAll} className="bg-sky-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-sky-800 shadow-lg shadow-sky-900/20 transition flex items-center">
                            <Save className="mr-2 h-4 w-4"/> Save All Items
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            {scannedImagePreview && <img src={scannedImagePreview} alt="Receipt" className="rounded-2xl border border-slate-200 shadow-sm w-full object-cover" />}
                        </div>
                        <div className="lg:col-span-2 space-y-4">
                            {/* Global Settings */}
                            <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Date</label><input type="date" value={globalDate} onChange={e=>setGlobalDate(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg"/></div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Store</label><input type="text" value={globalStore} onChange={e=>setGlobalStore(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg"/></div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Room</label><select value={globalArea} onChange={e=>setGlobalArea(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg"><option value="General">General</option>{ROOMS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                            </div>
                            
                            {/* Items List */}
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {scannedItems.map((item, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-3 relative">
                                        <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <input type="text" value={item.item} onChange={e=>updateItem(idx,'item',e.target.value)} className="w-full font-bold border-0 border-b border-slate-200 focus:ring-0 px-0 py-1"/>
                                                <div className="flex gap-2 mt-2">
                                                    <input type="text" placeholder="Brand" value={item.brand||''} onChange={e=>updateItem(idx,'brand',e.target.value)} className="w-1/2 text-xs border-0 border-b border-slate-100"/>
                                                    <input type="text" placeholder="Model" value={item.model||''} onChange={e=>updateItem(idx,'model',e.target.value)} className="w-1/2 text-xs border-0 border-b border-slate-100"/>
                                                </div>
                                            </div>
                                            <div>
                                                <select value={item.category} onChange={e=>updateItem(idx,'category',e.target.value)} className="w-full text-xs border-0 border-b border-slate-200"><option>Select Category</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
                                                <select value={item.area||''} onChange={e=>updateItem(idx,'area',e.target.value)} className="w-full text-xs border-0 border-b border-slate-200 mt-2"><option value="">(Global)</option>{ROOMS.map(r=><option key={r} value={r}>{r}</option>)}</select>
                                            </div>
                                        </div>
                                        <button onClick={()=>setScannedItems(prev=>prev.filter((_,i)=>i!==idx))} className="text-slate-300 hover:text-red-500"><XCircle size={20}/></button>
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
