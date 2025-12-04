// src/features/records/AddRecordForm.jsx
import React, { useState, useEffect } from 'react';
import { ChevronDown, Zap, Wrench, Camera, Pencil, PlusCircle, X } from 'lucide-react';
import { CATEGORIES, ROOMS, MAINTENANCE_FREQUENCIES, PAINT_SHEENS, ROOF_MATERIALS, FLOORING_TYPES } from '../../config/constants';
import { useGemini } from '../../hooks/useGemini';
import { SmartScan } from './SmartScan';

export const AddRecordForm = ({ onSave, onBatchSave, isSaving, newRecord, onInputChange, onFileChange, fileInputRef, isEditing, onCancelEdit }) => {
    const { suggestMaintenance, isSuggesting } = useGemini();
    const [suggestedTasks, setSuggestedTasks] = useState([]);
    const [isCustomArea, setIsCustomArea] = useState(false);

    useEffect(() => {
        if (newRecord.area && !ROOMS.includes(newRecord.area)) setIsCustomArea(true);
        else if (!newRecord.area) setIsCustomArea(false);
    }, [newRecord.area]);

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
    };

    const showSheen = newRecord.category === "Paint & Finishes";
    const showMaterial = ["Roof & Exterior", "Flooring"].includes(newRecord.category);
    const showSerial = ["Appliances", "HVAC & Systems", "Plumbing", "Electrical"].includes(newRecord.category);

    return (
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
            {/* Include Smart Scan at the top */}
            {!isEditing && <div className="p-10 pb-0"><SmartScan onBatchSave={onBatchSave} onAutoFill={handleAutoFill} /></div>}
            
            <form onSubmit={onSave} className="p-10 pt-6 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-2"> 
                    <h2 className="text-2xl font-bold text-slate-800">{isEditing ? 'Edit Record' : 'Manual Entry'}</h2> 
                    {isEditing && <button type="button" onClick={onCancelEdit} className="text-sm text-slate-400 hover:text-slate-600 flex items-center font-bold uppercase tracking-wider"><X size={14} className="mr-1"/> Cancel</button>} 
                </div> 

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Category *</label>
                        <div className="relative">
                            <select name="category" value={newRecord.category} onChange={onInputChange} required className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500 focus:bg-white appearance-none">
                                <option value="" disabled>Select</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Area/Room *</label>
                        {!isCustomArea ? (
                            <div className="relative">
                                <select name="area" value={ROOMS.includes(newRecord.area) ? newRecord.area : ""} onChange={handleRoomChange} required className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500 focus:bg-white appearance-none">
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

                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Item Name *</label><input type="text" name="item" value={newRecord.item} onChange={onInputChange} required placeholder="e.g. North Wall" className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500 focus:bg-white"/></div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Brand</label><input type="text" name="brand" value={newRecord.brand} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm"/></div>
                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Model</label><input type="text" name="model" value={newRecord.model} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm"/></div>
                    {showSheen && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sheen</label><select name="sheen" value={newRecord.sheen} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm"><option value="">Select</option>{PAINT_SHEENS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>}
                    {showSerial && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Serial #</label><input type="text" name="serialNumber" value={newRecord.serialNumber} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm"/></div>}
                    {showMaterial && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Material</label><select name="material" value={newRecord.material} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm"><option value="">Select</option>{(newRecord.category==="Roof & Exterior"?ROOF_MATERIALS:FLOORING_TYPES).map(m=><option key={m} value={m}>{m}</option>)}</select></div>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Date Installed</label><input type="date" name="dateInstalled" value={newRecord.dateInstalled} onChange={onInputChange} className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500"/></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Contractor</label><input type="text" name="contractor" value={newRecord.contractor} onChange={onInputChange} className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500"/></div>
                </div>

                {/* Maintenance Section with AI Button */}
                <div>
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
                    {suggestedTasks.length > 0 && (
                        <div className="mt-4 p-4 bg-sky-50 rounded-xl border border-sky-100 text-sm">
                            <p className="font-bold text-sky-900 mb-2 flex items-center"><Wrench size={14} className="mr-2"/> Suggested Tasks:</p>
                            <ul className="list-disc pl-5 space-y-1 text-sky-800">{suggestedTasks.map((task, i) => <li key={i}>{task}</li>)}</ul>
                        </div>
                    )}
                </div>

                {/* File Upload & Notes */}
                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Product Link</label><input type="url" name="purchaseLink" value={newRecord.purchaseLink} onChange={onInputChange} className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500"/></div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 hover:border-sky-400 hover:bg-sky-50 transition-colors text-center cursor-pointer relative group">
                    <label className="block text-sm font-bold text-slate-600 mb-2 group-hover:text-sky-700 pointer-events-none">Upload Receipt or Photo</label>
                    <input type="file" accept="image/*" onChange={onFileChange} ref={fileInputRef} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                    <div className="text-slate-400 group-hover:text-sky-400"><Camera size={24} className="mx-auto mb-2"/></div>
                    <p className="text-xs text-slate-400 group-hover:text-sky-500">Max 1MB</p>
                </div>
                {newRecord.imageUrl && <div className="p-4 bg-sky-50 rounded-xl border border-sky-100"><img src={newRecord.imageUrl} alt="Current" className="h-32 rounded-lg object-cover"/></div>}
                <div><label className="block text-sm font-medium text-gray-700">Notes</label><textarea name="notes" rows="3" value={newRecord.notes} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border resize-none"></textarea></div>
                
                <button type="submit" disabled={isSaving} className="w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-xl shadow-lg shadow-sky-900/10 text-base font-bold text-white bg-sky-900 hover:bg-sky-800 disabled:opacity-50 transition-transform active:scale-[0.98]"> {isSaving ? 'Saving...' : (isEditing ? <><Pencil size={18} className="mr-2"/> Update Record</> : <><PlusCircle size={18} className="mr-2"/> Log New Item</>)} </button>
            </form>
        </div>
    );
};
