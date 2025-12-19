// src/features/dashboard/MaintenanceDashboard.jsx
import React, { useMemo, useState } from 'react';
import { 
    Zap, Calendar, CheckCircle, Clock, PlusCircle, ChevronRight, 
    Wrench, AlertTriangle, Sparkles, TrendingUp, History, Archive, 
    ArrowRight, Check, X, Phone, MessageCircle, Mail, User, Hourglass,
    Trash2, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MAINTENANCE_FREQUENCIES, STANDARD_MAINTENANCE_ITEMS } from '../../config/constants';
import { useHomeHealth } from '../../hooks/useHomeHealth'; 
import { toProperCase } from '../../lib/utils';

// --- HELPER FUNCTIONS ---

const getNextServiceDate = (record) => {
    if (!record.dateInstalled || record.maintenanceFrequency === 'none') return null;
    const freq = MAINTENANCE_FREQUENCIES.find(f => f.value === record.maintenanceFrequency);
    if (!freq || freq.months === 0) return null;
    const installed = new Date(record.dateInstalled);
    const next = new Date(installed);
    next.setMonth(next.getMonth() + freq.months);
    const now = new Date();
    while (next < now) next.setMonth(next.getMonth() + freq.months);
    return next;
};

const cleanPhoneForLink = (phone) => {
    if (!phone) return '';
    return phone.replace(/[^\d+]/g, '');
};

// --- SUB-COMPONENTS ---

const MaintenanceCard = ({ task, isOverdue, onBook, onComplete }) => {
    const cleanPhone = cleanPhoneForLink(task.contractorPhone);
    const hasPhone = !!cleanPhone;
    const hasEmail = !!task.contractorEmail;
    
    const formattedDate = task.nextDate 
        ? task.nextDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Pending';

    return (
        <div className={`p-4 rounded-2xl border ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'} transition-all hover:shadow-sm`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isOverdue ? 'bg-white text-red-500 shadow-sm' : 'bg-slate-50 text-emerald-600'}`}>
                        <Wrench size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">{task.taskName}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                            <span>{task.item}</span>
                            <span>•</span>
                            <span>{toProperCase(task.frequency)}</span>
                        </div>
                    </div>
                </div>
                
                <div className="text-right">
                    {isOverdue ? (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                            {Math.abs(task.daysUntil)} days overdue
                        </span>
                    ) : (
                        <span className="text-xs font-medium text-slate-500">
                            {formattedDate}
                        </span>
                    )}
                </div>
            </div>

            {task.contractor && (
                <div className="bg-slate-50 rounded-xl p-3 mb-3 flex items-center gap-2">
                    <User size={14} className="text-slate-400" />
                    <span className="text-xs font-medium text-slate-600">{task.contractor}</span>
                    {task.contractorPhone && (
                        <span className="text-xs text-slate-400">• {task.contractorPhone}</span>
                    )}
                </div>
            )}

            <div className="flex gap-2">
                {(hasPhone || hasEmail) ? (
                    <div className="flex gap-2 flex-1">
                        {hasPhone && (
                            <>
                                <a href={`tel:${cleanPhone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                                    <Phone size={14} /> Call
                                </a>
                                <a href={`sms:${cleanPhone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                                    <MessageCircle size={14} /> Text
                                </a>
                            </>
                        )}
                        {hasEmail && (
                            <a href={`mailto:${task.contractorEmail}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors">
                                <Mail size={14} /> Email
                            </a>
                        )}
                    </div>
                ) : (
                    <button onClick={() => onBook && onBook(task)} className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                        <Phone size={14} /> Book Pro
                    </button>
                )}
                
                <button onClick={() => onComplete && onComplete(task)} className="flex items-center justify-center gap-2 py-2 px-4 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors shadow-sm active:scale-95">
                    <Check size={14} /> Mark Done
                </button>
            </div>
        </div>
    );
};

// UPDATED: Added debugging and safer handlers
const HistoryItemCard = ({ item, onDelete, onRestore }) => {
    const [showConfirm, setShowConfirm] = useState(false);

    const handleDelete = (e) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(item);
        } else {
            console.error("HistoryItemCard: onDelete prop is missing");
            toast.error("Error: Delete function not connected");
        }
        setShowConfirm(false);
    };

    const handleRestore = (e) => {
        e.stopPropagation();
        if (onRestore) {
            onRestore(item);
        } else {
            console.error("HistoryItemCard: onRestore prop is missing");
            toast.error("Error: Restore function not connected");
        }
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4 group">
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <Check className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-grow min-w-0">
                <p className="font-bold text-slate-800 decoration-slate-300">{item.taskName}</p>
                <p className="text-xs text-slate-500">Completed on {new Date(item.completedDate).toLocaleDateString()}</p>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleRestore}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Restore to active tasks"
                >
                    <RotateCcw size={16} />
                </button>

                {showConfirm ? (
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={handleDelete} className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors">Confirm</button>
                        <button onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }} className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors">Cancel</button>
                    </div>
                ) : (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                        title="Delete permanently"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const MaintenanceDashboard = ({ 
    records = [], 
    onAddRecord, 
    onNavigateToRecords, 
    onBookService, 
    onMarkTaskDone,
    onDeleteHistoryItem,   // ENSURE THIS IS PASSED FROM APP.JSX
    onRestoreHistoryItem   // ENSURE THIS IS PASSED FROM APP.JSX
}) => {
    const [viewMode, setViewMode] = useState('upcoming');
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    // Safety check for records
    const safeRecords = Array.isArray(records) ? records : [];
    
    const contractorDirectory = useMemo(() => {
        const dir = {};
        safeRecords.forEach(r => {
            if (r.contractor && r.contractor.trim().length > 0) {
                const name = r.contractor.trim().toLowerCase();
                if (!dir[name]) dir[name] = { displayName: r.contractor.trim(), phone: null, email: null };
                if (r.contractorPhone && r.contractorPhone.trim()) dir[name].phone = r.contractorPhone.trim();
                if (r.contractorEmail && r.contractorEmail.trim()) dir[name].email = r.contractorEmail.trim();
            }
        });
        return dir;
    }, [safeRecords]);

    const { soonTasks, futureTasks, overdueTasks, historyItems } = useMemo(() => {
        const now = new Date();
        const soon = [], future = [], overdue = [], history = [];

        safeRecords.forEach(record => {
            if (record.maintenanceHistory && Array.isArray(record.maintenanceHistory)) {
                // Ensure recordId is attached to every history item so onDelete/onRestore works
                record.maintenanceHistory.forEach(h => history.push({ 
                    ...h, 
                    item: record.item, 
                    recordId: record.id 
                }));
            }

            const processTask = (taskName, freq, nextDateStr, isGranular) => {
                if (!nextDateStr || freq === 'none') return;
                const nextDate = new Date(nextDateStr);
                if (isNaN(nextDate.getTime())) return;
                
                const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                const cName = record.contractor ? record.contractor.trim().toLowerCase() : null;
                const dirEntry = cName ? contractorDirectory[cName] : null;
                
                const taskItem = {
                    id: `${record.id}-${taskName}`,
                    recordId: record.id,
                    item: record.item,
                    taskName: taskName,
                    category: record.category,
                    nextDate: nextDate,
                    daysUntil: daysUntil,
                    frequency: freq,
                    isGranular: isGranular,
                    contractor: record.contractor || null,
                    contractorPhone: record.contractorPhone || dirEntry?.phone || null,
                    contractorEmail: record.contractorEmail || dirEntry?.email || null
                };

                if (daysUntil < 0) overdue.push(taskItem);
                else if (daysUntil <= 90) soon.push(taskItem);
                else future.push(taskItem);
            };

            if (record.maintenanceTasks && record.maintenanceTasks.length > 0) {
                record.maintenanceTasks.forEach(t => processTask(t.task, t.frequency, t.nextDue, true));
            } else {
                const nextDate = getNextServiceDate(record);
                if (nextDate) processTask('General Maintenance', record.maintenanceFrequency, nextDate.toISOString(), false);
            }
        });

        const byDate = (a, b) => a.daysUntil - b.daysUntil;
        return {
            soonTasks: soon.sort(byDate),
            futureTasks: future.sort(byDate),
            overdueTasks: overdue.sort(byDate),
            historyItems: history.sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate))
        };
    }, [safeRecords, contractorDirectory]);

    const suggestedItems = useMemo(() => {
        const existingItems = new Set(safeRecords.map(r => r.item ? r.item.toLowerCase() : ''));
        return STANDARD_MAINTENANCE_ITEMS.filter(item => !existingItems.has(item.item.toLowerCase()));
    }, [safeRecords]);

    return (
        <div className="space-y-6">
            <div className="bg-slate-100 p-1.5 rounded-xl flex">
                <button onClick={() => setViewMode('upcoming')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${viewMode === 'upcoming' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}>Upcoming & Due</button>
                <button onClick={() => setViewMode('history')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${viewMode === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}>Completed History</button>
            </div>

            {viewMode === 'upcoming' ? (
                <div className="space-y-8">
                    {overdueTasks.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-bold text-red-700 flex items-center text-sm uppercase tracking-wider"><AlertTriangle className="h-4 w-4 mr-2" /> Needs Attention</h3>
                            {overdueTasks.map(task => <MaintenanceCard key={task.id} task={task} isOverdue onBook={onBookService} onComplete={onMarkTaskDone} />)}
                        </div>
                    )}

                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-700 flex items-center text-sm uppercase tracking-wider"><Calendar className="h-4 w-4 mr-2" /> Coming Soon (90 Days)</h3>
                        {soonTasks.length === 0 ? (
                            <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center"><p className="text-slate-400 text-sm font-medium">No tasks due in the next 3 months.</p></div>
                        ) : (
                            soonTasks.map(task => <MaintenanceCard key={task.id} task={task} onBook={onBookService} onComplete={onMarkTaskDone} />)
                        )}
                    </div>

                    {futureTasks.length > 0 && (
                        <div className="space-y-3 opacity-80 hover:opacity-100 transition-opacity">
                            <h3 className="font-bold text-slate-400 flex items-center text-sm uppercase tracking-wider"><Hourglass className="h-4 w-4 mr-2" /> Future Schedule</h3>
                            {futureTasks.map(task => <MaintenanceCard key={task.id} task={task} onBook={onBookService} onComplete={onMarkTaskDone} />)}
                        </div>
                    )}

                    {overdueTasks.length === 0 && soonTasks.length === 0 && futureTasks.length === 0 && (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle className="h-10 w-10 text-emerald-200 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">No maintenance scheduled.</p>
                            <button onClick={() => setShowSuggestions(true)} className="text-emerald-600 font-bold text-sm mt-2 hover:underline">Browse Suggestions</button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                     {historyItems.length === 0 ? (
                        <div className="text-center py-12">
                             <div className="bg-slate-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"><History className="h-8 w-8 text-slate-300" /></div>
                             <h3 className="text-slate-800 font-bold">No History Yet</h3>
                        </div>
                     ) : (
                        <>
                            {historyItems.map((item, i) => (
                                <HistoryItemCard 
                                    key={item.id || i} 
                                    item={item} 
                                    onDelete={onDeleteHistoryItem}
                                    onRestore={onRestoreHistoryItem}
                                />
                            ))}
                        </>
                     )}
                </div>
            )}

            {suggestedItems.length > 0 && (
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mt-8">
                    <button onClick={() => setShowSuggestions(!showSuggestions)} className="w-full flex justify-between items-center">
                        <h3 className="font-bold text-emerald-900 flex items-center"><Sparkles className="h-5 w-5 mr-2" /> Suggested Maintenance Items</h3>
                        <ChevronRight className={`h-5 w-5 text-emerald-600 transition-transform ${showSuggestions ? 'rotate-90' : ''}`} />
                    </button>
                    {showSuggestions && (
                        <div className="mt-4 space-y-2">
                            {suggestedItems.slice(0, 5).map((suggestion, i) => (
                                <button key={i} onClick={() => onAddRecord && onAddRecord(suggestion)} className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-100 hover:border-emerald-300 transition-colors text-left">
                                    <div><p className="font-bold text-slate-800 text-sm">{suggestion.item}</p><p className="text-xs text-slate-500">{suggestion.category}</p></div>
                                    <PlusCircle className="h-5 w-5 text-emerald-500" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MaintenanceDashboard;
