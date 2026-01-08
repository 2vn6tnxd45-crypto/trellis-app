// api/cron/weekly-digest.js
// Runs weekly to send digest emails

import { Resend } from 'resend';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (for reading user data)
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
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    // Verify this is a legitimate cron request
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[WeeklyDigest] Starting...');
    
    try {
        // Get all users with digest enabled
        // Note: You'll need to adjust this query based on your data structure
        const usersSnapshot = await db.collectionGroup('profile').get();
        
        let sentCount = 0;
        
        for (const doc of usersSnapshot.docs) {
            const profile = doc.data();
            
            if (!profile.notifications?.emailDigest) continue;
            if (!profile.email) continue;
            
            // Get their tasks and send digest
            // (Simplified - you'd add the full logic here)
            
            await resend.emails.send({
                from: 'Krib <onboarding@resend.dev>',
                to: [profile.email],
                subject: '📋 Your weekly home update',
                html: `<p>Hi ${profile.name}, here's your weekly digest...</p>` // Add full template
            });
            
            sentCount++;
        }
        
        console.log(`[WeeklyDigest] Sent ${sentCount} emails`);
        return res.status(200).json({ success: true, sent: sentCount });
    } catch (err) {
        console.error('[WeeklyDigest] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
