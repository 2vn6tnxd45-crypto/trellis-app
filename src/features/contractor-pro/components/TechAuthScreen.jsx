// src/features/contractor-pro/components/TechAuthScreen.jsx
// ============================================
// TECH AUTHENTICATION SCREEN
// ============================================
// Login screen for field technicians to access portal
// Supports PIN login and invite link setup

import React, { useState, useEffect, useRef } from 'react';
import {
    Smartphone, Lock, Eye, EyeOff, ArrowRight, Loader2,
    CheckCircle, AlertCircle, Building2, User, RefreshCw,
    KeyRound, Phone, Mail, ChevronLeft
} from 'lucide-react';
import {
    authenticateWithPin,
    authenticateByContact,
    validateInviteToken,
    completeInviteSetup,
    PIN_LENGTH
} from '../lib/techAuthService';

// ============================================
// PIN INPUT COMPONENT
// ============================================

const PinInput = ({ length = 4, value, onChange, disabled = false, autoFocus = true }) => {
    const inputRefs = useRef([]);

    const handleChange = (index, digit) => {
        if (!/^\d*$/.test(digit)) return;

        const newValue = value.split('');
        newValue[index] = digit;
        const newPin = newValue.join('').slice(0, length);
        onChange(newPin);

        // Auto-advance to next input
        if (digit && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !value[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
        onChange(pastedData);
        // Focus last filled input or next empty
        const focusIndex = Math.min(pastedData.length, length - 1);
        inputRefs.current[focusIndex]?.focus();
    };

    useEffect(() => {
        if (autoFocus && inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, [autoFocus]);

    return (
        <div className="flex gap-3 justify-center">
            {Array.from({ length }).map((_, i) => (
                <input
                    key={i}
                    ref={el => inputRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={1}
                    value={value[i] || ''}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    className={`w-14 h-16 text-center text-2xl font-bold border-2 rounded-xl outline-none transition-all ${
                        disabled ? 'bg-slate-100 text-slate-400 border-slate-200' :
                        value[i] ? 'border-emerald-400 bg-emerald-50 text-emerald-700' :
                        'border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                    }`}
                />
            ))}
        </div>
    );
};

// ============================================
// LOGIN FORM
// ============================================

const LoginForm = ({ onSuccess, initialContractorId = null }) => {
    const [mode, setMode] = useState('quickLogin'); // quickLogin, techId, contact
    const [contractorId, setContractorId] = useState(initialContractorId || '');
    const [techId, setTechId] = useState('');
    const [contact, setContact] = useState('');
    const [pin, setPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showContractorList, setShowContractorList] = useState(false);
    const [contractors, setContractors] = useState([]);

    // Recent logins from localStorage for quick login
    const [recentLogins, setRecentLogins] = useState([]);

    useEffect(() => {
        try {
            const recent = JSON.parse(localStorage.getItem('trellis_recent_tech_logins') || '[]');
            setRecentLogins(recent.slice(0, 3));
        } catch {
            setRecentLogins([]);
        }
    }, []);

    const handleLogin = async (e) => {
        e?.preventDefault();

        if (pin.length !== PIN_LENGTH) {
            setError(`Enter your ${PIN_LENGTH}-digit PIN`);
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            let result;

            if (mode === 'contact') {
                result = await authenticateByContact(contact, pin);
            } else {
                // quickLogin or techId mode
                result = await authenticateWithPin(contractorId, techId, pin);
            }

            if (result.multipleContractors) {
                setContractors(result.contractors);
                setShowContractorList(true);
                setIsLoading(false);
                return;
            }

            if (result.success) {
                // Save to recent logins
                const newRecent = [
                    { contractorId, techId, techName: result.session.techName, contractorName: result.session.contractorName },
                    ...recentLogins.filter(r => !(r.contractorId === contractorId && r.techId === techId))
                ].slice(0, 3);
                localStorage.setItem('trellis_recent_tech_logins', JSON.stringify(newRecent));

                onSuccess(result.session);
            } else {
                setError(result.error || 'Login failed');
                setPin('');
            }
        } catch (err) {
            setError('Login failed. Please try again.');
            setPin('');
        } finally {
            setIsLoading(false);
        }
    };

    const selectContractor = (contractor) => {
        setContractorId(contractor.id);
        setShowContractorList(false);
        setMode('techId');
    };

    const selectRecentLogin = (recent) => {
        setContractorId(recent.contractorId);
        setTechId(recent.techId);
        setMode('quickLogin');
    };

    // Auto-submit when PIN is complete
    useEffect(() => {
        if (pin.length === PIN_LENGTH && (contractorId && techId || contact)) {
            handleLogin();
        }
    }, [pin]);

    return (
        <div className="w-full max-w-md mx-auto">
            {/* Contractor selection overlay */}
            {showContractorList && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-700 mb-3">Multiple accounts found. Select your company:</p>
                    <div className="space-y-2">
                        {contractors.map(c => (
                            <button
                                key={c.id}
                                onClick={() => selectContractor(c)}
                                className="w-full p-3 bg-white border border-amber-200 rounded-lg text-left hover:border-emerald-400 hover:bg-emerald-50 transition-colors flex items-center gap-3"
                            >
                                <Building2 size={18} className="text-slate-400" />
                                <span className="font-medium text-slate-800">{c.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent logins */}
            {recentLogins.length > 0 && mode === 'quickLogin' && !showContractorList && (
                <div className="mb-6">
                    <p className="text-sm text-slate-500 mb-3 text-center">Recent logins</p>
                    <div className="space-y-2">
                        {recentLogins.map((recent, i) => (
                            <button
                                key={i}
                                onClick={() => selectRecentLogin(recent)}
                                className={`w-full p-3 border rounded-xl text-left transition-colors flex items-center gap-3 ${
                                    contractorId === recent.contractorId && techId === recent.techId
                                        ? 'border-emerald-400 bg-emerald-50'
                                        : 'border-slate-200 hover:border-emerald-300 bg-white'
                                }`}
                            >
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                                    style={{ backgroundColor: '#10B981' }}
                                >
                                    {recent.techName?.charAt(0) || 'T'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800 truncate">{recent.techName}</p>
                                    <p className="text-xs text-slate-500 truncate">{recent.contractorName}</p>
                                </div>
                                {contractorId === recent.contractorId && techId === recent.techId && (
                                    <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Mode selector */}
            {!showContractorList && (
                <div className="flex gap-2 mb-6">
                    {recentLogins.length > 0 && (
                        <button
                            onClick={() => setMode('quickLogin')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                mode === 'quickLogin'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Quick Login
                        </button>
                    )}
                    <button
                        onClick={() => setMode('contact')}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                            mode === 'contact'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        Phone/Email
                    </button>
                </div>
            )}

            {/* Contact login */}
            {mode === 'contact' && !showContractorList && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                        Phone number or email
                    </label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                            placeholder="(555) 123-4567 or email@company.com"
                            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        />
                    </div>
                </div>
            )}

            {/* PIN entry */}
            {((mode === 'quickLogin' && contractorId && techId) || (mode === 'contact' && contact)) && !showContractorList && (
                <form onSubmit={handleLogin}>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-600 mb-4 text-center">
                            Enter your {PIN_LENGTH}-digit PIN
                        </label>
                        <PinInput
                            length={PIN_LENGTH}
                            value={pin}
                            onChange={setPin}
                            disabled={isLoading}
                        />
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || pin.length !== PIN_LENGTH}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Logging in...
                            </>
                        ) : (
                            <>
                                <Lock size={18} />
                                Login
                            </>
                        )}
                    </button>
                </form>
            )}

            {/* No selection prompt */}
            {mode === 'quickLogin' && (!contractorId || !techId) && recentLogins.length === 0 && !showContractorList && (
                <div className="text-center py-8">
                    <User size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-600 mb-4">No recent logins</p>
                    <button
                        onClick={() => setMode('contact')}
                        className="text-emerald-600 font-medium hover:underline"
                    >
                        Login with phone or email
                    </button>
                </div>
            )}
        </div>
    );
};

// ============================================
// INVITE SETUP FORM
// ============================================

const InviteSetupForm = ({ token, contractorId, onSuccess }) => {
    const [step, setStep] = useState('validating'); // validating, setup, success
    const [techInfo, setTechInfo] = useState(null);
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        validateInvite();
    }, [token, contractorId]);

    const validateInvite = async () => {
        const result = await validateInviteToken(token, contractorId);
        if (result.valid) {
            setTechInfo(result);
            setStep('setup');
        } else {
            setError(result.error || 'Invalid invite link');
            setStep('error');
        }
    };

    const handleSetup = async (e) => {
        e.preventDefault();

        if (pin.length !== PIN_LENGTH) {
            setError(`PIN must be ${PIN_LENGTH} digits`);
            return;
        }

        if (pin !== confirmPin) {
            setError('PINs do not match');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await completeInviteSetup(token, contractorId, pin);
            if (result.success) {
                setStep('success');
                // Auto-login after short delay
                setTimeout(() => {
                    onSuccess(result.techId);
                }, 2000);
            } else {
                setError(result.error || 'Setup failed');
            }
        } catch (err) {
            setError('Setup failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (step === 'validating') {
        return (
            <div className="text-center py-12">
                <Loader2 size={40} className="mx-auto text-emerald-500 animate-spin mb-4" />
                <p className="text-slate-600">Validating invite...</p>
            </div>
        );
    }

    if (step === 'error') {
        return (
            <div className="text-center py-12">
                <AlertCircle size={40} className="mx-auto text-red-400 mb-4" />
                <p className="text-slate-800 font-medium mb-2">Unable to complete setup</p>
                <p className="text-slate-500 text-sm mb-6">{error}</p>
                <button
                    onClick={() => window.location.href = '/tech-portal'}
                    className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
                >
                    Go to Login
                </button>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="text-center py-12">
                <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
                <p className="text-slate-800 font-bold text-lg mb-2">Setup Complete!</p>
                <p className="text-slate-500">Logging you in...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto">
            {/* Welcome header */}
            <div className="text-center mb-8">
                <div
                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl"
                    style={{ backgroundColor: techInfo?.tech?.color || '#10B981' }}
                >
                    {techInfo?.tech?.name?.charAt(0) || 'T'}
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">
                    Welcome, {techInfo?.tech?.name}!
                </h2>
                <p className="text-slate-500">
                    Set up portal access for {techInfo?.contractorName}
                </p>
            </div>

            <form onSubmit={handleSetup}>
                {/* Create PIN */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-600 mb-4 text-center">
                        Create a {PIN_LENGTH}-digit PIN
                    </label>
                    <PinInput
                        length={PIN_LENGTH}
                        value={pin}
                        onChange={setPin}
                        disabled={isLoading}
                    />
                    <p className="text-xs text-slate-400 text-center mt-2">
                        You'll use this PIN to log in daily
                    </p>
                </div>

                {/* Confirm PIN */}
                {pin.length === PIN_LENGTH && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-600 mb-4 text-center">
                            Confirm your PIN
                        </label>
                        <PinInput
                            length={PIN_LENGTH}
                            value={confirmPin}
                            onChange={setConfirmPin}
                            disabled={isLoading}
                            autoFocus={true}
                        />
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading || pin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Setting up...
                        </>
                    ) : (
                        <>
                            <KeyRound size={18} />
                            Complete Setup
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

const TechAuthScreen = ({ onAuthenticated, inviteToken = null, contractorId = null }) => {
    const isInviteSetup = inviteToken && contractorId;

    const handleLoginSuccess = (session) => {
        onAuthenticated(session);
    };

    const handleSetupSuccess = async (techId) => {
        // After setup, log them in
        // They'll need to enter their PIN to verify
        window.location.href = '/tech-portal';
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col">
            {/* Header */}
            <div className="py-6 px-4">
                <div className="max-w-md mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                        <Smartphone size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800">Tech Portal</h1>
                        <p className="text-xs text-slate-500">Field Technician Access</p>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6">
                        {isInviteSetup ? (
                            <InviteSetupForm
                                token={inviteToken}
                                contractorId={contractorId}
                                onSuccess={handleSetupSuccess}
                            />
                        ) : (
                            <>
                                <div className="text-center mb-6">
                                    <Lock size={32} className="mx-auto text-emerald-500 mb-3" />
                                    <h2 className="text-xl font-bold text-slate-800">
                                        Technician Login
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Access your daily jobs and time clock
                                    </p>
                                </div>
                                <LoginForm
                                    onSuccess={handleLoginSuccess}
                                    initialContractorId={contractorId}
                                />
                            </>
                        )}
                    </div>

                    {/* Help link */}
                    <p className="text-center text-xs text-slate-400 mt-6">
                        Need help? Contact your office manager.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TechAuthScreen;
