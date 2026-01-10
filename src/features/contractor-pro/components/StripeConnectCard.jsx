// src/features/contractor-pro/components/StripeConnectCard.jsx
// ============================================
// STRIPE CONNECT CARD
// ============================================
// Allows contractors to connect their Stripe account
// to receive payments from customers

import React, { useState, useEffect } from 'react';
import { 
    CreditCard, ExternalLink, CheckCircle, AlertCircle, 
    Loader2, RefreshCw, DollarSign, Shield
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';
import { startStripeOnboarding, checkStripeStatus } from '../../../lib/stripeService';
import toast from 'react-hot-toast';

// ============================================
// STRIPE CONNECT CARD COMPONENT
// ============================================

export const StripeConnectCard = ({ contractorId, profile }) => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    
    // Get Stripe status from profile
    const stripeAccountId = profile?.stripe?.accountId;
    const isComplete = profile?.stripe?.isComplete;
    const chargesEnabled = profile?.stripe?.chargesEnabled;
    const payoutsEnabled = profile?.stripe?.payoutsEnabled;
    
    // Determine overall status
    const getStatus = () => {
        if (!stripeAccountId) return 'not_connected';
        if (isComplete && chargesEnabled && payoutsEnabled) return 'active';
        if (stripeAccountId && !isComplete) return 'incomplete';
        return 'pending';
    };
    
    const status = getStatus();

    // Check for return from Stripe onboarding
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const stripeStatus = params.get('stripe');
        
        if (stripeStatus === 'success' && stripeAccountId) {
            // Refresh status from Stripe
            handleRefreshStatus();
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname + '?pro');
        } else if (stripeStatus === 'refresh') {
            toast('Stripe setup was interrupted. Click "Continue Setup" to finish.', {
                icon: '⚠️',
                duration: 5000
            });
            window.history.replaceState({}, '', window.location.pathname + '?pro');
        }
    }, [stripeAccountId]);

    // Start Stripe Connect onboarding
    const handleConnect = async () => {
        setIsConnecting(true);
        
        try {
            const result = await startStripeOnboarding({
                contractorId,
                email: profile?.profile?.email || '',
                businessName: profile?.profile?.companyName || '',
                existingStripeAccountId: stripeAccountId || null
            });
            
            // Save the account ID to Firebase
            const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
            await updateDoc(contractorRef, {
                'stripe.accountId': result.accountId,
                'stripe.updatedAt': serverTimestamp()
            });
            
            // Redirect to Stripe onboarding
            window.location.href = result.onboardingUrl;
            
        } catch (error) {
            console.error('Stripe connect error:', error);
            toast.error(error.message || 'Failed to start Stripe setup');
            setIsConnecting(false);
        }
    };

    // Refresh status from Stripe
    const handleRefreshStatus = async () => {
        if (!stripeAccountId) return;
        
        setIsCheckingStatus(true);
        
        try {
            const result = await checkStripeStatus(stripeAccountId);
            
            // Update Firebase with latest status
            const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
            await updateDoc(contractorRef, {
                'stripe.isComplete': result.status.isComplete,
                'stripe.chargesEnabled': result.status.chargesEnabled,
                'stripe.payoutsEnabled': result.status.payoutsEnabled,
                'stripe.updatedAt': serverTimestamp()
            });
            
            if (result.status.isComplete) {
                toast.success('Stripe account is ready to accept payments!');
            } else {
                toast('Stripe setup is incomplete. Click "Continue Setup" to finish.', {
                    icon: '⚠️'
                });
            }
        } catch (error) {
            console.error('Status check error:', error);
            toast.error('Could not check Stripe status');
        } finally {
            setIsCheckingStatus(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                        status === 'active' 
                            ? 'bg-emerald-100' 
                            : status === 'incomplete' 
                                ? 'bg-amber-100' 
                                : 'bg-slate-100'
                    }`}>
                        <CreditCard size={20} className={
                            status === 'active' 
                                ? 'text-emerald-600' 
                                : status === 'incomplete' 
                                    ? 'text-amber-600' 
                                    : 'text-slate-600'
                        } />
                    </div>
                    <div>
                        <span className="font-bold text-slate-800">Payment Processing</span>
                        <p className="text-xs text-slate-500">Powered by Stripe</p>
                    </div>
                </div>
                
                {/* Status Badge */}
                {status === 'active' && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                        <CheckCircle size={12} />
                        Active
                    </span>
                )}
                {status === 'incomplete' && (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                        <AlertCircle size={12} />
                        Incomplete
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                {status === 'not_connected' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Connect your Stripe account to collect deposits and payments directly from customers.
                        </p>
                        
                        {/* Benefits */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl">
                                <DollarSign size={16} className="text-emerald-600 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-slate-700">Collect Deposits</p>
                                    <p className="text-xs text-slate-500">Before starting work</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl">
                                <Shield size={16} className="text-emerald-600 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-slate-700">Secure Payments</p>
                                    <p className="text-xs text-slate-500">Bank-level security</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 bg-blue-50 p-3 rounded-xl">
                            <Shield size={14} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700">
                                <strong>Free to connect.</strong> You only pay standard Stripe fees (2.9% + 30¢) when you receive a payment. Krib takes nothing.
                            </p>
                        </div>
                        
                        <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="w-full py-3 bg-[#635BFF] text-white font-bold rounded-xl hover:bg-[#5851e0] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <CreditCard size={18} />
                                    Connect with Stripe
                                    <ExternalLink size={14} />
                                </>
                            )}
                        </button>
                    </div>
                )}

                {status === 'incomplete' && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 bg-amber-50 p-3 rounded-xl">
                            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-800">Setup Incomplete</p>
                                <p className="text-xs text-amber-700 mt-1">
                                    Stripe needs more information to enable payments. This usually takes 2-3 minutes.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="flex-1 py-2.5 bg-[#635BFF] text-white font-bold rounded-xl hover:bg-[#5851e0] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isConnecting ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <>
                                        Continue Setup
                                        <ExternalLink size={14} />
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleRefreshStatus}
                                disabled={isCheckingStatus}
                                className="px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                {isCheckingStatus ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <RefreshCw size={16} />
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {status === 'active' && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 bg-emerald-50 p-3 rounded-xl">
                            <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-emerald-800">Ready to Accept Payments</p>
                                <p className="text-xs text-emerald-700 mt-1">
                                    Customers can pay deposits and balances when they accept your quotes.
                                </p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="p-3 bg-slate-50 rounded-xl">
                                <p className="text-xs text-slate-500">Payments</p>
                                <p className="text-lg font-bold text-emerald-600 flex items-center justify-center gap-1">
                                    <CheckCircle size={14} />
                                    Enabled
                                </p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl">
                                <p className="text-xs text-slate-500">Payouts</p>
                                <p className="text-lg font-bold text-emerald-600 flex items-center justify-center gap-1">
                                    <CheckCircle size={14} />
                                    Enabled
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <a
                                href="https://dashboard.stripe.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                            >
                                Open Stripe Dashboard
                                <ExternalLink size={14} />
                            </a>
                            <button
                                onClick={handleRefreshStatus}
                                disabled={isCheckingStatus}
                                className="px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                                title="Refresh status"
                            >
                                {isCheckingStatus ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <RefreshCw size={16} />
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StripeConnectCard;
