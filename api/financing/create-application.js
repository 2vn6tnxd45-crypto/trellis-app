// api/financing/create-application.js
// ============================================
// WISETACK APPLICATION CREATION API
// ============================================
// Creates a financing application with Wisetack

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

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

// Wisetack API configuration
const WISETACK_API_BASE = process.env.WISETACK_API_URL || 'https://api.wisetack.com/v1';
const WISETACK_SANDBOX_URL = 'https://sandbox-api.wisetack.com/v1';

// Determine if we're in sandbox mode
const isSandbox = () => {
    return process.env.NODE_ENV !== 'production' || process.env.WISETACK_SANDBOX === 'true';
};

// Get Wisetack API base URL
const getApiBase = () => {
    return isSandbox() ? WISETACK_SANDBOX_URL : WISETACK_API_BASE;
};

// Decrypt API key from Firestore
const decryptApiKey = (encryptedKey) => {
    if (!encryptedKey) return null;

    // If not encrypted (development), return as-is
    if (!encryptedKey.startsWith('enc:')) return encryptedKey;

    try {
        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) return null;

        const parts = encryptedKey.substring(4).split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];

        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            Buffer.from(encryptionKey, 'hex'),
            iv
        );

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('[Financing] Decryption error:', error);
        return null;
    }
};

// Format phone number
const formatPhone = (phone) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return `+${digits}`;
};

// Parse name into first and last
const parseName = (fullName) => {
    if (!fullName) return { firstName: '', lastName: '' };
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ')
    };
};

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            quoteId,
            contractorId,
            amount,
            customer,
            serviceDescription
        } = req.body;

        // Validate required fields
        if (!quoteId || !contractorId || !amount || !customer?.email) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['quoteId', 'contractorId', 'amount', 'customer.email']
            });
        }

        // Validate amount
        if (amount < 500 || amount > 25000) {
            return res.status(400).json({
                error: 'Amount must be between $500 and $25,000'
            });
        }

        const db = getFirebaseAdmin();

        // Get contractor's financing settings
        const contractorRef = db.collection('contractors').doc(contractorId);
        const contractorDoc = await contractorRef.get();

        if (!contractorDoc.exists) {
            return res.status(404).json({ error: 'Contractor not found' });
        }

        const contractorData = contractorDoc.data();
        const financingSettings = contractorData.financing || {};

        if (!financingSettings.enabled) {
            return res.status(403).json({ error: 'Financing is not enabled for this contractor' });
        }

        // Get API credentials
        const merchantId = financingSettings.merchantId;
        const apiKey = decryptApiKey(financingSettings.apiKey) || process.env.WISETACK_API_KEY;

        if (!merchantId || !apiKey) {
            return res.status(500).json({ error: 'Financing provider not properly configured' });
        }

        // Get quote details
        const quoteRef = db.collection('contractors').doc(contractorId).collection('quotes').doc(quoteId);
        const quoteDoc = await quoteRef.get();

        if (!quoteDoc.exists) {
            return res.status(404).json({ error: 'Quote not found' });
        }

        const quoteData = quoteDoc.data();

        // Parse customer name
        const { firstName, lastName } = parseName(customer.name);

        // Build Wisetack application payload
        const applicationPayload = {
            merchant_id: merchantId,
            loan_amount: Math.round(amount * 100), // Convert to cents
            customer: {
                first_name: firstName,
                last_name: lastName,
                email: customer.email,
                phone: formatPhone(customer.phone),
                address: customer.address ? {
                    street: customer.address.street || customer.address.formatted?.split(',')[0] || '',
                    city: customer.address.city || '',
                    state: customer.address.state || '',
                    zip: customer.address.zip || customer.address.postalCode || ''
                } : null
            },
            transaction: {
                description: serviceDescription || quoteData.title || 'Home Service',
                reference_id: quoteId,
                items: quoteData.lineItems?.map(item => ({
                    name: item.description || item.name,
                    quantity: item.quantity || 1,
                    unit_price: Math.round((item.unitPrice || item.price || 0) * 100)
                })) || [{
                    name: serviceDescription || 'Service',
                    quantity: 1,
                    unit_price: Math.round(amount * 100)
                }]
            },
            metadata: {
                krib_quote_id: quoteId,
                krib_contractor_id: contractorId,
                source: 'krib_quote'
            },
            // Callback URLs
            redirect_url: `${process.env.APP_URL || process.env.VERCEL_URL}/quotes/${quoteId}?financing=complete`,
            webhook_url: `${process.env.APP_URL || process.env.VERCEL_URL}/api/financing/webhook`
        };

        // Call Wisetack API
        const wisetackResponse = await fetch(`${getApiBase()}/applications`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-Wisetack-Merchant-Id': merchantId
            },
            body: JSON.stringify(applicationPayload)
        });

        const wisetackResult = await wisetackResponse.json();

        if (!wisetackResponse.ok) {
            console.error('[Financing] Wisetack API error:', wisetackResult);

            // Log the error
            await db.collection('financingEvents').add({
                type: 'application_error',
                quoteId,
                contractorId,
                error: wisetackResult.error || wisetackResult.message || 'Unknown error',
                timestamp: FieldValue.serverTimestamp()
            });

            return res.status(wisetackResponse.status).json({
                error: wisetackResult.message || 'Failed to create financing application',
                code: wisetackResult.error_code
            });
        }

        // Store application in Firestore
        const applicationData = {
            id: wisetackResult.id,
            wisetackId: wisetackResult.id,
            quoteId,
            contractorId,
            customerId: quoteData.customerId || null,
            customerEmail: customer.email,
            customerName: customer.name,
            requestedAmount: amount,
            status: 'pending',
            applicationUrl: wisetackResult.application_url,
            expiresAt: wisetackResult.expires_at,
            provider: 'wisetack',
            createdAt: FieldValue.serverTimestamp()
        };

        await db.collection('financingApplications').doc(wisetackResult.id).set(applicationData);

        // Update quote with financing info
        await quoteRef.update({
            financing: {
                offered: true,
                applicationId: wisetackResult.id,
                status: 'pending',
                requestedAmount: amount,
                applicationUrl: wisetackResult.application_url,
                appliedAt: FieldValue.serverTimestamp()
            },
            updatedAt: FieldValue.serverTimestamp()
        });

        // Log the event
        await db.collection('financingEvents').add({
            type: 'application_created',
            applicationId: wisetackResult.id,
            quoteId,
            contractorId,
            amount,
            customerEmail: customer.email,
            timestamp: FieldValue.serverTimestamp()
        });

        console.log(`[Financing] Application created: ${wisetackResult.id} for quote ${quoteId}`);

        return res.status(201).json({
            success: true,
            applicationId: wisetackResult.id,
            applicationUrl: wisetackResult.application_url,
            expiresAt: wisetackResult.expires_at,
            status: 'pending'
        });

    } catch (error) {
        console.error('[Financing API] Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

export const config = {
    api: {
        bodyParser: true
    }
};
