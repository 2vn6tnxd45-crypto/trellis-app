// api/widget/contractor-info.js
// ============================================
// PUBLIC CONTRACTOR INFO API
// ============================================
// Returns public contractor info for booking widget

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

// CORS headers for widget embedding
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=300' // 5 minute cache
};

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
        const { contractorId } = req.query;

        if (!contractorId) {
            return res.status(400).set(corsHeaders).json({ error: 'Missing contractorId parameter' });
        }

        const db = getFirebaseAdmin();
        const contractorRef = db.collection('contractors').doc(contractorId);
        const contractorDoc = await contractorRef.get();

        if (!contractorDoc.exists) {
            return res.status(404).set(corsHeaders).json({ error: 'Contractor not found' });
        }

        const data = contractorDoc.data();
        const bookingWidget = data.bookingWidget || {};

        // Check if booking is enabled
        if (!bookingWidget.enabled) {
            return res.status(403).set(corsHeaders).json({
                error: 'Online booking is not enabled for this contractor',
                enabled: false
            });
        }

        // Get average rating
        let averageRating = null;
        let reviewCount = 0;
        try {
            const reviewsSnapshot = await db.collection('contractors')
                .doc(contractorId)
                .collection('reviews')
                .get();

            if (!reviewsSnapshot.empty) {
                const ratings = reviewsSnapshot.docs.map(d => d.data().rating).filter(r => r);
                if (ratings.length > 0) {
                    averageRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
                    reviewCount = ratings.length;
                }
            }
        } catch (e) {
            console.warn('Error fetching reviews:', e);
        }

        // Build public response (only safe fields)
        const publicInfo = {
            id: contractorId,
            companyName: data.businessName || data.companyName || 'Service Provider',
            logoUrl: data.logoUrl || null,
            serviceArea: data.serviceArea || null,
            averageRating: averageRating ? parseFloat(averageRating) : null,
            reviewCount,

            // Booking settings
            booking: {
                enabled: true,
                allowedServices: bookingWidget.allowedServices || [],
                leadTimeHours: bookingWidget.leadTimeHours || 24,
                maxAdvanceDays: bookingWidget.maxAdvanceDays || 30,
                slotDurationMinutes: bookingWidget.slotDurationMinutes || 60,
                requirePhone: bookingWidget.requirePhone !== false,
                requireAddress: bookingWidget.requireAddress !== false
            },

            // Customization
            customization: {
                primaryColor: bookingWidget.customization?.primaryColor || '#10b981',
                buttonText: bookingWidget.customization?.buttonText || 'Book Now',
                headerText: bookingWidget.customization?.headerText || 'Schedule Service'
            },

            // Available service types
            serviceTypes: (data.serviceTypes || [])
                .filter(st => !bookingWidget.allowedServices?.length ||
                    bookingWidget.allowedServices.includes(st.id || st.value))
                .map(st => ({
                    id: st.id || st.value,
                    name: st.name || st.label,
                    duration: st.duration || bookingWidget.slotDurationMinutes || 60
                }))
        };

        return res.status(200).set(corsHeaders).json(publicInfo);

    } catch (error) {
        console.error('[Widget API] Error:', error);
        return res.status(500).set(corsHeaders).json({ error: 'Internal server error' });
    }
}

export const config = {
    api: {
        bodyParser: false
    }
};
