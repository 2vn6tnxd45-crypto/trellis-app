/**
 * SellMembershipModal Component
 * Modal for selling a membership plan to a customer
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Check,
  CreditCard,
  Calendar,
  DollarSign,
  Loader2,
  AlertCircle,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/membershipService';

// Payment method options
const PAYMENT_METHODS = [
  {
    id: 'manual',
    name: 'Manual / Cash / Check',
    description: 'Record payment manually',
    icon: DollarSign
  },
  {
    id: 'stripe',
    name: 'Credit Card (Stripe)',
    description: 'Secure card payment',
    icon: CreditCard
  }
];

export const SellMembershipModal = ({
  isOpen,
  onClose,
  plans = [],
  customers = [],
  onSell,
  loading = false
}) => {
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('manual');
  const [autoRenew, setAutoRenew] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedPlan(null);
      setSelectedCustomer(null);
      setNewCustomer({ name: '', email: '', phone: '', address: '' });
      setIsNewCustomer(false);
      setCustomerSearch('');
      setPaymentMethod('manual');
      setAutoRenew(true);
      setStartDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setErrors({});
    }
  }, [isOpen]);

  // Filter customers based on search
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch.trim()) return true;
    const query = customerSearch.toLowerCase();
    return (
      c.name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.phone?.includes(query)
    );
  }).slice(0, 10);

  // Active plans only
  const activePlans = plans.filter(p => p.active);

  // Validate current step
  const validateStep = () => {
    const newErrors = {};

    if (step === 1 && !selectedPlan) {
      newErrors.plan = 'Please select a plan';
    }

    if (step === 2) {
      if (isNewCustomer) {
        if (!newCustomer.name.trim()) newErrors.name = 'Name is required';
        if (!newCustomer.email.trim()) newErrors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomer.email)) {
          newErrors.email = 'Invalid email address';
        }
      } else if (!selectedCustomer) {
        newErrors.customer = 'Please select a customer';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next step
  const handleNext = () => {
    if (!validateStep()) return;
    setStep(prev => prev + 1);
  };

  // Handle previous step
  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  // Handle sell
  const handleSell = async () => {
    if (!validateStep()) return;

    const customer = isNewCustomer
      ? {
          name: newCustomer.name,
          email: newCustomer.email,
          phone: newCustomer.phone || null,
          address: newCustomer.address || null,
          isNew: true
        }
      : selectedCustomer;

    const membershipData = {
      planId: selectedPlan.id,
      customerId: customer.id || null,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      propertyAddress: customer.address || customer.propertyAddress,
      startDate: new Date(startDate),
      autoRenew,
      paymentMethod,
      notes
    };

    await onSell(membershipData, customer);
  };

  // Calculate end date preview
  const getEndDatePreview = () => {
    if (!selectedPlan || !startDate) return null;
    const start = new Date(startDate);
    switch (selectedPlan.billingCycle) {
      case 'monthly': start.setMonth(start.getMonth() + 1); break;
      case 'quarterly': start.setMonth(start.getMonth() + 3); break;
      case 'annual': start.setFullYear(start.getFullYear() + 1); break;
      case 'one-time': start.setFullYear(start.getFullYear() + 1); break;
    }
    return start;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Shield className="text-green-600" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Sell Membership</h2>
              <p className="text-sm text-slate-500">Step {step} of 3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                  s < step ? 'bg-green-500 text-white' :
                  s === step ? 'bg-blue-600 text-white' :
                  'bg-slate-200 text-slate-500'
                }`}>
                  {s < step ? <Check size={16} /> : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 rounded-full ${
                    s < step ? 'bg-green-500' : 'bg-slate-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>Select Plan</span>
            <span>Customer Info</span>
            <span>Review & Confirm</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-220px)]">
          {/* Step 1: Select Plan */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Choose a Membership Plan
              </h3>

              {errors.plan && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                  <AlertCircle size={16} />
                  {errors.plan}
                </div>
              )}

              {activePlans.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-xl">
                  <Shield size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600">No active plans available.</p>
                  <p className="text-sm text-slate-500 mt-1">Create a plan first to start selling memberships.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {activePlans.map(plan => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        selectedPlan?.id === plan.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${plan.color}20` }}
                          >
                            <Shield size={24} style={{ color: plan.color }} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900">{plan.name}</h4>
                              {plan.featured && (
                                <span className="px-2 py-0.5 text-xs font-bold text-yellow-700 bg-yellow-100 rounded-full flex items-center gap-1">
                                  <Sparkles size={10} />
                                  Popular
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mt-0.5">{plan.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold" style={{ color: plan.color }}>
                            {formatCurrency(plan.price)}
                          </p>
                          <p className="text-xs text-slate-500">
                            per {plan.billingCycle === 'monthly' ? 'month' : plan.billingCycle === 'annual' ? 'year' : plan.billingCycle}
                          </p>
                        </div>
                      </div>

                      {/* Plan highlights */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {plan.includedServices?.slice(0, 3).map((service, i) => (
                          <span key={i} className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg">
                            {service.quantity}x {service.description}
                          </span>
                        ))}
                        {plan.benefits?.discountPercent > 0 && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-lg">
                            {plan.benefits.discountPercent}% discount
                          </span>
                        )}
                        {plan.benefits?.priorityScheduling && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg">
                            Priority scheduling
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Customer Info */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Customer Information
              </h3>

              {/* Toggle */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsNewCustomer(false)}
                  className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                    !isNewCustomer
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <User className="mx-auto mb-1" size={20} />
                  <span className="text-sm font-medium">Existing Customer</span>
                </button>
                <button
                  onClick={() => setIsNewCustomer(true)}
                  className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                    isNewCustomer
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <User className="mx-auto mb-1" size={20} />
                  <span className="text-sm font-medium">New Customer</span>
                </button>
              </div>

              {errors.customer && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                  <AlertCircle size={16} />
                  {errors.customer}
                </div>
              )}

              {!isNewCustomer ? (
                /* Existing Customer */
                <div className="space-y-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search by name, email, or phone..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredCustomers.length === 0 ? (
                      <p className="p-4 text-center text-slate-500 text-sm">
                        No customers found. Try a different search or add a new customer.
                      </p>
                    ) : (
                      filteredCustomers.map(customer => (
                        <button
                          key={customer.id}
                          onClick={() => setSelectedCustomer(customer)}
                          className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                            selectedCustomer?.id === customer.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                              {customer.name?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 truncate">{customer.name}</p>
                              <p className="text-sm text-slate-500 truncate">{customer.email}</p>
                            </div>
                            {selectedCustomer?.id === customer.id && (
                              <Check className="text-blue-600" size={20} />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* New Customer Form */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="John Smith"
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${
                          errors.name ? 'border-red-300' : 'border-slate-200'
                        } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                      />
                    </div>
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="email"
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@example.com"
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${
                          errors.email ? 'border-red-300' : 'border-slate-200'
                        } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                      />
                    </div>
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="tel"
                        value={newCustomer.phone}
                        onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(555) 123-4567"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Property Address
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={newCustomer.address}
                        onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="123 Main St, City, State 12345"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Plan Summary */}
              <div className="p-4 rounded-xl border-2" style={{ borderColor: selectedPlan?.color }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Shield size={24} style={{ color: selectedPlan?.color }} />
                    <div>
                      <h4 className="font-bold text-slate-900">{selectedPlan?.name}</h4>
                      <p className="text-sm text-slate-500">{selectedPlan?.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: selectedPlan?.color }}>
                      {formatCurrency(selectedPlan?.price)}
                    </p>
                    <p className="text-xs text-slate-500">
                      per {selectedPlan?.billingCycle === 'monthly' ? 'month' : 'year'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Summary */}
              <div className="p-4 bg-slate-50 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Customer</h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                    {(isNewCustomer ? newCustomer.name : selectedCustomer?.name)?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">
                      {isNewCustomer ? newCustomer.name : selectedCustomer?.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {isNewCustomer ? newCustomer.email : selectedCustomer?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {getEndDatePreview() && (
                  <p className="mt-1 text-sm text-slate-500">
                    Membership ends: {formatDate(getEndDatePreview())}
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map(method => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          paymentMethod === method.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon size={20} className={paymentMethod === method.id ? 'text-blue-600' : 'text-slate-400'} />
                        <p className="font-medium text-slate-900 mt-1">{method.name}</p>
                        <p className="text-xs text-slate-500">{method.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto Renew */}
              <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                <div>
                  <p className="font-medium text-slate-900">Auto-renew membership</p>
                  <p className="text-sm text-slate-500">
                    Automatically renew when the membership expires
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
              </label>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this membership..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>

            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={step === 1 && !selectedPlan}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSell}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Complete Sale - {formatCurrency(selectedPlan?.price)}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellMembershipModal;
