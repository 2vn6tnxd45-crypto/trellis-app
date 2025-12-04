// src/features/auth/AuthScreen.jsx
import React, { useState, useEffect } from 'react';
import { Mail, Lock } from 'lucide-react';
import { Logo } from '../../components/common/Logo';

// Simple Icons for buttons
const GoogleIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>);
const AppleIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.64 3.4 1.74-3.12 1.84-2.6 5.75.64 7.13-.5 1.24-1.14 2.47-2.69 4.14zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.54 4.33-3.74 4.25z" /></svg>);

export const AuthScreen = ({ onLogin, onGoogleLogin, onAppleLogin, onGuestLogin, error: authError }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('email')) {
            setEmail(params.get('email'));
            setIsSignUp(true);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError(null);
        setIsLoading(true);
        try {
            await onLogin(email, password, isSignUp);
        } catch (err) {
            setLocalError(err.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-sky-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans print:hidden">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="flex justify-center mb-4">
                     <Logo className="h-24 w-24 rounded-3xl shadow-lg bg-white p-2" />
                </div>
                <h2 className="mt-6 text-4xl font-extrabold text-sky-900 tracking-tight">{isSignUp ? 'Create your Pedigree' : 'Sign in to HausKey'}</h2>
                <p className="mt-2 text-base text-sky-600/80">The permanent record for your home.</p>
            </div>
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl shadow-sky-100/50 rounded-2xl sm:px-10 border border-sky-100">
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button onClick={onGoogleLogin} className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-200 rounded-xl shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"><span className="mr-2"><GoogleIcon /></span> Google</button>
                        <button onClick={onAppleLogin} className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-200 rounded-xl shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"><span className="mr-2"><AppleIcon /></span> Apple</button>
                    </div>
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                        <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-400">Or continue with email</span></div>
                    </div>
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-bold text-sky-900 mb-1">Email</label>
                            <div className="relative rounded-xl shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail size={18} className="text-gray-400" /></div>
                                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-10 sm:text-sm border-gray-200 rounded-xl p-3 border focus:ring-sky-500 focus:border-sky-500" placeholder="you@example.com"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-sky-900 mb-1">Password</label>
                            <div className="relative rounded-xl shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock size={18} className="text-gray-400" /></div>
                                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-10 sm:text-sm border-gray-200 rounded-xl p-3 border focus:ring-sky-500 focus:border-sky-500" placeholder="••••••••"/>
                            </div>
                        </div>
                        {(localError || authError) && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-100">{localError || authError}</div>}
                        <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-sky-200 text-sm font-bold text-white bg-sky-900 hover:bg-sky-800 disabled:opacity-50 transition-all">{isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}</button>
                    </form>
                    <div className="mt-6 text-center space-y-4">
                        <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm font-medium text-sky-600 hover:text-sky-800">{isSignUp ? 'Already have an account? Sign in' : 'Need an account? Create one'}</button>
                        <div className="border-t border-gray-100 pt-4"><button onClick={onGuestLogin} className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wider">Try as a Guest</button></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
