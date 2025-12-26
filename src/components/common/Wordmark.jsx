// src/components/common/Wordmark.jsx
// ============================================
// KRIB WORDMARK
// ============================================
// The "krib" text treatment with accented "i".
// Uses Satoshi font (must be loaded in CSS/HTML).

import React from 'react';
import { brand } from '../../config/brand';

export const Wordmark = ({ 
  size = 'md',
  variant = 'default',
  accentI = true,
  className = ''
}) => {
  // Size presets
  const sizes = {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
    '2xl': 'text-5xl',
  };

  // Color variants
  const getColors = () => {
    switch (variant) {
      case 'white':
        return { text: 'text-white', accent: 'text-white' };
      case 'dark':
        return { text: 'text-slate-900', accent: 'text-emerald-500' };
      case 'muted':
        return { text: 'text-slate-600', accent: 'text-emerald-500' };
      default:
        return { text: 'text-slate-900', accent: 'text-emerald-500' };
    }
  };

  const colors = getColors();
  const sizeClass = sizes[size] || sizes.md;

  return (
    <span 
      className={`font-extrabold tracking-tight ${sizeClass} ${className}`}
      style={{ fontFamily: brand.fonts.display }}
    >
      <span className={colors.text}>kr</span>
      <span className={accentI ? colors.accent : colors.text}>i</span>
      <span className={colors.text}>b</span>
    </span>
  );
};

export default Wordmark;
