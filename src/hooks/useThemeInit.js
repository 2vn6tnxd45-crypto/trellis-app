// src/hooks/useThemeInit.js
import { useEffect } from 'react';

export const useThemeInit = () => {
    useEffect(() => {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('krib-theme', 'light');
    }, []);
};

export default useThemeInit;
