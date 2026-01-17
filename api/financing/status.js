// api/financing/status.js
// ============================================
// FINANCING APPLICATION STATUS API
// ============================================
// Get status of a financing application

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

export default async function handler(req, res) {
    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { applicationId } = req.query;

        if (!applicationId) {
            return res.status(400).json({ error: 'Missing applicationId parameter' });
        }

        const db = getFirebaseAdmin();

        // Get application from Firestore
        const appRef = db.collection('financingApplications').doc(applicationId);
        const appDoc = await appRef.get();

        if (!appDoc.exists) {
            return res.status(404).json({ error: 'Application not found' });
        }

        const data = appDoc.data();

        // Return sanitized data
        return res.status(200).json({
            id: applicationId,
            status: data.status,
            requestedAmount: data.requestedAmount,
            approvedAmount: data.approvedAmount || null,
            apr: data.apr || null,
            monthlyPayment: data.monthlyPayment || null,
            termMonths: data.termMonths || null,
            applicationUrl: data.applicationUrl,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            approvedAt: data.approvedAt?.toDate?.()?.toISOString() || data.approvedAt,
            fundedAt: data.fundedAt?.toDate?.()?.toISOString() || data.fundedAt
        });

    } catch (error) {
        console.error('[Financing Status] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

export const config = {
    api: {
        bodyParser: false
    }
};
