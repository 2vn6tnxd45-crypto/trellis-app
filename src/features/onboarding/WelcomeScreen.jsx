// src/features/onboarding/WelcomeScreen.jsx
// ============================================
// 🏠 WELCOME SCREEN - UPDATED
// ============================================
// Simplified welcome for new users (the minority who don't onboard via contractor).
// Primary action: Scan a document
// Secondary action: Have contractor add it
// Tertiary: Guided label finding
//
// NOTE: This view only appears when the user has 0 items.
// Most users will onboard via contractor invite and skip this entirely.

import React from 'react';
import { Camera, Sparkles, Wrench, Send, ChevronRight, HelpCircle } from 'lucide-react';

export const WelcomeScreen = ({ 
    propertyName, 
    onScanReceipt,           // Opens SmartScanner directly
    onStartGuidedScan,       // Opens ScanFirstOnboarding (for "where to find label" guides)
    onCreateContractorLink,  // Opens contractor invite flow
    onDismiss 
}) => {
    return (
        <div className="space-y-6">
            {/* Hero */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-[2rem] p-8 text-white relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <span className="text-emerald-100 font-bold text-sm uppercase tracking-wider">
                            Welcome to Krib
                        </span>
                    </div>
                    
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
                        Let's set up {propertyName || 'your home'}! 🏠
                    </h1>
                    
                    <p className="text-emerald-100 text-lg max-w-xl leading-relaxed">
                        Snap a photo of any receipt, invoice, or appliance label. 
                        We'll extract and organize the details automatically.
                    </p>
                </div>
            </div>

            {/* Primary Action - Scan Receipt */}
            <button
                onClick={onScanReceipt}
                className="w-full bg-white rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 p-5 transition-all hover:shadow-lg group"
            >
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-100 p-3 rounded-xl group-hover:bg-emerald-200 transition-colors">
                        <Camera className="h-7 w-7 text-emerald-600" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 text-lg">Scan a Receipt</h3>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1">
                                <Sparkles size={10} />
                                AI-Powered
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm">
                            Upload a receipt and our AI extracts the details
                        </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </div>
            </button>

            {/* Secondary Action - Contractor */}
            <button
                onClick={onCreateContractorLink}
                className="w-full bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 hover:border-amber-300 p-5 transition-all hover:shadow-md group"
            >
                <div className="flex items-center gap-4">
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-amber-100">
                        <Wrench className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="flex-1 text-left">
                        <h3 className="font-bold text-slate-800">Have Your Contractor Add It</h3>
                        <p className="text-slate-500 text-sm">
                            Send them a link—they'll submit all the details for you
                        </p>
                    </div>
                    <div className="bg-amber-500 p-2 rounded-lg group-hover:bg-amber-600 transition-colors">
                        <Send className="h-4 w-4 text-white" />
                    </div>
                </div>
            </button>

            {/* Tertiary - Guided Help */}
            <button
                onClick={onStartGuidedScan}
                className="w-full flex items-center justify-center gap-2 py-3 text-slate-500 hover:text-emerald-600 transition-colors"
            >
                <HelpCircle size={16} />
                <span className="text-sm font-medium">
                    Don't have a receipt? We'll show you where to find the label
                </span>
                <ChevronRight size={16} />
            </button>

            {/* Skip */}
            <div className="text-center">
                <button 
                    onClick={onDismiss} 
                    className="text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
                >
                    Skip for now — I'll explore on my own
                </button>
            </div>
        </div>
    );
};

export default WelcomeScreen;
