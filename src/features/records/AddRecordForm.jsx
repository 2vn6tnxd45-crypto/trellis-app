// src/features/records/AddRecordForm.jsx
import React, { useState, useEffect } from 'react';
import { ChevronDown, Zap, Wrench, Camera, Pencil, PlusCircle, X, ChevronUp, ChevronRight, FileText, Trash2, Paperclip } from 'lucide-react'; 
import { CATEGORIES, ROOMS, MAINTENANCE_FREQUENCIES, PAINT_SHEENS, ROOF_MATERIALS, FLOORING_TYPES } from '../../config/constants';
import { useGemini } from '../../hooks/useGemini';
import { SmartScan } from './SmartScan';

const DOC_TYPES = ["Photo", "Receipt", "Warranty", "Manual", "Contract", "Other"];

export const AddRecordForm = ({ onSave, onBatchSave, isSaving, newRecord, onInputChange, onAttachmentsChange, isEditing, onCancelEdit }) => {
    const { suggestMaintenance, isSuggesting } = useGemini();
    const [suggestedTasks, setSuggestedTasks] = useState([]);
    const [isCustomArea, setIsCustomArea] = useState(false);
    const [isExpanded, setIsExpanded] = useState(!!isEditing);

    // Local state for attachments to manage UI before lifting up
    const [localAttachments, setLocalAttachments] = useState(newRecord.attachments || []);

    useEffect(() => {
        if (newRecord.area && !ROOMS.includes(newRecord.area)) setIsCustomArea(true);
        else if (!newRecord.area) setIsCustomArea(false);
        // Sync attachments if record changes
        if (newRecord.attachments) setLocalAttachments(newRecord.attachments);
    }, [newRecord]);

    const handleRoomChange = (e) => {
        if (e.target.value === "Other (Custom)") {
            setIsCustomArea(true);
            onInputChange({ target: { name: 'area', value: '' } });
        } else {
            setIsCustomArea(false);
            onInputChange(e);
        }
    };

    const handleSuggest = async () => {
        const result = await suggestMaintenance(newRecord);
        if (result) {
            setIsExpanded(true);
            if (result.frequency) onInputChange({ target: { name: 'maintenanceFrequency', value: result.frequency } });
            if (result.tasks) {
                setSuggestedTasks(result.tasks);
                onInputChange({ target: { name: 'maintenanceTasks', value: result.tasks } });
            }
        }
    };

    const handleAutoFill = (data) => {
        Object.keys(data).forEach(key => {
            onInputChange({ target: { name: key, value: data[key] } });
        });
        setIsExpanded(true);
    };

    // Attachment Handlers
    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            onAttachmentsChange(newFiles); // Pass raw files to parent wrapper
        }
    };

    const removeAttachment = (index) => {
        const updated = [...localAttachments];
        updated.splice(index, 1);
        setLocalAttachments(updated);
        // We'd need a way to tell parent to remove it from the "pending" list too, 
        // but for simplicity in this architecture, we'll handle removals in the wrapper 
        // or just accept that "Add" is additive only for the raw files.
        // For existing (saved) attachments, we update the record state directly:
        onInputChange({ target: { name: 'attachments', value: updated } });
    };

    const updateAttachmentType = (index, type) => {
        const updated = [...localAttachments];
        updated[index].type = type;
        setLocalAttachments(updated);
        onInputChange({ target: { name: 'attachments', value: updated } });
    };

    const showSheen = newRecord.category === "Paint & Finishes";
    const showMaterial = ["Roof & Exterior", "Flooring"].includes(newRecord.category);
    const showSerial = ["Appliances", "HVAC & Systems", "Plumbing", "Electrical"].includes(newRecord.category);

    return (
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
            {!isEditing && <div className="p-10 pb-0"><SmartScan onBatchSave={onBatchSave} onAutoFill={handleAutoFill} /></div>}
            
            <form onSubmit={onSave} className="p-10 pt-6 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-2"> 
                    <h2 className="text-2xl font-bold text-slate-800">{isEditing ? 'Edit Record' : 'Add Item'}</h2> 
                    {isEditing && <button type="button" onClick={onCancelEdit} className="text-sm text-slate-400 hover:text-slate-600 flex items-center font-bold uppercase tracking-wider"><X size={14} className="mr-1"/> Cancel</button>} 
                </div> 

                {/* Quick Add Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Category *</label>
                        <div className="relative">
                            <select name="category" value={newRecord.category} onChange={onInputChange} required className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500 focus:bg-white appearance-none transition-colors">
                                <option value="" disabled>Select</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Area/Room *</label>
                        {!isCustomArea ? (
                            <div className="relative">
                                <select name="area" value={ROOMS.includes(newRecord.area) ? newRecord.area : ""} onChange={handleRoomChange} required className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500 focus:bg-white appearance-none transition-colors">
                                    <option value="" disabled>Select</option>{ROOMS.map(r => <option key={r} value={r}>{r}</option>)}<option value="Other (Custom)">Other (Custom)</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/>
                            </div>
                        ) : (
                            <div className="relative flex">
                                <input type="text" name="area" value={newRecord.area} onChange={onInputChange} required autoFocus placeholder="e.g. Guest House" className="block w-full rounded-l-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500"/>
                                <button type="button" onClick={() => {setIsCustomArea(false); onInputChange({target:{name:'area', value:''}})}} className="px-4 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl hover:bg-slate-200"><X size={18}/></button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Item Name *</label><input type="text" name="item" value={newRecord.item} onChange={onInputChange} required placeholder="e.g. North Wall" className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500 focus:bg-white"/></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Date Installed</label><input type="date" name="dateInstalled" value={newRecord.dateInstalled} onChange={onInputChange} className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500"/></div>
                </div>

                {/* --- NEW: Attachments Section --- */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Documents & Photos</label>
                        <label className="cursor-pointer text-xs flex items-center bg-sky-50 text-sky-700 px-3 py-1.5 rounded-full border border-sky-100 hover:bg-sky-100 transition-colors font-bold uppercase tracking-wide">
                            <PlusCircle size={12} className="mr-1"/> Add File
                            <input type="file" multiple onChange={handleFileSelect} className="hidden" />
                        </label>
                    </div>
                    
                    {localAttachments.length > 0 ? (
                        <div className="space-y-2 mb-4">
                            {localAttachments.map((att, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center border border-slate-100 shrink-0">
                                        {att.type === 'Photo' ? <Camera size={16} className="text-slate-400"/> : <FileText size={16} className="text-slate-400"/>}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <p className="text-sm font-bold text-slate-700 truncate">{att.name || "Untitled"}</p>
                                        <p className="text-xs text-slate-400">{Math.round((att.size || 0) / 1024)} KB</p>
                                    </div>
                                    <select 
                                        value={att.type} 
                                        onChange={(e) => updateAttachmentType(idx, e.target.value)}
                                        className="text-xs border-slate-200 rounded-lg p-1.5 bg-white focus:ring-0"
                                    >
                                        {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <button type="button" onClick={() => removeAttachment(idx)} className="p-2 text-slate-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 text-center relative">
                            <div className="text-slate-400"><Paperclip size={24} className="mx-auto mb-2"/></div>
                            <p className="text-sm font-bold text-slate-500">No documents attached</p>
                            <p className="text-xs text-slate-400">Upload warranties, receipts, or manuals.</p>
                        </div>
                    )}
                </div>

                {/* Toggle Details */}
                <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="flex items-center text-sm font-bold text-sky-600 hover:text-sky-800 transition-colors w-full justify-center py-2 bg-sky-50/50 rounded-lg hover:bg-sky-50">
                    {isExpanded ? <><ChevronUp size={16} className="mr-1"/> Hide Details</> : <><ChevronRight size={16} className="mr-1"/> Add Details, Specs & Maintenance</>}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Brand</label><input type="text" name="brand" value={newRecord.brand} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm bg-white"/></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Model</label><input type="text" name="model" value={newRecord.model} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm bg-white"/></div>
                            {showSheen && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sheen</label><select name="sheen" value={newRecord.sheen} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm bg-white"><option value="">Select</option>{PAINT_SHEENS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>}
                            {showSerial && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Serial #</label><input type="text" name="serialNumber" value={newRecord.serialNumber} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm bg-white"/></div>}
                            {showMaterial && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Material</label><select name="material" value={newRecord.material} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm bg-white"><option value="">Select</option>{(newRecord.category==="Roof & Exterior"?ROOF_MATERIALS:FLOORING_TYPES).map(m=><option key={m} value={m}>{m}</option>)}</select></div>}
                        </div>

                        <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Contractor / Store</label><input type="text" name="contractor" value={newRecord.contractor} onChange={onInputChange} className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500"/></div>

                        <div className="border-t border-slate-100 pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Maintenance Schedule</label>
                                <button type="button" onClick={handleSuggest} disabled={isSuggesting} className="text-xs flex items-center bg-sky-50 text-sky-700 px-3 py-1.5 rounded-full border border-sky-100 hover:bg-sky-100 transition-colors font-bold uppercase tracking-wide">
                                    {isSuggesting ? <span className="animate-pulse">Thinking...</span> : <><Zap size={12} className="mr-1 fill-sky-700"/> Auto-Suggest</>}
                                </button>
                            </div>
                            <div className="relative">
                                <select name="maintenanceFrequency" value={newRecord.maintenanceFrequency} onChange={onInputChange} className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500 appearance-none">
                                    {MAINTENANCE_FREQUENCIES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/>
                            </div>
                            {suggestedTasks.length > 0 && <div className="mt-4 p-4 bg-sky-50 rounded-xl border border-sky-100 text-sm"><p className="font-bold text-sky-900 mb-2 flex items-center"><Wrench size={14} className="mr-2"/> Suggested Tasks:</p><ul className="list-disc pl-5 space-y-1 text-sky-800">{suggestedTasks.map((task, i) => <li key={i}>{task}</li>)}</ul></div>}
                        </div>

                        <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Product Link</label><input type="url" name="purchaseLink" value={newRecord.purchaseLink} onChange={onInputChange} placeholder="https://..." className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Notes</label><textarea name="notes" rows="3" value={newRecord.notes} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border resize-none"></textarea></div>
                    </div>
                )}
                
                <button type="submit" disabled={isSaving} className="w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-xl shadow-lg shadow-sky-900/10 text-base font-bold text-white bg-sky-900 hover:bg-sky-800 disabled:opacity-50 transition-transform active:scale-[0.98]"> {isSaving ? 'Saving...' : (isEditing ? <><Pencil size={18} className="mr-2"/> Update Record</> : <><PlusCircle size={18} className="mr-2"/> Log Item</>)} </button>
            </form>
        </div>
    );
};
