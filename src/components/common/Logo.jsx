// src/components/common/Logo.jsx
import React from 'react';

export const Logo = ({ className = "h-8 w-8", variant = "color" }) => {
  // Use the variant to determine stroke color (defaulting to emerald-500 #10b981)
  const strokeColor = variant === "white" ? "#ffffff" : "#10b981";
  
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="18" y="44" width="64" height="48" rx="8" stroke={strokeColor} strokeWidth="4" fill="none"/>
      <path d="M50 12 L88 44 L12 44 Z" stroke={strokeColor} strokeWidth="4" fill="none" strokeLinejoin="round"/>
      <rect x="35" y="56" width="30" height="24" rx="4" stroke={strokeColor} strokeWidth="3" fill="none"/>
    </svg>
  );
};
