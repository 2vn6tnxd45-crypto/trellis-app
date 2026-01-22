// api/customer-eta.js
// ============================================
// CUSTOMER ETA API ENDPOINT
// ============================================
// Quick Win #4: Live ETA tracking for customers

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    });
}

const db = getFirestore();

/**
 * GET /api/customer-eta?jobId=xxx&token=xxx
 * Returns ETA information for a customer to view
 */
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { jobId, token, contractorId } = req.query;

        if (!jobId || !contractorId) {
            return res.status(400).json({ error: 'Missing jobId or contractorId' });
        }

        // Get the job
        const jobRef = db.collection('contractors').doc(contractorId).collection('jobs').doc(jobId);
        const jobSnap = await jobRef.get();

        if (!jobSnap.exists) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const job = jobSnap.data();

        // Basic token validation (in production, use proper JWT)
        // For now, we'll use a simple hash of jobId + date
        const expectedToken = Buffer.from(`${jobId}-${job.scheduledDate}`).toString('base64').slice(0, 12);
        if (token && token !== expectedToken) {
            return res.status(403).json({ error: 'Invalid token' });
        }

        // Get tech info if assigned
        let techInfo = null;
        if (job.assignedTechId) {
            const techRef = db.collection('contractors').doc(contractorId).collection('team').doc(job.assignedTechId);
            const techSnap = await techRef.get();
            if (techSnap.exists) {
                const tech = techSnap.data();
                techInfo = {
                    name: tech.name,
                    photo: tech.photoUrl || null
                };
            }
        }

        // Calculate ETA based on status
        let eta = null;
        let etaMessage = '';

        switch (job.status) {
            case 'scheduled':
                eta = `${job.scheduledDate} ${job.scheduledStartTime}`;
                etaMessage = `Scheduled for ${formatTime(job.scheduledStartTime)}`;
                break;

            case 'en_route':
                // If we have travel time estimate, use it
                if (job.currentTravelMinutes) {
                    const now = new Date();
                    now.setMinutes(now.getMinutes() + job.currentTravelMinutes);
                    eta = now.toISOString();
                    etaMessage = `Arriving in approximately ${job.currentTravelMinutes} minutes`;
                } else {
                    etaMessage = 'Tech is on the way';
                }
                break;

            case 'on_site':
            case 'in_progress':
                etaMessage = 'Tech has arrived';
                break;

            case 'running_late':
                if (job.estimatedDelay) {
                    etaMessage = `Running approximately ${job.estimatedDelay} minutes late`;
                } else {
                    etaMessage = 'Running late - we\'ll update you shortly';
                }
                break;

            case 'completed':
                etaMessage = 'Service completed';
                break;

            case 'cancelled':
                etaMessage = 'This appointment has been cancelled';
                break;

            default:
                etaMessage = 'Appointment pending confirmation';
        }

        // Build response
        const response = {
            jobNumber: job.jobNumber,
            status: job.status,
            statusLabel: getStatusLabel(job.status),

            // Scheduling
            scheduledDate: job.scheduledDate,
            scheduledStartTime: job.scheduledStartTime,
            scheduledEndTime: job.scheduledEndTime,

            // ETA
            eta,
            etaMessage,

            // Tech info (limited for privacy)
            tech: techInfo,

            // Service address (confirm for customer)
            serviceAddress: job.serviceAddress,

            // Job info
            title: job.title,
            description: job.description,

            // Last updated
            lastUpdated: job.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('Customer ETA error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Helper functions
function formatTime(time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

function getStatusLabel(status) {
    const labels = {
        'pending_schedule': 'Pending',
        'scheduled': 'Scheduled',
        'en_route': 'On the Way',
        'on_site': 'Arrived',
        'in_progress': 'In Progress',
        'running_late': 'Running Late',
        'waiting': 'Waiting',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return labels[status] || status;
}
