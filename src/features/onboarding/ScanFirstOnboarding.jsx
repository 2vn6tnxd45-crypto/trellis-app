// src/features/onboarding/ScanFirstOnboarding.jsx
// ============================================
// 📸 SCAN-FIRST ONBOARDING
// ============================================
// Replaces the questionnaire-based onboarding with a scan-first approach.
// Users either scan a document OR get guided to find their appliance labels.
// 
// This is for the MINORITY of users who sign up directly (not via contractor invite).
// Once they have items, this view disappears.

import React, { useState } from 'react';
import { 
    Camera, FileText, Wrench, X, ChevronRight, 
    Thermometer, Droplets, Home, Zap, Sparkles,
    ArrowLeft, CheckCircle2, HelpCircle, Send
} from 'lucide-react';

// ============================================
// CATEGORY GUIDES - Where to find labels
// ============================================
const SCAN_GUIDES = [
    {
        id: 'hvac',
        icon: Thermometer,
        name: 'HVAC System',
        color: 'red',
        guide: {
            title: 'Find your HVAC label',
            description: 'The rating plate is usually on the side panel of your furnace or inside the access door.',
            tips: [
                'Check the side of your indoor unit (air handler)',
                'Look inside the front panel door',
                'Outdoor units have a label on the back or side'
            ],
            altDocs: ['Service invoice', 'Installation receipt', 'Home inspection report']
        }
    },
    {
        id: 'water_heater',
        icon: Droplets,
        name: 'Water Heater',
        color: 'blue',
        guide: {
            title: 'Find your water heater label',
            description: 'Look for the yellow EnergyGuide sticker or manufacturer label on the front or side.',
            tips: [
                'Yellow EnergyGuide label has capacity & efficiency',
                'Manufacturer sticker has model & serial number',
                'Check near the temperature dial'
            ],
            altDocs: ['Installation receipt', 'Warranty card', 'Home inspection report']
        }
    },
    {
        id: 'roof',
        icon: Home,
        name: 'Roof',
        color: 'amber',
        guide: {
            title: 'Find your roof documentation',
            description: "Roof details are usually on the installer's invoice or your home inspection report.",
            tips: [
                'Check your closing documents',
                'Look for roofing contractor invoices',
                'Home inspection reports list roof age & type'
            ],
            altDocs: ['Contractor invoice', 'Home inspection', 'Warranty certificate']
        }
    },
    {
        id: 'electrical',
        icon: Zap,
        name: 'Electrical Panel',
        color: 'yellow',
        guide: {
            title: 'Find your panel info',
            description: 'The panel label is inside the door of your breaker box.',
            tips: [
                'Label is inside the panel door',
                'Photograph the circuit breaker directory too',
                'Note the main breaker amperage (100A, 200A, etc.)'
            ],
            altDocs: ['Electrician invoice', 'Home inspection report', 'Permit documents']
        }
    }
];

// ============================================
// GUIDE DETAIL VIEW
// ============================================
const GuideDetailView = ({ guide, onBack, onScan }) => {
    const colorClasses = {
        red: 'bg-red-50 text-red-600 border-red-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100'
    };
    
    const IconComponent = guide.icon;
    
    return (
        <div className="animate-in slide-in-from-right duration-200">
            {/* Header */}
            <button 
                onClick={onBack}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors"
            >
                <ArrowLeft size={18} />
                <span className="text-sm font-medium">Back</span>
            </button>
            
            {/* Guide Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                <div className={`inline-flex p-3 rounded-xl mb-4 ${colorClasses[guide.color]}`}>
                    <IconComponent size={28} />
                </div>
                
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                    {guide.guide.title}
                </h2>
                <p className="text-slate-600 mb-6">
                    {guide.guide.description}
                </p>
                
                {/* Tips */}
                <div className="bg-slate-50 rounded-xl p-4 mb-6">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                        Where to look
                    </p>
                    <ul className="space-y-2">
                        {guide.guide.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                                <span>{tip}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                
                {/* Primary Action */}
                <button
                    onClick={() => onScan(guide.id)}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-colors flex items-center justify-center gap-2"
                >
                    <Camera size={20} />
                    Take Photo of Label
                </button>
            </div>
            
            {/* Alternative Documents */}
            <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                    Or scan one of these instead
                </p>
                <div className="space-y-2">
                    {guide.guide.altDocs.map((doc, i) => (
                        <button
                            key={i}
                            onClick={() => onScan(guide.id)}
                            className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors text-left"
                        >
                            <FileText size={18} className="text-slate-400" />
                            <span className="text-sm font-medium text-slate-700">{doc}</span>
                            <ChevronRight size={16} className="text-slate-300 ml-auto" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ============================================
// CONTRACTOR CTA
// ============================================
const ContractorCTA = ({ onCreateLink }) => (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5">
        <div className="flex items-start gap-4">
            <div className="bg-white p-2.5 rounded-xl shadow-sm border border-amber-100">
                <Wrench size={24} className="text-amber-600" />
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-slate-800 mb-1">Had work done recently?</h3>
                <p className="text-sm text-slate-600 mb-3">
                    Send your contractor a link—they'll add all the details for you.
                </p>
                <button
                    onClick={onCreateLink}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-colors"
                >
                    <Send size={16} />
                    Create Contractor Link
                </button>
            </div>
        </div>
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
export const ScanFirstOnboarding = ({ 
    propertyName,
    onScanReceipt,      // Opens SmartScanner
    onCreateContractorLink, // Opens contractor invite flow
    onDismiss 
}) => {
    const [selectedGuide, setSelectedGuide] = useState(null);
    
    // If a guide is selected, show the detail view
    if (selectedGuide) {
        const guide = SCAN_GUIDES.find(g => g.id === selectedGuide);
        return (
            <div className="min-h-[60vh]">
                <GuideDetailView 
                    guide={guide}
                    onBack={() => setSelectedGuide(null)}
                    onScan={() => {
                        onScanReceipt();
                    }}
                />
            </div>
        );
    }
    
    // Main view
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-800">
                    Add your first item
                </h1>
                <button 
                    onClick={onDismiss}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
            
            {/* Primary Action - Scan */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Camera size={24} />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg">Scan a Receipt or Label</h2>
                        <p className="text-emerald-100 text-sm">We'll extract all the details automatically</p>
                    </div>
                </div>
                
                <button
                    onClick={onScanReceipt}
                    className="w-full mt-4 py-3.5 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                >
                    <Sparkles size={18} />
                    Open Scanner
                    <span className="ml-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                        AI-Powered
                    </span>
                </button>
            </div>
            
            {/* Contractor CTA */}
            <ContractorCTA onCreateLink={onCreateContractorLink} />
            
            {/* Guide Links */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <HelpCircle size={16} className="text-slate-400" />
                    <p className="text-sm font-medium text-slate-500">
                        Don't have a receipt? We'll show you where to find the label.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    {SCAN_GUIDES.map(guide => {
                        const IconComponent = guide.icon;
                        const colorClasses = {
                            red: 'bg-red-50 text-red-500',
                            blue: 'bg-blue-50 text-blue-500',
                            amber: 'bg-amber-50 text-amber-500',
                            yellow: 'bg-yellow-50 text-yellow-500'
                        };
                        
                        return (
                            <button
                                key={guide.id}
                                onClick={() => setSelectedGuide(guide.id)}
                                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all text-left"
                            >
                                <div className={`p-2 rounded-lg ${colorClasses[guide.color]}`}>
                                    <IconComponent size={18} />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800 text-sm">{guide.name}</p>
                                    <p className="text-xs text-emerald-600">Find label →</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
            
            {/* Skip */}
            <div className="text-center pt-2">
                <button 
                    onClick={onDismiss}
                    className="text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
                >
                    Skip for now
                </button>
            </div>
        </div>
    );
};

export default ScanFirstOnboarding;
