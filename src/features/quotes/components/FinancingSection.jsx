// src/features/quotes/components/FinancingSection.jsx
// ============================================
// FINANCING SECTION FOR QUOTE VIEWS
// ============================================
// Shows financing options and application status on quotes

import React, { useState, useEffect } from 'react';
import {
    CreditCard, DollarSign, CheckCircle, Clock, Loader2,
    ExternalLink, AlertCircle, ChevronDown, ChevronUp,
    Banknote, Shield, Info
} from 'lucide-react';
import {
    calculateMonthlyPayment,
    getPaymentEstimates,
    formatCurrency,
    createFinancingApplication,
    getApplicationStatus,
    FINANCING_STATUS,
    getStatusDisplay,
    getShortDisclaimer
} from '../../../lib/wisetackService';

/**
 * Main financing section component for public quote view
 */
export const FinancingSection = ({
    quote,
    contractorId,
    financingSettings,
    onStatusChange
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showTerms, setShowTerms] = useState(false);
    const [applicationStatus, setApplicationStatus] = useState(null);

    const total = quote?.total || quote?.grandTotal || 0;
    const financing = quote?.financing || {};
    const status = financing.status || FINANCING_STATUS.OFFERED;
    const minAmount = financingSettings?.minAmount || 500;

    // Check if financing is eligible
    const isEligible = total >= minAmount && financingSettings?.enabled;

    // Calculate payment estimates
    const defaultTerm = financingSettings?.defaultTermMonths || 12;
    const estimatedMonthly = calculateMonthlyPayment(total, defaultTerm);
    const paymentOptions = getPaymentEstimates(total);

    // Poll for status updates if pending
    useEffect(() => {
        if (financing.applicationId && status === FINANCING_STATUS.PENDING) {
            const pollStatus = async () => {
                try {
                    const result = await getApplicationStatus(financing.applicationId);
                    if (result.status !== status) {
                        setApplicationStatus(result);
                        onStatusChange?.(result);
                    }
                } catch (e) {
                    console.error('Error polling status:', e);
                }
            };

            const interval = setInterval(pollStatus, 10000); // Poll every 10 seconds
            return () => clearInterval(interval);
        }
    }, [financing.applicationId, status]);

    // Handle apply for financing
    const handleApply = async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await createFinancingApplication({
                quoteId: quote.id,
                contractorId,
                amount: total,
                customerName: quote.customerName,
                customerEmail: quote.customerEmail,
                customerPhone: quote.customerPhone,
                serviceAddress: quote.serviceAddress,
                serviceDescription: quote.title || quote.description
            });

            // Redirect to Wisetack application
            if (result.applicationUrl) {
                window.location.href = result.applicationUrl;
            }
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    // Don't show if not eligible
    if (!isEligible) {
        return null;
    }

    // Show status-specific content
    if (status === FINANCING_STATUS.APPROVED || status === FINANCING_STATUS.FUNDED) {
        return (
            <ApprovedSection
                financing={financing}
                status={status}
            />
        );
    }

    if (status === FINANCING_STATUS.PENDING) {
        return (
            <PendingSection
                financing={financing}
                applicationStatus={applicationStatus}
            />
        );
    }

    if (status === FINANCING_STATUS.DENIED) {
        return (
            <DeniedSection />
        );
    }

    // Default: Show financing offer
    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
            {/* Header */}
            <div className="flex items-start gap-4 mb-5">
                <div className="bg-blue-100 p-3 rounded-xl">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">
                        Financing Available
                    </h3>
                    <p className="text-3xl font-bold text-blue-600">
                        As low as {formatCurrency(estimatedMonthly)}/month*
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        {defaultTerm} months at 9.99% APR example
                    </p>
                </div>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-3 gap-3 mb-5">
                <BenefitBadge
                    icon={<Shield className="w-4 h-4" />}
                    text="No credit impact"
                />
                <BenefitBadge
                    icon={<Clock className="w-4 h-4" />}
                    text="Instant decision"
                />
                <BenefitBadge
                    icon={<CheckCircle className="w-4 h-4" />}
                    text="Easy payments"
                />
            </div>

            {/* Show payment options */}
            <button
                onClick={() => setShowTerms(!showTerms)}
                className="w-full flex items-center justify-between py-3 text-sm text-blue-600 hover:text-blue-700"
            >
                <span>View all payment options</span>
                {showTerms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTerms && (
                <div className="mb-5 space-y-2">
                    {paymentOptions
                        .filter(opt => [12, 24, 36, 48, 60].includes(opt.termMonths))
                        .map(opt => (
                            <div
                                key={opt.termMonths}
                                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                            >
                                <span className="text-gray-600">{opt.termMonths} months</span>
                                <span className="font-semibold text-gray-800">
                                    {formatCurrency(opt.monthlyPayment)}/mo
                                </span>
                            </div>
                        ))
                    }
                    <p className="text-xs text-gray-500">
                        *Based on 9.99% APR. Your actual rate may vary from 0-29.99% APR based on creditworthiness.
                    </p>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* Apply button */}
            <button
                onClick={handleApply}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Processing...</span>
                    </>
                ) : (
                    <>
                        <DollarSign className="w-5 h-5" />
                        <span>Check Your Rate - No Impact to Credit</span>
                    </>
                )}
            </button>

            {/* Disclaimer */}
            <p className="text-xs text-gray-400 mt-4 text-center">
                {getShortDisclaimer()} Loans provided by{' '}
                <a
                    href="https://wisetack.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-gray-500"
                >
                    Wisetack
                </a>
                .
            </p>
        </div>
    );
};

/**
 * Approved financing section
 */
const ApprovedSection = ({ financing, status }) => {
    const display = getStatusDisplay(status);
    const isFunded = status === FINANCING_STATUS.FUNDED;

    return (
        <div className={`${display.bgColor} rounded-2xl p-6`}>
            <div className="flex items-start gap-4">
                <div className="bg-white/50 p-3 rounded-xl">
                    {isFunded ? (
                        <Banknote className={`w-6 h-6 ${display.textColor}`} />
                    ) : (
                        <CheckCircle className={`w-6 h-6 ${display.textColor}`} />
                    )}
                </div>
                <div className="flex-1">
                    <h3 className={`text-lg font-bold ${display.textColor} mb-1`}>
                        {isFunded ? 'Financing Complete' : 'Financing Approved!'}
                    </h3>

                    {financing.approvedAmount && (
                        <p className={`text-2xl font-bold ${display.textColor}`}>
                            {formatCurrency(financing.approvedAmount)}
                        </p>
                    )}

                    <div className="mt-3 space-y-1">
                        {financing.monthlyPayment && (
                            <p className={`text-sm ${display.textColor}`}>
                                <span className="font-semibold">{formatCurrency(financing.monthlyPayment)}</span>/month
                                {financing.termMonths && ` for ${financing.termMonths} months`}
                            </p>
                        )}
                        {financing.apr && (
                            <p className={`text-sm ${display.textColor} opacity-80`}>
                                {financing.apr}% APR
                            </p>
                        )}
                    </div>

                    {!isFunded && financing.applicationUrl && (
                        <a
                            href={financing.applicationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white/30 rounded-lg ${display.textColor} font-medium hover:bg-white/50 transition-colors`}
                        >
                            <ExternalLink className="w-4 h-4" />
                            Complete Your Application
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Pending application section
 */
const PendingSection = ({ financing, applicationStatus }) => {
    return (
        <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
            <div className="flex items-start gap-4">
                <div className="bg-amber-100 p-3 rounded-xl">
                    <Clock className="w-6 h-6 text-amber-600 animate-pulse" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-amber-800 mb-1">
                        Financing Application In Progress
                    </h3>
                    <p className="text-sm text-amber-700 mb-4">
                        Your application is being reviewed. This usually takes just a few minutes.
                    </p>

                    {financing.applicationUrl && (
                        <a
                            href={financing.applicationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Continue Application
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Denied section
 */
const DeniedSection = () => {
    return (
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="flex items-start gap-4">
                <div className="bg-gray-100 p-3 rounded-xl">
                    <Info className="w-6 h-6 text-gray-500" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-700 mb-1">
                        Financing Not Available
                    </h3>
                    <p className="text-sm text-gray-500">
                        We weren't able to approve financing at this time. You can still proceed with other payment options,
                        or contact us to discuss alternative arrangements.
                    </p>
                </div>
            </div>
        </div>
    );
};

/**
 * Benefit badge component
 */
const BenefitBadge = ({ icon, text }) => (
    <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
        <span className="text-blue-600">{icon}</span>
        <span className="text-xs text-gray-700 font-medium">{text}</span>
    </div>
);

/**
 * Compact financing indicator for quote lists
 */
export const FinancingIndicatorCompact = ({ quote, minAmount = 500 }) => {
    const total = quote?.total || quote?.grandTotal || 0;
    const financing = quote?.financing;

    if (total < minAmount && !financing) {
        return null;
    }

    if (financing?.status) {
        const display = getStatusDisplay(financing.status);
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${display.bgColor} ${display.textColor}`}>
                <CreditCard className="w-3 h-3" />
                {financing.status === FINANCING_STATUS.APPROVED && financing.monthlyPayment
                    ? `${formatCurrency(financing.monthlyPayment)}/mo`
                    : display.label
                }
            </span>
        );
    }

    // Default: show "financing available"
    const monthly = calculateMonthlyPayment(total, 12);
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
            <CreditCard className="w-3 h-3" />
            From {formatCurrency(monthly)}/mo
        </span>
    );
};

export default FinancingSection;
