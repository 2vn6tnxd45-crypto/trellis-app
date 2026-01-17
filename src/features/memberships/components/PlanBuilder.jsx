/**
 * PlanBuilder Component
 * UI for creating and editing membership plans
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Eye,
  X,
  Check,
  Shield,
  Clock,
  Percent,
  Zap,
  ArrowRight,
  Star,
  Sparkles
} from 'lucide-react';

// Default plan template
const getDefaultPlan = () => ({
  name: '',
  description: '',
  price: 299,
  billingCycle: 'annual',
  includedServices: [],
  benefits: {
    discountPercent: 15,
    priorityScheduling: true,
    waiveDiagnosticFee: true,
    waiveTripFee: false,
    emergencyResponse: null,
    transferable: false
  },
  featured: false,
  color: '#10b981',
  badgeText: '',
  active: true,
  autoRenew: true,
  renewalReminderDays: 30
});

// Service type options
const SERVICE_TYPES = [
  { value: 'hvac-tuneup', label: 'HVAC Tune-up' },
  { value: 'hvac-inspection', label: 'HVAC Inspection' },
  { value: 'furnace-cleaning', label: 'Furnace Cleaning' },
  { value: 'ac-cleaning', label: 'AC Cleaning' },
  { value: 'filter-replacement', label: 'Filter Replacement' },
  { value: 'plumbing-inspection', label: 'Plumbing Inspection' },
  { value: 'drain-cleaning', label: 'Drain Cleaning' },
  { value: 'water-heater-flush', label: 'Water Heater Flush' },
  { value: 'electrical-inspection', label: 'Electrical Inspection' },
  { value: 'appliance-tuneup', label: 'Appliance Tune-up' },
  { value: 'general-maintenance', label: 'General Maintenance' },
  { value: 'custom', label: 'Custom Service' }
];

// Color options
const COLOR_OPTIONS = [
  { value: '#10b981', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#f59e0b', label: 'Gold' },
  { value: '#ef4444', label: 'Red' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#14b8a6', label: 'Teal' }
];

// Emergency response options
const EMERGENCY_OPTIONS = [
  { value: null, label: 'None' },
  { value: 'same-day', label: 'Same-day' },
  { value: '24hr', label: '24-hour' },
  { value: '4hr', label: '4-hour' },
  { value: '2hr', label: '2-hour' }
];

export const PlanBuilder = ({
  plan: existingPlan,
  onSave,
  onCancel,
  loading = false
}) => {
  const [plan, setPlan] = useState(getDefaultPlan());
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState({});
  const [newService, setNewService] = useState({ serviceType: '', quantity: 1, description: '' });

  // Initialize with existing plan data if editing
  useEffect(() => {
    if (existingPlan) {
      setPlan({
        ...getDefaultPlan(),
        ...existingPlan,
        benefits: {
          ...getDefaultPlan().benefits,
          ...existingPlan.benefits
        }
      });
    }
  }, [existingPlan]);

  // Update plan field
  const updateField = (field, value) => {
    setPlan(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Update benefit field
  const updateBenefit = (field, value) => {
    setPlan(prev => ({
      ...prev,
      benefits: { ...prev.benefits, [field]: value }
    }));
  };

  // Add included service
  const addService = () => {
    if (!newService.serviceType) return;

    const serviceLabel = SERVICE_TYPES.find(s => s.value === newService.serviceType)?.label || newService.serviceType;

    setPlan(prev => ({
      ...prev,
      includedServices: [
        ...prev.includedServices,
        {
          serviceType: newService.serviceType,
          quantity: newService.quantity || 1,
          description: newService.description || serviceLabel
        }
      ]
    }));

    setNewService({ serviceType: '', quantity: 1, description: '' });
  };

  // Remove included service
  const removeService = (index) => {
    setPlan(prev => ({
      ...prev,
      includedServices: prev.includedServices.filter((_, i) => i !== index)
    }));
  };

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (!plan.name.trim()) {
      newErrors.name = 'Plan name is required';
    }

    if (!plan.price || plan.price <= 0) {
      newErrors.price = 'Price must be greater than 0';
    }

    if (!plan.billingCycle) {
      newErrors.billingCycle = 'Billing cycle is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validate()) return;
    onSave(plan);
  };

  // Format price display
  const formatPrice = (price, cycle) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(price);

    const suffix = cycle === 'monthly' ? '/mo' : cycle === 'annual' ? '/yr' : '';
    return `${formatted}${suffix}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {existingPlan ? 'Edit Plan' : 'Create Membership Plan'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Eye size={16} />
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Form */}
        <div className="flex-1 p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Basic Information
            </h3>

            {/* Plan Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Plan Name *
              </label>
              <input
                type="text"
                value={plan.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Gold HVAC Plan"
                className={`w-full px-4 py-2.5 rounded-xl border ${
                  errors.name ? 'border-red-300' : 'border-slate-200'
                } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={plan.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Complete peace of mind for your HVAC system"
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
              />
            </div>

            {/* Price & Billing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Price *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={plan.price}
                    onChange={(e) => updateField('price', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="1"
                    className={`w-full pl-8 pr-4 py-2.5 rounded-xl border ${
                      errors.price ? 'border-red-300' : 'border-slate-200'
                    } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                  />
                </div>
                {errors.price && (
                  <p className="mt-1 text-sm text-red-600">{errors.price}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Billing Cycle *
                </label>
                <select
                  value={plan.billingCycle}
                  onChange={(e) => updateField('billingCycle', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="annual">Annual</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="one-time">One-time</option>
                </select>
              </div>
            </div>
          </div>

          {/* Included Services */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Included Services
            </h3>

            {/* Service List */}
            {plan.includedServices.length > 0 && (
              <div className="space-y-2">
                {plan.includedServices.map((service, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-sm font-bold text-slate-700 border border-slate-200">
                        {service.quantity}x
                      </span>
                      <span className="text-sm font-medium text-slate-700">
                        {service.description}
                      </span>
                    </div>
                    <button
                      onClick={() => removeService(index)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Service */}
            <div className="flex gap-2">
              <select
                value={newService.serviceType}
                onChange={(e) => setNewService(prev => ({ ...prev, serviceType: e.target.value }))}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Select service...</option>
                {SERVICE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <input
                type="number"
                value={newService.quantity}
                onChange={(e) => setNewService(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                min="1"
                className="w-20 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-center"
              />
              <button
                onClick={addService}
                disabled={!newService.serviceType}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Member Benefits
            </h3>

            {/* Discount Percent */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Discount on Repairs
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={plan.benefits.discountPercent || 0}
                  onChange={(e) => updateBenefit('discountPercent', parseInt(e.target.value) || 0)}
                  min="0"
                  max="100"
                  className="w-24 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <span className="text-slate-500">%</span>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Priority Scheduling</span>
                </div>
                <input
                  type="checkbox"
                  checked={plan.benefits.priorityScheduling}
                  onChange={(e) => updateBenefit('priorityScheduling', e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Percent size={18} className="text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Waive Diagnostic Fee</span>
                </div>
                <input
                  type="checkbox"
                  checked={plan.benefits.waiveDiagnosticFee}
                  onChange={(e) => updateBenefit('waiveDiagnosticFee', e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Percent size={18} className="text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Waive Trip Fee</span>
                </div>
                <input
                  type="checkbox"
                  checked={plan.benefits.waiveTripFee}
                  onChange={(e) => updateBenefit('waiveTripFee', e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <ArrowRight size={18} className="text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Transferable to New Owner</span>
                </div>
                <input
                  type="checkbox"
                  checked={plan.benefits.transferable}
                  onChange={(e) => updateBenefit('transferable', e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
              </label>
            </div>

            {/* Emergency Response */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Emergency Response Time
              </label>
              <select
                value={plan.benefits.emergencyResponse || ''}
                onChange={(e) => updateBenefit('emergencyResponse', e.target.value || null)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                {EMERGENCY_OPTIONS.map(opt => (
                  <option key={opt.value || 'none'} value={opt.value || ''}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Display Options */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Display Options
            </h3>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Card Color
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => updateField('color', color.value)}
                    className={`w-10 h-10 rounded-xl border-2 transition-all ${
                      plan.color === color.value
                        ? 'border-slate-900 scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {/* Badge & Featured */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Badge Text
                </label>
                <input
                  type="text"
                  value={plan.badgeText}
                  onChange={(e) => updateField('badgeText', e.target.value)}
                  placeholder="e.g., Most Popular"
                  maxLength={20}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plan.featured}
                    onChange={(e) => updateField('featured', e.target.checked)}
                    className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Featured Plan</span>
                </label>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Settings
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={plan.autoRenew}
                  onChange={(e) => updateField('autoRenew', e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Auto-renew by Default</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={plan.active}
                  onChange={(e) => updateField('active', e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Plan Active</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Renewal Reminder (days before expiration)
              </label>
              <input
                type="number"
                value={plan.renewalReminderDays}
                onChange={(e) => updateField('renewalReminderDays', parseInt(e.target.value) || 30)}
                min="1"
                max="90"
                className="w-24 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="w-full lg:w-96 p-6 bg-slate-50 border-l border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
              Card Preview
            </h3>
            <PlanPreviewCard plan={plan} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {loading ? 'Saving...' : existingPlan ? 'Update Plan' : 'Create Plan'}
        </button>
      </div>
    </div>
  );
};

/**
 * Plan Preview Card
 */
const PlanPreviewCard = ({ plan }) => {
  const formatPrice = (price, cycle) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(price);

    const suffix = cycle === 'monthly' ? '/mo' : cycle === 'annual' ? '/yr' : '';
    return { price: formatted, suffix };
  };

  const { price, suffix } = formatPrice(plan.price, plan.billingCycle);

  return (
    <div
      className="relative rounded-2xl border-2 overflow-hidden bg-white"
      style={{ borderColor: plan.color }}
    >
      {/* Badge */}
      {plan.badgeText && (
        <div
          className="absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white rounded-bl-xl"
          style={{ backgroundColor: plan.color }}
        >
          {plan.badgeText}
        </div>
      )}

      {/* Header */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          {plan.featured && (
            <Star size={18} className="text-yellow-500 fill-yellow-500" />
          )}
          <h3 className="text-lg font-bold text-slate-900">
            {plan.name || 'Plan Name'}
          </h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          {plan.description || 'Plan description'}
        </p>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold" style={{ color: plan.color }}>
            {price}
          </span>
          <span className="text-slate-500">{suffix}</span>
        </div>
      </div>

      {/* Services */}
      <div className="px-5 pb-4 border-t border-slate-100 pt-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">
          Included Services
        </h4>
        <ul className="space-y-2">
          {plan.includedServices.length > 0 ? (
            plan.includedServices.map((service, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-slate-700">
                <Check size={14} style={{ color: plan.color }} />
                {service.quantity}x {service.description}
              </li>
            ))
          ) : (
            <li className="text-sm text-slate-400 italic">No services added</li>
          )}
        </ul>
      </div>

      {/* Benefits */}
      <div className="px-5 pb-5 border-t border-slate-100 pt-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">
          Benefits
        </h4>
        <ul className="space-y-2">
          {plan.benefits.discountPercent > 0 && (
            <li className="flex items-center gap-2 text-sm text-slate-700">
              <Check size={14} style={{ color: plan.color }} />
              {plan.benefits.discountPercent}% discount on repairs
            </li>
          )}
          {plan.benefits.priorityScheduling && (
            <li className="flex items-center gap-2 text-sm text-slate-700">
              <Check size={14} style={{ color: plan.color }} />
              Priority scheduling
            </li>
          )}
          {plan.benefits.waiveDiagnosticFee && (
            <li className="flex items-center gap-2 text-sm text-slate-700">
              <Check size={14} style={{ color: plan.color }} />
              No diagnostic fee
            </li>
          )}
          {plan.benefits.waiveTripFee && (
            <li className="flex items-center gap-2 text-sm text-slate-700">
              <Check size={14} style={{ color: plan.color }} />
              No trip fee
            </li>
          )}
          {plan.benefits.emergencyResponse && (
            <li className="flex items-center gap-2 text-sm text-slate-700">
              <Check size={14} style={{ color: plan.color }} />
              {plan.benefits.emergencyResponse} emergency response
            </li>
          )}
          {plan.benefits.transferable && (
            <li className="flex items-center gap-2 text-sm text-slate-700">
              <Check size={14} style={{ color: plan.color }} />
              Transferable to new owner
            </li>
          )}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-5 pb-5">
        <button
          className="w-full py-3 text-sm font-bold text-white rounded-xl transition-opacity hover:opacity-90"
          style={{ backgroundColor: plan.color }}
        >
          Select Plan
        </button>
      </div>
    </div>
  );
};

export default PlanBuilder;
