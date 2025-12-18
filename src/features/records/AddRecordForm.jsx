// src/features/records/AddRecordForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Zap, Wrench, Camera, Pencil, PlusCircle, X, ChevronRight, FileText, Trash2, Paperclip, Armchair, Loader2, Save, ListChecks, Tag, Info, ScanLine, ArrowLeft, CheckCircle2, Image as ImageIcon, AlertTriangle, ExternalLink, Sparkles, MapPin } from 'lucide-react'; 
import toast from 'react-hot-toast';
import { CATEGORIES, ROOMS, MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { useGemini } from '../../hooks/useGemini';
import { SmartScanner } from '../scanner/SmartScanner';
import { compressImage } from '../../lib/images';

const StepIndicator = ({ currentStep, totalSteps }) => (
    <div className="flex items-center gap-2 mb-6">{Array.from({ length: totalSteps }).map((_, i) => (<div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i + 1 <= currentStep ? 'bg-emerald-500' : 'bg-slate-100'}`} />))}</div>
);

export const AddRecordForm = ({ onSave, onBatchSave, isSaving, newRecord, onInputChange, onAttachmentsChange, isEditing, onCancelEdit, existingRecords = [] }) => {
    const { suggestMaintenance, scanRoom, isSuggesting } = useGemini();
    const [step, setStep] = useState(isEditing ? 2 : 1);
    
    // Batch Mode State
    const hasBatchItems = newRecord.isBatch && newRecord.items && newRecord.items.length > 0;
    const [scanMode, setScanMode] = useState(hasBatchItems ? 'room-results' : null);
    const [roomScanResults, setRoomScanResults] = useState(hasBatchItems ? newRecord.items : []);
    
    const [showSmartScanner, setShowSmartScanner] = useState(false);
    const [suggestedTasks, setSuggestedTasks] = useState([]);
    const [isCustomArea, setIsCustomArea] = useState(false);
    const [localAttachments, setLocalAttachments] = useState(newRecord.attachments || []);
    
    const roomInputRef = useRef(null);
    const photoInputRef = useRef(null);
    const [roomScanFile, setRoomScanFile] = useState(null);

    useEffect(() => {
        const hasBatch = newRecord.isBatch && newRecord.items && newRecord.items.length > 0;
        if (hasBatch) {
            setRoomScanResults(newRecord.items);
            setScanMode('room-results');
            if (newRecord.attachments && newRecord.attachments.length > 0 && newRecord.attachments[0].fileRef) {
                setRoomScanFile(newRecord.attachments[0].fileRef);
            }
        }
        
        if (newRecord.area && !ROOMS.includes(newRecord.area)) setIsCustomArea(true);
        else if (!newRecord.area) setIsCustomArea(false);
        if (newRecord.attachments) setLocalAttachments(newRecord.attachments);
    }, [newRecord]);

    const handleNext = () => setStep(s => s + 1);
    const handleBack = () => setStep(s => s - 1);

    const checkDuplicate = (itemName) => {
        if (!itemName) return false;
        const match = existingRecords.find(r => 
            r.item.toLowerCase().includes(itemName.toLowerCase()) || 
            itemName.toLowerCase().includes(r.item.toLowerCase())
        );
        return match;
    };

    const handleSmartScanComplete = (data) => {
        setShowSmartScanner(false);
        
        if (data.items && data.items.length > 1) {
            setRoomScanResults(data.items);
            setScanMode('room-results');
            if (data.attachments && data.attachments.length > 0 && data.attachments[0].fileRef) {
                setRoomScanFile(data.attachments[0].fileRef);
            }
            toast.success(`Imported ${data.items.length} items from scan!`);
        } 
        else {
            const singleItem = data.items?.[0] || {};
            const fieldsToUpdate = {
                item: singleItem.item || data.item || '',
                category: singleItem.category || data.category || '',
                brand: singleItem.brand || data.brand || '',
                model: singleItem.model || data.model || '',
                cost: singleItem.cost || data.cost || '',
                dateInstalled: data.date || new Date().toISOString().split('T')[0],
                contractor: data.store || data.contractor || '',
                warranty: data.warranty || '',
                maintenanceFrequency: singleItem.maintenanceFrequency || 'none',
                notes: singleItem.notes || '',
                attachments: data.attachments || [],
                contractorPhone: data.contractorPhone,
                contractorEmail: data.contractorEmail,
                contractorAddress: data.contractorAddress
            };

            Object.keys(fieldsToUpdate).forEach(key => {
                onInputChange({ target: { name: key, value: fieldsToUpdate[key] } });
            });
            if (data.attachments) setLocalAttachments(data.attachments);
            setStep(2);
            toast.success("Details auto-filled!");
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const newAtts = [...(localAttachments || [])];
        newAtts.push({ fileRef: file, name: "Item Photo", type: "Photo", size: file.size, preview: URL.createObjectURL(file) });
        onAttachmentsChange(newAtts.map(a => a.fileRef || a));
        setLocalAttachments(newAtts);
        toast.success("Photo added!");
        setStep(2);
    };

    const handleRoomScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setRoomScanFile(file);
        const loadingToast = toast.loading("Analyzing room...");
        try {
            const base64Str = await compressImage(file);
            const data = await scanRoom([file], [base64Str]); 
            if (data && data.items) {
                setRoomScanResults(data.items);
                toast.success(`Found ${data.items.length} items!`);
                setScanMode('room-results');
            } else toast.error("Could not identify items.");
        } catch (err) { console.error(err); toast.error("Scan failed."); } finally { toast.dismiss(loadingToast); if (roomInputRef.current) roomInputRef.current.value = ""; }
    };

    const handleSaveRoomItems = async () => {
        if (roomScanResults.length === 0) return;
        await onBatchSave(roomScanResults, roomScanFile);
        setRoomScanResults([]); setRoomScanFile(null); setScanMode(null);
    };

    const handleRoomChange = (e) => {
        if (e.target.value === "Other (Custom)") { setIsCustomArea(true); onInputChange({ target: { name: 'area', value: '' } }); } 
        else { setIsCustomArea(false); onInputChange(e); }
    };

    const handleSuggest = async () => {
        const result = await suggestMaintenance(newRecord);
        if (result) {
            if (result.frequency) onInputChange({ target: { name: 'maintenanceFrequency', value: result.frequency } });
            if (result.tasks) { setSuggestedTasks(result.tasks); toast.success("Maintenance updated!"); }
        }
    };

    const removeAttachment = (index) => {
        const updated = [...localAttachments]; updated.splice(index, 1);
        setLocalAttachments(updated); onInputChange({ target: { name: 'attachments', value: updated } });
    };

    if (showSmartScanner) {
        return <SmartScanner onClose={() => setShowSmartScanner(false)} onProcessComplete={handleSmartScanComplete} />;
    }

    if (scanMode === 'room-results') {
        return (
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-6 bg-slate-50 border-b border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div><h3 className="font-bold text-slate-800 text-lg flex items-center"><ListChecks className="mr-2 h-5 w-5 text-emerald-600"/> Batch Results</h3><p className="text-sm text-slate-500">We found {roomScanResults.length} items. Review before saving.</p></div>
                        <div className="flex gap-2"><button onClick={() => { setScanMode(null); onCancelEdit(); }} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancel</button><button onClick={handleSaveRoomItems} disabled={isSaving} className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center">{isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Save className="mr-2 h-4 w-4"/>} Save All</button></div>
                    </div>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                    {roomScanResults.map((item, idx) => {
                        const duplicate = checkDuplicate(item.item);
                        return (
                            <div key={idx} className={`flex flex-col gap-2 p-4 border rounded-xl items-start ${duplicate ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                                <div className="flex flex-col md:flex-row gap-4 w-full">
                                    <div className="bg-slate-100 p-2 rounded-lg h-fit hidden md:block"><Tag size={16} className="text-slate-400"/></div>
                                    
                                    {/* Item Name */}
                                    <div className="flex-grow">
                                        <input value={item.item} onChange={(e) => { const u = [...roomScanResults]; u[idx].item = e.target.value; setRoomScanResults(u); }} className="w-full font-bold text-slate-800 border-b border-slate-200 focus:border-emerald-500 outline-none p-1 bg-transparent" placeholder="Item Name"/>
                                    </div>

                                    {/* Category Select */}
                                    <div className="w-full md:w-1/4">
                                        <select value={item.category} onChange={(e) => { const u = [...roomScanResults]; u[idx].category = e.target.value; setRoomScanResults(u); }} className="w-full text-sm text-slate-500 border-b border-slate-200 focus:border-emerald-500 outline-none p-1 bg-transparent">
                                            <option value="">Category...</option>
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    
                                    {/* NEW: Area Select */}
                                    <div className="w-full md:w-1/4">
                                        <select value={item.area || ''} onChange={(e) => { const u = [...roomScanResults]; u[idx].area = e.target.value; setRoomScanResults(u); }} className="w-full text-sm text-slate-500 border-b border-slate-200 focus:border-emerald-500 outline-none p-1 bg-transparent">
                                            <option value="">Area...</option>
                                            {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>

                                    <button onClick={() => { const u = [...roomScanResults]; u.splice(idx, 1); setRoomScanResults(u); }} className="text-slate-300 hover:text-red-500 md:self-center"><X size={18}/></button>
                                </div>
                                {duplicate && (
                                    <div className="flex items-center text-xs text-amber-600 md:ml-12">
                                        <AlertTriangle size={12} className="mr-1"/>
                                        <span>Possible duplicate: You already have "{duplicate.item}".</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ... (The rest of the standard form Step 1/2/3 remains unchanged below)
    return (
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10"><div><h2 className="text-xl font-bold text-slate-800">{isEditing ? 'Edit Item' : 'Add New Item'}</h2>{!isEditing && <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Step {step} of 3</p>}</div>{isEditing ? <button type="button" onClick={onCancelEdit} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button> : <button type="button" onClick={onCancelEdit} className="text-sm font-bold text-slate-400 hover:text-slate-600">Cancel</button>}</div>
            {!isEditing && <div className="px-6 pt-6"><StepIndicator currentStep={step} totalSteps={3} /></div>}
            <div className="overflow-y-auto p-6 pt-2 flex-grow">
                <form id="recordForm" onSubmit={onSave} className="space-y-6">
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 text-center">How do you want to add this item?</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button type="button" onClick={() => setShowSmartScanner(true)} className="group p-6 rounded-2xl border-2 border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300 transition-all text-left flex flex-col gap-3">
                                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><ScanLine className="text-emerald-600" size={24} /></div>
                                    <div><p className="font-bold text-emerald-900">Scan Receipt</p><p className="text-xs text-emerald-700/80 mt-1">Extract info automatically</p></div>
                                </button>
                                <button type="button" onClick={() => photoInputRef.current?.click()} className="group p-6 rounded-2xl border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left flex flex-col gap-3">
                                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><ImageIcon className="text-blue-600" size={24} /></div>
                                    <div><p className="font-bold text-slate-800">Upload Photo</p><p className="text-xs text-slate-500 mt-1">Take a picture of the item</p></div>
                                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                </button>
                            </div>
                            <button type="button" onClick={() => setStep(2)} className="w-full p-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-sm transition-colors flex items-center justify-center"><Pencil className="mr-2 h-4 w-4" /> Type Manually</button>
                            <div className="pt-6 border-t border-slate-50 text-center"><p className="text-xs text-slate-400 mb-3">Adding multiple items?</p><button type="button" onClick={() => roomInputRef.current?.click()} className="text-indigo-600 font-bold text-sm hover:underline flex items-center justify-center"><Armchair className="mr-1.5 h-4 w-4" /> Scan a whole room</button><input ref={roomInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleRoomScan} /></div>
                        </div>
                    )}
                    {(step === 2 || isEditing) && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            
                            {/* ATTACHMENT GALLERY */}
                            {localAttachments.length > 0 && (
                                <div className="space-y-3 mb-4">
                                    <div className="flex justify-between items-end">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Attached Documents</label>
                                        <button type="button" onClick={() => photoInputRef.current?.click()} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center">
                                            <PlusCircle size={14} className="mr-1"/> Add Another
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {localAttachments.map((att, index) => {
                                            const displayUrl = att.preview || att.url;
                                            const isImage = (att.type?.includes('image') || att.type === 'Photo') || (displayUrl && (displayUrl.includes('.jpg') || displayUrl.includes('.png') || displayUrl.includes('.jpeg')));
                                            
                                            return (
                                                <div key={index} className="relative group bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                                                    <div className="h-32 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                                                        {displayUrl && isImage ? (
                                                            <img src={displayUrl} alt={att.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                                                                <FileText className="h-8 w-8 mb-2" />
                                                                <span className="text-[10px] font-bold uppercase">Document</span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                                                            {displayUrl && (
                                                                <a href={displayUrl} target="_blank" rel="noreferrer" className="p-2 bg-white rounded-full text-slate-700 shadow-sm hover:text-emerald-600 hover:scale-110 transition-all" title="View Original"><ExternalLink size={16} /></a>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="p-2 bg-white border-t border-slate-100 flex justify-between items-center">
                                                        <span className="text-xs font-bold text-slate-700 truncate max-w-[80%]">{att.name || 'File'}</span>
                                                        <button type="button" onClick={() => removeAttachment(index)} className="text-slate-400 hover:text-red-500 transition-colors p-1"><Trash2 size={14} /></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {localAttachments.length === 0 && (
                                <button type="button" onClick={() => photoInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2">
                                    <Paperclip size={16} /> Attach Photo or Document
                                </button>
                            )}
                            <input ref={photoInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handlePhotoUpload} />

                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">What is it? *</label><input type="text" name="item" value={newRecord.item} onChange={onInputChange} required placeholder="e.g. Living Room Sofa" className="block w-full rounded-xl border-slate-200 bg-slate-50 p-4 border focus:ring-emerald-500 focus:bg-white transition-all font-bold text-lg text-slate-800 placeholder:font-normal"/></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Category *</label><div className="relative"><select name="category" value={newRecord.category} onChange={onInputChange} required className="block w-full rounded-xl border-slate-200 bg-white p-3 border focus:ring-emerald-500 appearance-none text-sm font-medium"><option value="" disabled>Select...</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown size={16} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none"/></div></div><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Area *</label>{!isCustomArea ? (<div className="relative"><select name="area" value={ROOMS.includes(newRecord.area) ? newRecord.area : ""} onChange={handleRoomChange} required className="block w-full rounded-xl border-slate-200 bg-white p-3 border focus:ring-emerald-500 appearance-none text-sm font-medium"><option value="" disabled>Select...</option>{ROOMS.map(r => <option key={r} value={r}>{r}</option>)}<option value="Other (Custom)">Other...</option></select><ChevronDown size={16} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none"/></div>) : (<div className="flex"><input type="text" name="area" value={newRecord.area} onChange={onInputChange} required autoFocus placeholder="Name..." className="block w-full rounded-l-xl border-slate-200 bg-white p-3 border focus:ring-emerald-500 text-sm"/><button type="button" onClick={() => {setIsCustomArea(false); onInputChange({target:{name:'area', value:''}})}} className="px-3 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl hover:bg-slate-200"><X size={16}/></button></div>)}</div></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Date Installed</label><input type="date" name="dateInstalled" value={newRecord.dateInstalled} onChange={onInputChange} className="block w-full rounded-xl border-slate-200 bg-white p-3 border focus:ring-emerald-500 text-sm text-slate-600"/></div>
                            {!isEditing && <button type="button" onClick={handleNext} disabled={!newRecord.item || !newRecord.category} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-lg">Next: Add Details <ChevronRight size={16} className="ml-2"/></button>}
                        </div>
                    )}
                    {(step === 3 || isEditing) && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center"><Tag size={12} className="mr-1"/> Product Specs</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Brand</label><input type="text" name="brand" value={newRecord.brand} onChange={onInputChange} placeholder="e.g. Samsung" className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm bg-white"/></div><div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Model</label><input type="text" name="model" value={newRecord.model} onChange={onInputChange} placeholder="Model #" className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm bg-white"/></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cost ($)</label><input type="number" name="cost" value={newRecord.cost} onChange={onInputChange} placeholder="0.00" className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm bg-white"/></div><div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Contractor</label><input type="text" name="contractor" value={newRecord.contractor} onChange={onInputChange} placeholder="Company Name" className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm bg-white"/></div></div></div>
                            
                            <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center"><Wrench size={12} className="mr-1"/> Maintenance</h4>
                                    
                                    {newRecord.maintenanceFrequency !== 'none' && (
                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold flex items-center">
                                            <Sparkles size={10} className="mr-1"/> Auto-Scheduled
                                        </span>
                                    )}
                                    
                                    <button type="button" onClick={handleSuggest} disabled={isSuggesting} className="text-[10px] font-bold text-emerald-600 bg-white px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-50 shadow-sm flex items-center ml-2">
                                        {isSuggesting ? <Loader2 className="animate-spin h-3 w-3 mr-1"/> : <Zap className="h-3 w-3 mr-1 fill-emerald-600"/>} AI Suggest
                                    </button>
                                </div>
                                <div className="relative">
                                    <select name="maintenanceFrequency" value={newRecord.maintenanceFrequency} onChange={onInputChange} className="block w-full rounded-xl border-emerald-200 bg-white p-3 border focus:ring-emerald-500 appearance-none text-sm font-medium text-emerald-900">
                                        {MAINTENANCE_FREQUENCIES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-3.5 text-emerald-400 pointer-events-none"/>
                                </div>
                                {suggestedTasks.length > 0 && (<div className="bg-white p-3 rounded-xl border border-emerald-100 text-xs text-emerald-800"><p className="font-bold mb-1">Recommended Tasks:</p><ul className="list-disc pl-4 space-y-0.5">{suggestedTasks.map((t,i) => <li key={i}>{t}</li>)}</ul></div>)}
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Warranty Information</label>
                                <input type="text" name="warranty" value={newRecord.warranty || ''} onChange={onInputChange} placeholder="e.g. 10 Year Parts, 1 Year Labor" className="block w-full rounded-xl border-slate-200 bg-white p-3 border focus:ring-emerald-500 text-sm" />
                            </div>

                            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Notes</label><textarea name="notes" value={newRecord.notes} onChange={onInputChange} rows={3} className="block w-full rounded-xl border-slate-200 bg-white p-3 border focus:ring-emerald-500 text-sm resize-none" placeholder="Add details..."></textarea></div>
                            <div className="flex gap-3 pt-2">{!isEditing && <button type="button" onClick={handleBack} className="px-6 py-4 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Back</button>}<button type="submit" disabled={isSaving} className="flex-grow py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center transition-all active:scale-[0.98]">{isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : (isEditing ? 'Save Changes' : 'Complete Setup')}</button></div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};
