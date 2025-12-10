// src/features/onboarding/GuidedOnboarding.jsx
// ============================================
// 🎯 GUIDED ONBOARDING
// ============================================
// Step-by-step wizard that gets users to add their first 3 items
// in under 2 minutes. This is critical for retention.

import React, { useState } from 'react';
import { 
    Thermometer, Droplets, Home, Zap, Refrigerator, 
    ChevronRight, ChevronLeft, Check, Sparkles, Camera,
    X, ArrowRight, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

const ONBOARDING_STEPS = [
    {
        id: 'hvac',
        icon: Thermometer,
        title: "Heating & Cooling",
        question: "What type of HVAC system does your home have?",
        options: [
            { label: "Central AC + Furnace", value: "central_ac_furnace", item: "HVAC System", category: "HVAC & Systems", maintenanceFrequency: "quarterly" },
            { label: "Heat Pump", value: "heat_pump", item: "Heat Pump", category: "HVAC & Systems", maintenanceFrequency: "quarterly" },
            { label: "Window Units", value: "window_ac", item: "Window AC Units", category: "HVAC & Systems", maintenanceFrequency: "annual" },
            { label: "Boiler / Radiators", value: "boiler", item: "Boiler System", category: "HVAC & Systems", maintenanceFrequency: "annual" },
            { label: "Mini-Split", value: "mini_split", item: "Mini-Split System", category: "HVAC & Systems", maintenanceFrequency: "annual" },
        ],
        skipLabel: "No HVAC / Not sure",
        tip: "Filter changes every 1-3 months can improve efficiency by 15%"
    },
    {
        id: 'water_heater',
        icon: Droplets,
        title: "Hot Water",
        question: "What type of water heater do you have?",
        options: [
            { label: "Gas Tank", value: "gas_tank", item: "Gas Water Heater", category: "Plumbing", maintenanceFrequency: "annual", notes: "Typical lifespan: 8-12 years" },
            { label: "Electric Tank", value: "electric_tank", item: "Electric Water Heater", category: "Plumbing", maintenanceFrequency: "annual", notes: "Typical lifespan: 10-15 years" },
            { label: "Tankless Gas", value: "tankless_gas", item: "Tankless Water Heater", category: "Plumbing", maintenanceFrequency: "annual", notes: "Descale annually in hard water areas" },
            { label: "Tankless Electric", value: "tankless_electric", item: "Tankless Electric Water Heater", category: "Plumbing", maintenanceFrequency: "annual" },
            { label: "Heat Pump Water Heater", value: "heat_pump_wh", item: "Heat Pump Water Heater", category: "Plumbing", maintenanceFrequency: "annual" },
        ],
        skipLabel: "Not sure / Shared system",
        tip: "Flushing your tank annually removes sediment and extends life"
    },
    {
        id: 'roof',
        icon: Home,
        title: "Roof",
        question: "What type of roof does your home have?",
        options: [
            { label: "Asphalt Shingles", value: "asphalt", item: "Asphalt Shingle Roof", category: "Roof & Exterior", maintenanceFrequency: "annual", notes: "Typical lifespan: 20-30 years" },
            { label: "Metal Roof", value: "metal", item: "Metal Roof", category: "Roof & Exterior", maintenanceFrequency: "biennial", notes: "Typical lifespan: 40-70 years" },
            { label: "Tile (Clay/Concrete)", value: "tile", item: "Tile Roof", category: "Roof & Exterior", maintenanceFrequency: "annual", notes: "Typical lifespan: 50+ years" },
            { label: "Slate", value: "slate", item: "Slate Roof", category: "Roof & Exterior", maintenanceFrequency: "biennial", notes: "Typical lifespan: 75-100 years" },
            { label: "Flat / TPO / EPDM", value: "flat", item: "Flat Roof", category: "Roof & Exterior", maintenanceFrequency: "semiannual", notes: "Check for ponding water" },
        ],
        skipLabel: "Not sure",
        tip: "Knowing your roof age helps predict replacement costs"
    },
];

const ProgressBar = ({ current, total }) => (
    <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
            <div 
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < current ? 'bg-emerald-500' : i === current ? 'bg-emerald-300' : 'bg-slate-200'
                }`}
            />
        ))}
    </div>
);

const StepCard = ({ step, onSelect, onSkip, isLast }) => {
    const Icon = step.icon;
    const [selected, setSelected] = useState(null);
    
    const handleSelect = (option) => {
        setSelected(option.value);
        // Small delay for visual feedback
        setTimeout(() => onSelect(option), 300);
    };
    
    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-emerald-100 p-3 rounded-xl">
                    <Icon className="h-6 w-6 text-emerald-700" />
                </div>
                <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">{step.title}</p>
                    <h2 className="text-xl font-bold text-slate-800">{step.question}</h2>
                </div>
            </div>
            
            <div className="space-y-2 mb-6">
                {step.options.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => handleSelect(option)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                            selected === option.value
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{option.label}</span>
                            {selected === option.value ? (
                                <div className="h-6 w-6 bg-emerald-500 rounded-full flex items-center justify-center">
                                    <Check size={14} className="text-white" />
                                </div>
                            ) : (
                                <div className="h-6 w-6 border-2 border-slate-200 rounded-full" />
                            )}
                        </div>
                    </button>
                ))}
            </div>
            
            {/* Tip */}
            {step.tip && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 mb-6">
                    <p className="text-xs text-amber-800 flex items-start gap-2">
                        <Sparkles size={14} className="shrink-0 mt-0.5" />
                        <span>{step.tip}</span>
                    </p>
                </div>
            )}
            
            <button
                onClick={onSkip}
                className="w-full py-3 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
            >
                {step.skipLabel} →
            </button>
        </div>
    );
};

const CompletionScreen = ({ itemsAdded, onFinish, onScanReceipt }) => (
    <div className="text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="inline-flex p-4 bg-emerald-100 rounded-full mb-6">
            <Check className="h-12 w-12 text-emerald-600" />
        </div>
        
        <h2 className="text-2xl font-extrabold text-slate-800 mb-2">
            {itemsAdded > 0 ? `Nice! ${itemsAdded} items added` : "You're all set!"}
        </h2>
        <p className="text-slate-500 mb-8">
            {itemsAdded > 0 
                ? "Your home profile is taking shape. You can add more details anytime."
                : "You can add items whenever you're ready."
            }
        </p>
        
        <div className="space-y-3">
            <button
                onClick={onFinish}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-colors"
            >
                Go to Dashboard
            </button>
            
            <button
                onClick={onScanReceipt}
                className="w-full py-4 bg-white border-2 border-slate-200 hover:border-emerald-300 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
                <Camera size={18} />
                Scan a Receipt Instead
            </button>
        </div>
        
        <div className="mt-8 p-4 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500">
                <strong>Pro tip:</strong> Had work done recently? Create a contractor link and let them submit the details!
            </p>
        </div>
    </div>
);

export const GuidedOnboarding = ({ propertyName, onComplete, onAddItem, onScanReceipt, onDismiss }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [itemsAdded, setItemsAdded] = useState([]);
    const [showCompletion, setShowCompletion] = useState(false);
    
    const handleSelect = async (option) => {
        // Create the item
        const newItem = {
            item: option.item,
            category: option.category,
            maintenanceFrequency: option.maintenanceFrequency || 'none',
            notes: option.notes || '',
            dateInstalled: '', // User can fill in later
            area: 'General',
        };
        
        try {
            await onAddItem(newItem);
            setItemsAdded([...itemsAdded, newItem]);
            toast.success(`Added: ${option.item}`, { icon: '✓', duration: 1500 });
        } catch (e) {
            console.error(e);
        }
        
        // Move to next step
        if (currentStep < ONBOARDING_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            setShowCompletion(true);
        }
    };
    
    const handleSkip = () => {
        if (currentStep < ONBOARDING_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            setShowCompletion(true);
        }
    };
    
    const handleFinish = () => {
        onComplete(itemsAdded);
    };
    
    const currentStepData = ONBOARDING_STEPS[currentStep];
    
    return (
        <div className="min-h-[60vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    {currentStep > 0 && !showCompletion && (
                        <button 
                            onClick={() => setCurrentStep(currentStep - 1)}
                            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <h1 className="text-lg font-bold text-slate-800">
                        {showCompletion ? 'Setup Complete' : `Setting up ${propertyName || 'your home'}`}
                    </h1>
                </div>
                <button 
                    onClick={onDismiss}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
            
            {/* Progress */}
            {!showCompletion && (
                <div className="mb-8">
                    <ProgressBar current={currentStep} total={ONBOARDING_STEPS.length} />
                    <p className="text-xs text-slate-400 mt-2 text-center">
                        Step {currentStep + 1} of {ONBOARDING_STEPS.length}
                    </p>
                </div>
            )}
            
            {/* Content */}
            <div className="flex-grow">
                {showCompletion ? (
                    <CompletionScreen 
                        itemsAdded={itemsAdded.length}
                        onFinish={handleFinish}
                        onScanReceipt={onScanReceipt}
                    />
                ) : (
                    <StepCard 
                        step={currentStepData}
                        onSelect={handleSelect}
                        onSkip={handleSkip}
                        isLast={currentStep === ONBOARDING_STEPS.length - 1}
                    />
                )}
            </div>
            
            {/* Items Added Counter */}
            {itemsAdded.length > 0 && !showCompletion && (
                <div className="mt-6 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-emerald-500 text-white h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">
                            {itemsAdded.length}
                        </div>
                        <span className="text-sm font-medium text-emerald-800">
                            item{itemsAdded.length > 1 ? 's' : ''} added
                        </span>
                    </div>
                    <button 
                        onClick={() => setShowCompletion(true)}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                    >
                        Finish Early →
                    </button>
                </div>
            )}
        </div>
    );
};
