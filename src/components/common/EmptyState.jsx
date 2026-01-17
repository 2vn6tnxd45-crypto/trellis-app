import React from 'react';
import { PackageOpen } from 'lucide-react';

// Use "export const" (Named Export) to match the "import { EmptyState }" in App.jsx
export const EmptyState = ({
  title,
  description,
  action,
  icon: CustomIcon = null,
  iconColor = "text-slate-400",
  compact = false
}) => {
  const IconComponent = CustomIcon || PackageOpen;

  return (
    <div className={`flex flex-col items-center justify-center text-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed ${
      compact ? 'p-6 h-auto' : 'p-8 h-64'
    }`}>
      <div className="bg-white p-4 rounded-full shadow-sm mb-4">
        <IconComponent size={compact ? 24 : 32} className={iconColor} />
      </div>
      <h3 className={`font-bold text-slate-700 mb-1 ${compact ? 'text-base' : 'text-lg'}`}>
        {title}
      </h3>
      <p className={`text-slate-500 max-w-xs mx-auto ${compact ? 'text-sm mb-4' : 'mb-6'}`}>
        {description}
      </p>
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
};
