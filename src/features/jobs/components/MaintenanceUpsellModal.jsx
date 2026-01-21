// src/features/jobs/components/MaintenanceUpsellModal.jsx
// ============================================
// POST-COMPLETION MAINTENANCE UPSELL MODAL
// ============================================
// Shown after job completion to offer recurring maintenance plans
// Based on equipment installed and service type

import React, { useState, useMemo } from 'react';
import {
    Calendar,
    Bell,
    Shield,
    CheckCircle,
    Clock,
    DollarSign,
    Package,
    Repeat,
    X,
    ChevronRight,
    Loader2,
    Sparkles,
    Star,
    Percent
} from 'lucide-react';

// ============================================
// MAINTENANCE PLAN TEMPLATES
// ============================================

const MAINTENANCE_PLANS = {
    'HVAC': {
        name: 'HVAC Maintenance Plan',
        description: 'Keep your system running efficiently year-round',
        visits: 2,
        interval: 'Twice yearly (Spring & Fall)',
        includes: [
            'Full system inspection',
            'Filter replacement',
            'Coil cleaning',
            'Refrigerant level check',
            'Thermostat calibration',
            'Safety inspection'
        ],
        benefits: [
            '10% off all repairs',
            'Priority scheduling',
            'No overtime charges',
            'Warranty protection'
        ],
        suggestedPrice: { low: 199, high: 299 },
        savings: 'Save up to $200/year on repairs'
    },
    'Plumbing': {
        name: 'Plumbing Protection Plan',
        description: 'Prevent costly plumbing emergencies',
        visits: 1,
        interval: 'Annual inspection',
        includes: [
            'Full system inspection',
            'Water heater flush',
            'Drain cleaning check',
            'Fixture inspection',
            'Water pressure test',
            'Leak detection'
        ],
        benefits: [
            '15% off repairs',
            'Priority emergency service',
            'No trip charges',
            'Parts warranty extension'
        ],
        suggestedPrice: { low: 149, high: 199 },
        savings: 'Prevent emergency calls averaging $500+'
    },
    'Electrical': {
        name: 'Electrical Safety Plan',
        description: 'Ensure your home stays safe and up to code',
        visits: 1,
        interval: 'Annual safety check',
        includes: [
            'Panel inspection',
            'Outlet/switch testing',
            'GFCI/AFCI testing',
            'Smoke detector check',
            'Surge protection review',
            'Code compliance check'
        ],
        benefits: [
            '10% off repairs',
            'Priority scheduling',
            'Free safety callbacks',
            'Documentation for insurance'
        ],
        suggestedPrice: { low: 129, high: 179 },
        savings: 'Early detection saves thousands'
    },
    'Appliances': {
        name: 'Appliance Care Plan',
        description: 'Extend the life of your major appliances',
        visits: 1,
        interval: 'Annual tune-up',
        includes: [
            'Full inspection',
            'Cleaning and maintenance',
            'Performance testing',
            'Component check',
            'Efficiency optimization'
        ],
        benefits: [
            '20% off repairs',
            'Extended parts warranty',
            'Priority scheduling',
            'No diagnostic fees'
        ],
        suggestedPrice: { low: 99, high: 149 },
        savings: 'Extend appliance life by 3-5 years'
    },
    'General': {
        name: 'Home Maintenance Plan',
        description: 'Comprehensive care for your home systems',
        visits: 2,
        interval: 'Twice yearly visits',
        includes: [
            'Multi-system inspection',
            'Preventive maintenance',
            'Safety checks',
            'Filter replacements',
            'Seasonal preparation'
        ],
        benefits: [
            '15% off all services',
            'Priority scheduling',
            'No emergency fees',
            'Annual home report'
        ],
        suggestedPrice: { low: 249, high: 349 },
        savings: 'Comprehensive protection for peace of mind'
    }
};

// ============================================
// MAIN COMPONENT
// ============================================

export const MaintenanceUpsellModal = ({
    isOpen,
    onClose,
    job, // Completed job data
    onAcceptPlan,
    onScheduleReminder,
    contractor
}) => {
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [customPrice, setCustomPrice] = useState('');
    const [enrolling, setEnrolling] = useState(false);

    // Determine appropriate plan based on job type
    const recommendedPlan = useMemo(() => {
        const title = (job?.title || job?.description || '').toLowerCase();
        const category = job?.serviceType || job?.category || '';

        if (title.includes('hvac') || title.includes('ac') || title.includes('air condition') || title.includes('furnace') || title.includes('heat')) {
            return 'HVAC';
        }
        if (title.includes('plumb') || title.includes('water heater') || title.includes('drain') || title.includes('pipe')) {
            return 'Plumbing';
        }
        if (title.includes('electric') || title.includes('panel') || title.includes('outlet') || title.includes('wiring')) {
            return 'Electrical';
        }
        if (title.includes('appliance') || title.includes('washer') || title.includes('dryer') || title.includes('refrigerator')) {
            return 'Appliances';
        }

        return 'General';
    }, [job]);

    const plan = MAINTENANCE_PLANS[selectedPlan || recommendedPlan];
    const otherPlans = Object.keys(MAINTENANCE_PLANS).filter(k => k !== recommendedPlan);

    // Handle plan enrollment
    const handleEnroll = async () => {
        if (!plan) return;

        setEnrolling(true);
        try {
            const planData = {
                planType: selectedPlan || recommendedPlan,
                planName: plan.name,
                price: parseFloat(customPrice) || plan.suggestedPrice.low,
                visits: plan.visits,
                interval: plan.interval,
                includes: plan.includes,
                benefits: plan.benefits,
                sourceJobId: job.id,
                customerId: job.customerId || job.customer?.id,
                customerEmail: job.customer?.email || job.customerEmail,
                customerName: job.customer?.name || job.customerName,
                propertyId: job.propertyId,
                enrolledAt: new Date().toISOString()
            };

            await onAcceptPlan?.(planData);
            onClose();
        } catch (error) {
            console.error('Error enrolling in plan:', error);
        } finally {
            setEnrolling(false);
        }
    };

    // Handle "remind me later"
    const handleRemindLater = async () => {
        await onScheduleReminder?.({
            jobId: job.id,
            customerId: job.customerId,
            customerEmail: job.customer?.email,
            reminderDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            planType: recommendedPlan
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-8">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={20} className="text-yellow-300" />
                        <span className="text-sm font-medium bg-white/20 px-2 py-0.5 rounded">
                            Recommended
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                    <p className="text-white/80">{plan.description}</p>

                    {/* Price badge */}
                    <div className="absolute bottom-0 right-6 translate-y-1/2">
                        <div className="bg-white rounded-xl shadow-lg px-4 py-2 text-center">
                            <p className="text-xs text-slate-500">Starting at</p>
                            <p className="text-2xl font-bold text-emerald-600">
                                ${plan.suggestedPrice.low}
                                <span className="text-sm font-normal text-slate-500">/year</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 pt-10">
                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="text-center p-3 bg-slate-50 rounded-xl">
                            <Calendar size={20} className="mx-auto text-emerald-600 mb-1" />
                            <p className="text-lg font-bold text-slate-800">{plan.visits}</p>
                            <p className="text-xs text-slate-500">Visit{plan.visits !== 1 ? 's' : ''}/Year</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-xl">
                            <Percent size={20} className="mx-auto text-emerald-600 mb-1" />
                            <p className="text-lg font-bold text-slate-800">10-20%</p>
                            <p className="text-xs text-slate-500">Off Repairs</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-xl">
                            <Shield size={20} className="mx-auto text-emerald-600 mb-1" />
                            <p className="text-lg font-bold text-slate-800">Priority</p>
                            <p className="text-xs text-slate-500">Service</p>
                        </div>
                    </div>

                    {/* What's included */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <Package size={16} className="text-emerald-600" />
                            What's Included
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {plan.includes.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                    <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                                    <span className="text-slate-600">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Benefits */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <Star size={16} className="text-amber-500" />
                            Member Benefits
                        </h3>
                        <div className="space-y-2">
                            {plan.benefits.map((benefit, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg text-sm">
                                    <Star size={12} className="text-amber-500 shrink-0" />
                                    <span className="text-amber-800">{benefit}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Savings callout */}
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                                <DollarSign size={20} className="text-emerald-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-emerald-800">Potential Savings</p>
                                <p className="text-sm text-emerald-600">{plan.savings}</p>
                            </div>
                        </div>
                    </div>

                    {/* Custom pricing (for contractor) */}
                    {contractor && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Custom Annual Price (optional)
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400">$</span>
                                <input
                                    type="number"
                                    value={customPrice}
                                    onChange={(e) => setCustomPrice(e.target.value)}
                                    placeholder={`${plan.suggestedPrice.low} - ${plan.suggestedPrice.high}`}
                                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                                />
                                <span className="text-slate-400">/year</span>
                            </div>
                        </div>
                    )}

                    {/* Other plan options */}
                    {otherPlans.length > 0 && (
                        <div className="mb-4">
                            <p className="text-sm text-slate-500 mb-2">Other plans available:</p>
                            <div className="flex flex-wrap gap-2">
                                {otherPlans.map(planKey => (
                                    <button
                                        key={planKey}
                                        onClick={() => setSelectedPlan(planKey)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                            selectedPlan === planKey
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {MAINTENANCE_PLANS[planKey].name.replace(' Plan', '')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
                    <button
                        onClick={handleEnroll}
                        disabled={enrolling}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors mb-3"
                    >
                        {enrolling ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Enrolling...
                            </>
                        ) : (
                            <>
                                <Repeat size={18} />
                                Enroll in Plan
                                <ChevronRight size={18} />
                            </>
                        )}
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={handleRemindLater}
                            className="flex-1 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Bell size={14} className="inline mr-1" />
                            Remind Me Later
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                        >
                            No Thanks
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaintenanceUpsellModal;
