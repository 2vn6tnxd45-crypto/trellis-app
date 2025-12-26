// src/config/brand.js
// ============================================
// KRIB BRAND CONSTANTS
// ============================================
// Single source of truth for all brand values.
// Import this anywhere you need brand colors, fonts, etc.

export const brand = {
  // ==========================================
  // NAME & TAGLINES
  // ==========================================
  name: 'krib',
  displayName: 'Krib',
  
  tagline: {
    short: 'Know your home',
    long: "Your home's digital twin",
    functional: 'Every detail, documented',
  },

  // ==========================================
  // COLORS
  // ==========================================
  colors: {
    // Primary - Emerald
    primary: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981', // Main brand color
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
    
    // Accent - Amber (for doors, warmth)
    accent: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b', // Main accent
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    
    // Semantic
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },

  // ==========================================
  // TYPOGRAPHY
  // ==========================================
  fonts: {
    // Display font for headings, logo wordmark
    display: '"Satoshi", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    
    // Body font
    body: '"Satoshi", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    
    // Mono font for codes, data
    mono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Monaco, monospace',
  },
  
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  // ==========================================
  // LOGO
  // ==========================================
  logo: {
    // The SVG path for the Negative Door logo
    svgPath: 'M8 50 L50 24 L92 50 L84 50 L84 90 L60 90 L60 58 C60 55 57 52 54 52 L46 52 C43 52 40 55 40 58 L40 90 L16 90 L16 50 Z',
    viewBox: '0 0 100 100',
  },

  // ==========================================
  // GRADIENTS
  // ==========================================
  gradients: {
    primary: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    accent: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    hero: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    dark: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  },

  // ==========================================
  // SPACING & RADII (for consistency)
  // ==========================================
  borderRadius: {
    sm: '0.5rem',    // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.5rem',    // 24px
    '2xl': '2rem',   // 32px
    full: '9999px',
  },

  // ==========================================
  // LINKS
  // ==========================================
  urls: {
    website: 'https://mykrib.app',
    support: 'mailto:support@mykrib.app',
    privacy: '/privacy_policy.html',
    terms: '/terms.html',
  },
};

// ==========================================
// CSS CUSTOM PROPERTIES
// ==========================================
// Add this to your :root in CSS for consistency
export const cssVariables = `
:root {
  /* Brand Colors */
  --krib-primary: #10b981;
  --krib-primary-dark: #059669;
  --krib-accent: #f59e0b;
  --krib-accent-dark: #d97706;
  
  /* Typography */
  --font-display: "Satoshi", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-body: "Satoshi", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  
  /* Spacing */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
}
`;

export default brand;
