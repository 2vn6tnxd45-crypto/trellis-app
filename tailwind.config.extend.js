// tailwind.config.extend.js
// ============================================
// 🎨 TAILWIND EXTENSION FOR KRIB THEME
// ============================================
// Merge this with your existing tailwind.config.js

/*
USAGE:
------
In your tailwind.config.js, merge this extend object:

module.exports = {
  // ... existing config
  theme: {
    extend: {
      ...require('./tailwind.config.extend').extend,
      // your other extensions
    },
  },
}
*/

module.exports = {
  extend: {
    fontFamily: {
      'sans': ['Satoshi', 'system-ui', 'sans-serif'],
      'display': ['Satoshi', 'system-ui', 'sans-serif'],
    },
    colors: {
      // Krib brand colors (emerald-based)
      krib: {
        50: '#ecfdf5',
        100: '#d1fae5',
        200: '#a7f3d0',
        300: '#6ee7b7',
        400: '#34d399',
        500: '#10b981',
        600: '#059669',
        700: '#047857',
        800: '#065f46',
        900: '#064e3b',
        950: '#022c22',
      },
      // Primary - Warm Sage
      sage: {
        50: '#f6f7f4',
        100: '#e8ebe3',
        200: '#d3d9c9',
        300: '#b5c0a4',
        400: '#97a67f',
        500: '#6b7c5e',
        600: '#566449',
        700: '#454f3b',
        800: '#3a4233',
        900: '#32382d',
        950: '#191d16',
      },
      
      // Accent - Terracotta
      terra: {
        50: '#fdf6f3',
        100: '#fae9e3',
        200: '#f6d5ca',
        300: '#eeb8a5',
        400: '#e39279',
        500: '#c4785a',
        600: '#b0614a',
        700: '#934e3d',
        800: '#794337',
        900: '#653b31',
        950: '#361c17',
      },
      
      // Warm Neutrals (can replace or supplement slate)
      warm: {
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
    },
    
    boxShadow: {
      'sage': '0 10px 25px -5px rgba(107, 124, 94, 0.25)',
      'sage-lg': '0 20px 40px -10px rgba(107, 124, 94, 0.3)',
      'terra': '0 10px 25px -5px rgba(196, 120, 90, 0.25)',
      'terra-lg': '0 20px 40px -10px rgba(196, 120, 90, 0.3)',
      'warm': '0 10px 25px -5px rgba(38, 36, 31, 0.15)',
    },
    
    backgroundImage: {
      'gradient-sage': 'linear-gradient(135deg, #6b7c5e 0%, #566449 100%)',
      'gradient-sage-light': 'linear-gradient(135deg, #f6f7f4 0%, #e8ebe3 100%)',
      'gradient-terra': 'linear-gradient(135deg, #c4785a 0%, #b0614a 100%)',
      'gradient-terra-light': 'linear-gradient(135deg, #fdf6f3 0%, #fae9e3 100%)',
      'gradient-hero': 'linear-gradient(135deg, #32382d 0%, #361c17 100%)',
      'gradient-hero-light': 'linear-gradient(135deg, #f6f7f4 0%, #fdf6f3 50%, #f8f8f7 100%)',
    },
    
    animation: {
      'pulse-sage': 'pulse-sage 2s ease-in-out infinite',
      'scan-line': 'scan-line 2s ease-in-out infinite',
      'celebration-pop': 'celebration-pop 0.4s ease-out',
      'slide-up': 'slide-up 0.3s ease-out',
      'confetti-fall': 'confetti-fall 3s linear forwards',
      'float': 'float 3s ease-in-out infinite',
      'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
      'fade-in': 'fadeIn 0.6s ease-out forwards',
    },
    
    keyframes: {
      'pulse-sage': {
        '0%, 100%': { boxShadow: '0 0 0 0 rgba(107, 124, 94, 0.4)' },
        '50%': { boxShadow: '0 0 0 10px rgba(107, 124, 94, 0)' },
      },
      'scan-line': {
        '0%, 100%': { transform: 'translateY(-100%)' },
        '50%': { transform: 'translateY(100%)' },
      },
      'celebration-pop': {
        '0%': { transform: 'scale(0.8)', opacity: '0' },
        '50%': { transform: 'scale(1.05)' },
        '100%': { transform: 'scale(1)', opacity: '1' },
      },
      'slide-up': {
        from: { transform: 'translateY(100%)' },
        to: { transform: 'translateY(0)' },
      },
      'confetti-fall': {
        '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
        '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
      },
      'float': {
        '0%, 100%': { transform: 'translateY(0)' },
        '50%': { transform: 'translateY(-10px)' },
      },
      'fadeInUp': {
        '0%': { opacity: '0', transform: 'translateY(20px)' },
        '100%': { opacity: '1', transform: 'translateY(0)' },
      },
      'fadeIn': {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
    },
    
    borderRadius: {
      '4xl': '2rem',
      '5xl': '2.5rem',
    },
  },
};
