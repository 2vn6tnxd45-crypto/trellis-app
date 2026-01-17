/**
 * MembershipsList Component
 * Dashboard showing all customer memberships with filters and actions
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Users,
  Clock,
  AlertTriangle,
  Ban,
  MoreVertical,
  RefreshCw,
  XCircle,
  Eye,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  ChevronDown,
  Shield,
  CheckCircle,
  Edit,
  Trash2
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  getStatusBadgeInfo,
  getDaysUntilExpiration,
  isExpiringSoon
} from '../lib/membershipService';

// Status filter options
const STATUS_FILTERS = [
  { value: 'all', label: 'All Members', icon: Users },
  { value: 'active', label: 'Active', icon: CheckCircle },
  { value: 'expiring', label: 'Expiring Soon', icon: AlertTriangle },
  { value: 'expired', label: 'Expired', icon: Clock },
  { value: 'cancelled', label: 'Cancelled', icon: Ban }
];

export const MembershipsList = ({
  memberships = [],
  plans = [],
  loading = false,
  onRenew,
  onCancel,
  onViewDetails,
  onSendReminder,
  onEdit
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [sortBy, setSortBy] = useState('endDate');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedMemberships, setSelectedMemberships] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);

  // Filter and sort memberships
  const filteredMemberships = useMemo(() => {
    let result = [...memberships];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.customerName?.toLowerCase().includes(query) ||
        m.customerEmail?.toLowerCase().includes(query) ||
        m.planName?.toLowerCase().includes(query) ||
        m.propertyAddress?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'expiring') {
        result = result.filter(m =>
          m.status === 'active' && isExpiringSoon(m.endDate, 30)
        );
      } else {
        result = result.filter(m => m.status === statusFilter);
      }
    }

    // Plan filter
    if (planFilter !== 'all') {
      result = result.filter(m => m.planId === planFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'endDate':
          const dateA = a.endDate?.toDate ? a.endDate.toDate() : new Date(a.endDate);
          const dateB = b.endDate?.toDate ? b.endDate.toDate() : new Date(b.endDate);
          comparison = dateA - dateB;
          break;
        case 'customerName':
          comparison = (a.customerName || '').localeCompare(b.customerName || '');
          break;
        case 'planName':
          comparison = (a.planName || '').localeCompare(b.planName || '');
          break;
        case 'totalSavings':
          comparison = (b.totalSavings || 0) - (a.totalSavings || 0);
          break;
        default:
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [memberships, searchQuery, statusFilter, planFilter, sortBy, sortOrder]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = {
      all: memberships.length,
      active: 0,
      expiring: 0,
      expired: 0,
      cancelled: 0
    };

    memberships.forEach(m => {
      if (m.status === 'active') {
        counts.active++;
        if (isExpiringSoon(m.endDate, 30)) {
          counts.expiring++;
        }
      } else if (m.status === 'expired') {
        counts.expired++;
      } else if (m.status === 'cancelled') {
        counts.cancelled++;
      }
    });

    return counts;
  }, [memberships]);

  // Toggle selection
  const toggleSelection = (membershipId) => {
    setSelectedMemberships(prev =>
      prev.includes(membershipId)
        ? prev.filter(id => id !== membershipId)
        : [...prev, membershipId]
    );
  };

  // Toggle all selection
  const toggleAllSelection = () => {
    if (selectedMemberships.length === filteredMemberships.length) {
      setSelectedMemberships([]);
    } else {
      setSelectedMemberships(filteredMemberships.map(m => m.id));
    }
  };

  // Bulk actions
  const handleBulkRenewal = () => {
    selectedMemberships.forEach(id => {
      const membership = memberships.find(m => m.id === id);
      if (membership?.status === 'active' || membership?.status === 'expired') {
        onRenew?.(id);
      }
    });
    setSelectedMemberships([]);
  };

  const handleBulkReminder = () => {
    selectedMemberships.forEach(id => {
      onSendReminder?.(id);
    });
    setSelectedMemberships([]);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12">
        <div className="flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-600">Loading memberships...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Customer Memberships</h2>
            <p className="text-sm text-slate-600 mt-1">
              {statusCounts.active} active members • {statusCounts.expiring} expiring soon
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, email, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2 mt-4">
          {STATUS_FILTERS.map(filter => {
            const Icon = filter.icon;
            const count = statusCounts[filter.value];
            const isActive = statusFilter === filter.value;

            return (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon size={16} />
                {filter.label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  isActive ? 'bg-blue-500' : 'bg-slate-200'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Additional Filters */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          {/* Plan Filter */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Plans</option>
              {plans.filter(p => p.active).map(plan => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="endDate">Expiration Date</option>
              <option value="customerName">Customer Name</option>
              <option value="planName">Plan Name</option>
              <option value="totalSavings">Total Savings</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ChevronDown
                size={16}
                className={`text-slate-500 transition-transform ${
                  sortOrder === 'desc' ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* Bulk Actions */}
          {selectedMemberships.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-slate-600">
                {selectedMemberships.length} selected
              </span>
              <button
                onClick={handleBulkReminder}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Mail size={14} />
                Send Reminders
              </button>
              <button
                onClick={handleBulkRenewal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                <RefreshCw size={14} />
                Bulk Renew
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {filteredMemberships.length === 0 ? (
        <div className="p-12 text-center">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No memberships found</h3>
          <p className="text-sm text-slate-500">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Start selling membership plans to see them here'
            }
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedMemberships.length === filteredMemberships.length}
                    onChange={toggleAllSelection}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Services Used
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Savings
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMemberships.map(membership => (
                <MembershipRow
                  key={membership.id}
                  membership={membership}
                  isSelected={selectedMemberships.includes(membership.id)}
                  isExpanded={expandedRow === membership.id}
                  onToggleSelect={() => toggleSelection(membership.id)}
                  onToggleExpand={() => setExpandedRow(
                    expandedRow === membership.id ? null : membership.id
                  )}
                  onRenew={() => onRenew?.(membership.id)}
                  onCancel={() => onCancel?.(membership.id)}
                  onViewDetails={() => onViewDetails?.(membership)}
                  onSendReminder={() => onSendReminder?.(membership.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <p className="text-sm text-slate-600">
          Showing {filteredMemberships.length} of {memberships.length} memberships
        </p>
      </div>
    </div>
  );
};

/**
 * Membership Row Component
 */
const MembershipRow = ({
  membership,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onRenew,
  onCancel,
  onViewDetails,
  onSendReminder
}) => {
  const [showActions, setShowActions] = useState(false);

  const statusInfo = getStatusBadgeInfo(membership.status);
  const daysLeft = getDaysUntilExpiration(membership.endDate);
  const expiringSoon = isExpiringSoon(membership.endDate, 30);

  // Calculate services used
  const servicesStats = useMemo(() => {
    const services = membership.servicesUsed || [];
    const totalUsed = services.reduce((sum, s) => sum + s.usedCount, 0);
    const totalIncluded = services.reduce((sum, s) => sum + s.includedCount, 0);
    return { used: totalUsed, total: totalIncluded };
  }, [membership.servicesUsed]);

  return (
    <>
      <tr className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
        {/* Checkbox */}
        <td className="px-4 py-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
          />
        </td>

        {/* Customer */}
        <td className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: membership.planColor || '#10b981' }}
            >
              {membership.customerName?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-medium text-slate-900">{membership.customerName}</p>
              <p className="text-sm text-slate-500">{membership.customerEmail}</p>
              {membership.propertyAddress && (
                <p className="text-xs text-slate-400 mt-0.5">{membership.propertyAddress}</p>
              )}
            </div>
          </div>
        </td>

        {/* Plan */}
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <Shield size={16} style={{ color: membership.planColor || '#10b981' }} />
            <div>
              <p className="font-medium text-slate-900">{membership.planName}</p>
              <p className="text-sm text-slate-500">
                {formatCurrency(membership.price)}/{membership.billingCycle === 'monthly' ? 'mo' : 'yr'}
              </p>
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="px-4 py-4">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.className}`}>
            {membership.status === 'active' && expiringSoon ? (
              <AlertTriangle size={12} />
            ) : (
              <CheckCircle size={12} />
            )}
            {statusInfo.label}
          </span>
          {membership.autoRenew && membership.status === 'active' && (
            <span className="ml-2 text-xs text-slate-400">Auto-renew</span>
          )}
        </td>

        {/* Expires */}
        <td className="px-4 py-4">
          <div>
            <p className={`font-medium ${
              expiringSoon && membership.status === 'active' ? 'text-amber-600' : 'text-slate-900'
            }`}>
              {formatDate(membership.endDate)}
            </p>
            {membership.status === 'active' && daysLeft !== null && (
              <p className={`text-sm ${
                daysLeft <= 7 ? 'text-red-500' :
                daysLeft <= 30 ? 'text-amber-500' :
                'text-slate-500'
              }`}>
                {daysLeft <= 0 ? 'Expired' :
                 daysLeft === 1 ? '1 day left' :
                 `${daysLeft} days left`}
              </p>
            )}
          </div>
        </td>

        {/* Services Used */}
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden max-w-20">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${servicesStats.total > 0 ? (servicesStats.used / servicesStats.total) * 100 : 0}%`,
                  backgroundColor: membership.planColor || '#10b981'
                }}
              />
            </div>
            <span className="text-sm text-slate-600">
              {servicesStats.used}/{servicesStats.total}
            </span>
          </div>
        </td>

        {/* Savings */}
        <td className="px-4 py-4">
          <p className="font-medium text-green-600">
            {formatCurrency(membership.totalSavings || 0)}
          </p>
        </td>

        {/* Actions */}
        <td className="px-4 py-4">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onViewDetails}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="View Details"
            >
              <Eye size={16} />
            </button>

            {membership.status === 'active' && (
              <button
                onClick={onSendReminder}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Send Reminder"
              >
                <Mail size={16} />
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <MoreVertical size={16} />
              </button>

              {showActions && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowActions(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
                    <button
                      onClick={() => {
                        onViewDetails();
                        setShowActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Eye size={14} />
                      View Details
                    </button>

                    {(membership.status === 'active' || membership.status === 'expired') && (
                      <button
                        onClick={() => {
                          onRenew();
                          setShowActions(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                      >
                        <RefreshCw size={14} />
                        Renew Membership
                      </button>
                    )}

                    {membership.status === 'active' && (
                      <button
                        onClick={() => {
                          onCancel();
                          setShowActions(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                      >
                        <XCircle size={14} />
                        Cancel Membership
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </td>
      </tr>

      {/* Expanded Details */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="bg-slate-50 p-4">
            <MembershipDetails membership={membership} />
          </td>
        </tr>
      )}
    </>
  );
};

/**
 * Membership Details (expanded view)
 */
const MembershipDetails = ({ membership }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Services */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Services Used</h4>
        <ul className="space-y-1">
          {(membership.servicesUsed || []).map((service, index) => (
            <li key={index} className="text-sm text-slate-600 flex justify-between">
              <span>{service.serviceName || service.serviceType}</span>
              <span className="font-medium">{service.usedCount}/{service.includedCount}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Benefits */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Active Benefits</h4>
        <ul className="space-y-1 text-sm text-slate-600">
          {membership.benefits?.discountPercent > 0 && (
            <li>{membership.benefits.discountPercent}% repair discount</li>
          )}
          {membership.benefits?.priorityScheduling && <li>Priority scheduling</li>}
          {membership.benefits?.waiveDiagnosticFee && <li>No diagnostic fee</li>}
          {membership.benefits?.waiveTripFee && <li>No trip fee</li>}
          {membership.benefits?.emergencyResponse && (
            <li>{membership.benefits.emergencyResponse} emergency response</li>
          )}
        </ul>
      </div>

      {/* Discounts Applied */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Recent Savings</h4>
        <ul className="space-y-1">
          {(membership.discountsApplied || []).slice(-3).map((discount, index) => (
            <li key={index} className="text-sm text-slate-600 flex justify-between">
              <span>{formatDate(discount.date)}</span>
              <span className="font-medium text-green-600">-{formatCurrency(discount.amount)}</span>
            </li>
          ))}
          {(!membership.discountsApplied || membership.discountsApplied.length === 0) && (
            <li className="text-sm text-slate-400 italic">No discounts applied yet</li>
          )}
        </ul>
      </div>

      {/* Summary */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Summary</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Member Since</span>
            <span className="font-medium text-slate-900">{formatDate(membership.startDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Total Savings</span>
            <span className="font-medium text-green-600">{formatCurrency(membership.totalSavings || 0)}</span>
          </div>
          {membership.renewedAt && (
            <div className="flex justify-between">
              <span className="text-slate-600">Last Renewed</span>
              <span className="font-medium text-slate-900">{formatDate(membership.renewedAt)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MembershipsList;
