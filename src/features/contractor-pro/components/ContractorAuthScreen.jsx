// src/features/contractor-pro/components/ContractorAuthScreen.jsx
// ============================================
// CONTRACTOR AUTH SCREEN
// ============================================
// Sign up and sign in for contractor accounts

import React, { useState } from 'react';
import { 
    Mail, Lock, Eye, EyeOff, User, Building2, Phone,
    ArrowRight, Loader2, AlertCircle, CheckCircle,
    Sparkles, Users, TrendingUp, FileText
} from 'lucide-react';
import { Logo } from '../../../components/common/Logo';

// ============================================
// FEATURE HIGHLIGHT
// ============================================
const FeatureHighlight = ({ icon: Icon, title, description }) => (
    <div className="flex items-start gap-3">
        <div className="bg-white/20 p-2 rounded-lg text-white flex-shrink-0">
            <Icon size={18} />
        </div>
        <div>
            <p className="font-medium text-white">{title}</p>
            <p className="text-sm text-white/70">{description}</p>
        </div>
    </div>
);

// ============================================
// GOOGLE SIGN IN BUTTON
// ============================================
const GoogleButton = ({ onClick, loading, text = "Continue with Google" }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
    >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {loading ? 'Signing in...' : text}
    </button>
);

// ============================================
// DIVIDER
// ============================================
const Divider = ({ text = "or" }) => (
    <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-sm text-slate-400 font-medium">{text}</span>
        <div className="flex-1 h-px bg-slate-200" />
    </div>
);

// ============================================
// MAIN AUTH SCREEN
// ============================================
export const ContractorAuthScreen = ({
    onSignIn,
    onSignUp,
    onGoogleSignIn,
    onResetPassword,
    loading,
    error,
    onClearError
}) => {
    const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'reset'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    
    // Sign up specific fields
    const [name, setName] = useState('');
    const [company, setCompany] = useState('');
    const [phone, setPhone] = useState('');
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        onClearError?.();
        
        if (mode === 'signin') {
            await onSignIn(email, password);
        } else if (mode === 'signup') {
            await onSignUp(email, password, { name, company, phone });
        } else if (mode === 'reset') {
            const result = await onResetPassword(email);
            if (result?.success) {
                setResetSent(true);
            }
        }
    };
    
    const switchMode = (newMode) => {
        setMode(newMode);
        onClearError?.();
        setResetSent(false);
    };
    
    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Left Panel - Branding (Desktop) */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 to-emerald-700 p-12 flex-col justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-12">
                        <div>
                            <Logo className="h-10 w-10" variant="white" />
                            <p className="text-white/70 text-sm mt-1">For Professionals</p>
                        </div>
                    </div>
                    
                    <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
                        Build lasting customer relationships
                    </h2>
                    <p className="text-white/80 text-lg mb-12">
                        Track every job, stay connected with customers, and grow your business 
                        through repeat work and referrals.
                    </p>
                    
                    <div className="space-y-6">
                        <FeatureHighlight 
                            icon={Users}
                            title="Customer Relationship Tracking"
                            description="See every homeowner who has your contact info saved"
                        />
                        <FeatureHighlight 
                            icon={FileText}
                            title="Digital Work Portfolio"
                            description="Build a record of all your installations and repairs"
                        />
                        <FeatureHighlight 
                            icon={TrendingUp}
                            title="Business Insights"
                            description="Track your claim rate and customer engagement"
                        />
                    </div>
                </div>
                
                <p className="text-white/60 text-sm">
                    © {new Date().getFullYear()} Krib. All rights reserved.
                </p>
            </div>
            
            {/* Right Panel - Auth Form */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex flex-col items-center justify-center mb-8">
                        <Logo className="h-10 w-10" />
                        <p className="text-slate-500 text-xs mt-1">For Professionals</p>
                    </div>
                    
                    {/* Auth Card */}
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
                        {/* Header */}
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">
                                {mode === 'signin' && 'Welcome back'}
                                {mode === 'signup' && 'Create your account'}
                                {mode === 'reset' && 'Reset password'}
                            </h2>
                            <p className="text-slate-500 mt-1">
                                {mode === 'signin' && 'Sign in to your contractor dashboard'}
                                {mode === 'signup' && 'Start building your customer network'}
                                {mode === 'reset' && "We'll send you a reset link"}
                            </p>
                        </div>
                        
                        {/* Error Display */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                                <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}
                        
                        {/* Reset Success */}
                        {mode === 'reset' && resetSent && (
                            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                                <CheckCircle className="text-emerald-500 flex-shrink-0" size={20} />
                                <div>
                                    <p className="text-sm font-medium text-emerald-800">Check your email</p>
                                    <p className="text-sm text-emerald-600">
                                        We sent a password reset link to {email}
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        {/* Google Sign In */}
                        {mode !== 'reset' && (
                            <>
                                <GoogleButton 
                                    onClick={onGoogleSignIn}
                                    loading={loading}
                                    text={mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
                                />
                                <Divider text="or continue with email" />
                            </>
                        )}
                        
                        {/* Auth Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Sign Up Fields */}
                            {mode === 'signup' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                Your Name
                                            </label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input
                                                    type="text"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    placeholder="John Smith"
                                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                Company
                                            </label>
                                            <div className="relative">
                                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input
                                                    type="text"
                                                    value={company}
                                                    onChange={(e) => setCompany(e.target.value)}
                                                    placeholder="ABC Plumbing"
                                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Phone Number
                                        </label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="(555) 123-4567"
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                                        required
                                    />
                                </div>
                            </div>
                            
                            {/* Password (not for reset) */}
                            {mode !== 'reset' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            )}
                            
                            {/* Forgot Password Link */}
                            {mode === 'signin' && (
                                <div className="text-right">
                                    <button
                                        type="button"
                                        onClick={() => switchMode('reset')}
                                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                            )}
                            
                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        {mode === 'signin' && 'Signing in...'}
                                        {mode === 'signup' && 'Creating account...'}
                                        {mode === 'reset' && 'Sending...'}
                                    </>
                                ) : (
                                    <>
                                        {mode === 'signin' && 'Sign In'}
                                        {mode === 'signup' && 'Create Account'}
                                        {mode === 'reset' && 'Send Reset Link'}
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                        
                        {/* Mode Switch */}
                        <div className="mt-6 text-center">
                            {mode === 'signin' && (
                                <p className="text-sm text-slate-500">
                                    Don't have an account?{' '}
                                    <button
                                        onClick={() => switchMode('signup')}
                                        className="text-emerald-600 font-medium hover:text-emerald-700"
                                    >
                                        Sign up
                                    </button>
                                </p>
                            )}
                            {mode === 'signup' && (
                                <p className="text-sm text-slate-500">
                                    Already have an account?{' '}
                                    <button
                                        onClick={() => switchMode('signin')}
                                        className="text-emerald-600 font-medium hover:text-emerald-700"
                                    >
                                        Sign in
                                    </button>
                                </p>
                            )}
                            {mode === 'reset' && (
                                <button
                                    onClick={() => switchMode('signin')}
                                    className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
                                >
                                    ← Back to sign in
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {/* Homeowner Link */}
                    <p className="text-center text-sm text-slate-500 mt-6">
                        Are you a homeowner?{' '}
                        <a href="/" className="text-emerald-600 font-medium hover:text-emerald-700">
                            Go to Krib Home →
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ContractorAuthScreen;
