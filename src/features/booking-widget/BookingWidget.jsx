// src/features/booking-widget/BookingWidget.jsx
// ============================================
// ONLINE BOOKING WIDGET COMPONENT
// ============================================
// Embeddable booking widget for contractor websites

import React, { useState, useEffect, useMemo } from 'react';
import './styles/widget.css';

// Widget Steps
const STEPS = {
    SERVICE: 'service',
    DATE: 'date',
    TIME: 'time',
    DETAILS: 'details',
    CONFIRM: 'confirm'
};

// Main BookingWidget Component
export const BookingWidget = ({
    contractorId,
    apiBaseUrl = '',
    primaryColor = '#10b981',
    embedded = false
}) => {
    // State
    const [step, setStep] = useState(STEPS.SERVICE);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Contractor data
    const [contractorInfo, setContractorInfo] = useState(null);

    // Availability data
    const [availability, setAvailability] = useState(null);

    // Booking selections
    const [selectedService, setSelectedService] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);

    // Customer form
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        description: '',
        referralSource: ''
    });

    // Booking confirmation
    const [bookingResult, setBookingResult] = useState(null);

    // Calendar state
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    // Load contractor info on mount
    useEffect(() => {
        loadContractorInfo();
    }, [contractorId]);

    // Load availability when date changes
    useEffect(() => {
        if (contractorInfo?.booking?.enabled) {
            loadAvailability();
        }
    }, [contractorInfo, calendarMonth]);

    // API call to get contractor info
    const loadContractorInfo = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${apiBaseUrl}/api/widget/contractor-info?contractorId=${contractorId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load booking information');
            }

            setContractorInfo(data);

            // Auto-select service if only one
            if (data.serviceTypes?.length === 1) {
                setSelectedService(data.serviceTypes[0]);
                setStep(STEPS.DATE);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // API call to get availability
    const loadAvailability = async () => {
        try {
            const startDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
            const endDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);

            const response = await fetch(
                `${apiBaseUrl}/api/widget/availability?contractorId=${contractorId}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`
            );
            const data = await response.json();

            if (response.ok) {
                setAvailability(data.slots);
            }
        } catch (err) {
            console.error('Failed to load availability:', err);
        }
    };

    // Submit booking
    const submitBooking = async () => {
        try {
            setSubmitting(true);
            setError(null);

            const response = await fetch(`${apiBaseUrl}/api/widget/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractorId,
                    serviceType: selectedService.id,
                    date: selectedDate,
                    time: selectedTime.start,
                    customerName: formData.name,
                    customerEmail: formData.email,
                    customerPhone: formData.phone || null,
                    serviceAddress: formData.address || null,
                    description: formData.description || null,
                    referralSource: formData.referralSource || null
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to complete booking');
            }

            setBookingResult(data.booking);
            setStep(STEPS.CONFIRM);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Form handlers
    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Navigation
    const goBack = () => {
        const steps = [STEPS.SERVICE, STEPS.DATE, STEPS.TIME, STEPS.DETAILS];
        const currentIndex = steps.indexOf(step);
        if (currentIndex > 0) {
            setStep(steps[currentIndex - 1]);
        }
    };

    const goNext = () => {
        const steps = [STEPS.SERVICE, STEPS.DATE, STEPS.TIME, STEPS.DETAILS];
        const currentIndex = steps.indexOf(step);
        if (currentIndex < steps.length - 1) {
            setStep(steps[currentIndex + 1]);
        }
    };

    // Validate form
    const isFormValid = useMemo(() => {
        const { name, email, phone, address } = formData;
        const requirePhone = contractorInfo?.booking?.requirePhone;
        const requireAddress = contractorInfo?.booking?.requireAddress;

        if (!name.trim() || !email.trim()) return false;
        if (requirePhone && !phone.trim()) return false;
        if (requireAddress && !address.trim()) return false;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;

        return true;
    }, [formData, contractorInfo]);

    // Theme colors
    const theme = {
        primary: primaryColor || contractorInfo?.customization?.primaryColor || '#10b981',
        primaryHover: adjustColor(primaryColor || '#10b981', -10),
        primaryLight: adjustColor(primaryColor || '#10b981', 40)
    };

    // Loading state
    if (loading) {
        return (
            <div className="krib-widget krib-loading">
                <div className="krib-spinner" style={{ borderTopColor: theme.primary }}></div>
                <p>Loading booking options...</p>
            </div>
        );
    }

    // Error state
    if (error && !contractorInfo) {
        return (
            <div className="krib-widget krib-error">
                <div className="krib-error-icon">!</div>
                <p>{error}</p>
                <button onClick={loadContractorInfo} style={{ backgroundColor: theme.primary }}>
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className={`krib-widget ${embedded ? 'krib-embedded' : ''}`}>
            {/* Header */}
            <div className="krib-header" style={{ backgroundColor: theme.primary }}>
                {contractorInfo?.logoUrl && (
                    <img src={contractorInfo.logoUrl} alt="" className="krib-logo" />
                )}
                <div className="krib-header-text">
                    <h2>{contractorInfo?.customization?.headerText || 'Schedule Service'}</h2>
                    <p>{contractorInfo?.companyName}</p>
                </div>
                {contractorInfo?.averageRating && (
                    <div className="krib-rating">
                        <span className="krib-star">★</span>
                        <span>{contractorInfo.averageRating}</span>
                        <span className="krib-review-count">({contractorInfo.reviewCount})</span>
                    </div>
                )}
            </div>

            {/* Progress */}
            {step !== STEPS.CONFIRM && (
                <div className="krib-progress">
                    <ProgressStep active={step === STEPS.SERVICE} completed={selectedService} label="Service" />
                    <ProgressStep active={step === STEPS.DATE} completed={selectedDate} label="Date" />
                    <ProgressStep active={step === STEPS.TIME} completed={selectedTime} label="Time" />
                    <ProgressStep active={step === STEPS.DETAILS} completed={false} label="Details" />
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="krib-alert krib-alert-error">
                    {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Content */}
            <div className="krib-content">
                {/* Step 1: Service Selection */}
                {step === STEPS.SERVICE && (
                    <ServiceStep
                        services={contractorInfo?.serviceTypes || []}
                        selected={selectedService}
                        onSelect={(service) => {
                            setSelectedService(service);
                            goNext();
                        }}
                        theme={theme}
                    />
                )}

                {/* Step 2: Date Selection */}
                {step === STEPS.DATE && (
                    <DateStep
                        availability={availability}
                        selected={selectedDate}
                        calendarMonth={calendarMonth}
                        maxAdvanceDays={contractorInfo?.booking?.maxAdvanceDays || 30}
                        onSelect={(date) => {
                            setSelectedDate(date);
                            setSelectedTime(null);
                            goNext();
                        }}
                        onMonthChange={setCalendarMonth}
                        theme={theme}
                    />
                )}

                {/* Step 3: Time Selection */}
                {step === STEPS.TIME && (
                    <TimeStep
                        availability={availability}
                        selectedDate={selectedDate}
                        selectedTime={selectedTime}
                        onSelect={(time) => {
                            setSelectedTime(time);
                            goNext();
                        }}
                        theme={theme}
                    />
                )}

                {/* Step 4: Customer Details */}
                {step === STEPS.DETAILS && (
                    <DetailsStep
                        formData={formData}
                        onChange={handleFormChange}
                        requirePhone={contractorInfo?.booking?.requirePhone}
                        requireAddress={contractorInfo?.booking?.requireAddress}
                        selectedService={selectedService}
                        selectedDate={selectedDate}
                        selectedTime={selectedTime}
                        onSubmit={submitBooking}
                        submitting={submitting}
                        isValid={isFormValid}
                        theme={theme}
                    />
                )}

                {/* Step 5: Confirmation */}
                {step === STEPS.CONFIRM && bookingResult && (
                    <ConfirmationStep
                        booking={bookingResult}
                        theme={theme}
                    />
                )}
            </div>

            {/* Footer navigation */}
            {step !== STEPS.SERVICE && step !== STEPS.CONFIRM && (
                <div className="krib-footer">
                    <button className="krib-btn krib-btn-secondary" onClick={goBack}>
                        ← Back
                    </button>
                </div>
            )}

            {/* Powered by */}
            <div className="krib-powered">
                Powered by <a href="https://mykrib.app" target="_blank" rel="noopener noreferrer">Krib</a>
            </div>
        </div>
    );
};

// Progress Step Component
const ProgressStep = ({ active, completed, label }) => (
    <div className={`krib-progress-step ${active ? 'active' : ''} ${completed ? 'completed' : ''}`}>
        <div className="krib-progress-dot"></div>
        <span>{label}</span>
    </div>
);

// Service Selection Step
const ServiceStep = ({ services, selected, onSelect, theme }) => (
    <div className="krib-step krib-step-service">
        <h3>What service do you need?</h3>
        <div className="krib-service-grid">
            {services.map((service) => (
                <button
                    key={service.id}
                    className={`krib-service-card ${selected?.id === service.id ? 'selected' : ''}`}
                    onClick={() => onSelect(service)}
                    style={selected?.id === service.id ? { borderColor: theme.primary, backgroundColor: theme.primaryLight } : {}}
                >
                    <span className="krib-service-name">{service.name}</span>
                    {service.duration && (
                        <span className="krib-service-duration">~{service.duration} min</span>
                    )}
                </button>
            ))}
        </div>
    </div>
);

// Date Selection Step
const DateStep = ({ availability, selected, calendarMonth, maxAdvanceDays, onSelect, onMonthChange, theme }) => {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays);

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const canGoPrev = new Date(year, month, 1) > today;
    const canGoNext = new Date(year, month + 1, 1) <= maxDate;

    const getDateAvailability = (day) => {
        if (!day) return null;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return availability?.[dateStr];
    };

    const isDateSelectable = (day) => {
        if (!day) return false;
        const date = new Date(year, month, day);
        if (date < today || date > maxDate) return false;
        const avail = getDateAvailability(day);
        return avail?.available;
    };

    return (
        <div className="krib-step krib-step-date">
            <h3>Select a date</h3>

            <div className="krib-calendar">
                <div className="krib-calendar-header">
                    <button
                        disabled={!canGoPrev}
                        onClick={() => onMonthChange(new Date(year, month - 1, 1))}
                    >
                        ←
                    </button>
                    <span>
                        {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        disabled={!canGoNext}
                        onClick={() => onMonthChange(new Date(year, month + 1, 1))}
                    >
                        →
                    </button>
                </div>

                <div className="krib-calendar-weekdays">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <span key={d}>{d}</span>
                    ))}
                </div>

                <div className="krib-calendar-days">
                    {days.map((day, i) => {
                        const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
                        const selectable = isDateSelectable(day);
                        const isSelected = dateStr === selected;
                        const avail = getDateAvailability(day);

                        return (
                            <button
                                key={i}
                                disabled={!selectable}
                                className={`krib-calendar-day ${isSelected ? 'selected' : ''} ${selectable ? 'available' : ''}`}
                                onClick={() => selectable && onSelect(dateStr)}
                                style={isSelected ? { backgroundColor: theme.primary } : {}}
                            >
                                {day}
                                {avail?.availableCount > 0 && (
                                    <span className="krib-slot-count">{avail.availableCount}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// Time Selection Step
const TimeStep = ({ availability, selectedDate, selectedTime, onSelect, theme }) => {
    const dayData = availability?.[selectedDate];
    const slots = dayData?.slots?.filter(s => s.available) || [];

    if (!slots.length) {
        return (
            <div className="krib-step krib-step-time">
                <h3>Select a time</h3>
                <p className="krib-no-slots">No available times for this date. Please select a different date.</p>
            </div>
        );
    }

    return (
        <div className="krib-step krib-step-time">
            <h3>Select a time for {dayData?.dayLabel}</h3>
            <div className="krib-time-grid">
                {slots.map((slot) => (
                    <button
                        key={slot.start}
                        className={`krib-time-slot ${selectedTime?.start === slot.start ? 'selected' : ''}`}
                        onClick={() => onSelect(slot)}
                        style={selectedTime?.start === slot.start ? { backgroundColor: theme.primary, borderColor: theme.primary } : {}}
                    >
                        {slot.startDisplay}
                    </button>
                ))}
            </div>
        </div>
    );
};

// Details Step
const DetailsStep = ({
    formData,
    onChange,
    requirePhone,
    requireAddress,
    selectedService,
    selectedDate,
    selectedTime,
    onSubmit,
    submitting,
    isValid,
    theme
}) => {
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="krib-step krib-step-details">
            <h3>Your information</h3>

            {/* Booking summary */}
            <div className="krib-summary">
                <div className="krib-summary-item">
                    <span>Service:</span>
                    <strong>{selectedService?.name}</strong>
                </div>
                <div className="krib-summary-item">
                    <span>Date:</span>
                    <strong>{formatDate(selectedDate)}</strong>
                </div>
                <div className="krib-summary-item">
                    <span>Time:</span>
                    <strong>{selectedTime?.startDisplay}</strong>
                </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                <div className="krib-form-group">
                    <label>Name *</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => onChange('name', e.target.value)}
                        placeholder="Your full name"
                        required
                    />
                </div>

                <div className="krib-form-group">
                    <label>Email *</label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => onChange('email', e.target.value)}
                        placeholder="your@email.com"
                        required
                    />
                </div>

                <div className="krib-form-group">
                    <label>Phone {requirePhone ? '*' : '(optional)'}</label>
                    <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => onChange('phone', e.target.value)}
                        placeholder="(555) 555-5555"
                        required={requirePhone}
                    />
                </div>

                <div className="krib-form-group">
                    <label>Service Address {requireAddress ? '*' : '(optional)'}</label>
                    <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => onChange('address', e.target.value)}
                        placeholder="123 Main St, City, State ZIP"
                        required={requireAddress}
                    />
                </div>

                <div className="krib-form-group">
                    <label>Describe the issue (optional)</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => onChange('description', e.target.value)}
                        placeholder="Please describe what you need help with..."
                        rows={3}
                    />
                </div>

                <div className="krib-form-group">
                    <label>How did you hear about us? (optional)</label>
                    <select
                        value={formData.referralSource}
                        onChange={(e) => onChange('referralSource', e.target.value)}
                    >
                        <option value="">Select...</option>
                        <option value="google">Google Search</option>
                        <option value="referral">Friend/Family Referral</option>
                        <option value="social">Social Media</option>
                        <option value="yelp">Yelp</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <button
                    type="submit"
                    className="krib-btn krib-btn-primary"
                    disabled={!isValid || submitting}
                    style={{ backgroundColor: theme.primary }}
                >
                    {submitting ? 'Booking...' : 'Confirm Booking'}
                </button>
            </form>
        </div>
    );
};

// Confirmation Step
const ConfirmationStep = ({ booking, theme }) => (
    <div className="krib-step krib-step-confirm">
        <div className="krib-confirm-icon" style={{ backgroundColor: theme.primaryLight, color: theme.primary }}>
            ✓
        </div>
        <h3>Booking Confirmed!</h3>
        <p>Thank you for booking with {booking.companyName}</p>

        <div className="krib-confirm-details">
            <div className="krib-confirm-code">
                <span>Confirmation Code</span>
                <strong>{booking.confirmationCode}</strong>
            </div>

            <div className="krib-confirm-item">
                <span>Service</span>
                <strong>{booking.serviceType}</strong>
            </div>

            <div className="krib-confirm-item">
                <span>Date & Time</span>
                <strong>
                    {new Date(booking.scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    })} at {booking.scheduledTime}
                </strong>
            </div>
        </div>

        <p className="krib-confirm-note">
            A confirmation email has been sent to <strong>{booking.customerEmail}</strong>
        </p>
    </div>
);

// Utility: Adjust color brightness
function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default BookingWidget;
