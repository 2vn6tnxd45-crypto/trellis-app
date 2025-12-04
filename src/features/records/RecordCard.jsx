// src/features/records/RecordCard.jsx
import React from 'react';
import { Home, ShieldAlert, ShieldCheck, AlertCircle, Loader2, Pencil, Trash2 } from 'lucide-react';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { useRecalls } from '../../hooks/useRecalls';

export const RecordCard = ({ record, onDeleteClick, onEditClick }) => {
    const { checkSafety, status: recallStatus, loading: checkingRecall } = useRecalls();

    const handleCheckSafety = (e) => {
        e.stopPropagation();
        checkSafety(record.brand, record.model);
    };

    return (
        <div onClick={() => onEditClick(record)} className="bg-white p-0 rounded-[1.5rem] shadow-sm border border-slate-100 transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-slate-200 duration-300 cursor-pointer group relative overflow-hidden"> 
            {record.imageUrl && <div className="h-48 w-full bg-gray-100 relative group print:h-32 rounded-t-[1.5rem] -mt-0 -mx-0 mb-6"><img src={record.imageUrl} alt={record.item} className="w-full h-full object-cover"/></div>} 
            <div className={`p-8 ${record.imageUrl ? 'pt-0' : ''} flex flex-col`}> 
                <div className="flex justify-between items-start mb-6"> 
                    <div className="p-2.5 rounded-full bg-slate-100 text-slate-500 group-hover:bg-sky-900 group-hover:text-white transition-colors duration-300"> <Home size={20} /> </div> 
                    <div className="flex gap-2">
                        {recallStatus && recallStatus.status !== 'clean' && (
                            <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center ${recallStatus.status === 'warning' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {recallStatus.status === 'warning' ? <><ShieldAlert size={12} className="mr-1"/> Recall Found</> : <><AlertCircle size={12} className="mr-1"/> Check Manually</>}
                            </span>
                        )}
                        {recallStatus && recallStatus.status === 'clean' && (
                            <span className="px-2 py-1 rounded-full text-xs font-bold flex items-center bg-green-100 text-green-700">
                                <ShieldCheck size={12} className="mr-1"/> No Recall Found
                            </span>
                        )}
                        <span className="bg-white border border-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{String(record.category || 'General')}</span> 
                    </div>
                </div> 
                <div className="mb-4"> 
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 group-hover:text-sky-500 transition-colors">Item</p> 
                    <h2 className="text-2xl font-bold text-slate-800 group-hover:text-slate-900 leading-tight">{String(record.item || 'Unknown')}</h2> 
                </div> 
                <div className="space-y-2 mb-6"> 
                    {record.brand && <p className="text-slate-500 text-sm flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2"></span>{record.brand}</p>} 
                    {record.dateInstalled && <p className="text-slate-500 text-sm flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2"></span>{record.dateInstalled}</p>} 
                    {record.model && <p className="text-slate-500 text-sm flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2"></span>Model: {record.model}</p>}
                </div> 
                
                <div className="mb-4">
                    {!recallStatus && (
                        <button onClick={handleCheckSafety} disabled={checkingRecall} className="text-xs flex items-center text-slate-400 hover:text-sky-600 transition font-bold">
                            {checkingRecall ? <Loader2 className="animate-spin mr-1 h-3 w-3"/> : <ShieldCheck className="mr-1 h-3 w-3"/>} 
                            {record.model ? "Check Safety Status" : "Add Model # to Check Safety"}
                        </button>
                    )}
                    {recallStatus?.url && (
                        <a href={recallStatus.url} target="_blank" rel="noreferrer" className="text-xs text-red-600 underline hover:text-red-800 font-bold" onClick={e => e.stopPropagation()}>View Recall Report</a>
                    )}
                </div>

                <div className="flex justify-between items-center border-t border-slate-50 pt-4 mt-auto"> 
                    <div className="flex gap-2"> 
                        <button onClick={(e) => { e.stopPropagation(); onEditClick(record); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-sky-600 transition"><Pencil size={16}/></button> 
                        <button onClick={(e) => { e.stopPropagation(); onDeleteClick(record.id); }} className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition"><Trash2 size={16}/></button> 
                    </div> 
                    {record.maintenanceFrequency !== 'none' && <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded-md">{MAINTENANCE_FREQUENCIES.find(f=>f.value===record.maintenanceFrequency)?.label}</span>} 
                </div> 
            </div> 
        </div> 
    );
};
