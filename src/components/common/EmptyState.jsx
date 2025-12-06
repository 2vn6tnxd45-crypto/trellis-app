// src/components/common/EmptyState.jsx
import React from 'react';

export const EmptyState = ({ icon: Icon, title, description, actions }) => (
    <div className="text-center py-12 px-6 bg-white rounded-3xl border border-dashed border-slate-200 flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-emerald-50 rounded-full p-4 mb-4">
            <Icon className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-500 max-w-xs mb-8 text-sm leading-relaxed">
            {description}
        </p>
        {actions && (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {actions}
            </div>
        )}
    </div>
);
