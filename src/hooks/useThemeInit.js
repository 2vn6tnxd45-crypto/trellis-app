// src/hooks/useThemeInit.js
// ============================================
// 🌙 THEME INITIALIZATION HOOK
// ============================================
// Add this to your App.jsx to make dark mode work on page load

import { useEffect } from 'react';

/**
 * Initializes the theme based on:
 * 1. User's saved preference in localStorage
 * 2. System preference (if set to 'system' or no preference saved)
 * 
 * Call this once at the top level of your app (in App.jsx)
 */
export const useThemeInit = () => {
    useEffect(() => {
        // Prevent flash of wrong theme
        document.documentElement.classList.add('no-transitions');
        
        const savedTheme = localStorage.getItem('krib-theme') || 'system';
        
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            // 'system' - check user's OS preference
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
        
        // Re-enable transitions after a brief delay
        setTimeout(() => {
            document.documentElement.classList.remove('no-transitions');
        }, 100);
        
        // Listen for system theme changes (if user chose 'system')
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            const currentTheme = localStorage.getItem('krib-theme');
            if (currentTheme === 'system' || !currentTheme) {
                if (e.matches) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            }
        };
        
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);
};

export default useThemeInit;
