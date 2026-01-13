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
import { SlotPicker } from './SlotPicker';

// Helper to format scheduled time with range
const formatScheduledTimeRange = (job) => {
    if (!job.scheduledTime) return '';

    const startDate = new Date(job.scheduledTime);
    const dateStr = startDate.toLocaleDateString();
    const startTime = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    // Check if we have an end time from slot selection
    if (job.scheduling?.confirmedSlot?.end) {
        const endTime = new Date(job.scheduling.confirmedSlot.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return `${dateStr} • ${startTime} - ${endTime}`;
    }

    // Fallback to just start time for proposal-based scheduling
    return `${dateStr} • ${startTime}`;
};

// ADD: contractorId prop to link the schedule to the specific pro
export const JobScheduler = ({ job, userType, contractorId, onUpdate }) => {
    // userType: 'homeowner' | 'contractor'
    const [isProposing, setIsProposing] = useState(false);
    const [proposal, setProposal] = useState({ date: '', time: '09:00' });
    const [estimateAmount, setEstimateAmount] = useState('');
    const [showEstimateInput, setShowEstimateInput] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Check for offered slots for homeowner
    const hasOfferedSlots = job.scheduling?.offeredSlots?.some(s => s.status === 'offered');

    // If homeowner and has offered slots, show picker:
    if (userType === 'homeowner' && hasOfferedSlots) {
        return (
            <SlotPicker
                job={job}
                onClose={() => {
                    // Just triggering update or doing nothing depending on flow
                }}
                onSuccess={onUpdate}
                onRequestNewTimes={() => {
                    // Open request times logic, or handle it via a modal here
                    toast('Please message the contractor to request new times');
                }}
            />
        );
    }

    const handleProposeTime = async () => {
        if (!proposal.date || !proposal.time) return toast.error("Please pick a date and time");

        // Validate date is in the future
        const timestamp = new Date(`${proposal.date}T${proposal.time}`);
        const now = new Date();

        if (isNaN(timestamp.getTime())) {
            return toast.error("Invalid date or time");
        }

        if (timestamp < now) {
            return toast.error("Cannot schedule appointments in the past");
        }

        // Validate date is within reasonable range (6 months)
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

        if (timestamp > sixMonthsFromNow) {
            return toast.error("Cannot schedule more than 6 months in advance");
        }

        try {
            const newProposal = {
                date: timestamp.toISOString(),
                proposedBy: userType,
                createdAt: new Date().toISOString()
            };

            // Prepare update data
            const updateData = {
                proposedTimes: arrayUnion(newProposal),
                status: 'scheduling', // Update status to reflect active negotiation
                lastActivity: serverTimestamp()
            };

            // Link the contractor to this job if they are the one proposing
            if (userType === 'contractor' && contractorId) {
                updateData.contractorId = contractorId;
            }

            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), updateData);

            toast.success("Time proposed!");
            setIsProposing(false);
            setProposal({ date: '', time: '09:00' }); // Reset form
            if (onUpdate) onUpdate();
        } catch (e) {
            console.error(e);
            toast.error("Failed to propose time");
            // Don't close the form - let user try again
        }
    };

    const handleAcceptTime = async (proposalItem) => {
        if (isSubmitting) return; // Prevent double-click
        setIsSubmitting(true);

        try {
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                scheduledTime: proposalItem.date,
                status: 'scheduled',
                lastActivity: serverTimestamp()
            });
            toast.success("Appointment confirmed!");
            if (onUpdate) onUpdate();
        } catch (e) {
            console.error(e);
            toast.error("Failed to confirm");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendEstimate = async () => {
        if (!estimateAmount) return;

        // Validate estimate amount
        const amount = parseFloat(estimateAmount);
        if (isNaN(amount) || amount <= 0) {
            return toast.error("Please enter a valid amount");
        }

        try {
            const updateData = {
                estimate: {
                    amount: amount,
                    status: 'pending'
                },
                status: 'quoted'
            };

            // Link contractor here too just in case
            if (userType === 'contractor' && contractorId) {
                updateData.contractorId = contractorId;
            }

            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), updateData);
            toast.success("Estimate sent");
            setShowEstimateInput(false);
            setEstimateAmount(''); // Reset form
            if (onUpdate) onUpdate();
        } catch (e) {
            console.error(e);
            toast.error("Failed to send estimate");
        }
    };

    const handleApproveEstimate = async () => {
        if (isSubmitting) return; // Prevent double-click
        setIsSubmitting(true);

        try {
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                'estimate.status': 'approved',
                // Don't mark scheduled yet, move to scheduling phase
                status: 'scheduling'
            });
            toast.success("Estimate approved! Now let's schedule a time.");
            if (onUpdate) onUpdate();
        } catch (e) {
            console.error(e);
            toast.error("Failed to approve");
        } finally {
            setIsSubmitting(false);
        }
    };

    // -- RENDER HELPERS --

    const renderTimeline = () => {
        return (
            <div className="space-y-4 mb-6">
                {/* Initial Request Bubble */}
                <div className="flex gap-3 text-sm text-slate-600">
                    <div className="mt-1"><MessageSquare size={16} /></div>
                    <div className="bg-slate-50 p-3 rounded-lg rounded-tl-none border border-slate-100 w-full">
                        <p className="font-medium text-slate-900">Request Created</p>
                        <p>{job.description}</p>
                    </div>
                </div>

                {/* Quote Accepted Bubble */}
                {job.estimate?.status === 'approved' && (
                    <div className="flex justify-center my-4">
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                            Quote Accepted (${job.estimate.amount})
                        </span>
                    </div>
                )}

                {/* Proposals Bubbles */}
                {job.proposedTimes?.map((p, i) => (
                    <div key={i} className={`flex gap-3 text-sm ${p.proposedBy === userType ? 'flex-row-reverse' : ''}`}>
                        <div className="mt-1"><Calendar size={16} className="text-slate-400" /></div>
                        <div className={`p-3 rounded-lg shadow-sm ${p.proposedBy === userType ? 'bg-emerald-50 text-emerald-900 rounded-tr-none border border-emerald-100' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                            <p className="font-bold text-xs uppercase mb-1 opacity-70">
                                {p.proposedBy === userType ? 'You' : (p.proposedBy === 'contractor' ? 'Contractor' : 'Homeowner')} proposed:
                            </p>
                            <p className="text-lg font-medium">
                                {new Date(p.date).toLocaleDateString()} @ {new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {/* Only show Accept button if the OTHER person proposed it and it's not yet scheduled */}
                            {p.proposedBy !== userType && !job.scheduledTime && (
                                <button
                                    onClick={() => handleAcceptTime(p)}
                                    disabled={isSubmitting}
                                    className="mt-2 w-full px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-md hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <CheckCircle size={12} />
                                    {isSubmitting ? 'Confirming...' : 'Confirm This Time'}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm h-full flex flex-col">
            {/* Header / Status Bar */}
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Calendar className="text-emerald-600" size={20} />
                    <span className="font-bold text-slate-800">
                        {job.scheduledTime ? 'Scheduled' : 'Scheduling'}
                    </span>
                </div>
                {job.scheduledTime && (
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle size={10} />
                        {job.scheduling?.confirmedSlot?.end ? (
                            // Show time range for slot-based scheduling
                            <>
                                {new Date(job.scheduledTime).toLocaleDateString()} • {' '}
                                {new Date(job.scheduledTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {' '}
                                {new Date(job.scheduling.confirmedSlot.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </>
                        ) : (
                            // Just date for proposal-based scheduling
                            new Date(job.scheduledTime).toLocaleDateString()
                        )}
                    </span>
                )}
            </div>

            {/* Timeline Area */}
            <div className="p-4 bg-slate-50/50 flex-grow overflow-y-auto min-h-[300px]">
                {renderTimeline()}
            </div>

            {/* Actions Area */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                {job.scheduledTime ? (
                    <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <CheckCircle size={24} className="text-emerald-600 shrink-0" />
                        <div>
                            <p className="font-bold">Appointment Confirmed</p>
                            <p className="text-sm opacity-80">See you on {formatScheduledTimeRange(job)}</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {isProposing ? (
                            <div className="p-4 border border-emerald-200 rounded-xl bg-emerald-50 animate-in slide-in-from-bottom-2">
                                <p className="text-xs font-bold text-emerald-800 uppercase mb-2">Propose New Time</p>
                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="date"
                                        className="flex-1 p-2 rounded-lg border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={proposal.date}
                                        onChange={e => setProposal({ ...proposal, date: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                    <input
                                        type="time"
                                        className="w-28 p-2 rounded-lg border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={proposal.time}
                                        onChange={e => setProposal({ ...proposal, time: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleProposeTime} className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-lg hover:bg-emerald-700 transition-colors">Send Proposal</button>
                                    <button onClick={() => { setIsProposing(false); setProposal({ date: '', time: '09:00' }); }} className="px-4 bg-white text-slate-500 font-bold py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setIsProposing(true)} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 font-bold hover:border-emerald-500 hover:text-emerald-600 transition-colors bg-slate-50 hover:bg-emerald-50">
                                Propose a Time
                            </button>
                        )}
                    </div>
                )}

                {/* Estimate Section (Contractor Only) */}
                {userType === 'contractor' && !job.estimate && !job.scheduledTime && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        {showEstimateInput ? (
                            <div className="flex gap-2 items-center animate-in slide-in-from-bottom-1">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                                        value={estimateAmount}
                                        onChange={e => setEstimateAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <button onClick={handleSendEstimate} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors">Send</button>
                                <button onClick={() => setShowEstimateInput(false)} className="p-2 text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
                            </div>
                        ) : (
                            <button onClick={() => setShowEstimateInput(true)} className="text-sm font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1 transition-colors">
                                <DollarSign size={16} /> Send Estimate
                            </button>
                        )}
                    </div>
                )}

                {/* Estimate Approval (Homeowner Only) */}
                {userType === 'homeowner' && job.estimate?.status === 'pending' && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-bold text-amber-900 flex items-center gap-2">
                                <DollarSign size={18} className="text-amber-600" /> Estimate Received
                            </span>
                            <span className="text-xl font-bold text-amber-900">${job.estimate.amount}</span>
                        </div>
                        <button
                            onClick={handleApproveEstimate}
                            disabled={isSubmitting}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors shadow-sm shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Approving...' : 'Approve Estimate'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
