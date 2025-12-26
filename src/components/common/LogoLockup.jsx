// src/components/common/LogoLockup.jsx
// ============================================
// KRIB LOGO LOCKUP
// ============================================
// Combines the logo icon with the wordmark.
// Use this for headers, splash screens, etc.

import React from 'react';
import { Logo } from './Logo';
import { Wordmark } from './Wordmark';
import { brand } from '../../config/brand';

export const LogoLockup = ({ 
  layout = 'horizontal',  // 'horizontal' | 'stacked'
  size = 'md',
  variant = 'default',    // 'default' | 'white' | 'dark'
  showTagline = false,
  tagline = brand.tagline.short,
  className = ''
}) => {
  // Size mappings
  const sizeConfig = {
    xs: { logo: 24, wordmark: 'sm', gap: 'gap-2', tagline: 'text-xs' },
    sm: { logo: 32, wordmark: 'md', gap: 'gap-2', tagline: 'text-xs' },
    md: { logo: 40, wordmark: 'lg', gap: 'gap-3', tagline: 'text-sm' },
    lg: { logo: 52, wordmark: 'xl', gap: 'gap-3', tagline: 'text-sm' },
    xl: { logo: 64, wordmark: '2xl', gap: 'gap-4', tagline: 'text-base' },
  };

  const config = sizeConfig[size] || sizeConfig.md;
  
  // Variant to logo variant mapping
  const logoVariant = variant === 'white' ? 'white' : 'color';
  const wordmarkVariant = variant;

  // Tagline color
  const taglineColor = variant === 'white' 
    ? 'text-white/70' 
    : 'text-slate-500';

  if (layout === 'stacked') {
    return (
      <div className={`flex flex-col items-center ${config.gap} ${className}`}>
        <Logo size={config.logo} variant={logoVariant} />
        <div className="flex flex-col items-center">
          <Wordmark size={config.wordmark} variant={wordmarkVariant} />
          {showTagline && (
            <span className={`${config.tagline} ${taglineColor} mt-1`}>
              {tagline}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Horizontal layout (default)
  return (
    <div className={`flex items-center ${config.gap} ${className}`}>
      <Logo size={config.logo} variant={logoVariant} />
      <div className="flex flex-col">
        <Wordmark size={config.wordmark} variant={wordmarkVariant} />
        {showTagline && (
          <span className={`${config.tagline} ${taglineColor}`}>
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================
// PRESET LOCKUPS FOR COMMON USE CASES
// ============================================

// For app headers
export const HeaderLogo = ({ className = '' }) => (
  <LogoLockup size="sm" className={className} />
);

// For splash/loading screens
export const SplashLogo = ({ className = '' }) => (
  <LogoLockup 
    layout="stacked" 
    size="xl" 
    showTagline 
    className={className} 
  />
);

// For footer
export const FooterLogo = ({ className = '' }) => (
  <LogoLockup 
    size="sm" 
    showTagline 
    className={className} 
  />
);

// For dark backgrounds (hero sections, etc.)
export const HeroLogo = ({ className = '' }) => (
  <LogoLockup 
    layout="stacked" 
    size="xl" 
    variant="white"
    showTagline 
    className={className} 
  />
);

export default LogoLockup;
