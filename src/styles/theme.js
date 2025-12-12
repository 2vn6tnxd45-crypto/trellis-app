// src/styles/theme.js
// ============================================
// 🎨 KRIB THEME SYSTEM
// ============================================
// Warmer, more residential color palette.
// Replaces clinical emerald with sage/terracotta tones.

// ============================================
// COLOR PALETTE
// ============================================

export const colors = {
    // Primary - Warm Sage (replaces clinical emerald)
    primary: {
        50: '#f6f7f4',
        100: '#e8ebe3',
        200: '#d3d9c9',
        300: '#b5c0a4',
        400: '#97a67f',
        500: '#6b7c5e',  // Main primary
        600: '#566449',
        700: '#454f3b',
        800: '#3a4233',
        900: '#32382d',
        950: '#191d16',
    },
    
    // Accent - Terracotta (warm, residential feel)
    accent: {
        50: '#fdf6f3',
        100: '#fae9e3',
        200: '#f6d5ca',
        300: '#eeb8a5',
        400: '#e39279',
        500: '#c4785a',  // Main accent
        600: '#b0614a',
        700: '#934e3d',
        800: '#794337',
        900: '#653b31',
        950: '#361c17',
    },
    
    // Neutral - Warm Grays
    slate: {
        50: '#f8f8f7',
        100: '#f0efed',
        200: '#e3e1dd',
        300: '#d1cdc7',
        400: '#a9a49b',
        500: '#8a847a',
        600: '#736d64',
        700: '#5f5a53',
        800: '#504c47',
        900: '#45423e',
        950: '#26241f',
    },
    
    // Semantic Colors
    success: {
        light: '#e8f5e8',
        main: '#4a8c4a',
        dark: '#2d5a2d',
    },
    warning: {
        light: '#fff3e0',
        main: '#e6a23c',
        dark: '#b88230',
    },
    error: {
        light: '#fde8e8',
        main: '#c45c5c',
        dark: '#9a4444',
    },
    info: {
        light: '#e3f2fd',
        main: '#5c8bc4',
        dark: '#446a9a',
    },
};

// ============================================
// GRADIENTS
// ============================================

export const gradients = {
    // Primary gradients
    primary: 'linear-gradient(135deg, #6b7c5e 0%, #566449 100%)',
    primarySubtle: 'linear-gradient(135deg, #f6f7f4 0%, #e8ebe3 100%)',
    
    // Accent gradients  
    accent: 'linear-gradient(135deg, #c4785a 0%, #b0614a 100%)',
    accentSubtle: 'linear-gradient(135deg, #fdf6f3 0%, #fae9e3 100%)',
    
    // Hero gradients
    heroLight: 'linear-gradient(135deg, #f6f7f4 0%, #fdf6f3 50%, #f8f8f7 100%)',
    heroDark: 'linear-gradient(135deg, #32382d 0%, #361c17 100%)',
    
    // Status gradients
    success: 'linear-gradient(135deg, #4a8c4a 0%, #2d5a2d 100%)',
    warning: 'linear-gradient(135deg, #e6a23c 0%, #b88230 100%)',
    error: 'linear-gradient(135deg, #c45c5c 0%, #9a4444 100%)',
};

// ============================================
// SHADOWS
// ============================================

export const shadows = {
    sm: '0 1px 2px 0 rgba(38, 36, 31, 0.05)',
    base: '0 1px 3px 0 rgba(38, 36, 31, 0.1), 0 1px 2px -1px rgba(38, 36, 31, 0.1)',
    md: '0 4px 6px -1px rgba(38, 36, 31, 0.1), 0 2px 4px -2px rgba(38, 36, 31, 0.1)',
    lg: '0 10px 15px -3px rgba(38, 36, 31, 0.1), 0 4px 6px -4px rgba(38, 36, 31, 0.1)',
    xl: '0 20px 25px -5px rgba(38, 36, 31, 0.1), 0 8px 10px -6px rgba(38, 36, 31, 0.1)',
    
    // Colored shadows
    primary: '0 10px 25px -5px rgba(107, 124, 94, 0.25)',
    accent: '0 10px 25px -5px rgba(196, 120, 90, 0.25)',
    success: '0 10px 25px -5px rgba(74, 140, 74, 0.25)',
    error: '0 10px 25px -5px rgba(196, 92, 92, 0.25)',
};

// ============================================
// COMPONENT STYLES
// ============================================

export const components = {
    // Buttons
    button: {
        primary: {
            background: gradients.primary,
            color: '#ffffff',
            shadow: shadows.primary,
            hover: {
                transform: 'translateY(-1px)',
                shadow: shadows.lg,
            },
        },
        secondary: {
            background: '#ffffff',
            color: colors.primary[600],
            border: `2px solid ${colors.primary[200]}`,
            hover: {
                border: `2px solid ${colors.primary[400]}`,
                background: colors.primary[50],
            },
        },
        accent: {
            background: gradients.accent,
            color: '#ffffff',
            shadow: shadows.accent,
        },
    },
    
    // Cards
    card: {
        background: '#ffffff',
        border: `1px solid ${colors.slate[200]}`,
        borderRadius: '1rem',
        shadow: shadows.base,
        hover: {
            border: `1px solid ${colors.primary[300]}`,
            shadow: shadows.md,
        },
    },
    
    // Inputs
    input: {
        background: '#ffffff',
        border: `2px solid ${colors.slate[200]}`,
        borderRadius: '0.75rem',
        focus: {
            border: `2px solid ${colors.primary[400]}`,
            ring: `0 0 0 3px ${colors.primary[100]}`,
        },
    },
    
    // Badges
    badge: {
        primary: {
            background: colors.primary[100],
            color: colors.primary[700],
        },
        accent: {
            background: colors.accent[100],
            color: colors.accent[700],
        },
        success: {
            background: colors.success.light,
            color: colors.success.dark,
        },
        warning: {
            background: colors.warning.light,
            color: colors.warning.dark,
        },
        error: {
            background: colors.error.light,
            color: colors.error.dark,
        },
    },
};

// ============================================
// TAILWIND CSS VARIABLES (for index.css)
// ============================================

export const cssVariables = `
:root {
  /* Primary - Sage */
  --color-primary-50: #f6f7f4;
  --color-primary-100: #e8ebe3;
  --color-primary-200: #d3d9c9;
  --color-primary-300: #b5c0a4;
  --color-primary-400: #97a67f;
  --color-primary-500: #6b7c5e;
  --color-primary-600: #566449;
  --color-primary-700: #454f3b;
  --color-primary-800: #3a4233;
  --color-primary-900: #32382d;
  
  /* Accent - Terracotta */
  --color-accent-50: #fdf6f3;
  --color-accent-100: #fae9e3;
  --color-accent-200: #f6d5ca;
  --color-accent-300: #eeb8a5;
  --color-accent-400: #e39279;
  --color-accent-500: #c4785a;
  --color-accent-600: #b0614a;
  --color-accent-700: #934e3d;
  --color-accent-800: #794337;
  --color-accent-900: #653b31;
  
  /* Neutral - Warm Grays */
  --color-slate-50: #f8f8f7;
  --color-slate-100: #f0efed;
  --color-slate-200: #e3e1dd;
  --color-slate-300: #d1cdc7;
  --color-slate-400: #a9a49b;
  --color-slate-500: #8a847a;
  --color-slate-600: #736d64;
  --color-slate-700: #5f5a53;
  --color-slate-800: #504c47;
  --color-slate-900: #45423e;
}
`;

// ============================================
// TAILWIND CONFIG EXTENSION
// ============================================

export const tailwindExtend = {
    colors: {
        // Primary palette
        sage: colors.primary,
        // Accent palette
        terra: colors.accent,
        // Override default slate with warm grays
        // (or keep as separate 'warm' palette)
        warm: colors.slate,
    },
    boxShadow: {
        'primary': shadows.primary,
        'accent': shadows.accent,
        'success': shadows.success,
        'error': shadows.error,
    },
    backgroundImage: {
        'gradient-primary': gradients.primary,
        'gradient-accent': gradients.accent,
        'gradient-hero-light': gradients.heroLight,
        'gradient-hero-dark': gradients.heroDark,
    },
};

// ============================================
// HELPER: GET THEME CLASSES
// ============================================

export const getButtonClasses = (variant = 'primary') => {
    const base = 'font-bold rounded-xl transition-all duration-200 active:scale-[0.98]';
    
    const variants = {
        primary: `${base} bg-gradient-to-r from-sage-500 to-sage-600 text-white shadow-primary hover:shadow-lg hover:-translate-y-0.5`,
        secondary: `${base} bg-white border-2 border-sage-200 text-sage-700 hover:border-sage-400 hover:bg-sage-50`,
        accent: `${base} bg-gradient-to-r from-terra-500 to-terra-600 text-white shadow-accent hover:shadow-lg hover:-translate-y-0.5`,
        ghost: `${base} text-sage-600 hover:bg-sage-50`,
        danger: `${base} bg-gradient-to-r from-red-500 to-red-600 text-white shadow-error hover:shadow-lg`,
    };
    
    return variants[variant] || variants.primary;
};

export const getCardClasses = (interactive = false) => {
    const base = 'bg-white rounded-2xl border border-warm-200';
    
    if (interactive) {
        return `${base} hover:border-sage-300 hover:shadow-md transition-all cursor-pointer`;
    }
    
    return base;
};

export const getBadgeClasses = (variant = 'primary') => {
    const base = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold';
    
    const variants = {
        primary: `${base} bg-sage-100 text-sage-700`,
        accent: `${base} bg-terra-100 text-terra-700`,
        success: `${base} bg-green-100 text-green-700`,
        warning: `${base} bg-amber-100 text-amber-700`,
        error: `${base} bg-red-100 text-red-700`,
        neutral: `${base} bg-warm-100 text-warm-700`,
    };
    
    return variants[variant] || variants.primary;
};

// ============================================
// THEME CONTEXT (optional, for dynamic theming)
// ============================================

import { createContext, useContext } from 'react';

const ThemeContext = createContext({
    colors,
    gradients,
    shadows,
    components,
});

export const ThemeProvider = ({ children }) => {
    return (
        <ThemeContext.Provider value={{ colors, gradients, shadows, components }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);

export default {
    colors,
    gradients,
    shadows,
    components,
    cssVariables,
    tailwindExtend,
    getButtonClasses,
    getCardClasses,
    getBadgeClasses,
};
