/**
 * MembershipsView Component
 * Main memberships dashboard for contractors
 */

import React, { useState } from 'react';
import {
  Crown,
  Users,
  Plus,
  Settings,
  TrendingUp,
  RefreshCw,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SectionLoader } from '../../../components/common';

import { MembershipsList } from './MembershipsList';
import { MembershipStats, MembershipMiniStats } from './MembershipStats';
import { SellMembershipModal } from './SellMembershipModal';
import { PlanBuilder } from './PlanBuilder';
import {
  createMembership,
  cancelMembership,
  renewMembership,
  createPlan,
  getExpiringMemberships
} from '../lib/membershipService';

export const MembershipsView = ({
  plans = [],
  memberships = [],
  stats = null,
  customers = [],
  loading = false,
  contractorId,
  onNavigate,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState('members'); // 'members', 'stats', 'plans'
  const [showSellModal, setShowSellModal] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expiringMemberships, setExpiringMemberships] = useState([]);

  // Load expiring memberships
  React.useEffect(() => {
    const loadExpiring = async () => {
      if (contractorId) {
        try {
          const expiring = await getExpiringMemberships(contractorId, 30);
          setExpiringMemberships(expiring);
        } catch (err) {
          console.error('Error loading expiring memberships:', err);
        }
      }
    };
    loadExpiring();
  }, [contractorId, memberships]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
      toast.success('Data refreshed');
    } catch (err) {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle sell membership
  const handleSellMembership = async (membershipData, customer) => {
    try {
      // If new customer, create them first (would need customer creation service)
      const customerId = customer.id || `temp-${Date.now()}`;

      await createMembership(contractorId, {
        ...membershipData,
        customerId
      });

      toast.success('Membership sold successfully!');
      setShowSellModal(false);
      await onRefresh?.();
    } catch (err) {
      console.error('Error selling membership:', err);
      toast.error('Failed to create membership');
    }
  };

  // Handle renew
  const handleRenew = async (membershipId) => {
    try {
      await renewMembership(contractorId, membershipId);
      toast.success('Membership renewed!');
      await onRefresh?.();
    } catch (err) {
      console.error('Error renewing membership:', err);
      toast.error('Failed to renew');
    }
  };

  // Handle cancel
  const handleCancel = async (membershipId) => {
    if (!confirm('Are you sure you want to cancel this membership?')) return;

    try {
      await cancelMembership(contractorId, membershipId, 'Cancelled by contractor');
      toast.success('Membership cancelled');
      await onRefresh?.();
    } catch (err) {
      console.error('Error cancelling membership:', err);
      toast.error('Failed to cancel');
    }
  };

  // Handle create plan
  const handleCreatePlan = async (planData) => {
    try {
      await createPlan(contractorId, planData);
      toast.success('Plan created!');
      setShowCreatePlan(false);
      await onRefresh?.();
    } catch (err) {
      console.error('Error creating plan:', err);
      toast.error('Failed to create plan');
    }
  };

  if (loading) {
    return <SectionLoader message="Loading memberships..." className="min-h-[60vh]" />;
  }

  // If showing create plan form
  if (showCreatePlan) {
    return (
      <div>
        <button
          onClick={() => setShowCreatePlan(false)}
          className="mb-4 text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          ← Back to Memberships
        </button>
        <PlanBuilder
          onSave={handleCreatePlan}
          onCancel={() => setShowCreatePlan(false)}
        />
      </div>
    );
  }

  const activePlans = plans.filter(p => p.active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Crown className="text-amber-500" size={28} />
            Memberships
          </h1>
          <p className="text-slate-500 mt-1">
            Manage service plans and member benefits
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setShowCreatePlan(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Settings size={16} />
            Manage Plans
          </button>

          <button
            onClick={() => setShowSellModal(true)}
            disabled={activePlans.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            Sell Membership
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickStatCard
            label="Active Members"
            value={stats.activeMembers}
            icon={Users}
            color="blue"
          />
          <QuickStatCard
            label="Monthly Revenue"
            value={`$${stats.monthlyRecurringRevenue?.toFixed(0) || 0}`}
            icon={TrendingUp}
            color="green"
          />
          <QuickStatCard
            label="Active Plans"
            value={activePlans.length}
            icon={Crown}
            color="amber"
          />
          <QuickStatCard
            label="Renewal Rate"
            value={`${stats.renewalRate?.toFixed(0) || 0}%`}
            icon={RefreshCw}
            color="purple"
          />
        </div>
      )}

      {/* No Plans Warning */}
      {activePlans.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <Crown className="mx-auto text-amber-500 mb-3" size={40} />
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            No Membership Plans Yet
          </h3>
          <p className="text-slate-600 mb-4">
            Create your first membership plan to start selling recurring service agreements.
          </p>
          <button
            onClick={() => setShowCreatePlan(true)}
            className="px-6 py-2 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors"
          >
            Create Your First Plan
          </button>
        </div>
      )}

      {/* Tabs */}
      {activePlans.length > 0 && (
        <>
          <div className="flex gap-2 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('members')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'members'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Members ({memberships.length})
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'stats'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'plans'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Plans ({activePlans.length})
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'members' && (
            <MembershipsList
              memberships={memberships}
              plans={plans}
              loading={loading}
              onRenew={handleRenew}
              onCancel={handleCancel}
              onViewDetails={(membership) => {
                console.log('View details:', membership);
              }}
              onSendReminder={(membershipId) => {
                toast.success('Reminder sent!');
              }}
            />
          )}

          {activeTab === 'stats' && (
            <MembershipStats
              stats={stats}
              expiringMemberships={expiringMemberships}
              loading={loading}
            />
          )}

          {activeTab === 'plans' && (
            <PlansListView
              plans={plans}
              onCreatePlan={() => setShowCreatePlan(true)}
              contractorId={contractorId}
              onRefresh={onRefresh}
            />
          )}
        </>
      )}

      {/* Sell Membership Modal */}
      <SellMembershipModal
        isOpen={showSellModal}
        onClose={() => setShowSellModal(false)}
        plans={activePlans}
        customers={customers}
        onSell={handleSellMembership}
      />
    </div>
  );
};

/**
 * Quick Stat Card
 */
const QuickStatCard = ({ label, value, icon: Icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Plans List View
 */
const PlansListView = ({ plans, onCreatePlan, contractorId, onRefresh }) => {
  const [editingPlan, setEditingPlan] = useState(null);

  const handleUpdatePlan = async (planData) => {
    try {
      const { updatePlan } = await import('../lib/membershipService');
      await updatePlan(contractorId, editingPlan.id, planData);
      toast.success('Plan updated!');
      setEditingPlan(null);
      await onRefresh?.();
    } catch (err) {
      console.error('Error updating plan:', err);
      toast.error('Failed to update plan');
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!confirm('Are you sure you want to deactivate this plan?')) return;

    try {
      const { deletePlan } = await import('../lib/membershipService');
      await deletePlan(contractorId, planId);
      toast.success('Plan deactivated');
      await onRefresh?.();
    } catch (err) {
      console.error('Error deleting plan:', err);
      toast.error('Failed to deactivate plan');
    }
  };

  if (editingPlan) {
    return (
      <PlanBuilder
        plan={editingPlan}
        onSave={handleUpdatePlan}
        onCancel={() => setEditingPlan(null)}
      />
    );
  }

  const activePlans = plans.filter(p => p.active);
  const inactivePlans = plans.filter(p => !p.active);

  return (
    <div className="space-y-6">
      {/* Active Plans */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Active Plans</h3>
          <button
            onClick={onCreatePlan}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"
          >
            <Plus size={16} />
            Create Plan
          </button>
        </div>

        {activePlans.length === 0 ? (
          <div className="bg-slate-50 rounded-xl p-8 text-center">
            <p className="text-slate-500">No active plans. Create your first plan to get started.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePlans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={() => setEditingPlan(plan)}
                onDelete={() => handleDeletePlan(plan.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inactive Plans */}
      {inactivePlans.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-slate-500 mb-4">Inactive Plans</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {inactivePlans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={() => setEditingPlan(plan)}
                inactive
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Plan Card
 */
const PlanCard = ({ plan, onEdit, onDelete, inactive }) => {
  return (
    <div
      className="bg-white rounded-xl border-2 p-4 transition-all hover:shadow-md"
      style={{ borderColor: plan.color || '#10b981' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-bold text-slate-900">{plan.name}</h4>
          <p className="text-sm text-slate-500">{plan.description}</p>
        </div>
        {plan.featured && (
          <span className="px-2 py-0.5 text-xs font-bold text-amber-700 bg-amber-100 rounded-full">
            Featured
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-bold" style={{ color: plan.color }}>
          ${plan.price}
        </span>
        <span className="text-slate-500">
          /{plan.billingCycle === 'monthly' ? 'mo' : 'yr'}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
          {plan.memberCount || 0} members
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="px-3 py-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Edit
          </button>
          {!inactive && onDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Deactivate
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MembershipsView;
