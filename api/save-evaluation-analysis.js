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

// Initialize Firebase Admin
if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = getFirestore();

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

        // Build the document path
        // Path: artifacts/{appId}/public/data/contractors/{contractorId}/evaluations/{evaluationId}
        const appId = process.env.VITE_APP_ID || process.env.APP_ID || 'default';
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
