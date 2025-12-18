import React from 'react';
import { PackageOpen } from 'lucide-react';

// Use "export const" (Named Export) to match the "import { EmptyState }" in App.jsx
export const EmptyState = ({ title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed h-64">
      <div className="bg-white p-4 rounded-full shadow-sm mb-4">
        <PackageOpen size={32} className="text-slate-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-700 mb-1">{title}</h3>
      <p className="text-slate-500 max-w-xs mb-6 mx-auto">{description}</p>
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
};
