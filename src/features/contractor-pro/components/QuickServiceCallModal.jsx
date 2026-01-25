// src/features/contractor-pro/components/QuickServiceCallModal.jsx
// ============================================
// QUICK SERVICE CALL MODAL
// ============================================
// Streamlined one-screen job creation for phone calls
// Target: Complete flow in under 60 seconds

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    X, Phone, User, MapPin, Clock, Calendar,
    DollarSign, Users, Search, Plus, Check,
    Loader2, Send, ChevronDown, AlertCircle,
    Zap, Droplet, Flame, Wind, Wrench, Package
} from 'lucide-react';
import { createJobDirect, linkJobToHomeowner } from '../../jobs/lib/jobService';
import { sendSMS } from '../../../lib/twilioService';
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';
import toast from 'react-hot-toast';

// ============================================
// CONSTANTS
// ============================================

const TRADE_CATEGORIES = {
    'HVAC': { icon: Wind, color: 'blue', issues: ['AC not cooling', 'Heating not working', 'Strange noises', 'Thermostat issues', 'Air quality concerns'] },
    'Plumbing': { icon: Droplet, color: 'cyan', issues: ['Leaking pipe', 'Clogged drain', 'Water heater issue', 'No hot water', 'Running toilet'] },
    'Electrical': { icon: Zap, color: 'amber', issues: ['Outlet not working', 'Breaker tripping', 'Light fixture issue', 'Electrical panel', 'Power outage'] },
    'Appliances': { icon: Package, color: 'purple', issues: ['Refrigerator repair', 'Washer/dryer issue', 'Dishwasher repair', 'Oven/stove repair', 'Garbage disposal'] },
    'General': { icon: Wrench, color: 'slate', issues: ['General repair', 'Maintenance check', 'Inspection', 'Other service'] }
};

const TIME_SLOTS = [
    { label: '8:00 AM', value: '08:00' },
    { label: '9:00 AM', value: '09:00' },
    { label: '10:00 AM', value: '10:00' },
    { label: '11:00 AM', value: '11:00' },
    { label: '12:00 PM', value: '12:00' },
    { label: '1:00 PM', value: '13:00' },
    { label: '2:00 PM', value: '14:00' },
    { label: '3:00 PM', value: '15:00' },
    { label: '4:00 PM', value: '16:00' },
    { label: '5:00 PM', value: '17:00' }
];

const DIAGNOSTIC_FEE_PRESETS = [49, 79, 99, 129];

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatPhoneNumber = (value) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const toE164 = (phone) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return null;
};

const getDateLabel = (dateStr) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const date = new Date(dateStr);
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (dateStr === todayStr) return 'Today';
    if (dateStr === tomorrowStr) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// ============================================
// CUSTOMER SEARCH COMPONENT
// ============================================

const CustomerSearch = ({
    customers = [],
    value,
    onChange,
    onSelectCustomer,
    showQuickAdd,
    onToggleQuickAdd
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef(null);

    const filteredCustomers = useMemo(() => {
        if (!searchTerm.trim()) return customers.slice(0, 10);
        const term = searchTerm.toLowerCase();
        return customers.filter(c =>
            c.name?.toLowerCase().includes(term) ||
            c.phone?.includes(term) ||
            c.email?.toLowerCase().includes(term) ||
            c.address?.toLowerCase().includes(term)
        ).slice(0, 10);
    }, [customers, searchTerm]);

    const handleSelect = (customer) => {
        onSelectCustomer(customer);
        setSearchTerm('');
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">
                <User size={14} className="inline mr-1" />
                Customer
            </label>

            {/* Search input */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={value?.name || searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                        if (value) onChange(null);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Search customers or add new..."
                    className="w-full pl-9 pr-20 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <button
                    type="button"
                    onClick={onToggleQuickAdd}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                        showQuickAdd
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    <Plus size={12} className="inline mr-0.5" />
                    New
                </button>
            </div>

            {/* Dropdown */}
            {isOpen && !showQuickAdd && filteredCustomers.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {filteredCustomers.map(customer => (
                        <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleSelect(customer)}
                            className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 flex items-center gap-3 border-b border-slate-100 last:border-0"
                        >
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                                <User size={14} className="text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{customer.name}</p>
                                <p className="text-xs text-slate-500 truncate">{customer.phone || customer.email}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Click away handler */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

// ============================================
// QUICK ADD CUSTOMER FORM
// ============================================

const QuickAddCustomerForm = ({ formData, onChange }) => {
    const mapsLoaded = useGoogleMaps();
    const addressInputRef = useRef(null);
    const autocompleteRef = useRef(null);

    // Initialize Google Places Autocomplete
    useEffect(() => {
        if (!mapsLoaded || !addressInputRef.current || autocompleteRef.current) return;

        try {
            autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
                types: ['address'],
                componentRestrictions: { country: 'us' }
            });

            autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current.getPlace();
                if (place.formatted_address) {
                    onChange({ ...formData, address: place.formatted_address });
                }
            });
        } catch (err) {
            console.warn('Autocomplete init error:', err);
        }

        return () => {
            if (autocompleteRef.current) {
                window.google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current);
            }
        };
    }, [mapsLoaded]);

    const handlePhoneChange = (e) => {
        const formatted = formatPhoneNumber(e.target.value);
        onChange({ ...formData, phone: formatted });
    };

    return (
        <div className="space-y-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                <Plus size={14} />
                Quick Add New Customer
            </div>
            <div className="grid grid-cols-2 gap-2">
                <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => onChange({ ...formData, name: e.target.value })}
                    placeholder="Customer name *"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={handlePhoneChange}
                    placeholder="Phone number *"
                    maxLength={14}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
            </div>
            <input
                ref={addressInputRef}
                type="text"
                value={formData.address || ''}
                onChange={(e) => onChange({ ...formData, address: e.target.value })}
                placeholder="Service address *"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            />
            <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => onChange({ ...formData, email: e.target.value })}
                placeholder="Email (optional)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            />
        </div>
    );
};

// ============================================
// ISSUE SELECTOR
// ============================================

const IssueSelector = ({ category, issue, onCategoryChange, onIssueChange, details, onDetailsChange }) => {
    const [showIssues, setShowIssues] = useState(false);

    const selectedCategory = TRADE_CATEGORIES[category];
    const CategoryIcon = selectedCategory?.icon || Wrench;

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
                <Wrench size={14} className="inline mr-1" />
                Service Needed
            </label>

            {/* Category buttons */}
            <div className="flex flex-wrap gap-2">
                {Object.entries(TRADE_CATEGORIES).map(([key, config]) => {
                    const Icon = config.icon;
                    const isSelected = category === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => {
                                onCategoryChange(key);
                                setShowIssues(true);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                isSelected
                                    ? `bg-${config.color}-100 text-${config.color}-700 ring-2 ring-${config.color}-300`
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <Icon size={14} />
                            {key}
                        </button>
                    );
                })}
            </div>

            {/* Issue dropdown */}
            {category && (
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowIssues(!showIssues)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-left flex items-center justify-between hover:border-slate-300"
                    >
                        <span className={issue ? 'text-slate-800' : 'text-slate-400'}>
                            {issue || 'Select issue type...'}
                        </span>
                        <ChevronDown size={16} className="text-slate-400" />
                    </button>

                    {showIssues && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowIssues(false)} />
                            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                                {selectedCategory?.issues.map((issueOption) => (
                                    <button
                                        key={issueOption}
                                        type="button"
                                        onClick={() => {
                                            onIssueChange(issueOption);
                                            setShowIssues(false);
                                        }}
                                        className={`w-full px-3 py-2.5 text-left hover:bg-emerald-50 text-sm ${
                                            issue === issueOption ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'
                                        }`}
                                    >
                                        {issueOption}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Additional details */}
            <textarea
                value={details}
                onChange={(e) => onDetailsChange(e.target.value)}
                placeholder="Additional details from call..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 resize-none"
            />
        </div>
    );
};

// ============================================
// DATE/TIME PICKER
// ============================================

const DateTimePicker = ({ date, time, onDateChange, onTimeChange }) => {
    const today = new Date();
    const dates = useMemo(() => {
        const result = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            result.push(d.toISOString().split('T')[0]);
        }
        return result;
    }, []);

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
                <Calendar size={14} className="inline mr-1" />
                When
            </label>

            {/* Date quick picks */}
            <div className="flex flex-wrap gap-2">
                {dates.slice(0, 5).map((dateStr) => (
                    <button
                        key={dateStr}
                        type="button"
                        onClick={() => onDateChange(dateStr)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                            date === dateStr
                                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        {getDateLabel(dateStr)}
                    </button>
                ))}
                <input
                    type="date"
                    value={date}
                    onChange={(e) => onDateChange(e.target.value)}
                    min={today.toISOString().split('T')[0]}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                />
            </div>

            {/* Time slots */}
            <div className="flex flex-wrap gap-1.5">
                {TIME_SLOTS.map((slot) => (
                    <button
                        key={slot.value}
                        type="button"
                        onClick={() => onTimeChange(slot.value)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            time === slot.value
                                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        {slot.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

// ============================================
// DIAGNOSTIC FEE INPUT
// ============================================

const DiagnosticFeeInput = ({ fee, waiveIfRepair, onFeeChange, onWaiveChange }) => {
    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
                <DollarSign size={14} className="inline mr-1" />
                Diagnostic Fee
            </label>

            <div className="flex items-center gap-2">
                {/* Preset buttons */}
                {DIAGNOSTIC_FEE_PRESETS.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        onClick={() => onFeeChange(preset)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                            fee === preset
                                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        ${preset}
                    </button>
                ))}

                {/* Custom input */}
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                        type="number"
                        value={fee}
                        onChange={(e) => onFeeChange(parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="Custom"
                    />
                </div>
            </div>

            {/* Waive if repair checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={waiveIfRepair}
                    onChange={(e) => onWaiveChange(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-600">Waive if customer approves repair</span>
            </label>
        </div>
    );
};

// ============================================
// TECH ASSIGNMENT
// ============================================

const TechAssignment = ({ teamMembers, selectedId, onSelect, contractorName }) => {
    if (!teamMembers?.length) return null;

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
                <Users size={14} className="inline mr-1" />
                Assign To
            </label>

            <div className="flex flex-wrap gap-2">
                {/* Self option */}
                <button
                    type="button"
                    onClick={() => onSelect(null)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        selectedId === null
                            ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        Me
                    </div>
                    {contractorName || 'Myself'}
                </button>

                {/* Team members */}
                {teamMembers.map((tech) => (
                    <button
                        key={tech.id}
                        type="button"
                        onClick={() => onSelect(tech.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                            selectedId === tech.id
                                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: tech.color || '#64748B' }}
                        >
                            {tech.name?.charAt(0)}
                        </div>
                        {tech.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const QuickServiceCallModal = ({
    isOpen,
    onClose,
    contractorId,
    contractorName,
    companyName,
    customers = [],
    teamMembers = [],
    onJobCreated
}) => {
    const [loading, setLoading] = useState(false);
    const [showQuickAdd, setShowQuickAdd] = useState(false);

    // Form state
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '', email: '' });
    const [category, setCategory] = useState('');
    const [issue, setIssue] = useState('');
    const [details, setDetails] = useState('');
    const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
    const [scheduledTime, setScheduledTime] = useState('09:00');
    const [diagnosticFee, setDiagnosticFee] = useState(79);
    const [waiveIfRepair, setWaiveIfRepair] = useState(true);
    const [assignedTechId, setAssignedTechId] = useState(null);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedCustomer(null);
            setNewCustomer({ name: '', phone: '', address: '', email: '' });
            setShowQuickAdd(false);
            setCategory('');
            setIssue('');
            setDetails('');
            setScheduledDate(new Date().toISOString().split('T')[0]);
            setScheduledTime('09:00');
            setDiagnosticFee(79);
            setWaiveIfRepair(true);
            setAssignedTechId(null);
        }
    }, [isOpen]);

    // Get customer data (either selected or new)
    const customerData = useMemo(() => {
        if (selectedCustomer) {
            return {
                name: selectedCustomer.name,
                phone: selectedCustomer.phone,
                email: selectedCustomer.email,
                address: selectedCustomer.address || selectedCustomer.propertyAddress
            };
        }
        return newCustomer;
    }, [selectedCustomer, newCustomer]);

    // Validation
    const isValid = useMemo(() => {
        const hasCustomer = customerData.name && customerData.phone && customerData.address;
        const hasService = category && issue;
        const hasSchedule = scheduledDate && scheduledTime;
        return hasCustomer && hasService && hasSchedule;
    }, [customerData, category, issue, scheduledDate, scheduledTime]);

    // Handle submit
    const handleSubmit = async () => {
        if (!isValid) return;

        setLoading(true);
        try {
            // Build job title
            const jobTitle = `${issue} - ${category}`;

            // Get assigned tech info
            const assignedTech = assignedTechId
                ? teamMembers.find(t => t.id === assignedTechId)
                : null;

            // Build full ISO datetime from date + time
            const [year, month, day] = scheduledDate.split('-').map(Number);
            const [hours, minutes] = scheduledTime.split(':').map(Number);
            const scheduledDateTime = new Date(year, month - 1, day, hours, minutes);
            const scheduledTimeISO = scheduledDateTime.toISOString();

            // Create job data
            const jobData = {
                title: jobTitle,
                description: details || `Service call: ${issue}`,
                category,
                customerName: customerData.name,
                customerPhone: customerData.phone,
                customerEmail: customerData.email || '',
                propertyAddress: customerData.address,
                scheduledDate: scheduledTimeISO,
                scheduledTime: scheduledTimeISO,
                estimatedDuration: 60, // Default 1 hour for diagnostic
                priority: 'normal',
                status: 'scheduled',
                assignedTechId: assignedTechId || contractorId,
                assignedTechName: assignedTech?.name || contractorName,
                assignedCrewIds: assignedTechId ? [assignedTechId] : [],
                // Pricing
                price: diagnosticFee,
                lineItems: [{
                    id: Date.now(),
                    type: 'service',
                    description: `Diagnostic / Service Call Fee${waiveIfRepair ? ' (waived if repair approved)' : ''}`,
                    quantity: 1,
                    unitPrice: diagnosticFee
                }],
                pricing: {
                    subtotal: diagnosticFee,
                    taxRate: 0,
                    taxAmount: 0,
                    total: diagnosticFee
                },
                // Metadata
                notes: waiveIfRepair ? 'Diagnostic fee waived if customer approves repair' : '',
                createdVia: 'quick_service_call'
            };

            // Create the job
            const result = await createJobDirect(contractorId, jobData);

            if (result.success) {
                // Try to link to homeowner if email provided
                if (customerData.email) {
                    try {
                        await linkJobToHomeowner(contractorId, result.jobId, customerData.email);
                    } catch (linkError) {
                        console.warn('Failed to link job to homeowner:', linkError);
                    }
                }

                // Send SMS confirmation
                const phoneE164 = toE164(customerData.phone);
                if (phoneE164) {
                    try {
                        const dateFormatted = new Date(scheduledDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                        });
                        const timeFormatted = new Date(`2000-01-01T${scheduledTime}`).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        });

                        const message = `Hi ${customerData.name.split(' ')[0]}! Your ${category} appointment has been scheduled for ${dateFormatted} at ${timeFormatted}. ${assignedTech?.name || contractorName} will be your technician. Reply CONFIRM to confirm. - ${companyName}`;

                        await sendSMS({
                            to: phoneE164,
                            message,
                            jobId: result.jobId,
                            contractorId,
                            type: 'booking_confirmation',
                            metadata: { jobNumber: result.jobNumber }
                        });

                        toast.success(`Job ${result.jobNumber} created! SMS sent to customer.`, {
                            duration: 4000,
                            icon: '📱'
                        });
                    } catch (smsError) {
                        console.warn('Failed to send SMS:', smsError);
                        toast.success(`Job ${result.jobNumber} created! (SMS failed to send)`);
                    }
                } else {
                    toast.success(`Job ${result.jobNumber} created successfully!`);
                }

                onJobCreated?.(result.job);
                onClose();
            } else {
                toast.error(result.error || 'Failed to create job');
            }
        } catch (error) {
            console.error('Error creating quick service call:', error);
            toast.error('Failed to create job: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-emerald-600 to-teal-600">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <Phone className="text-white" size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-white">Quick Service Call</h2>
                            <p className="text-xs text-emerald-100">Schedule in under 60 seconds</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Form - Single scrollable area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Customer Section */}
                    <CustomerSearch
                        customers={customers}
                        value={selectedCustomer}
                        onChange={setSelectedCustomer}
                        onSelectCustomer={(customer) => {
                            setSelectedCustomer(customer);
                            setShowQuickAdd(false);
                        }}
                        showQuickAdd={showQuickAdd}
                        onToggleQuickAdd={() => {
                            setShowQuickAdd(!showQuickAdd);
                            setSelectedCustomer(null);
                        }}
                    />

                    {/* Quick add form */}
                    {showQuickAdd && (
                        <QuickAddCustomerForm
                            formData={newCustomer}
                            onChange={setNewCustomer}
                        />
                    )}

                    {/* Selected customer display */}
                    {selectedCustomer && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <User size={18} className="text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800">{selectedCustomer.name}</p>
                                    <p className="text-xs text-slate-500 truncate">
                                        {selectedCustomer.phone} • {selectedCustomer.address || selectedCustomer.propertyAddress}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedCustomer(null)}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Issue Selector */}
                    <IssueSelector
                        category={category}
                        issue={issue}
                        onCategoryChange={setCategory}
                        onIssueChange={setIssue}
                        details={details}
                        onDetailsChange={setDetails}
                    />

                    {/* Date/Time Picker */}
                    <DateTimePicker
                        date={scheduledDate}
                        time={scheduledTime}
                        onDateChange={setScheduledDate}
                        onTimeChange={setScheduledTime}
                    />

                    {/* Diagnostic Fee */}
                    <DiagnosticFeeInput
                        fee={diagnosticFee}
                        waiveIfRepair={waiveIfRepair}
                        onFeeChange={setDiagnosticFee}
                        onWaiveChange={setWaiveIfRepair}
                    />

                    {/* Tech Assignment */}
                    <TechAssignment
                        teamMembers={teamMembers}
                        selectedId={assignedTechId}
                        onSelect={setAssignedTechId}
                        contractorName={contractorName}
                    />
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50">
                    {/* Validation message */}
                    {!isValid && (
                        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-sm">
                            <AlertCircle size={14} />
                            {!customerData.name || !customerData.phone || !customerData.address
                                ? 'Enter customer info'
                                : !category || !issue
                                ? 'Select service type'
                                : 'Select date and time'}
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !isValid}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Send size={18} />
                                Schedule & Send Confirmation
                            </>
                        )}
                    </button>

                    <p className="text-center text-xs text-slate-500 mt-2">
                        Customer will receive SMS confirmation
                    </p>
                </div>
            </div>
        </div>
    );
};

export default QuickServiceCallModal;
