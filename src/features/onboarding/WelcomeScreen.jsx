// src/features/onboarding/WelcomeScreen.jsx
import React from 'react';
import { 
    Camera, 
    Plus, 
    Sparkles, 
    Home, 
    ArrowRight, 
    CheckCircle2,
    Lightbulb,
    FileText,
    Wrench
} from 'lucide-react';
import { Logo } from '../../components/common/Logo';

export const WelcomeScreen = ({ propertyName, onAddRecord, onDismiss }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Welcome Card */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-[2rem] p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
                
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
                        Krib helps you remember everything about your home—paint colors, 
                        appliance models, maintenance schedules, and more. Let's add your first item.
                    </p>
                </div>
            </div>

            {/* Quick Start Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                    onClick={onAddRecord}
                    className="bg-white p-6 rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-lg transition-all text-left group"
                >
                    <div className="flex items-start gap-4">
                        <div className="bg-emerald-100 p-3 rounded-xl group-hover:bg-emerald-200 transition-colors">
                            <Camera className="h-6 w-6 text-emerald-700" />
                        </div>
                        <div className="flex-grow">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 text-lg">Scan a Receipt</h3>
                                <ArrowRight className="h-5 w-5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-slate-500 text-sm mt-1">
                                Got a receipt from Home Depot or a contractor invoice? 
                                Our AI will extract all the details automatically.
                            </p>
                            <div className="mt-3 flex items-center text-emerald-600 text-xs font-bold">
                                <Sparkles className="h-3 w-3 mr-1" /> AI-Powered
                            </div>
                        </div>
                    </div>
                </button>

                <button 
                    onClick={onAddRecord}
                    className="bg-white p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all text-left group"
                >
                    <div className="flex items-start gap-4">
                        <div className="bg-slate-100 p-3 rounded-xl group-hover:bg-emerald-100 transition-colors">
                            <Plus className="h-6 w-6 text-slate-600 group-hover:text-emerald-700" />
                        </div>
                        <div className="flex-grow">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 text-lg">Add Manually</h3>
                                <ArrowRight className="h-5 w-5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-slate-500 text-sm mt-1">
                                Know your HVAC model or paint color? 
                                Type in the details and we'll organize it for you.
                            </p>
                        </div>
                    </div>
                </button>
            </div>

            {/* Suggested First Items */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-bold text-slate-800 flex items-center">
                        <Lightbulb className="h-5 w-5 mr-2 text-amber-500" />
                        Popular First Items
                    </h2>
                    <span className="text-xs text-slate-400 font-medium">Click to add</span>
                </div>
                
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        { icon: "🌡️", title: "HVAC System", desc: "Furnace, AC, air handler" },
                        { icon: "🚰", title: "Water Heater", desc: "Tank or tankless" },
                        { icon: "🎨", title: "Interior Paint", desc: "Wall colors & brands" },
                        { icon: "🏠", title: "Roof", desc: "Shingles, install date" },
                    ].map((item, i) => (
                        <button 
                            key={i}
                            onClick={onAddRecord}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 transition-colors text-left group"
                        >
                            <span className="text-2xl">{item.icon}</span>
                            <div className="flex-grow">
                                <p className="font-bold text-slate-800 text-sm">{item.title}</p>
                                <p className="text-xs text-slate-400">{item.desc}</p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                        </button>
                    ))}
                </div>
            </div>

            {/* Benefits List */}
            <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                <h3 className="font-bold text-emerald-900 mb-4 flex items-center">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    What you'll be able to do
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-lg border border-emerald-200">
                            <FileText className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                            <p className="font-bold text-emerald-900 text-sm">Generate Reports</p>
                            <p className="text-emerald-700 text-xs">Share your home's history when selling</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-lg border border-emerald-200">
                            <Wrench className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                            <p className="font-bold text-emerald-900 text-sm">Track Maintenance</p>
                            <p className="text-emerald-700 text-xs">Never miss filter changes again</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-lg border border-emerald-200">
                            <Home className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                            <p className="font-bold text-emerald-900 text-sm">Know Your Home</p>
                            <p className="text-emerald-700 text-xs">Every paint color, every model number</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Skip Button */}
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
