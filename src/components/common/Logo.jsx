// src/components/common/Logo.jsx
import React from 'react';

export const Logo = ({ className = "h-8 w-8", variant = "color" }) => {
  const fillColor = variant === "white" ? "#ffffff" : "#10b981";
  const windowColor = variant === "white" ? "#10b981" : "#ffffff";
  
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* House body with rounded corners */}
      <rect x="15" y="42" width="70" height="50" rx="10" fill={fillColor}/>
      {/* Roof */}
      <polygon points="50,8 95,42 5,42" fill={fillColor}/>
      {/* Window/door cutout */}
      <rect x="32" y="54" width="36" height="26" rx="6" fill={windowColor}/>
    </svg>
  );
};
