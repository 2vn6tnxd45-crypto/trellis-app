// src/features/booking-widget/index.js
// ============================================
// BOOKING WIDGET EXPORTS
// ============================================

export { BookingWidget } from './BookingWidget';
export { BookingWidgetSettings } from './BookingWidgetSettings';
export {
    getBookingSettings,
    updateBookingSettings,
    getAvailableSlots,
    checkSlotAvailability,
    getNextAvailableDates,
    DEFAULT_BOOKING_SETTINGS,
    DEFAULT_WORKING_HOURS,
    formatTimeDisplay
} from './lib/availabilityService';
