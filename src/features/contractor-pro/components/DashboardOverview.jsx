// src/features/contractor-pro/components/DashboardOverview.jsx
// ============================================
// CONTRACTOR DASHBOARD OVERVIEW
// ============================================
// Main dashboard showing stats, recent activity, and quick actions

import React, { useState } from 'react';
import { 
    Users, FileText, TrendingUp, Clock, Plus, 
    CheckCircle, AlertCircle, ChevronRight, Copy,
    ExternalLink, Bell, Settings, LogOut, Sparkles,
    Building2, ArrowUpRight, Calendar
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// ============================================
// STAT CARD COMPONENT
// ============================================
const StatCard = ({ icon: Icon, label, value, subtext, color = 'emerald', trend }) => {
    const colorClasses = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100'
    };
    
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${colorClasses[color]}`}>
                    <Icon size={20} />
                </div>
                {trend && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        trend > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
            <p className="text-3xl font-extrabold text-slate-800 mb-1">{value}</p>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
    );
};

// ============================================
// ACTIVITY ITEM COMPONENT
// ============================================
const ActivityItem = ({ invitation, onClick }) => {
    const isClaimed = invitation.status === 'claimed';
    const isPending = invitation.status === 'pending';
    
    const getTimeAgo = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return formatDistanceToNow(date, { addSuffix: true });
    };
    
    const copyLink = (e) => {
        e.stopPropagation();
        if (invitation.link) {
            navigator.clipboard.writeText(invitation.link);
            toast.success('Link copied!');
        }
    };
    
    return (
        <div 
            onClick={onClick}
            className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all cursor-pointer"
        >
            <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                    isClaimed 
                        ? 'bg-emerald-100 text-emerald-600' 
                        : 'bg-amber-100 text-amber-600'
                }`}>
                    {isClaimed ? <CheckCircle size={18} /> : <Clock size={18} />}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-slate-800 truncate">
                            {isClaimed 
                                ? (invitation.customerName || invitation.customerPropertyName || 'New Customer')
                                : 'Pending Invitation'
                            }
                        </p>
                        <span className="text-xs text-slate-400">
                            {getTimeAgo(isClaimed ? invitation.claimedAt : invitation.createdAt)}
                        </span>
                    </div>
                    
                    <p className="text-sm text-slate-500">
                        {invitation.recordCount || 0} item{invitation.recordCount !== 1 ? 's' : ''}
                        {invitation.totalValue > 0 && (
                            <span className="ml-2 font-medium text-slate-600">
                                ${invitation.totalValue.toLocaleString()}
                            </span>
                        )}
                    </p>
                    
                    {/* Record summary */}
                    {invitation.recordSummary?.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1 truncate">
                            {invitation.recordSummary.map(r => r.item).join(', ')}
                        </p>
                    )}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {isPending && (
                        <button 
                            onClick={copyLink}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Copy link"
                        >
                            <Copy size={16} />
                        </button>
                    )}
                    <ChevronRight size={18} className="text-slate-300" />
                </div>
            </div>
        </div>
    );
};

// ============================================
// EMPTY STATE
// ============================================
const EmptyState = ({ onCreateInvitation }) => (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-8 text-center">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 inline-block mb-4">
            <Sparkles className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">
            Welcome to Krib Pro!
        </h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Create your first customer invitation to start building your digital portfolio 
            and tracking relationships.
        </p>
        <button
            onClick={onCreateInvitation}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
        >
            <Plus size={20} />
            Create First Invitation
        </button>
    </div>
);

// ============================================
// QUICK TIP CARD
// ============================================
const QuickTip = ({ tip, onDismiss }) => (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600 flex-shrink-0">
            <Sparkles size={16} />
        </div>
        <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">{tip.title}</p>
            <p className="text-sm text-blue-600 mt-0.5">{tip.message}</p>
        </div>
        {onDismiss && (
            <button 
                onClick={onDismiss}
                className="text-blue-400 hover:text-blue-600"
            >
                ×
            </button>
        )}
    </div>
);

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================
export const DashboardOverview = ({ 
    profile,
    stats,
    invitations,
    customers,
    loading,
    onCreateInvitation,
    onViewAllInvitations,
    onViewAllCustomers,
    onViewInvitation
}) => {
    const [showTip, setShowTip] = useState(true);
    
    const companyName = profile?.profile?.companyName || profile?.profile?.displayName || 'Your Business';
    const hasData = invitations.length > 0 || customers.length > 0;
    
    // Format claim rate as percentage
    const claimRatePercent = Math.round((stats.claimRate || 0) * 100);
    
    // Recent activity (claimed invitations first, then pending)
    const recentActivity = [...invitations]
        .sort((a, b) => {
            // Claimed first
            if (a.status === 'claimed' && b.status !== 'claimed') return -1;
            if (b.status === 'claimed' && a.status !== 'claimed') return 1;
            // Then by date
            const aDate = (a.claimedAt || a.createdAt)?.toDate?.() || new Date(0);
            const bDate = (b.claimedAt || b.createdAt)?.toDate?.() || new Date(0);
            return bDate - aDate;
        })
        .slice(0, 5);
    
    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 w-48 bg-slate-200 rounded-lg" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="h-32 bg-slate-100 rounded-2xl" />
                    ))}
                </div>
                <div className="h-64 bg-slate-100 rounded-2xl" />
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Welcome back! 👋
                    </h1>
                    <p className="text-slate-500">{companyName}</p>
                </div>
                <button
                    onClick={onCreateInvitation}
                    className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                >
                    <Plus size={18} />
                    New Invitation
                </button>
            </div>
            
            {/* Quick Tip (dismissible) */}
            {showTip && stats.totalInvitations < 5 && (
                <QuickTip 
                    tip={{
                        title: "Pro Tip",
                        message: "Send invitations after every job. When customers need service again, you're one tap away!"
                    }}
                    onDismiss={() => setShowTip(false)}
                />
            )}
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard 
                    icon={Users}
                    label="Customers"
                    value={stats.totalCustomers}
                    subtext="have your info saved"
                    color="emerald"
                />
                <StatCard 
                    icon={FileText}
                    label="Invitations"
                    value={stats.totalInvitations}
                    subtext={`${stats.pendingInvitations} pending`}
                    color="blue"
                />
                <StatCard 
                    icon={TrendingUp}
                    label="Claim Rate"
                    value={`${claimRatePercent}%`}
                    subtext="of invitations claimed"
                    color="purple"
                />
                <StatCard 
                    icon={Clock}
                    label="Pending"
                    value={stats.pendingInvitations}
                    subtext="awaiting claim"
                    color="amber"
                />
            </div>
            
            {/* Main Content */}
            {!hasData ? (
                <EmptyState onCreateInvitation={onCreateInvitation} />
            ) : (
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Recent Activity */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800">Recent Activity</h2>
                            <button 
                                onClick={onViewAllInvitations}
                                className="text-sm text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1"
                            >
                                View All <ArrowUpRight size={14} />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            {recentActivity.length > 0 ? (
                                recentActivity.map(invitation => (
                                    <ActivityItem 
                                        key={invitation.id}
                                        invitation={invitation}
                                        onClick={() => onViewInvitation?.(invitation)}
                                    />
                                ))
                            ) : (
                                <p className="text-center text-slate-400 py-8">
                                    No activity yet
                                </p>
                            )}
                        </div>
                    </div>
                    
                    {/* Top Customers */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800">Your Customers</h2>
                            <button 
                                onClick={onViewAllCustomers}
                                className="text-sm text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1"
                            >
                                View All <ArrowUpRight size={14} />
                            </button>
                        </div>
                        <div className="p-4">
                            {customers.length > 0 ? (
                                <div className="space-y-3">
                                    {customers.slice(0, 5).map(customer => (
                                        <div 
                                            key={customer.id}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                                        >
                                            <div className="bg-slate-100 p-2 rounded-full">
                                                <Users size={16} className="text-slate-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-800 truncate">
                                                    {customer.customerName || customer.propertyName || 'Customer'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {customer.totalJobs || 1} job{customer.totalJobs !== 1 ? 's' : ''}
                                                    {customer.totalSpend > 0 && (
                                                        <span className="ml-2">
                                                            • ${customer.totalSpend.toLocaleString()}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-300" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-slate-400 py-8">
                                    No customers yet
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Mobile FAB */}
            <button
                onClick={onCreateInvitation}
                className="md:hidden fixed bottom-24 right-4 p-4 bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 transition-colors z-50"
            >
                <Plus size={24} />
            </button>
        </div>
    );
};

export default DashboardOverview;
