// src/components/navigation/BottomNav.jsx
import React from 'react';
import { 
    LayoutDashboard, Package, Plus, Wrench, Menu,
    FileText, Settings, HelpCircle, LogOut
} from 'lucide-react';

export const BottomNav = ({ activeTab, onTabChange, onAddClick, notificationCount = 0 }) => {
    const tabs = [
        { id: 'Dashboard', icon: LayoutDashboard, label: 'Home' },
        { id: 'Items', icon: Package, label: 'Inventory' },
        { id: 'add', icon: Plus, label: 'Add', isCenter: true },
        { id: 'Contractors', icon: Wrench, label: 'Pros', badge: notificationCount },
        { id: 'More', icon: Menu, label: 'More' },
    ];
    
    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 z-50 md:max-w-md md:left-1/2 md:-translate-x-1/2 md:rounded-full md:bottom-6 md:shadow-2xl md:border-slate-100 md:px-4">
            <div className="flex justify-around items-center">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    
                    if (tab.isCenter) {
                        return (
                            <button
                                key={tab.id}
                                onClick={onAddClick}
                                className="relative -top-6 group"
                            >
                                <div className="h-14 w-14 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-all group-active:scale-95">
                                    <Plus size={28} strokeWidth={2.5} />
                                </div>
                            </button>
                        );
                    }
                    
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors relative ${
                                isActive 
                                    ? 'text-emerald-600' 
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <div className="relative">
                                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                {tab.badge > 0 && (
                                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                                        {tab.badge > 9 ? '9+' : tab.badge}
                                    </span>
                                )}
                            </div>
                            <span className={`text-[10px] font-bold mt-0.5 ${isActive ? 'text-emerald-600' : ''}`}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export const MoreMenu = ({ isOpen, onClose, onNavigate, onSignOut }) => {
    if (!isOpen) return null;
    
    const menuItems = [
        { id: 'Reports', icon: FileText, label: 'Reports', description: 'Generate home reports' },
        { id: 'Settings', icon: Settings, label: 'Settings', description: 'Account & preferences' },
        { id: 'Help', icon: HelpCircle, label: 'Help & Support', description: 'FAQs and contact' },
    ];
    
    return (
        <>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]" onClick={onClose} />
            <div className="fixed bottom-24 left-4 right-4 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[70] overflow-hidden animate-in slide-in-from-bottom-4 duration-200 md:max-w-sm md:left-1/2 md:-translate-x-1/2">
                <div className="p-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => { onNavigate(item.id); onClose(); }}
                                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                            >
                                <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                    <Icon size={20} className="text-slate-600 group-hover:text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{item.label}</p>
                                    <p className="text-xs text-slate-500">{item.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="border-t border-slate-100 p-2">
                    <button
                        onClick={onSignOut}
                        className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-red-50 transition-colors text-left"
                    >
                        <div className="h-10 w-10 bg-red-50 rounded-xl flex items-center justify-center">
                            <LogOut size={20} className="text-red-600" />
                        </div>
                        <div>
                            <p className="font-bold text-red-600">Sign Out</p>
                        </div>
                    </button>
                </div>
            </div>
        </>
    );
};
