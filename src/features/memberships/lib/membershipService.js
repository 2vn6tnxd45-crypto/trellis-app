/**
 * Membership Service
 * Handles plan management, membership lifecycle, benefit application, and analytics
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';

// Helper to get the correct contractor path
const getContractorPath = (contractorId) => `${CONTRACTORS_COLLECTION_PATH}/${contractorId}`;

// ===========================================
// PLAN MANAGEMENT
// ===========================================

/**
 * Create a new membership plan
 */
export const createPlan = async (contractorId, planData) => {
  const plansRef = collection(db, getContractorPath(contractorId), 'membershipPlans');

  const plan = {
    ...planData,
    active: planData.active ?? true,
    autoRenew: planData.autoRenew ?? true,
    renewalReminderDays: planData.renewalReminderDays ?? 30,
    memberCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  const docRef = await addDoc(plansRef, plan);
  return { id: docRef.id, ...plan };
};

/**
 * Update an existing membership plan
 */
export const updatePlan = async (contractorId, planId, updates) => {
  const planRef = doc(db, getContractorPath(contractorId), 'membershipPlans', planId);

  const updateData = {
    ...updates,
    updatedAt: Timestamp.now()
  };

  await updateDoc(planRef, updateData);
  return { id: planId, ...updateData };
};

/**
 * Get a single membership plan
 */
export const getPlan = async (contractorId, planId) => {
  const planRef = doc(db, getContractorPath(contractorId), 'membershipPlans', planId);
  const planSnap = await getDoc(planRef);

  if (!planSnap.exists()) {
    throw new Error('Plan not found');
  }

  return { id: planSnap.id, ...planSnap.data() };
};

/**
 * Get all membership plans for a contractor
 */
export const getPlans = async (contractorId, includeInactive = false) => {
  const plansRef = collection(db, getContractorPath(contractorId), 'membershipPlans');

  let q = query(plansRef, orderBy('createdAt', 'desc'));

  if (!includeInactive) {
    q = query(plansRef, where('active', '==', true), orderBy('createdAt', 'desc'));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Delete (deactivate) a membership plan
 */
export const deletePlan = async (contractorId, planId) => {
  const planRef = doc(db, getContractorPath(contractorId), 'membershipPlans', planId);

  // Soft delete - just mark as inactive
  await updateDoc(planRef, {
    active: false,
    updatedAt: Timestamp.now()
  });
};

// ===========================================
// MEMBERSHIP MANAGEMENT
// ===========================================

/**
 * Create a new customer membership
 */
export const createMembership = async (contractorId, membershipData) => {
  const membershipsRef = collection(db, getContractorPath(contractorId), 'memberships');

  // Get the plan details
  const plan = await getPlan(contractorId, membershipData.planId);

  // Calculate end date based on billing cycle
  const startDate = membershipData.startDate || Timestamp.now();
  const endDate = calculateEndDate(startDate, plan.billingCycle);
  const renewalDate = calculateRenewalDate(endDate, plan.renewalReminderDays || 30);

  // Initialize service usage tracking
  const servicesUsed = (plan.includedServices || []).map(service => ({
    serviceType: service.serviceType,
    serviceName: service.description || service.serviceType,
    usedCount: 0,
    includedCount: service.quantity,
    lastUsedDate: null,
    jobIds: []
  }));

  const membership = {
    planId: membershipData.planId,
    planName: plan.name,
    planColor: plan.color || '#10b981',

    // Customer info
    customerId: membershipData.customerId,
    customerName: membershipData.customerName,
    customerEmail: membershipData.customerEmail,
    customerPhone: membershipData.customerPhone || null,
    propertyId: membershipData.propertyId || null,
    propertyAddress: membershipData.propertyAddress || null,

    // Status
    status: 'active',

    // Dates
    startDate,
    endDate,
    renewalDate,

    // Billing
    price: plan.price,
    billingCycle: plan.billingCycle,
    autoRenew: membershipData.autoRenew ?? plan.autoRenew ?? true,
    paymentMethod: membershipData.paymentMethod || 'manual', // 'stripe' or 'manual'
    stripeSubscriptionId: membershipData.stripeSubscriptionId || null,
    stripeCustomerId: membershipData.stripeCustomerId || null,

    // Benefits from plan
    benefits: plan.benefits || {},

    // Usage tracking
    servicesUsed,

    // Savings tracking
    discountsApplied: [],
    feesWaived: [],
    totalSavings: 0,

    // Metadata
    notes: membershipData.notes || '',
    createdAt: Timestamp.now(),
    renewedAt: null,
    cancelledAt: null,
    cancellationReason: null
  };

  const docRef = await addDoc(membershipsRef, membership);

  // Update plan member count
  const planRef = doc(db, getContractorPath(contractorId), 'membershipPlans', membershipData.planId);
  const planSnap = await getDoc(planRef);
  if (planSnap.exists()) {
    await updateDoc(planRef, {
      memberCount: (planSnap.data().memberCount || 0) + 1,
      updatedAt: Timestamp.now()
    });
  }

  return { id: docRef.id, ...membership };
};

/**
 * Get a single membership
 */
export const getMembership = async (contractorId, membershipId) => {
  const membershipRef = doc(db, getContractorPath(contractorId), 'memberships', membershipId);
  const membershipSnap = await getDoc(membershipRef);

  if (!membershipSnap.exists()) {
    throw new Error('Membership not found');
  }

  return { id: membershipSnap.id, ...membershipSnap.data() };
};

/**
 * Get all memberships for a contractor
 */
export const getMemberships = async (contractorId, filters = {}) => {
  const membershipsRef = collection(db, getContractorPath(contractorId), 'memberships');

  let q = query(membershipsRef, orderBy('createdAt', 'desc'));

  if (filters.status) {
    q = query(membershipsRef, where('status', '==', filters.status), orderBy('createdAt', 'desc'));
  }

  if (filters.customerId) {
    q = query(membershipsRef, where('customerId', '==', filters.customerId));
  }

  const snapshot = await getDocs(q);
  let memberships = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Apply additional filters in memory
  if (filters.expiringWithinDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + filters.expiringWithinDays);
    memberships = memberships.filter(m => {
      const endDate = m.endDate?.toDate ? m.endDate.toDate() : new Date(m.endDate);
      return m.status === 'active' && endDate <= cutoffDate;
    });
  }

  return memberships;
};

/**
 * Get active membership for a specific customer
 */
export const getMembershipForCustomer = async (contractorId, customerId) => {
  const membershipsRef = collection(db, getContractorPath(contractorId), 'memberships');

  const q = query(
    membershipsRef,
    where('customerId', '==', customerId),
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  // Return the most recent active membership
  const memberships = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return memberships.sort((a, b) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
    return dateB - dateA;
  })[0];
};

/**
 * Cancel a membership
 */
export const cancelMembership = async (contractorId, membershipId, reason = '') => {
  const membershipRef = doc(db, getContractorPath(contractorId), 'memberships', membershipId);
  const membershipSnap = await getDoc(membershipRef);

  if (!membershipSnap.exists()) {
    throw new Error('Membership not found');
  }

  const membership = membershipSnap.data();

  await updateDoc(membershipRef, {
    status: 'cancelled',
    autoRenew: false,
    cancelledAt: Timestamp.now(),
    cancellationReason: reason
  });

  // Update plan member count
  const planRef = doc(db, getContractorPath(contractorId), 'membershipPlans', membership.planId);
  const planSnap = await getDoc(planRef);
  if (planSnap.exists()) {
    await updateDoc(planRef, {
      memberCount: Math.max(0, (planSnap.data().memberCount || 1) - 1),
      updatedAt: Timestamp.now()
    });
  }

  return { id: membershipId, status: 'cancelled' };
};

/**
 * Renew a membership
 */
export const renewMembership = async (contractorId, membershipId) => {
  const membershipRef = doc(db, getContractorPath(contractorId), 'memberships', membershipId);
  const membershipSnap = await getDoc(membershipRef);

  if (!membershipSnap.exists()) {
    throw new Error('Membership not found');
  }

  const membership = membershipSnap.data();
  const plan = await getPlan(contractorId, membership.planId);

  // Calculate new dates
  const newStartDate = Timestamp.now();
  const newEndDate = calculateEndDate(newStartDate, membership.billingCycle);
  const newRenewalDate = calculateRenewalDate(newEndDate, plan.renewalReminderDays || 30);

  // Reset service usage for the new period
  const servicesUsed = (membership.servicesUsed || []).map(service => ({
    ...service,
    usedCount: 0,
    lastUsedDate: null,
    jobIds: []
  }));

  await updateDoc(membershipRef, {
    status: 'active',
    startDate: newStartDate,
    endDate: newEndDate,
    renewalDate: newRenewalDate,
    servicesUsed,
    renewedAt: Timestamp.now()
  });

  return { id: membershipId, status: 'active', endDate: newEndDate };
};

/**
 * Update membership (for general updates)
 */
export const updateMembership = async (contractorId, membershipId, updates) => {
  const membershipRef = doc(db, getContractorPath(contractorId), 'memberships', membershipId);

  await updateDoc(membershipRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });

  return { id: membershipId, ...updates };
};

// ===========================================
// BENEFIT APPLICATION
// ===========================================

/**
 * Apply membership discount to a job/quote
 */
export const applyMembershipDiscount = async (contractorId, membershipId, jobId, originalTotal) => {
  const membershipRef = doc(db, getContractorPath(contractorId), 'memberships', membershipId);
  const membershipSnap = await getDoc(membershipRef);

  if (!membershipSnap.exists()) {
    throw new Error('Membership not found');
  }

  const membership = membershipSnap.data();

  if (membership.status !== 'active') {
    throw new Error('Membership is not active');
  }

  const discountPercent = membership.benefits?.discountPercent || 0;
  const discountAmount = (originalTotal * discountPercent) / 100;

  // Record the discount
  const discountRecord = {
    jobId,
    originalTotal,
    discountPercent,
    discountAmount,
    date: Timestamp.now()
  };

  const discountsApplied = [...(membership.discountsApplied || []), discountRecord];
  const totalSavings = (membership.totalSavings || 0) + discountAmount;

  await updateDoc(membershipRef, {
    discountsApplied,
    totalSavings
  });

  return {
    discountPercent,
    discountAmount,
    newTotal: originalTotal - discountAmount,
    totalSavings
  };
};

/**
 * Waive a fee (diagnostic fee, trip fee, etc.)
 */
export const waiveFee = async (contractorId, membershipId, jobId, feeType, feeAmount) => {
  const membershipRef = doc(db, getContractorPath(contractorId), 'memberships', membershipId);
  const membershipSnap = await getDoc(membershipRef);

  if (!membershipSnap.exists()) {
    throw new Error('Membership not found');
  }

  const membership = membershipSnap.data();

  // Record the waived fee
  const waivedRecord = {
    jobId,
    feeType,
    feeAmount,
    date: Timestamp.now()
  };

  const feesWaived = [...(membership.feesWaived || []), waivedRecord];
  const totalSavings = (membership.totalSavings || 0) + feeAmount;

  await updateDoc(membershipRef, {
    feesWaived,
    totalSavings
  });

  return { feeType, feeAmount, totalSavings };
};

/**
 * Record usage of an included service
 */
export const recordServiceUsage = async (contractorId, membershipId, serviceType, jobId) => {
  const membershipRef = doc(db, getContractorPath(contractorId), 'memberships', membershipId);
  const membershipSnap = await getDoc(membershipRef);

  if (!membershipSnap.exists()) {
    throw new Error('Membership not found');
  }

  const membership = membershipSnap.data();
  const servicesUsed = [...(membership.servicesUsed || [])];

  const serviceIndex = servicesUsed.findIndex(s => s.serviceType === serviceType);

  if (serviceIndex === -1) {
    throw new Error('Service type not found in membership');
  }

  const service = servicesUsed[serviceIndex];

  // Check if there are remaining uses
  if (service.usedCount >= service.includedCount) {
    return {
      success: false,
      message: 'All included services have been used',
      usedCount: service.usedCount,
      includedCount: service.includedCount
    };
  }

  // Record usage
  servicesUsed[serviceIndex] = {
    ...service,
    usedCount: service.usedCount + 1,
    lastUsedDate: Timestamp.now(),
    jobIds: [...(service.jobIds || []), jobId]
  };

  await updateDoc(membershipRef, { servicesUsed });

  return {
    success: true,
    usedCount: servicesUsed[serviceIndex].usedCount,
    includedCount: service.includedCount,
    remainingCount: service.includedCount - servicesUsed[serviceIndex].usedCount
  };
};

/**
 * Check if a service is included and has remaining uses
 */
export const checkServiceAvailability = (membership, serviceType) => {
  if (!membership || membership.status !== 'active') {
    return { available: false, reason: 'No active membership' };
  }

  const service = (membership.servicesUsed || []).find(s => s.serviceType === serviceType);

  if (!service) {
    return { available: false, reason: 'Service not included in plan' };
  }

  const remaining = service.includedCount - service.usedCount;

  return {
    available: remaining > 0,
    usedCount: service.usedCount,
    includedCount: service.includedCount,
    remainingCount: remaining,
    reason: remaining > 0 ? 'Service available' : 'All included services used'
  };
};

/**
 * Calculate membership benefits for a quote/job
 */
export const calculateMembershipBenefits = (membership, quote) => {
  if (!membership || membership.status !== 'active') {
    return null;
  }

  const benefits = membership.benefits || {};
  const result = {
    membershipId: membership.id,
    planName: membership.planName,
    planColor: membership.planColor,
    discounts: [],
    waived: [],
    includedServices: [],
    totalDiscount: 0,
    priorityScheduling: benefits.priorityScheduling || false,
    emergencyResponse: benefits.emergencyResponse || null
  };

  // Calculate percentage discount
  if (benefits.discountPercent && quote.subtotal) {
    const discountAmount = (quote.subtotal * benefits.discountPercent) / 100;
    result.discounts.push({
      type: 'percentage',
      description: `Member Discount (${benefits.discountPercent}%)`,
      amount: discountAmount
    });
    result.totalDiscount += discountAmount;
  }

  // Check for waived fees
  if (benefits.waiveDiagnosticFee && quote.diagnosticFee) {
    result.waived.push({
      type: 'diagnostic',
      description: 'Diagnostic Fee Waived',
      amount: quote.diagnosticFee
    });
    result.totalDiscount += quote.diagnosticFee;
  }

  if (benefits.waiveTripFee && quote.tripFee) {
    result.waived.push({
      type: 'trip',
      description: 'Trip Fee Waived',
      amount: quote.tripFee
    });
    result.totalDiscount += quote.tripFee;
  }

  // Check for included services
  if (quote.serviceType) {
    const serviceAvailability = checkServiceAvailability(membership, quote.serviceType);
    if (serviceAvailability.available) {
      result.includedServices.push({
        serviceType: quote.serviceType,
        description: 'Included Service',
        remainingCount: serviceAvailability.remainingCount
      });
    }
  }

  return result;
};

// ===========================================
// QUERIES & ANALYTICS
// ===========================================

/**
 * Get memberships expiring within a certain number of days
 */
export const getExpiringMemberships = async (contractorId, withinDays = 30) => {
  const memberships = await getMemberships(contractorId, { status: 'active' });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + withinDays);

  return memberships.filter(m => {
    const endDate = m.endDate?.toDate ? m.endDate.toDate() : new Date(m.endDate);
    return endDate <= cutoffDate && endDate >= new Date();
  }).sort((a, b) => {
    const dateA = a.endDate?.toDate ? a.endDate.toDate() : new Date(a.endDate);
    const dateB = b.endDate?.toDate ? b.endDate.toDate() : new Date(b.endDate);
    return dateA - dateB;
  });
};

/**
 * Get membership statistics for a contractor
 */
export const getMembershipStats = async (contractorId) => {
  const memberships = await getMemberships(contractorId);
  const plans = await getPlans(contractorId, true);

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const stats = {
    totalMembers: 0,
    activeMembers: 0,
    expiredMembers: 0,
    cancelledMembers: 0,
    expiringWithin30Days: 0,

    // Revenue
    totalRevenue: 0,
    monthlyRecurringRevenue: 0,
    annualRecurringRevenue: 0,

    // Savings
    totalSavingsProvided: 0,
    averageSavingsPerMember: 0,

    // Plans
    planStats: {},
    mostPopularPlan: null,

    // Retention
    renewalCount: 0,
    cancellationCount: 0,
    renewalRate: 0
  };

  // Initialize plan stats
  plans.forEach(plan => {
    stats.planStats[plan.id] = {
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      billingCycle: plan.billingCycle,
      activeMembers: 0,
      totalMembers: 0,
      revenue: 0
    };
  });

  // Calculate stats
  memberships.forEach(m => {
    stats.totalMembers++;
    stats.totalSavingsProvided += m.totalSavings || 0;

    // Update plan stats
    if (stats.planStats[m.planId]) {
      stats.planStats[m.planId].totalMembers++;
      stats.planStats[m.planId].revenue += m.price || 0;
    }

    if (m.status === 'active') {
      stats.activeMembers++;
      stats.totalRevenue += m.price || 0;

      if (stats.planStats[m.planId]) {
        stats.planStats[m.planId].activeMembers++;
      }

      // Calculate recurring revenue
      if (m.billingCycle === 'monthly') {
        stats.monthlyRecurringRevenue += m.price || 0;
        stats.annualRecurringRevenue += (m.price || 0) * 12;
      } else if (m.billingCycle === 'annual') {
        stats.monthlyRecurringRevenue += (m.price || 0) / 12;
        stats.annualRecurringRevenue += m.price || 0;
      }

      // Check if expiring soon
      const endDate = m.endDate?.toDate ? m.endDate.toDate() : new Date(m.endDate);
      if (endDate <= thirtyDaysFromNow && endDate >= now) {
        stats.expiringWithin30Days++;
      }
    } else if (m.status === 'expired') {
      stats.expiredMembers++;
    } else if (m.status === 'cancelled') {
      stats.cancelledMembers++;
      stats.cancellationCount++;
    }

    if (m.renewedAt) {
      stats.renewalCount++;
    }
  });

  // Calculate averages and rates
  if (stats.activeMembers > 0) {
    stats.averageSavingsPerMember = stats.totalSavingsProvided / stats.activeMembers;
  }

  const completedMemberships = stats.expiredMembers + stats.cancelledMembers + stats.renewalCount;
  if (completedMemberships > 0) {
    stats.renewalRate = (stats.renewalCount / completedMemberships) * 100;
  }

  // Find most popular plan
  const planStatsList = Object.values(stats.planStats);
  if (planStatsList.length > 0) {
    stats.mostPopularPlan = planStatsList.reduce((max, plan) =>
      plan.activeMembers > max.activeMembers ? plan : max
    , planStatsList[0]);
  }

  return stats;
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Calculate end date based on billing cycle
 */
function calculateEndDate(startDate, billingCycle) {
  const start = startDate?.toDate ? startDate.toDate() : new Date(startDate);
  const end = new Date(start);

  switch (billingCycle) {
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      break;
    case 'annual':
      end.setFullYear(end.getFullYear() + 1);
      break;
    case 'quarterly':
      end.setMonth(end.getMonth() + 3);
      break;
    case 'one-time':
      end.setFullYear(end.getFullYear() + 1); // Default to 1 year for one-time
      break;
    default:
      end.setFullYear(end.getFullYear() + 1);
  }

  return Timestamp.fromDate(end);
}

/**
 * Calculate renewal reminder date
 */
function calculateRenewalDate(endDate, reminderDays) {
  const end = endDate?.toDate ? endDate.toDate() : new Date(endDate);
  const renewal = new Date(end);
  renewal.setDate(renewal.getDate() - reminderDays);
  return Timestamp.fromDate(renewal);
}

/**
 * Format currency
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

/**
 * Format date
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Get status badge info
 */
export const getStatusBadgeInfo = (status) => {
  const badges = {
    active: { label: 'Active', className: 'bg-green-100 text-green-700' },
    expired: { label: 'Expired', className: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-700' },
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' }
  };
  return badges[status] || badges.pending;
};

/**
 * Get days until expiration
 */
export const getDaysUntilExpiration = (endDate) => {
  if (!endDate) return null;
  const end = endDate?.toDate ? endDate.toDate() : new Date(endDate);
  const now = new Date();
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Check if membership is expiring soon
 */
export const isExpiringSoon = (endDate, withinDays = 30) => {
  const daysLeft = getDaysUntilExpiration(endDate);
  return daysLeft !== null && daysLeft >= 0 && daysLeft <= withinDays;
};
