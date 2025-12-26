// src/components/common/Logo.jsx
// ============================================
// KRIB LOGO - "Negative Door" Design
// ============================================
// The craftsman house silhouette with door as negative space.
// Clean, iconic, memorable.

import React from 'react';

export const Logo = ({ 
  className = "h-8 w-8", 
  size,
  variant = "color",
  color
}) => {
  // Determine the fill color based on variant or explicit color prop
  const getFillColor = () => {
    if (color) return color;
    switch (variant) {
      case 'white': return '#ffffff';
      case 'dark': return '#0f172a';
      case 'muted': return '#64748b';
      default: return '#10b981'; // emerald-500
    }
  };

  const fillColor = getFillColor();

  // Support both className-based sizing and explicit size prop
  const sizeProps = size 
    ? { width: size, height: size } 
    : {};

  return (
    <svg 
      className={className}
      {...sizeProps}
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Krib logo"
    >
      {/* 
        Craftsman house silhouette with door carved out as negative space.
        The door uses fillRule="evenodd" to create the cutout effect.
      */}
      <path 
        d="M8 50 L50 24 L92 50 L84 50 L84 90 L60 90 L60 58 C60 55 57 52 54 52 L46 52 C43 52 40 55 40 58 L40 90 L16 90 L16 50 Z" 
        fill={fillColor}
        fillRule="evenodd"
      />
    </svg>
  );
};

// ============================================
// LOGO VARIANTS FOR SPECIFIC USE CASES
// ============================================

// App icon version (for favicons, app icons)
export const LogoIcon = ({ size = 32, variant = "white", background = true }) => {
  const bgColor = variant === "white" ? "#10b981" : "transparent";
  
  if (!background) {
    return <Logo size={size} variant={variant} />;
  }

  return (
    <div 
      style={{ 
        width: size, 
        height: size, 
        background: `linear-gradient(135deg, #10b981 0%, #059669 100%)`,
        borderRadius: size * 0.25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Logo size={size * 0.6} variant="white" />
    </div>
  );
};

export default Logo;
