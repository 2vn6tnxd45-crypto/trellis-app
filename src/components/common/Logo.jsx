// src/components/common/Logo.jsx
// ============================================
// KRIB LOGO - Text Wordmark with Dot
// ============================================
// Clean text-based logo: "krib" with teal dot above the "i"
// Uses dotless i character (ı) to avoid double dots

import React from 'react';

export const Logo = ({ 
  className = "h-8 w-8", 
  size,
  variant = "color",
  color
}) => {
  // Figure out what size to make the text based on the height class or size prop
  const getTextSize = () => {
    if (size) {
      if (size <= 24) return 'text-lg';
      if (size <= 32) return 'text-xl';
      if (size <= 40) return 'text-2xl';
      if (size <= 52) return 'text-3xl';
      return 'text-4xl';
    }
    // Check className for height hints
    if (className.includes('h-6')) return 'text-lg';
    if (className.includes('h-8')) return 'text-xl';
    if (className.includes('h-9')) return 'text-2xl';
    if (className.includes('h-10')) return 'text-2xl';
    if (className.includes('h-12')) return 'text-3xl';
    return 'text-xl';
  };

  // Determine colors based on variant
  const getColors = () => {
    if (color) return { text: color, dot: color };
    switch (variant) {
      case 'white':
        return { text: '#ffffff', dot: '#ffffff' };
      case 'dark':
        return { text: '#0f172a', dot: '#10b981' };
      case 'muted':
        return { text: '#64748b', dot: '#10b981' };
      default:
        return { text: '#0f172a', dot: '#10b981' }; // Dark text, emerald dot
    }
  };

  const textSize = getTextSize();
  const colors = getColors();

  return (
    <span 
      className={`font-extrabold tracking-tight ${textSize}`}
      style={{ 
        fontFamily: '"Satoshi", system-ui, -apple-system, sans-serif',
        display: 'inline-flex',
        alignItems: 'baseline',
        lineHeight: 1,
      }}
      aria-label="Krib logo"
    >
      <span style={{ color: colors.text }}>kr</span>
      <span style={{ position: 'relative', color: colors.text }}>
        ı{/* This is a DOTLESS i character (Unicode U+0131) */}
        {/* The custom dot above the dotless i */}
        <span 
          style={{ 
            position: 'absolute',
            top: '-0.1em',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '0.22em',
            height: '0.22em',
            backgroundColor: colors.dot,
            borderRadius: '50%',
          }}
        />
      </span>
      <span style={{ color: colors.text }}>b</span>
    </span>
  );
};

// ============================================
// LOGO VARIANTS FOR SPECIFIC USE CASES
// ============================================

// App icon version (for favicons, app icons)
export const LogoIcon = ({ size = 32, variant = "white", background = true }) => {
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
      <Logo size={size * 0.5} variant="white" />
    </div>
  );
};

export default Logo;
