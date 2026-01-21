// src/components/PaymentQRCode.jsx
// ============================================
// PAYMENT QR CODE COMPONENT
// ============================================
// Generates and displays QR codes for field payment collection
// Supports QR display, SMS/Email link delivery, and copy-to-clipboard

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    QrCode, Copy, Check, Send, Mail, MessageSquare,
    Loader2, AlertCircle, RefreshCw, ExternalLink,
    CreditCard, Smartphone, ChevronDown, X, Clock, DollarSign
} from 'lucide-react';
import {
    createFieldPaymentLink,
    sendPaymentLinkSMS,
    sendPaymentLinkEmail,
    PAYMENT_METHODS
} from '../lib/fieldPaymentService';
import toast from 'react-hot-toast';

// ============================================
// HELPER: Format currency
// ============================================
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
};

// ============================================
// SIMPLE QR CODE RENDERER
// ============================================
// Uses a simple SVG-based QR code generator
// For production, consider using 'qrcode' or 'qrcode.react' library

const QRCodeSVG = ({ value, size = 200, bgColor = '#ffffff', fgColor = '#000000' }) => {
    const [qrSvg, setQrSvg] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const generateQR = async () => {
            setLoading(true);
            setError(null);

            try {
                // Use Google Charts API for simple QR generation
                // In production, use a proper library like 'qrcode'
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=${bgColor.replace('#', '')}&color=${fgColor.replace('#', '')}`;
                setQrSvg(qrUrl);
            } catch (err) {
                console.error('QR generation error:', err);
                setError('Failed to generate QR code');
            } finally {
                setLoading(false);
            }
        };

        if (value) {
            generateQR();
        }
    }, [value, size, bgColor, fgColor]);

    if (loading) {
        return (
            <div
                className="flex items-center justify-center bg-gray-100 rounded-lg"
                style={{ width: size, height: size }}
            >
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="flex flex-col items-center justify-center bg-red-50 rounded-lg p-4"
                style={{ width: size, height: size }}
            >
                <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                <span className="text-red-600 text-sm text-center">{error}</span>
            </div>
        );
    }

    return (
        <img
            src={qrSvg}
            alt="Payment QR Code"
            width={size}
            height={size}
            className="rounded-lg"
        />
    );
};

// ============================================
// MAIN COMPONENT: PaymentQRCode
// ============================================
export const PaymentQRCode = ({
    // Payment details
    amount,
    jobId,
    jobNumber,
    description,
    // Customer info
    customerName,
    customerEmail,
    customerPhone,
    // Contractor info
    contractorId,
    contractorName,
    stripeAccountId,
    // Callbacks
    onPaymentSuccess,
    onClose,
    // Options
    showDeliveryOptions = true,
    autoGenerate = true,
    size = 'medium'
}) => {
    // State
    const [paymentLink, setPaymentLink] = useState(null);
    const [loading, setLoading] = useState(autoGenerate);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [sendingMethod, setSendingMethod] = useState(null);
    const [showDeliveryMenu, setShowDeliveryMenu] = useState(false);
    const [expiresIn, setExpiresIn] = useState(null);

    // Refs
    const deliveryMenuRef = useRef(null);

    // Size configurations
    const sizes = {
        small: { qr: 150, container: 'max-w-xs' },
        medium: { qr: 200, container: 'max-w-sm' },
        large: { qr: 280, container: 'max-w-md' }
    };
    const sizeConfig = sizes[size] || sizes.medium;

    // ============================================
    // GENERATE PAYMENT LINK
    // ============================================
    const generatePaymentLink = useCallback(async () => {
        if (!stripeAccountId) {
            setError('Payment setup required. Please connect your Stripe account.');
            return;
        }

        if (!amount || amount <= 0) {
            setError('Invalid payment amount');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await createFieldPaymentLink({
                stripeAccountId,
                amount,
                jobId,
                contractorId,
                description: description || `Payment for Job #${jobNumber || jobId?.slice(-6)}`,
                customerEmail,
                customerName,
                jobNumber,
                type: 'balance'
            });

            setPaymentLink(result);

            // Calculate expiration countdown
            if (result.expiresAt) {
                const expMs = new Date(result.expiresAt).getTime() - Date.now();
                setExpiresIn(Math.floor(expMs / 1000 / 60)); // minutes
            }
        } catch (err) {
            console.error('Payment link generation error:', err);
            setError(err.message || 'Failed to generate payment link');
            toast.error('Failed to generate payment link');
        } finally {
            setLoading(false);
        }
    }, [stripeAccountId, amount, jobId, contractorId, description, customerEmail, customerName, jobNumber]);

    // Auto-generate on mount
    useEffect(() => {
        if (autoGenerate && stripeAccountId && amount > 0) {
            generatePaymentLink();
        }
    }, [autoGenerate, generatePaymentLink, stripeAccountId, amount]);

    // Update expiration timer
    useEffect(() => {
        if (paymentLink?.expiresAt) {
            const interval = setInterval(() => {
                const expMs = new Date(paymentLink.expiresAt).getTime() - Date.now();
                if (expMs <= 0) {
                    setExpiresIn(0);
                    clearInterval(interval);
                } else {
                    setExpiresIn(Math.floor(expMs / 1000 / 60));
                }
            }, 60000); // Update every minute

            return () => clearInterval(interval);
        }
    }, [paymentLink]);

    // ============================================
    // COPY TO CLIPBOARD
    // ============================================
    const handleCopy = async () => {
        if (!paymentLink?.url) return;

        try {
            await navigator.clipboard.writeText(paymentLink.shortUrl || paymentLink.url);
            setCopied(true);
            toast.success('Payment link copied!');
            setTimeout(() => setCopied(false), 3000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    // ============================================
    // SEND VIA SMS
    // ============================================
    const handleSendSMS = async () => {
        if (!customerPhone) {
            toast.error('Customer phone number not available');
            return;
        }

        setSendingMethod('sms');
        try {
            await sendPaymentLinkSMS({
                phone: customerPhone,
                paymentUrl: paymentLink.shortUrl || paymentLink.url,
                amount,
                contractorName,
                jobDescription: description || `Job #${jobNumber}`,
                contractorId
            });
            toast.success('Payment link sent via SMS!');
            setShowDeliveryMenu(false);
        } catch (err) {
            toast.error(err.message || 'Failed to send SMS');
        } finally {
            setSendingMethod(null);
        }
    };

    // ============================================
    // SEND VIA EMAIL
    // ============================================
    const handleSendEmail = async () => {
        if (!customerEmail) {
            toast.error('Customer email not available');
            return;
        }

        setSendingMethod('email');
        try {
            await sendPaymentLinkEmail({
                email: customerEmail,
                paymentUrl: paymentLink.shortUrl || paymentLink.url,
                amount,
                contractorName,
                jobDescription: description || `Job #${jobNumber}`,
                customerName
            });
            toast.success('Payment link sent via email!');
            setShowDeliveryMenu(false);
        } catch (err) {
            toast.error(err.message || 'Failed to send email');
        } finally {
            setSendingMethod(null);
        }
    };

    // ============================================
    // OPEN LINK IN NEW TAB
    // ============================================
    const handleOpenLink = () => {
        if (paymentLink?.url) {
            window.open(paymentLink.url, '_blank');
        }
    };

    // ============================================
    // RENDER: Loading State
    // ============================================
    if (loading) {
        return (
            <div className={`${sizeConfig.container} mx-auto p-6 bg-white rounded-2xl shadow-lg`}>
                <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                    <p className="text-gray-600 font-medium">Generating payment link...</p>
                    <p className="text-gray-400 text-sm mt-1">This may take a moment</p>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER: Error State
    // ============================================
    if (error && !paymentLink) {
        return (
            <div className={`${sizeConfig.container} mx-auto p-6 bg-white rounded-2xl shadow-lg`}>
                <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <p className="text-red-600 font-medium text-center mb-2">{error}</p>
                    <button
                        onClick={generatePaymentLink}
                        className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER: No Stripe Account
    // ============================================
    if (!stripeAccountId) {
        return (
            <div className={`${sizeConfig.container} mx-auto p-6 bg-white rounded-2xl shadow-lg`}>
                <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                        <CreditCard className="w-8 h-8 text-amber-500" />
                    </div>
                    <p className="text-gray-800 font-medium text-center mb-2">Payment Setup Required</p>
                    <p className="text-gray-500 text-sm text-center">
                        Connect your Stripe account to accept field payments
                    </p>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER: Main QR Code Display
    // ============================================
    return (
        <div className={`${sizeConfig.container} mx-auto bg-white rounded-2xl shadow-lg overflow-hidden`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <QrCode className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">Collect Payment</h3>
                            {jobNumber && (
                                <p className="text-emerald-100 text-sm">Job #{jobNumber}</p>
                            )}
                        </div>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    )}
                </div>
            </div>

            {/* Amount Display */}
            <div className="px-6 py-4 bg-gradient-to-b from-emerald-50 to-white border-b">
                <div className="text-center">
                    <p className="text-sm text-gray-500 mb-1">Amount Due</p>
                    <p className="text-4xl font-bold text-emerald-600">{formatCurrency(amount)}</p>
                    {customerName && (
                        <p className="text-gray-600 mt-2">for {customerName}</p>
                    )}
                </div>
            </div>

            {/* QR Code */}
            <div className="px-6 py-6">
                {paymentLink ? (
                    <div className="flex flex-col items-center">
                        {/* QR Code */}
                        <div className="bg-white p-4 rounded-xl shadow-md border-2 border-emerald-100">
                            <QRCodeSVG
                                value={paymentLink.url}
                                size={sizeConfig.qr}
                            />
                        </div>

                        {/* Scan Instructions */}
                        <div className="mt-4 flex items-center gap-2 text-gray-500">
                            <Smartphone className="w-4 h-4" />
                            <span className="text-sm">Scan with phone camera to pay</span>
                        </div>

                        {/* Expiration */}
                        {expiresIn !== null && expiresIn > 0 && (
                            <div className="mt-2 flex items-center gap-1 text-amber-600 text-xs">
                                <Clock className="w-3 h-3" />
                                <span>Link expires in {expiresIn > 60 ? `${Math.floor(expiresIn / 60)}h` : `${expiresIn}m`}</span>
                            </div>
                        )}
                        {expiresIn === 0 && (
                            <div className="mt-2 flex items-center gap-1 text-red-600 text-xs">
                                <AlertCircle className="w-3 h-3" />
                                <span>Link expired -</span>
                                <button
                                    onClick={generatePaymentLink}
                                    className="underline hover:no-underline"
                                >
                                    Generate new link
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={generatePaymentLink}
                        className="w-full py-4 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <QrCode className="w-5 h-5" />
                        Generate Payment QR Code
                    </button>
                )}
            </div>

            {/* Actions */}
            {paymentLink && (
                <div className="px-6 pb-6 space-y-3">
                    {/* Copy Link Button */}
                    <button
                        onClick={handleCopy}
                        className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                            copied
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {copied ? (
                            <>
                                <Check className="w-4 h-4" />
                                Link Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                Copy Payment Link
                            </>
                        )}
                    </button>

                    {/* Delivery Options */}
                    {showDeliveryOptions && (customerEmail || customerPhone) && (
                        <div className="relative" ref={deliveryMenuRef}>
                            <button
                                onClick={() => setShowDeliveryMenu(!showDeliveryMenu)}
                                className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <Send className="w-4 h-4" />
                                Send Link to Customer
                                <ChevronDown className={`w-4 h-4 transition-transform ${showDeliveryMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {showDeliveryMenu && (
                                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border overflow-hidden z-10">
                                    {customerPhone && (
                                        <button
                                            onClick={handleSendSMS}
                                            disabled={sendingMethod === 'sms'}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50"
                                        >
                                            {sendingMethod === 'sms' ? (
                                                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                                            ) : (
                                                <MessageSquare className="w-5 h-5 text-emerald-500" />
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-800">Send via SMS</p>
                                                <p className="text-sm text-gray-500">{customerPhone}</p>
                                            </div>
                                        </button>
                                    )}
                                    {customerEmail && (
                                        <button
                                            onClick={handleSendEmail}
                                            disabled={sendingMethod === 'email'}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50 border-t"
                                        >
                                            {sendingMethod === 'email' ? (
                                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                            ) : (
                                                <Mail className="w-5 h-5 text-blue-500" />
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-800">Send via Email</p>
                                                <p className="text-sm text-gray-500 truncate">{customerEmail}</p>
                                            </div>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Open in Browser */}
                    <button
                        onClick={handleOpenLink}
                        className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm flex items-center justify-center gap-1"
                    >
                        <ExternalLink className="w-3 h-3" />
                        Open payment page in browser
                    </button>
                </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t">
                <p className="text-xs text-gray-400 text-center">
                    Payments are securely processed by Stripe
                </p>
            </div>
        </div>
    );
};

// ============================================
// COMPACT INLINE QR CODE
// ============================================
export const InlinePaymentQR = ({
    paymentUrl,
    amount,
    size = 120,
    showAmount = true
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(paymentUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    if (!paymentUrl) return null;

    return (
        <div className="inline-flex flex-col items-center p-3 bg-white rounded-xl border shadow-sm">
            <QRCodeSVG value={paymentUrl} size={size} />
            {showAmount && (
                <p className="mt-2 font-semibold text-emerald-600">{formatCurrency(amount)}</p>
            )}
            <button
                onClick={handleCopy}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy link'}
            </button>
        </div>
    );
};

// ============================================
// PAYMENT COLLECTION MODAL
// ============================================
export const PaymentCollectionModal = ({
    isOpen,
    onClose,
    job,
    contractor,
    onSuccess
}) => {
    if (!isOpen) return null;

    const balanceDue = job?.balanceDue ?? (
        (job?.invoiceData?.total || job?.total || 0) -
        (job?.depositAmount || job?.depositPaid || 0) -
        (job?.totalPaid || 0)
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative">
                <PaymentQRCode
                    amount={balanceDue}
                    jobId={job?.id}
                    jobNumber={job?.jobNumber}
                    description={job?.title || job?.description}
                    customerName={job?.customer?.name || job?.customerName}
                    customerEmail={job?.customer?.email || job?.customerEmail}
                    customerPhone={job?.customer?.phone || job?.customerPhone}
                    contractorId={contractor?.id}
                    contractorName={contractor?.businessName || contractor?.name}
                    stripeAccountId={contractor?.stripe?.accountId}
                    onPaymentSuccess={onSuccess}
                    onClose={onClose}
                    size="large"
                />
            </div>
        </div>
    );
};

export default PaymentQRCode;
