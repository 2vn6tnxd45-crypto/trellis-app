/**
 * MembershipStats Component
 * Analytics dashboard for membership program performance
 */

import React, { useMemo } from 'react';
import {
  Users,
  DollarSign,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Shield,
  Gift,
  Calendar,
  ArrowUp,
  ArrowDown,
  Clock,
  Percent,
  Target,
  PieChart,
  BarChart3
} from 'lucide-react';
import { formatCurrency, formatDate, isExpiringSoon } from '../lib/membershipService';

/**
 * Stats Overview Cards
 */
const StatCard = ({ icon: Icon, label, value, subValue, trend, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-medium ${
            trend >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {subValue && (
        <p className="text-xs text-slate-400 mt-1">{subValue}</p>
      )}
    </div>
  );
};

/**
 * Main Stats Component
 */
export const MembershipStats = ({
  stats,
  expiringMemberships = [],
  loading = false
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12">
        <div className="flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-600">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Shield size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">No Statistics Yet</h3>
        <p className="text-sm text-slate-500">
          Start selling memberships to see your analytics here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Active Members"
          value={stats.activeMembers}
          subValue={`${stats.totalMembers} total`}
          color="blue"
        />
        <StatCard
          icon={DollarSign}
          label="Monthly Revenue"
          value={formatCurrency(stats.monthlyRecurringRevenue)}
          subValue={`${formatCurrency(stats.annualRecurringRevenue)}/year`}
          color="green"
        />
        <StatCard
          icon={RefreshCw}
          label="Renewal Rate"
          value={`${stats.renewalRate.toFixed(1)}%`}
          subValue={`${stats.renewalCount} renewals`}
          color="purple"
        />
        <StatCard
          icon={AlertTriangle}
          label="Expiring Soon"
          value={stats.expiringWithin30Days}
          subValue="Within 30 days"
          color={stats.expiringWithin30Days > 0 ? 'amber' : 'blue'}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 size={20} className="text-slate-400" />
            Plan Performance
          </h3>

          <div className="space-y-4">
            {Object.values(stats.planStats || {})
              .filter(p => p.totalMembers > 0)
              .sort((a, b) => b.activeMembers - a.activeMembers)
              .map((planStat, index) => (
                <PlanStatRow key={planStat.planId} planStat={planStat} index={index} />
              ))
            }

            {Object.values(stats.planStats || {}).filter(p => p.totalMembers > 0).length === 0 && (
              <p className="text-slate-500 text-sm py-4 text-center">
                No plan data available yet
              </p>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          {/* Savings Provided */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <Gift size={18} />
              <span className="text-sm font-medium">Total Savings Provided</span>
            </div>
            <p className="text-3xl font-bold mb-1">
              {formatCurrency(stats.totalSavingsProvided)}
            </p>
            <p className="text-sm opacity-80">
              Avg. {formatCurrency(stats.averageSavingsPerMember)} per member
            </p>
          </div>

          {/* Most Popular Plan */}
          {stats.mostPopularPlan && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-3 text-slate-500">
                <Target size={18} />
                <span className="text-sm font-medium">Most Popular Plan</span>
              </div>
              <p className="text-lg font-bold text-slate-900 mb-1">
                {stats.mostPopularPlan.planName}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {stats.mostPopularPlan.activeMembers} active members
                </span>
                <span className="text-green-600 font-medium">
                  {formatCurrency(stats.mostPopularPlan.revenue)}
                </span>
              </div>
            </div>
          )}

          {/* Status Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4 text-slate-500">
              <PieChart size={18} />
              <span className="text-sm font-medium">Member Status</span>
            </div>
            <div className="space-y-3">
              <StatusBar
                label="Active"
                count={stats.activeMembers}
                total={stats.totalMembers}
                color="bg-green-500"
              />
              <StatusBar
                label="Expired"
                count={stats.expiredMembers}
                total={stats.totalMembers}
                color="bg-slate-400"
              />
              <StatusBar
                label="Cancelled"
                count={stats.cancelledMembers}
                total={stats.totalMembers}
                color="bg-red-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Expiring Soon List */}
      {expiringMemberships.length > 0 && (
        <ExpiringMembershipsList memberships={expiringMemberships} />
      )}
    </div>
  );
};

/**
 * Plan Stat Row
 */
const PlanStatRow = ({ planStat, index }) => {
  const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
  const color = colors[index % colors.length];

  return (
    <div className="p-4 bg-slate-50 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-medium text-slate-900">{planStat.planName}</span>
        </div>
        <span className="text-sm text-slate-500">
          {formatCurrency(planStat.price)}/{planStat.billingCycle === 'monthly' ? 'mo' : 'yr'}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-slate-600">
            <span className="font-bold text-slate-900">{planStat.activeMembers}</span> active
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600">
            {planStat.totalMembers} total
          </span>
        </div>
        <span className="font-bold text-green-600">
          {formatCurrency(planStat.revenue)}
        </span>
      </div>
    </div>
  );
};

/**
 * Status Bar Component
 */
const StatusBar = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{count}</span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Expiring Memberships List
 */
const ExpiringMembershipsList = ({ memberships }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-amber-50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-amber-600" size={20} />
          <h3 className="text-lg font-bold text-slate-900">
            Memberships Expiring Soon
          </h3>
          <span className="ml-auto px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
            {memberships.length}
          </span>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          These members need renewal reminders
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {memberships.slice(0, 5).map(membership => {
          const daysLeft = Math.ceil(
            (new Date(membership.endDate?.toDate ? membership.endDate.toDate() : membership.endDate) - new Date()) /
            (1000 * 60 * 60 * 24)
          );

          return (
            <div
              key={membership.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: membership.planColor || '#10b981' }}
                >
                  {membership.customerName?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{membership.customerName}</p>
                  <p className="text-sm text-slate-500">{membership.planName}</p>
                </div>
              </div>

              <div className="text-right">
                <p className={`font-medium ${
                  daysLeft <= 7 ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {daysLeft <= 0 ? 'Expired' :
                   daysLeft === 1 ? 'Expires tomorrow' :
                   `${daysLeft} days left`}
                </p>
                <p className="text-sm text-slate-500">
                  {formatDate(membership.endDate)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {memberships.length > 5 && (
        <div className="px-6 py-3 bg-slate-50 text-center">
          <p className="text-sm text-slate-500">
            +{memberships.length - 5} more expiring memberships
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Mini Stats Card for Dashboard Widgets
 */
export const MembershipMiniStats = ({ stats, onClick }) => {
  if (!stats) return null;

  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl text-white text-left hover:opacity-90 transition-opacity"
    >
      <div className="flex items-center justify-between mb-3">
        <Shield size={24} />
        {stats.expiringWithin30Days > 0 && (
          <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-bold">
            {stats.expiringWithin30Days} expiring
          </span>
        )}
      </div>
      <p className="text-3xl font-bold mb-1">{stats.activeMembers}</p>
      <p className="text-sm opacity-90">Active Members</p>
      <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-sm">
        <span className="opacity-80">Monthly Revenue</span>
        <span className="font-bold">{formatCurrency(stats.monthlyRecurringRevenue)}</span>
      </div>
    </button>
  );
};

export default MembershipStats;
