// src/features/onboarding/WelcomeScreen.jsx
import React from 'react';
import { Camera, Plus, Sparkles, Home, ArrowRight, CheckCircle2, Lightbulb, FileText, Wrench } from 'lucide-react';

export const WelcomeScreen = ({ propertyName, onAddRecord, onDismiss }) => {
    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-[2rem] p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <span className="text-emerald-100 font-bold text-sm uppercase tracking-wider">Welcome to Krib</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
                        Let's set up {propertyName || 'your home'}! 🏠
                    </h1>
                    <p className="text-emerald-100 text-lg max-w-xl leading-relaxed">
                        Krib helps you remember everything about your home—paint colors, appliance models, maintenance schedules, and more.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={onAddRecord} className="bg-white p-6 rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-lg transition-all text-left group">
                    <div className="flex items-start gap-4">
                        <div className="bg-emerald-100 p-3 rounded-xl group-hover:bg-emerald-200 transition-colors">
                            <Camera className="h-6 w-6 text-emerald-700" />
                        </div>
                        <div className="flex-grow">
                            <h3 className="font-bold text-slate-800 text-lg">Scan a Receipt</h3>
                            <p className="text-slate-500 text-sm mt-1">Upload a receipt and our AI extracts the details.</p>
                            <div className="mt-3 flex items-center text-emerald-600 text-xs font-bold">
                                <Sparkles className="h-3 w-3 mr-1" /> AI-Powered
                            </div>
                        </div>
                    </div>
                </button>

                <button onClick={onAddRecord} className="bg-white p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all text-left group">
                    <div className="flex items-start gap-4">
                        <div className="bg-slate-100 p-3 rounded-xl group-hover:bg-emerald-100 transition-colors">
                            <Plus className="h-6 w-6 text-slate-600 group-hover:text-emerald-700" />
                        </div>
                        <div className="flex-grow">
                            <h3 className="font-bold text-slate-800 text-lg">Add Manually</h3>
                            <p className="text-slate-500 text-sm mt-1">Type in the details yourself.</p>
                        </div>
                    </div>
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800 flex items-center">
                        <Lightbulb className="h-5 w-5 mr-2 text-amber-500" />
                        Popular First Items
                    </h2>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={onAddRecord} className="flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 transition-colors text-left">
                        <span className="text-2xl">🌡️</span>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">HVAC System</p>
                            <p className="text-xs text-slate-400">Furnace, AC</p>
                        </div>
                    </button>
                    <button onClick={onAddRecord} className="flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 transition-colors text-left">
                        <span className="text-2xl">🚰</span>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">Water Heater</p>
                            <p className="text-xs text-slate-400">Tank or tankless</p>
                        </div>
                    </button>
                    <button onClick={onAddRecord} className="flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 transition-colors text-left">
                        <span className="text-2xl">🎨</span>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">Interior Paint</p>
                            <p className="text-xs text-slate-400">Wall colors</p>
                        </div>
                    </button>
                    <button onClick={onAddRecord} className="flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 transition-colors text-left">
                        <span className="text-2xl">🏠</span>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">Roof</p>
                            <p className="text-xs text-slate-400">Shingles, date</p>
                        </div>
                    </button>
                </div>
            </div>

            <div className="text-center">
                <button onClick={onDismiss} className="text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors">
                    Skip for now — I'll explore on my own
                </button>
            </div>
        </div>
    );
};
