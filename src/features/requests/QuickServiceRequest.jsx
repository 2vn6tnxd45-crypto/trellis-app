// src/features/requests/QuickServiceRequest.jsx
// ============================================
// ⚡ QUICK SERVICE REQUEST
// ============================================
// Allows users to instantly create a contractor request link
// directly from a record card. Includes all relevant context.

import React, { useState } from 'react';
import { 
    X, Copy, Check, Send, Link as LinkIcon, MapPin, 
    Package, Share2, MessageCircle, Mail, Loader2
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';
import toast from 'react-hot-toast';

export const QuickServiceRequest = ({ 
    record, 
    userId, 
    propertyName, 
    propertyAddress,
    onClose 
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [createdLink, setCreatedLink] = useState(null);
    const [copied, setCopied] = useState(false);
    const [shareAddress, setShareAddress] = useState(false);
    const [customMessage, setCustomMessage] = useState('');
    const [description, setDescription] = useState(record?.item ? `Service for ${record.item}` : '');
    
    // If no record provided, this is a general service request
    const isGeneralRequest = !record || !record.item;
    
    const handleCreateLink = async () => {
        if (isGeneralRequest && !description.trim()) {
            toast.error('Please enter a description');
            return;
        }
        
        setIsCreating(true);
        
        try {
            const docRef = await addDoc(collection(db, REQUESTS_COLLECTION_PATH), {
                createdBy: userId,
                propertyName: propertyName || "My Home",
                propertyAddress: shareAddress ? propertyAddress : null,
                description: isGeneralRequest ? description : `Service for ${record.item}`,
                linkedContext: isGeneralRequest ? null : {
                    item: record.item,
                    brand: record.brand || null,
                    model: record.model || null,
                    year: record.dateInstalled ? new Date(record.dateInstalled).getFullYear() : null,
                    category: record.category,
                    area: record.area,
                    lastServiceDate: record.dateInstalled || null,
                    notes: record.notes || null
                },
                customMessage: customMessage || null,
                status: 'pending',
                createdAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            });
            
            const link = `${window.location.origin}${window.location.pathname}?requestId=${docRef.id}`;
            setCreatedLink(link);
            toast.success('Service link created!');
            
        } catch (error) {
            console.error('Error creating request:', error);
            toast.error('Failed to create link');
        } finally {
            setIsCreating(false);
        }
    };
    
    const handleCopy = () => {
        navigator.clipboard.writeText(createdLink);
        setCopied(true);
        toast.success('Link copied!');
        setTimeout(() => setCopied(false), 2000);
    };
    
    const handleShare = async () => {
        const shareText = `Hi! I need service for my ${record.item}${record.brand ? ` (${record.brand})` : ''}. Please use this link to submit work details: ${createdLink}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Service Request - ${record.item}`,
                    text: shareText,
                });
            } catch (err) {
                handleCopy();
            }
        } else {
            handleCopy();
        }
    };
    
    const handleSMS = () => {
        const text = `Service request for ${record.item}: ${createdLink}`;
        window.open(`sms:?body=${encodeURIComponent(text)}`);
    };
    
    const handleEmail = () => {
        const subject = `Service Request - ${record.item}`;
        const body = `Hi,\n\nI need service for my ${record.item}${record.brand ? ` (${record.brand})` : ''}.\n\nPlease use this link to submit work details after the job:\n${createdLink}\n\nThank you!`;
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    };
    
    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-slate-800">Request Service</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Create a link for your contractor</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                {/* Equipment Context - Only show if we have a record */}
                {!isGeneralRequest && (
                    <div className="p-5 bg-slate-50 border-b border-slate-100">
                        <div className="flex items-start gap-3">
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                                <Package className="h-5 w-5 text-slate-600" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{record.item}</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {record.brand && (
                                        <span className="text-xs text-slate-500">{record.brand}</span>
                                    )}
                                    {record.model && (
                                        <span className="text-xs text-slate-400">• {record.model}</span>
                                    )}
                                    {record.dateInstalled && (
                                        <span className="text-xs text-slate-400">• Installed {record.dateInstalled}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {!createdLink ? (
                    /* Creation Form */
                    <div className="p-5 space-y-4">
                        {/* Description field for general requests */}
                        {isGeneralRequest && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    What do you need? *
                                </label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g., HVAC service, plumbing repair..."
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                                />
                            </div>
                        )}
                        
                        {/* Share Address Toggle */}
                        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                            <input 
                                type="checkbox"
                                checked={shareAddress}
                                onChange={(e) => setShareAddress(e.target.checked)}
                                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex-grow">
                                <p className="font-medium text-slate-800 text-sm flex items-center gap-2">
                                    <MapPin size={14} />
                                    Include property address
                                </p>
                                <p className="text-xs text-slate-500">Helps contractor find your home</p>
                            </div>
                        </label>
                        
                        {/* Custom Message */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Note for contractor (optional)
                            </label>
                            <textarea
                                value={customMessage}
                                onChange={(e) => setCustomMessage(e.target.value)}
                                placeholder="e.g., AC not cooling properly, makes noise when starting..."
                                rows={2}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none text-sm"
                            />
                        </div>
                        
                        {/* Info */}
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                            <p className="text-xs text-emerald-800">
                                <strong>What happens:</strong> Your contractor will receive a link where they can submit work details, costs, and photos. This info imports directly into your home record.
                            </p>
                        </div>
                        
                        {/* Create Button */}
                        <button
                            onClick={handleCreateLink}
                            disabled={isCreating}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <LinkIcon size={18} />
                                    Create Service Link
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    /* Link Created - Share Options */
                    <div className="p-5 space-y-4">
                        {/* Link Display */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <p className="text-xs text-slate-500 mb-2 font-bold uppercase">Your service link</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-grow text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 truncate">
                                    {createdLink}
                                </code>
                                <button
                                    onClick={handleCopy}
                                    className={`p-2 rounded-lg transition-colors ${
                                        copied 
                                            ? 'bg-emerald-100 text-emerald-600' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {copied ? <Check size={18} /> : <Copy size={18} />}
                                </button>
                            </div>
                        </div>
                        
                        {/* Share Options */}
                        <div>
                            <p className="text-sm font-bold text-slate-700 mb-3">Send to contractor</p>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={handleSMS}
                                    className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl transition-colors"
                                >
                                    <MessageCircle className="h-6 w-6 text-emerald-600" />
                                    <span className="text-xs font-medium text-slate-600">Text</span>
                                </button>
                                <button
                                    onClick={handleEmail}
                                    className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl transition-colors"
                                >
                                    <Mail className="h-6 w-6 text-emerald-600" />
                                    <span className="text-xs font-medium text-slate-600">Email</span>
                                </button>
                                <button
                                    onClick={handleShare}
                                    className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl transition-colors"
                                >
                                    <Share2 className="h-6 w-6 text-emerald-600" />
                                    <span className="text-xs font-medium text-slate-600">Share</span>
                                </button>
                            </div>
                        </div>
                        
                        {/* Done Button */}
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
