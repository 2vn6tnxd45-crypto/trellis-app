// src/features/quotes/components/FinancingBadge.jsx
// ============================================
// FINANCING STATUS BADGE COMPONENT
// ============================================
// Visual badge showing financing status on quotes

import React from 'react';
import {
    CreditCard, Clock, CheckCircle, XCircle, DollarSign,
    AlertCircle, Banknote, Loader2
} from 'lucide-react';
import {
    FINANCING_STATUS,
    getStatusDisplay,
    formatCurrency
} from '../../../lib/wisetackService';

/**
 * Compact financing badge for list views
 */
export const FinancingBadgeCompact = ({ status, monthlyPayment }) => {
    const display = getStatusDisplay(status);

    const icons = {
        [FINANCING_STATUS.NOT_OFFERED]: null,
        [FINANCING_STATUS.OFFERED]: <CreditCard className="w-3.5 h-3.5" />,
        [FINANCING_STATUS.PENDING]: <Clock className="w-3.5 h-3.5" />,
        [FINANCING_STATUS.APPROVED]: <CheckCircle className="w-3.5 h-3.5" />,
        [FINANCING_STATUS.DENIED]: <XCircle className="w-3.5 h-3.5" />,
        [FINANCING_STATUS.FUNDED]: <Banknote className="w-3.5 h-3.5" />,
        [FINANCING_STATUS.EXPIRED]: <AlertCircle className="w-3.5 h-3.5" />,
        [FINANCING_STATUS.CANCELLED]: <XCircle className="w-3.5 h-3.5" />
    };

    if (status === FINANCING_STATUS.NOT_OFFERED) {
        return null;
    }

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${display.bgColor} ${display.textColor}`}>
            {icons[status]}
            {status === FINANCING_STATUS.APPROVED && monthlyPayment ? (
                <span>{formatCurrency(monthlyPayment)}/mo</span>
            ) : status === FINANCING_STATUS.FUNDED ? (
                <span>Financed</span>
            ) : (
                <span>{display.label}</span>
            )}
        </span>
    );
};

/**
 * Full financing badge with details
 */
export const FinancingBadge = ({
    status,
    approvedAmount,
    monthlyPayment,
    apr,
    termMonths,
    size = 'default'
}) => {
    const display = getStatusDisplay(status);
    const isCompact = size === 'compact';

    const getIcon = () => {
        const iconClass = isCompact ? 'w-4 h-4' : 'w-5 h-5';

        switch (status) {
            case FINANCING_STATUS.OFFERED:
                return <CreditCard className={iconClass} />;
            case FINANCING_STATUS.PENDING:
                return <Loader2 className={`${iconClass} animate-spin`} />;
            case FINANCING_STATUS.APPROVED:
                return <CheckCircle className={iconClass} />;
            case FINANCING_STATUS.FUNDED:
                return <Banknote className={iconClass} />;
            case FINANCING_STATUS.DENIED:
                return <XCircle className={iconClass} />;
            case FINANCING_STATUS.EXPIRED:
            case FINANCING_STATUS.CANCELLED:
                return <AlertCircle className={iconClass} />;
            default:
                return null;
        }
    };

    if (status === FINANCING_STATUS.NOT_OFFERED) {
        return null;
    }

    // Compact version
    if (isCompact) {
        return (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${display.bgColor}`}>
                <span className={display.textColor}>{getIcon()}</span>
                <span className={`text-sm font-medium ${display.textColor}`}>
                    {status === FINANCING_STATUS.APPROVED && monthlyPayment
                        ? `Approved - ${formatCurrency(monthlyPayment)}/mo`
                        : status === FINANCING_STATUS.FUNDED
                            ? 'Financed'
                            : display.label
                    }
                </span>
            </div>
        );
    }

    // Full version with details
    return (
        <div className={`rounded-xl ${display.bgColor} p-4`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/50 ${display.textColor}`}>
                    {getIcon()}
                </div>
                <div className="flex-1">
                    <p className={`font-semibold ${display.textColor}`}>
                        {status === FINANCING_STATUS.APPROVED
                            ? 'Financing Approved'
                            : status === FINANCING_STATUS.FUNDED
                                ? 'Financing Complete'
                                : status === FINANCING_STATUS.PENDING
                                    ? 'Application Pending'
                                    : display.label
                        }
                    </p>

                    {(status === FINANCING_STATUS.APPROVED || status === FINANCING_STATUS.FUNDED) && (
                        <div className="mt-1 space-y-0.5">
                            {approvedAmount && (
                                <p className={`text-sm ${display.textColor} opacity-80`}>
                                    Amount: {formatCurrency(approvedAmount)}
                                </p>
                            )}
                            {monthlyPayment && (
                                <p className={`text-sm font-medium ${display.textColor}`}>
                                    {formatCurrency(monthlyPayment)}/month
                                    {termMonths && ` for ${termMonths} months`}
                                </p>
                            )}
                            {apr && (
                                <p className={`text-xs ${display.textColor} opacity-70`}>
                                    {apr}% APR
                                </p>
                            )}
                        </div>
                    )}

                    {status === FINANCING_STATUS.PENDING && (
                        <p className={`text-sm ${display.textColor} opacity-80`}>
                            Customer is completing their application
                        </p>
                    )}

                    {status === FINANCING_STATUS.DENIED && (
                        <p className={`text-sm ${display.textColor} opacity-80`}>
                            Application was not approved
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Financing offer card for quote views
 */
export const FinancingOfferCard = ({
    total,
    estimatedMonthly,
    termMonths = 12,
    onApply,
    loading = false,
    status = FINANCING_STATUS.OFFERED,
    approvedDetails = null
}) => {
    // If already has a status beyond offered, show the badge
    if (status !== FINANCING_STATUS.OFFERED && status !== FINANCING_STATUS.NOT_OFFERED) {
        return (
            <FinancingBadge
                status={status}
                approvedAmount={approvedDetails?.approvedAmount}
                monthlyPayment={approvedDetails?.monthlyPayment}
                apr={approvedDetails?.apr}
                termMonths={approvedDetails?.termMonths}
            />
        );
    }

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <div className="flex items-start gap-4">
                <div className="bg-blue-100 p-3 rounded-xl">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                </div>

                <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 mb-1">
                        Financing Available
                    </h4>
                    <p className="text-2xl font-bold text-blue-600 mb-1">
                        As low as {formatCurrency(estimatedMonthly)}/month*
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                        {termMonths} months | 9.99% APR example
                    </p>

                    <button
                        onClick={onApply}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <DollarSign className="w-4 h-4" />
                                <span>Check Your Rate - No Impact to Credit</span>
                            </>
                        )}
                    </button>

                    <p className="text-xs text-gray-400 mt-3">
                        *Rate depends on credit. 0-29.99% APR. Checking rates won't affect your credit score.
                        Loans provided by Wisetack.
                    </p>
                </div>
            </div>
        </div>
    );
};

/**
 * Minimal financing indicator
 */
export const FinancingIndicator = ({ status, monthlyPayment }) => {
    if (!status || status === FINANCING_STATUS.NOT_OFFERED) {
        return null;
    }

    const display = getStatusDisplay(status);

    return (
        <div className={`flex items-center gap-1.5 text-sm ${display.textColor}`}>
            <CreditCard className="w-4 h-4" />
            {status === FINANCING_STATUS.APPROVED && monthlyPayment ? (
                <span>{formatCurrency(monthlyPayment)}/mo</span>
            ) : status === FINANCING_STATUS.FUNDED ? (
                <span>Financed</span>
            ) : (
                <span>{display.label}</span>
            )}
        </div>
    );
};

export default FinancingBadge;
