export const useThemeInit = () => {
    useEffect(() => {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('krib-theme', 'light');
    }, []);
};
