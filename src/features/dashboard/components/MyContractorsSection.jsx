// src/features/dashboard/components/MyContractorsSection.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    Hammer, Phone, Mail, MessageCircle, Star,
    ChevronRight, Shield, CheckCircle2, Clock,
    Plus, ExternalLink, Building2, Wrench
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { appId } from '../../../config/constants';
import { DashboardSection } from '../../../components/common/DashboardSection';

/**
 * MyContractorsSection - Displays homeowner's contractor relationships
 *
 * Two types of contractors:
 * 1. Record-based contractors (extracted from past work records)
 * 2. Linked/Professional contractors (claimed invitations or marketplace connections)
 */

const ContractorCard = ({ contractor, onContact, onViewProfile }) => {
    const isLinked = contractor.isLinked;
    const hasPhone = contractor.phone && contractor.phone.length > 5;
    const hasEmail = contractor.email && contractor.email.includes('@');

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 hover:shadow-md transition-all group">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                {/* Avatar/Logo */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isLinked
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                        : 'bg-slate-100'
                }`}>
                    {contractor.logoUrl ? (
                        <img
                            src={contractor.logoUrl}
                            alt={contractor.name}
                            className="w-full h-full object-cover rounded-xl"
                        />
                    ) : (
                        <Building2 size={20} className={isLinked ? 'text-white' : 'text-slate-400'} />
                    )}
                </div>

                {/* Name & Trade */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 truncate">
                            {contractor.companyName || contractor.name}
                        </h3>
                        {isLinked && (
                            <span className="shrink-0 p-1 bg-emerald-100 rounded-full" title="Verified Pro">
                                <CheckCircle2 size={12} className="text-emerald-600" />
                            </span>
                        )}
                    </div>
                    {contractor.trade && (
                        <p className="text-xs text-slate-500 mt-0.5">{contractor.trade}</p>
                    )}
                    {!contractor.trade && contractor.jobCount > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">
                            {contractor.jobCount} job{contractor.jobCount !== 1 ? 's' : ''} completed
                        </p>
                    )}
                </div>
            </div>

            {/* Stats for linked contractors */}
            {isLinked && (contractor.rating || contractor.responseTime) && (
                <div className="flex items-center gap-3 mb-3 text-xs">
                    {contractor.rating && (
                        <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-md font-medium">
                            <Star size={12} fill="currentColor" />
                            {contractor.rating.toFixed(1)}
                        </span>
                    )}
                    {contractor.responseTime && (
                        <span className="flex items-center gap-1 text-slate-500">
                            <Clock size={12} />
                            Responds in ~{contractor.responseTime}h
                        </span>
                    )}
                    {contractor.insured && (
                        <span className="flex items-center gap-1 text-emerald-600">
                            <Shield size={12} />
                            Insured
                        </span>
                    )}
                </div>
            )}

            {/* Recent work for record-based contractors */}
            {!isLinked && contractor.recentWork && (
                <div className="mb-3 p-2 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">Recent work</p>
                    <p className="text-sm text-slate-600 truncate">{contractor.recentWork}</p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-3 border-t border-slate-100">
                {hasPhone && (
                    <a
                        href={`tel:${contractor.phone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-colors"
                    >
                        <Phone size={14} />
                        Call
                    </a>
                )}
                {hasEmail && (
                    <a
                        href={`mailto:${contractor.email}`}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <Mail size={14} />
                        Email
                    </a>
                )}
                {isLinked && contractor.profileId && (
                    <button
                        onClick={() => onViewProfile?.(contractor)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <ExternalLink size={14} />
                        Profile
                    </button>
                )}
                {!hasPhone && !hasEmail && !isLinked && (
                    <button
                        onClick={() => onContact?.(contractor)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-500 text-xs font-medium rounded-lg cursor-not-allowed"
                        disabled
                    >
                        No contact info
                    </button>
                )}
            </div>
        </div>
    );
};

const EmptyState = ({ onFindContractors, onCreateLink }) => (
    <div className="text-center py-8 px-4">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Hammer size={28} className="text-slate-400" />
        </div>
        <h3 className="font-bold text-slate-700 mb-2">No contractors yet</h3>
        <p className="text-sm text-slate-500 mb-4 max-w-xs mx-auto">
            Add contractors from your home improvement receipts or find local pros
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
                onClick={onFindContractors}
                className="px-4 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
                <Wrench size={16} />
                Find Local Pros
            </button>
            <button
                onClick={onCreateLink}
                className="px-4 py-2.5 bg-white text-slate-600 font-medium text-sm rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
                <Plus size={16} />
                Create Service Link
            </button>
        </div>
    </div>
);

export const MyContractorsSection = ({
    contractors = [], // Record-based contractors from App.jsx
    userId,
    onNavigateToContractors,
    onCreateContractorLink,
    onViewContractorProfile
}) => {
    const [linkedContractors, setLinkedContractors] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch linked/professional contractors from claimed invitations
    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const fetchLinkedContractors = async () => {
            try {
                // Query invitations claimed by contractors for this homeowner
                const invitationsRef = collection(db, 'artifacts', appId, 'public', 'data', 'invitations');
                const q = query(
                    invitationsRef,
                    where('claimedBy', '==', userId),
                    where('status', '==', 'claimed')
                );

                const snapshot = await getDocs(q);
                const linked = [];

                for (const invDoc of snapshot.docs) {
                    const inv = invDoc.data();
                    if (inv.contractorId) {
                        // Fetch contractor profile details
                        try {
                            const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'contractorProfiles', inv.contractorId);
                            const profileSnap = await getDoc(profileRef);

                            if (profileSnap.exists()) {
                                const profile = profileSnap.data();
                                linked.push({
                                    id: inv.contractorId,
                                    profileId: inv.contractorId,
                                    name: profile.ownerName || profile.businessName,
                                    companyName: profile.businessName,
                                    trade: profile.primaryTrade,
                                    phone: profile.showPhone ? profile.phone : null,
                                    email: profile.showEmail ? profile.email : null,
                                    logoUrl: profile.logoUrl,
                                    rating: profile.averageRating,
                                    reviewCount: profile.reviewCount,
                                    responseTime: profile.averageResponseTime,
                                    insured: profile.insured,
                                    isLinked: true,
                                    claimedAt: inv.claimedAt
                                });
                            } else {
                                // Fallback: contractor claimed but no public profile
                                const contractorRef = doc(db, 'artifacts', appId, 'public', 'data', 'contractors', inv.contractorId);
                                const contractorSnap = await getDoc(contractorRef);

                                if (contractorSnap.exists()) {
                                    const contractor = contractorSnap.data();
                                    linked.push({
                                        id: inv.contractorId,
                                        profileId: inv.contractorId,
                                        name: contractor.profile?.displayName || inv.contractorEmail,
                                        companyName: contractor.profile?.companyName,
                                        trade: contractor.profile?.specialty,
                                        phone: contractor.profile?.phone,
                                        email: contractor.profile?.email,
                                        logoUrl: contractor.profile?.logoUrl,
                                        insured: contractor.profile?.insured,
                                        isLinked: true,
                                        claimedAt: inv.claimedAt
                                    });
                                }
                            }
                        } catch (err) {
                            console.error('Error fetching contractor profile:', err);
                        }
                    }
                }

                setLinkedContractors(linked);
            } catch (err) {
                console.error('Error fetching linked contractors:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchLinkedContractors();
    }, [userId]);

    // Combine and dedupe contractors
    const allContractors = useMemo(() => {
        const combined = [];
        const seenEmails = new Set();
        const seenNames = new Set();

        // Add linked contractors first (higher priority)
        linkedContractors.forEach(c => {
            combined.push(c);
            if (c.email) seenEmails.add(c.email.toLowerCase());
            if (c.name) seenNames.add(c.name.toLowerCase());
            if (c.companyName) seenNames.add(c.companyName.toLowerCase());
        });

        // Add record-based contractors (dedupe by email/name)
        contractors.forEach(c => {
            const emailKey = c.email?.toLowerCase();
            const nameKey = c.name?.toLowerCase();

            // Skip if already have this contractor from linked list
            if (emailKey && seenEmails.has(emailKey)) return;
            if (nameKey && seenNames.has(nameKey)) return;

            combined.push({
                ...c,
                isLinked: false,
                jobCount: c.jobs?.length || 0,
                recentWork: c.jobs?.[0]?.itemName || c.jobs?.[0]?.category
            });

            if (emailKey) seenEmails.add(emailKey);
            if (nameKey) seenNames.add(nameKey);
        });

        // Sort: linked first, then by job count
        return combined.sort((a, b) => {
            if (a.isLinked && !b.isLinked) return -1;
            if (!a.isLinked && b.isLinked) return 1;
            return (b.jobCount || 0) - (a.jobCount || 0);
        });
    }, [contractors, linkedContractors]);

    // Summary badge
    const getSummary = () => {
        const linkedCount = linkedContractors.length;
        const totalCount = allContractors.length;

        if (totalCount === 0) return null;

        if (linkedCount > 0) {
            return (
                <span className="text-xs text-emerald-600 font-bold">
                    {linkedCount} Pro{linkedCount !== 1 ? 's' : ''} linked
                </span>
            );
        }

        return (
            <span className="text-xs text-slate-500 font-medium">
                {totalCount} contractor{totalCount !== 1 ? 's' : ''}
            </span>
        );
    };

    if (loading) {
        return (
            <DashboardSection
                title="My Contractors"
                icon={Hammer}
                defaultOpen={false}
            >
                <div className="py-8 text-center">
                    <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto" />
                    <p className="text-sm text-slate-400 mt-2">Loading contractors...</p>
                </div>
            </DashboardSection>
        );
    }

    return (
        <DashboardSection
            title="My Contractors"
            icon={Hammer}
            defaultOpen={allContractors.length > 0}
            summary={getSummary()}
        >
            {allContractors.length === 0 ? (
                <EmptyState
                    onFindContractors={onNavigateToContractors}
                    onCreateLink={onCreateContractorLink}
                />
            ) : (
                <div className="space-y-4">
                    {/* Contractor Grid */}
                    <div className="grid gap-3 md:grid-cols-2">
                        {allContractors.slice(0, 4).map((contractor, idx) => (
                            <ContractorCard
                                key={contractor.id || contractor.name || idx}
                                contractor={contractor}
                                onViewProfile={onViewContractorProfile}
                            />
                        ))}
                    </div>

                    {/* View All Button */}
                    {allContractors.length > 4 && (
                        <button
                            onClick={onNavigateToContractors}
                            className="w-full py-3 text-center text-sm text-emerald-600 font-bold hover:bg-emerald-50 rounded-xl transition-colors flex items-center justify-center gap-1"
                        >
                            View all {allContractors.length} contractors
                            <ChevronRight size={16} />
                        </button>
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={onNavigateToContractors}
                            className="flex-1 px-4 py-2.5 bg-emerald-50 text-emerald-700 font-bold text-sm rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <Wrench size={16} />
                            Find Pros
                        </button>
                        <button
                            onClick={onCreateContractorLink}
                            className="flex-1 px-4 py-2.5 bg-slate-50 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={16} />
                            Share Link
                        </button>
                    </div>
                </div>
            )}
        </DashboardSection>
    );
};

export default MyContractorsSection;
