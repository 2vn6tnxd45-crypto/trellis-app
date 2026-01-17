// api/widget/availability.js
// ============================================
// PUBLIC AVAILABILITY API
// ============================================
// Returns available time slots for booking widget

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const getFirebaseAdmin = () => {
    if (getApps().length === 0) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
        initializeApp({
            credential: cert(serviceAccount)
        });
    }
    return getFirestore();
};

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=60' // 1 minute cache
};

// Constants
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DEFAULT_WORKING_HOURS = {
    monday: { enabled: true, start: '08:00', end: '17:00' },
    tuesday: { enabled: true, start: '08:00', end: '17:00' },
    wednesday: { enabled: true, start: '08:00', end: '17:00' },
    thursday: { enabled: true, start: '08:00', end: '17:00' },
    friday: { enabled: true, start: '08:00', end: '17:00' },
    saturday: { enabled: false, start: '09:00', end: '14:00' },
    sunday: { enabled: false, start: '09:00', end: '14:00' }
};

// Helper functions
const parseTimeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const minutesToTimeString = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const formatTimeDisplay = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

const getDateString = (date) => date.toISOString().split('T')[0];

const rangesOverlap = (start1, end1, start2, end2) => start1 < end2 && end1 > start2;

export default async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).set(corsHeaders).end();
    }

    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).set(corsHeaders).json({ error: 'Method not allowed' });
    }

    try {
        const { contractorId, startDate, endDate, serviceType } = req.query;

        if (!contractorId) {
            return res.status(400).set(corsHeaders).json({ error: 'Missing contractorId parameter' });
        }

        const db = getFirebaseAdmin();

        // Get contractor data
        const contractorRef = db.collection('contractors').doc(contractorId);
        const contractorDoc = await contractorRef.get();

        if (!contractorDoc.exists) {
            return res.status(404).set(corsHeaders).json({ error: 'Contractor not found' });
        }

        const contractorData = contractorDoc.data();
        const bookingWidget = contractorData.bookingWidget || {};

        if (!bookingWidget.enabled) {
            return res.status(403).set(corsHeaders).json({
                error: 'Online booking is not enabled'
            });
        }

        // Parse date range
        const now = new Date();
        const start = startDate ? new Date(startDate) : new Date();
        const maxAdvance = new Date();
        maxAdvance.setDate(maxAdvance.getDate() + (bookingWidget.maxAdvanceDays || 30));

        const end = endDate ? new Date(endDate) : maxAdvance;

        // Ensure dates are within allowed range
        if (start < now) {
            start.setTime(now.getTime());
        }
        if (end > maxAdvance) {
            end.setTime(maxAdvance.getTime());
        }

        // Get existing jobs
        const jobsSnapshot = await db.collection('contractors')
            .doc(contractorId)
            .collection('jobs')
            .where('scheduledDate', '>=', start)
            .where('scheduledDate', '<=', end)
            .where('status', 'in', ['scheduled', 'confirmed', 'assigned', 'in_progress'])
            .get();

        const existingJobs = jobsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                scheduledDate: data.scheduledDate?.toDate?.() || new Date(data.scheduledDate),
                estimatedDuration: data.estimatedDuration || bookingWidget.slotDurationMinutes || 60
            };
        });

        // Settings
        const leadTimeHours = bookingWidget.leadTimeHours || 24;
        const leadTimeCutoff = new Date(now.getTime() + leadTimeHours * 60 * 60 * 1000);
        const slotDuration = bookingWidget.slotDurationMinutes || 60;
        const buffer = bookingWidget.bufferMinutes || 30;
        const workingHours = contractorData.scheduling?.workingHours || DEFAULT_WORKING_HOURS;

        // Generate slots for each day
        const slotsByDate = {};
        const currentDate = new Date(start);
        currentDate.setHours(0, 0, 0, 0);

        const endDateNormalized = new Date(end);
        endDateNormalized.setHours(23, 59, 59, 999);

        while (currentDate <= endDateNormalized) {
            const dateStr = getDateString(currentDate);
            const dayName = DAY_NAMES[currentDate.getDay()];
            const dayConfig = workingHours[dayName];

            // Skip if day is not enabled
            if (!dayConfig?.enabled) {
                slotsByDate[dateStr] = {
                    date: dateStr,
                    dayName,
                    dayLabel: currentDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    }),
                    slots: [],
                    available: false
                };
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }

            // Get working hours for this day
            const dayStart = parseTimeToMinutes(dayConfig.start);
            const dayEnd = parseTimeToMinutes(dayConfig.end);

            // Get jobs for this specific day
            const dayJobs = existingJobs.filter(job => {
                const jobDate = new Date(job.scheduledDate);
                return getDateString(jobDate) === dateStr;
            });

            // Build blocked time ranges
            const blockedRanges = dayJobs.map(job => {
                const jobTime = new Date(job.scheduledDate);
                const jobStartMinutes = jobTime.getHours() * 60 + jobTime.getMinutes();
                return {
                    start: jobStartMinutes - buffer,
                    end: jobStartMinutes + job.estimatedDuration + buffer
                };
            });

            // Generate available slots
            const slots = [];
            let currentSlotStart = dayStart;

            while (currentSlotStart + slotDuration <= dayEnd) {
                const slotEnd = currentSlotStart + slotDuration;

                // Check if slot conflicts with any blocked range
                const isBlocked = blockedRanges.some(range =>
                    rangesOverlap(currentSlotStart, slotEnd, range.start, range.end)
                );

                // Check if slot is past lead time cutoff
                const slotDateTime = new Date(currentDate);
                slotDateTime.setHours(Math.floor(currentSlotStart / 60), currentSlotStart % 60, 0, 0);
                const isPastCutoff = slotDateTime < leadTimeCutoff;

                const startTime = minutesToTimeString(currentSlotStart);
                const endTime = minutesToTimeString(slotEnd);

                slots.push({
                    start: startTime,
                    end: endTime,
                    startDisplay: formatTimeDisplay(startTime),
                    endDisplay: formatTimeDisplay(endTime),
                    available: !isBlocked && !isPastCutoff
                });

                currentSlotStart += slotDuration;
            }

            slotsByDate[dateStr] = {
                date: dateStr,
                dayName,
                dayLabel: currentDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                }),
                slots,
                available: slots.some(s => s.available),
                availableCount: slots.filter(s => s.available).length
            };

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return res.status(200).set(corsHeaders).json({
            success: true,
            contractorId,
            startDate: getDateString(start),
            endDate: getDateString(end),
            slotDurationMinutes: slotDuration,
            leadTimeHours,
            slots: slotsByDate,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Availability API] Error:', error);
        return res.status(500).set(corsHeaders).json({ error: 'Internal server error' });
    }
}

export const config = {
    api: {
        bodyParser: false
    }
};
