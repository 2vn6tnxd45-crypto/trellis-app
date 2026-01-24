// src/components/common/CookieConsent.jsx
import React, { useState, useEffect } from 'react';

export const CookieConsent = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if the user has already voted
        const consent = localStorage.getItem('krib_consent');
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        // 1. Save their choice so we don't ask again
        localStorage.setItem('krib_consent', 'true');
        
        // 2. OPTIONAL: Initialize Ad/Tracking SDKs here in the future
        // e.g. initializeGoogleAds();
        
        setIsVisible(false);
    };

    const handleDecline = () => {
        localStorage.setItem('krib_consent', 'false');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[100] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-4" style={{ maxHeight: '30vh', overflow: 'hidden' }}>
            <div className="text-sm text-slate-600 shrink min-w-0">
                <p className="font-bold text-slate-800">We value your privacy</p>
                <p className="line-clamp-2">We use data to find you relevant home discounts and maintenance offers. We do not sell your personal info.</p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto shrink-0">
                <button
                    onClick={handleDecline}
                    className="flex-1 sm:flex-none px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg transition-colors"
                >
                    No Thanks
                </button>
                <button
                    onClick={handleAccept}
                    className="flex-1 sm:flex-none px-6 py-2 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-colors"
                >
                    Accept Offers
                </button>
            </div>
        </div>
    );
};
