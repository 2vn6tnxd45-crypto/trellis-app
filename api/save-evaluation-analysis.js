// api/save-evaluation-analysis.js
// ============================================
// SAVE EVALUATION AI ANALYSIS
// ============================================
// Server-side endpoint to save AI analysis to Firestore
// This uses Firebase Admin SDK which bypasses security rules,
// allowing homeowners to save analysis results to evaluations
// they don't have write access to.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin (if not already)
// Use FIREBASE_SERVICE_ACCOUNT env var (JSON string) - matching other working APIs
if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
            credential: cert(serviceAccount)
        });
    } else {
        console.warn('[save-evaluation-analysis] Firebase Admin not initialized - FIREBASE_SERVICE_ACCOUNT not set');
    }
}

const db = getApps().length > 0 ? getFirestore() : null;
const appId = 'krib-app';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://mykrib.app',
    'https://www.mykrib.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
].filter(Boolean);

export default async function handler(req, res) {
    // CORS headers
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { contractorId, evaluationId, analysis } = req.body;

        // Validate required fields
        if (!contractorId) {
            return res.status(400).json({ error: 'Contractor ID is required' });
        }
        if (!evaluationId) {
            return res.status(400).json({ error: 'Evaluation ID is required' });
        }
        if (!analysis || typeof analysis !== 'object') {
            return res.status(400).json({ error: 'Analysis object is required' });
        }

        console.log('[save-evaluation-analysis] Saving analysis for:', {
            contractorId,
            evaluationId,
            hasSummary: !!analysis.summary
        });

        // Check if Firebase Admin is available
        if (!db) {
            console.error('[save-evaluation-analysis] Firebase Admin not available');
            return res.status(503).json({
                error: 'Database service not available',
                message: 'Firebase Admin SDK not initialized. Check FIREBASE_SERVICE_ACCOUNT env var.'
            });
        }

        // Build the document path using the module-level appId
        // Path: artifacts/{appId}/public/data/contractors/{contractorId}/evaluations/{evaluationId}
        const evalRef = db.doc(
            `artifacts/${appId}/public/data/contractors/${contractorId}/evaluations/${evaluationId}`
        );

        // Verify the evaluation exists before updating
        const evalDoc = await evalRef.get();
        if (!evalDoc.exists) {
            console.warn('[save-evaluation-analysis] Evaluation not found:', evaluationId);
            return res.status(404).json({ error: 'Evaluation not found' });
        }

        // Save the analysis
        await evalRef.update({
            aiAnalysis: {
                ...analysis,
                savedAt: new Date().toISOString()
            },
            updatedAt: FieldValue.serverTimestamp()
        });

        console.log('[save-evaluation-analysis] Analysis saved successfully');
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('[save-evaluation-analysis] Error:', error);
        return res.status(500).json({
            error: 'Failed to save analysis',
            message: error.message
        });
    }
}
