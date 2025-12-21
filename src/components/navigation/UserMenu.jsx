// src/components/navigation/UserMenu.jsx
import React from 'react';
import { X, FileText, Settings, HelpCircle, LogOut, User } from 'lucide-react';

export const UserMenu = ({ 
    isOpen, 
    onClose, 
    onNavigate,
    onSignOut,
    userName 
}) => {
    if (!isOpen) return null;
    
    const menuItems = [
        { id: 'Reports', icon: FileText, label: 'Reports', description: 'Generate home reports' },
        { id: 'Settings', icon: Settings, label: 'Settings', description: 'Account & preferences' },
        { id: 'Help', icon: HelpCircle, label: 'Help & Support', description: 'FAQs and contact' },
    ];
    
    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]" 
                onClick={onClose} 
            />
            
            {/* Menu Panel */}
            <div className="fixed top-16 right-4 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[70] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
                {/* User Info Header */}
                {userName && (
                    <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                        <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <User size={18} className="text-emerald-600" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">{userName}</p>
                            <p className="text-xs text-slate-500">Manage your account</p>
                        </div>
                    </div>
                )}
                
                {/* Menu Items */}
                <div className="p-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => { 
                                    onNavigate(item.id); 
                                    onClose(); 
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                            >
                                <div className="h-9 w-9 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                                    <Icon size={16} className="text-slate-600 group-hover:text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800 text-sm">{item.label}</p>
                                    <p className="text-xs text-slate-500">{item.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
                
                {/* Sign Out */}
                <div className="border-t border-slate-100 p-2">
                    <button
                        onClick={() => {
                            onSignOut();
                            onClose();
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors text-left"
                    >
                        <div className="h-9 w-9 bg-red-50 rounded-lg flex items-center justify-center">
                            <LogOut size={16} className="text-red-600" />
                        </div>
                        <div>
                            <p className="font-medium text-red-600 text-sm">Sign Out</p>
                        </div>
                    </button>
                </div>
            </div>
        </>
    );
};

export default UserMenu;
