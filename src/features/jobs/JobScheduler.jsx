// src/features/jobs/JobScheduler.jsx
import React, { useState } from 'react';
import { 
    Calendar, Clock, CheckCircle, XCircle, MessageSquare, 
    DollarSign, Send, AlertCircle, ChevronRight 
} from 'lucide-react';
import { updateDoc, doc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';
import toast from 'react-hot-toast';

export const JobScheduler = ({ job, userType, onUpdate }) => {
    // userType: 'homeowner' | 'contractor'
    const [isProposing, setIsProposing] = useState(false);
    const [proposal, setProposal] = useState({ date: '', time: '09:00' });
    const [estimateAmount, setEstimateAmount] = useState('');
    const [showEstimateInput, setShowEstimateInput] = useState(false);

    const handleProposeTime = async () => {
        if (!proposal.date || !proposal.time) return toast.error("Please pick a date and time");
        
        try {
            const timestamp = new Date(`${proposal.dateT${proposal.time}`);
            const newProposal = {
                date: timestamp.toISOString(),
                proposedBy: userType,
                createdAt: new Date().toISOString()
            };

            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                proposedTimes: arrayUnion(newProposal),
                status: 'scheduling',
                lastActivity: serverTimestamp()
            });
            
            toast.success("Time proposed!");
            setIsProposing(false);
            onUpdate();
        } catch (e) {
            console.error(e);
            toast.error("Failed to propose time");
        }
    };

    const handleAcceptTime = async (proposalItem) => {
        try {
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                scheduledTime: proposalItem.date,
                status: 'scheduled',
                lastActivity: serverTimestamp()
            });
            toast.success("Appointment confirmed!");
            onUpdate();
        } catch (e) {
            toast.error("Failed to confirm");
        }
    };

    const handleSendEstimate = async () => {
        if (!estimateAmount) return;
        try {
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                estimate: {
                    amount: parseFloat(estimateAmount),
                    status: 'pending'
                },
                status: 'quoted'
            });
            toast.success("Estimate sent");
            setShowEstimateInput(false);
            onUpdate();
        } catch (e) {
            toast.error("Failed to send estimate");
        }
    };

    const handleApproveEstimate = async () => {
        try {
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                'estimate.status': 'approved',
                status: 'scheduled' // or 'approved'
            });
            toast.success("Estimate approved!");
            onUpdate();
        } catch (e) {
            toast.error("Failed to approve");
        }
    };

    // -- RENDER HELPERS --

    const renderTimeline = () => {
        const events = [...(job.proposedTimes || [])];
        if (job.estimate) events.push({ type: 'estimate', ...job.estimate, createdAt: job.lastActivity }); // Simplified sorting logic would go here
        
        return (
            <div className="space-y-4 mb-6">
                {/* Initial Request */}
                <div className="flex gap-3 text-sm text-slate-600">
                    <div className="mt-1"><MessageSquare size={16} /></div>
                    <div className="bg-slate-50 p-3 rounded-lg rounded-tl-none">
                        <p className="font-medium">Request Created</p>
                        <p>{job.description}</p>
                    </div>
                </div>

                {/* Proposals */}
                {job.proposedTimes?.map((p, i) => (
                    <div key={i} className={`flex gap-3 text-sm ${p.proposedBy === userType ? 'flex-row-reverse' : ''}`}>
                        <div className="mt-1"><Calendar size={16} className="text-slate-400" /></div>
                        <div className={`p-3 rounded-lg ${p.proposedBy === userType ? 'bg-emerald-50 text-emerald-900 rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                            <p className="font-bold">
                                {p.proposedBy === 'contractor' ? 'Pro' : 'Homeowner'} proposed:
                            </p>
                            <p className="text-lg">
                                {new Date(p.date).toLocaleDateString()} @ {new Date(p.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </p>
                            {/* Only show Accept button if the OTHER person proposed it and it's not yet scheduled */}
                            {p.proposedBy !== userType && !job.scheduledTime && (
                                <button 
                                    onClick={() => handleAcceptTime(p)}
                                    className="mt-2 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-md hover:bg-emerald-700"
                                >
                                    Confirm This Time
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Header / Status Bar */}
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calendar className="text-emerald-600" size={20} />
                    <span className="font-bold text-slate-800">
                        {job.scheduledTime ? 'Scheduled' : 'Scheduling'}
                    </span>
                </div>
                {job.scheduledTime && (
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                        {new Date(job.scheduledTime).toLocaleDateString()}
                    </span>
                )}
            </div>

            <div className="p-4 bg-slate-50/50 min-h-[200px] max-h-[400px] overflow-y-auto">
                {renderTimeline()}
            </div>

            {/* Actions Area */}
            <div className="p-4 border-t border-slate-100 bg-white">
                {job.scheduledTime ? (
                    <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-xl">
                        <CheckCircle size={20} />
                        <span className="font-medium">Appointment confirmed for {new Date(job.scheduledTime).toLocaleString()}</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {isProposing ? (
                            <div className="p-3 border border-emerald-200 rounded-xl bg-emerald-50 animate-in slide-in-from-bottom-2">
                                <p className="text-xs font-bold text-emerald-800 uppercase mb-2">Propose New Time</p>
                                <div className="flex gap-2 mb-2">
                                    <input type="date" className="flex-1 p-2 rounded-lg border border-emerald-200" value={proposal.date} onChange={e => setProposal({...proposal, date: e.target.value})} />
                                    <input type="time" className="w-24 p-2 rounded-lg border border-emerald-200" value={proposal.time} onChange={e => setProposal({...proposal, time: e.target.value})} />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleProposeTime} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg">Send Proposal</button>
                                    <button onClick={() => setIsProposing(false)} className="px-3 bg-white text-slate-500 font-bold py-2 rounded-lg border border-slate-200">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setIsProposing(true)} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 font-bold hover:border-emerald-500 hover:text-emerald-600 transition-colors">
                                Propose a Time
                            </button>
                        )}
                    </div>
                )}

                {/* Estimate Section (Contractor Only) */}
                {userType === 'contractor' && !job.estimate && !job.scheduledTime && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        {showEstimateInput ? (
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                    <input type="number" placeholder="0.00" className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg" value={estimateAmount} onChange={e => setEstimateAmount(e.target.value)} />
                                </div>
                                <button onClick={handleSendEstimate} className="bg-slate-900 text-white px-4 rounded-lg font-bold">Send</button>
                            </div>
                        ) : (
                            <button onClick={() => setShowEstimateInput(true)} className="text-sm font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1">
                                <DollarSign size={16} /> Send Estimate
                            </button>
                        )}
                    </div>
                )}

                {/* Estimate Approval (Homeowner Only) */}
                {userType === 'homeowner' && job.estimate?.status === 'pending' && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-amber-900">Estimate Received</span>
                            <span className="text-xl font-bold text-amber-900">${job.estimate.amount}</span>
                        </div>
                        <button onClick={handleApproveEstimate} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors">
                            Approve Estimate
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
