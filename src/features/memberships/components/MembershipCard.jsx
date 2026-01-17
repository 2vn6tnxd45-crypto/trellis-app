/**
 * MembershipCard Component
 * Customer-facing membership card showing plan details and benefits
 */

import React, { useMemo } from 'react';
import {
  Shield,
  Check,
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
  RefreshCw,
  Star,
  Zap,
  Phone,
  ChevronRight,
  Gift,
  Sparkles
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  getStatusBadgeInfo,
  getDaysUntilExpiration,
  isExpiringSoon
} from '../lib/membershipService';

/**
 * Full Membership Card
 * Shows complete membership details for customer portal
 */
export const MembershipCard = ({
  membership,
  onManage,
  onRenew,
  onContact,
  showActions = true,
  compact = false
}) => {
  if (!membership) return null;

  const statusInfo = getStatusBadgeInfo(membership.status);
  const daysLeft = getDaysUntilExpiration(membership.endDate);
  const expiringSoon = isExpiringSoon(membership.endDate, 30);

  // Calculate service usage
  const serviceUsage = useMemo(() => {
    const services = membership.servicesUsed || [];
    return services.map(service => ({
      ...service,
      remaining: service.includedCount - service.usedCount,
      percentUsed: (service.usedCount / service.includedCount) * 100
    }));
  }, [membership.servicesUsed]);

  // Calculate total savings
  const totalSavings = membership.totalSavings || 0;

  if (compact) {
    return (
      <CompactMembershipCard
        membership={membership}
        onManage={onManage}
      />
    );
  }

  return (
    <div
      className="bg-white rounded-2xl border-2 overflow-hidden shadow-sm"
      style={{ borderColor: membership.planColor || '#10b981' }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 text-white"
        style={{ backgroundColor: membership.planColor || '#10b981' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={28} />
            <div>
              <h3 className="text-lg font-bold">{membership.planName}</h3>
              <p className="text-sm opacity-90">Member since {formatDate(membership.startDate)}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            membership.status === 'active'
              ? 'bg-white/20 text-white'
              : statusInfo.className
          }`}>
            {statusInfo.label}
          </span>
        </div>

        {/* Expiration Warning */}
        {membership.status === 'active' && expiringSoon && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-white/20 rounded-lg">
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">
              {daysLeft <= 0 ? 'Expired' :
               daysLeft === 1 ? 'Expires tomorrow!' :
               `Expires in ${daysLeft} days`}
            </span>
          </div>
        )}
      </div>

      {/* Savings Banner */}
      {totalSavings > 0 && (
        <div className="px-6 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700">
            <Gift size={18} />
            <span className="text-sm font-medium">Your total savings</span>
          </div>
          <span className="text-lg font-bold text-green-600">
            {formatCurrency(totalSavings)}
          </span>
        </div>
      )}

      {/* Services */}
      <div className="p-6 border-b border-slate-100">
        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          Included Services
        </h4>
        <div className="space-y-4">
          {serviceUsage.map((service, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">
                  {service.serviceName || service.serviceType}
                </span>
                <span className="text-sm text-slate-500">
                  {service.usedCount} of {service.includedCount} used
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${service.percentUsed}%`,
                    backgroundColor: service.remaining === 0 ? '#ef4444' : membership.planColor || '#10b981'
                  }}
                />
              </div>
              {service.remaining > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  {service.remaining} remaining
                </p>
              )}
            </div>
          ))}

          {serviceUsage.length === 0 && (
            <p className="text-sm text-slate-400 italic">No included services</p>
          )}
        </div>
      </div>

      {/* Benefits */}
      <div className="p-6 border-b border-slate-100">
        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          Your Benefits
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {membership.benefits?.discountPercent > 0 && (
            <BenefitItem
              icon={DollarSign}
              label={`${membership.benefits.discountPercent}% off repairs`}
              color={membership.planColor}
            />
          )}
          {membership.benefits?.priorityScheduling && (
            <BenefitItem
              icon={Clock}
              label="Priority scheduling"
              color={membership.planColor}
            />
          )}
          {membership.benefits?.waiveDiagnosticFee && (
            <BenefitItem
              icon={Check}
              label="No diagnostic fee"
              color={membership.planColor}
            />
          )}
          {membership.benefits?.waiveTripFee && (
            <BenefitItem
              icon={Check}
              label="No trip fee"
              color={membership.planColor}
            />
          )}
          {membership.benefits?.emergencyResponse && (
            <BenefitItem
              icon={Zap}
              label={`${membership.benefits.emergencyResponse} emergency`}
              color={membership.planColor}
            />
          )}
          {membership.benefits?.transferable && (
            <BenefitItem
              icon={RefreshCw}
              label="Transferable"
              color={membership.planColor}
            />
          )}
        </div>
      </div>

      {/* Renewal Info */}
      <div className="p-6 bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">
              {membership.status === 'active' ? 'Renews on' : 'Expired on'}
            </p>
            <p className="text-lg font-bold text-slate-900">
              {formatDate(membership.endDate)}
            </p>
            {membership.autoRenew && membership.status === 'active' && (
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <RefreshCw size={12} />
                Auto-renewal enabled
              </p>
            )}
          </div>

          {showActions && (
            <div className="flex items-center gap-2">
              {onContact && (
                <button
                  onClick={onContact}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <Phone size={16} />
                  Contact
                </button>
              )}

              {membership.status === 'active' && expiringSoon && onRenew && (
                <button
                  onClick={onRenew}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors"
                  style={{ backgroundColor: membership.planColor || '#10b981' }}
                >
                  <RefreshCw size={16} />
                  Renew Now
                </button>
              )}

              {onManage && (
                <button
                  onClick={onManage}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors"
                  style={{ backgroundColor: membership.planColor || '#10b981' }}
                >
                  Manage
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Compact Membership Card
 * Smaller version for sidebars or quick display
 */
const CompactMembershipCard = ({ membership, onManage }) => {
  const daysLeft = getDaysUntilExpiration(membership.endDate);
  const expiringSoon = isExpiringSoon(membership.endDate, 14);

  return (
    <button
      onClick={onManage}
      className="w-full p-4 rounded-xl border-2 text-left transition-all hover:shadow-md"
      style={{ borderColor: membership.planColor || '#10b981' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
          style={{ backgroundColor: membership.planColor || '#10b981' }}
        >
          <Shield size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-900 truncate">{membership.planName}</p>
            {membership.status === 'active' && (
              <span className="w-2 h-2 rounded-full bg-green-500" />
            )}
          </div>
          <p className="text-sm text-slate-500">
            {membership.status === 'active'
              ? expiringSoon
                ? `Expires in ${daysLeft} days`
                : `Valid until ${formatDate(membership.endDate)}`
              : `Expired ${formatDate(membership.endDate)}`
            }
          </p>
        </div>
        <ChevronRight className="text-slate-400" size={20} />
      </div>

      {/* Quick savings */}
      {membership.totalSavings > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
          <Gift size={14} />
          <span>Saved {formatCurrency(membership.totalSavings)}</span>
        </div>
      )}
    </button>
  );
};

/**
 * Benefit Item Component
 */
const BenefitItem = ({ icon: Icon, label, color }) => (
  <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center"
      style={{ backgroundColor: `${color}20` }}
    >
      <Icon size={12} style={{ color }} />
    </div>
    <span className="text-sm text-slate-700">{label}</span>
  </div>
);

/**
 * Membership Badge
 * Small badge to show membership status on quotes/jobs
 */
export const MembershipBadge = ({
  membership,
  size = 'default',
  showSavings = false,
  onClick
}) => {
  if (!membership || membership.status !== 'active') return null;

  const isSmall = size === 'small';

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-all ${
        isSmall
          ? 'px-2 py-0.5 text-xs'
          : 'px-3 py-1 text-sm'
      } ${onClick ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
      style={{
        backgroundColor: `${membership.planColor}20`,
        color: membership.planColor || '#10b981'
      }}
    >
      <Shield size={isSmall ? 12 : 14} />
      <span>{membership.planName}</span>
      {showSavings && membership.benefits?.discountPercent > 0 && (
        <span className="font-bold">• {membership.benefits.discountPercent}% off</span>
      )}
    </button>
  );
};

/**
 * Plan Selection Card
 * Used when customer is selecting a plan to purchase
 */
export const PlanSelectionCard = ({
  plan,
  isSelected,
  onSelect,
  recommended = false
}) => {
  const formatPrice = (price, cycle) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(price);

    return {
      price: formatted,
      period: cycle === 'monthly' ? '/mo' : cycle === 'annual' ? '/yr' : ''
    };
  };

  const { price, period } = formatPrice(plan.price, plan.billingCycle);

  return (
    <button
      onClick={() => onSelect(plan)}
      className={`relative w-full p-6 rounded-2xl border-2 text-left transition-all ${
        isSelected
          ? 'bg-white shadow-lg scale-105'
          : 'bg-white hover:shadow-md'
      }`}
      style={{ borderColor: isSelected ? plan.color : '#e2e8f0' }}
    >
      {/* Recommended Badge */}
      {(recommended || plan.featured) && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold text-white rounded-full flex items-center gap-1"
          style={{ backgroundColor: plan.color }}
        >
          <Sparkles size={12} />
          {plan.badgeText || 'Recommended'}
        </div>
      )}

      {/* Plan Name */}
      <div className="flex items-center gap-2 mb-2">
        <Shield size={20} style={{ color: plan.color }} />
        <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-600 mb-4">{plan.description}</p>

      {/* Price */}
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-3xl font-bold" style={{ color: plan.color }}>
          {price}
        </span>
        <span className="text-slate-500">{period}</span>
      </div>

      {/* Services */}
      <div className="space-y-2 mb-4">
        {plan.includedServices?.slice(0, 4).map((service, index) => (
          <div key={index} className="flex items-center gap-2 text-sm text-slate-700">
            <Check size={14} style={{ color: plan.color }} />
            <span>{service.quantity}x {service.description}</span>
          </div>
        ))}
      </div>

      {/* Benefits */}
      <div className="flex flex-wrap gap-2">
        {plan.benefits?.discountPercent > 0 && (
          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
            {plan.benefits.discountPercent}% discount
          </span>
        )}
        {plan.benefits?.priorityScheduling && (
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
            Priority booking
          </span>
        )}
        {plan.benefits?.waiveDiagnosticFee && (
          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
            No diagnostic fee
          </span>
        )}
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div
          className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: plan.color }}
        >
          <Check size={14} />
        </div>
      )}
    </button>
  );
};

export default MembershipCard;
