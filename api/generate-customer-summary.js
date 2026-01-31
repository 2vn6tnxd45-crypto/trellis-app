// api/generate-customer-summary.js
// ============================================
// AI CUSTOMER SUMMARY GENERATION API
// ============================================
// Vercel serverless function for transforming informal crew notes
// into professional, customer-facing messages using Gemini AI

import { GoogleGenerativeAI } from '@google/generative-ai';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://mykrib.app',
    'https://www.mykrib.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
].filter(Boolean);

// ============================================
// TONE MAPPING
// ============================================

function getToneForUpdateType(updateType) {
    switch (updateType) {
        case 'issue':
        case 'delay':
            return 'apologetic';
        case 'material':
            return 'formal';
        case 'progress':
        default:
            return 'friendly';
    }
}

// ============================================
// FALLBACK TEMPLATES
// ============================================

function generateFallbackMessage(customerName, jobTitle, companyName, updateType) {
    const name = customerName || 'there';
    const job = jobTitle || 'your project';
    const company = companyName || 'Our team';

    switch (updateType) {
        case 'issue':
            return `Hi ${name}, we wanted to let you know about a situation we encountered during ${job}. Our team is addressing it and we'll keep you updated on our progress. Thank you for your patience. - ${company}`;
        case 'delay':
            return `Hi ${name}, we wanted to inform you of a brief delay on ${job}. We apologize for any inconvenience and are working to get back on schedule as quickly as possible. We'll keep you posted. - ${company}`;
        case 'material':
            return `Hi ${name}, we have an update regarding materials for ${job}. Our team will follow up with any additional details as needed. Thank you for your understanding. - ${company}`;
        case 'progress':
        default:
            return `Hi ${name}, we wanted to share a quick update on ${job}. Work is progressing well and our team is making good headway. We'll continue to keep you informed. - ${company}`;
    }
}

// ============================================
// PROMPT BUILDER
// ============================================

function buildPrompt(crewNotes, customerName, jobTitle, companyName, photoDescriptions, updateType) {
    const tone = getToneForUpdateType(updateType);

    const photoContext = photoDescriptions && photoDescriptions.length > 0
        ? `\n\nPhotos taken show: ${photoDescriptions.join('; ')}`
        : '';

    let toneGuidance;
    switch (tone) {
        case 'apologetic':
            toneGuidance = 'Use an apologetic but reassuring tone. Acknowledge the issue or delay professionally while emphasizing the team is handling it.';
            break;
        case 'formal':
            toneGuidance = 'Use a professional, informative tone focused on the facts about materials or supplies.';
            break;
        case 'friendly':
        default:
            toneGuidance = 'Use a warm, friendly but professional tone that conveys progress and competence.';
            break;
    }

    return `You are writing a brief customer update message for a home services company.

CONTEXT:
- Customer first name: ${customerName || 'Customer'}
- Job: ${jobTitle || 'Home service project'}
- Company name: ${companyName || 'Our team'}
- Update type: ${updateType}
${photoContext}

CREW NOTES (informal, internal language):
"${crewNotes}"

INSTRUCTIONS:
1. Transform the crew notes into a professional, customer-friendly message
2. Address the customer by their first name (Hi ${customerName || 'there'},)
3. ${toneGuidance}
4. Keep it concise: 2-4 sentences maximum
5. Do NOT use emojis
6. End with a simple closing that includes the company name (e.g., "- ${companyName || 'The Team'}")
7. Do NOT use formal greetings like "Dear" - start with "Hi [Name],"
8. Do NOT mention internal details, specific costs, or crew member names
9. Focus on what matters to the customer: progress, next steps, and reassurance

Respond with ONLY the customer message, nothing else.`;
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req, res) {
    // CORS headers - restrict to allowed origins
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('[generate-customer-summary] Processing request');

    const { crewNotes, customerName, jobTitle, companyName, photoDescriptions, updateType } = req.body;

    // Validate required fields
    if (!crewNotes || typeof crewNotes !== 'string') {
        console.log('[generate-customer-summary] Missing or invalid crewNotes');
        return res.status(400).json({ error: 'Missing required field: crewNotes' });
    }

    if (!companyName || typeof companyName !== 'string') {
        console.log('[generate-customer-summary] Missing or invalid companyName');
        return res.status(400).json({ error: 'Missing required field: companyName' });
    }

    // Normalize update type
    const validUpdateTypes = ['progress', 'issue', 'material', 'delay'];
    const normalizedUpdateType = validUpdateTypes.includes(updateType) ? updateType : 'progress';
    const tone = getToneForUpdateType(normalizedUpdateType);

    console.log('[generate-customer-summary] Update type:', normalizedUpdateType);
    console.log('[generate-customer-summary] Customer:', customerName || 'Not provided');
    console.log('[generate-customer-summary] Job:', jobTitle || 'Not provided');

    try {
        const apiKey = process.env.GEMINI_API_KEY;

        // Detailed API key debugging
        console.log('[generate-customer-summary] API Key check:', {
            exists: !!apiKey,
            length: apiKey ? apiKey.length : 0,
            prefix: apiKey ? apiKey.substring(0, 8) + '...' : 'N/A'
        });

        if (!apiKey) {
            console.warn('[generate-customer-summary] GEMINI_API_KEY not set in environment variables');
            console.warn('[generate-customer-summary] Available env vars:', Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('API')));
            return res.status(200).json({
                success: true,
                summary: generateFallbackMessage(customerName, jobTitle, companyName, normalizedUpdateType),
                tone,
                source: 'fallback',
                reason: 'API key not configured'
            });
        }

        console.log('[generate-customer-summary] Initializing GoogleGenerativeAI');
        const genAI = new GoogleGenerativeAI(apiKey);

        console.log('[generate-customer-summary] Getting model: gemini-1.5-flash');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = buildPrompt(
            crewNotes,
            customerName,
            jobTitle,
            companyName,
            photoDescriptions,
            normalizedUpdateType
        );

        console.log('[generate-customer-summary] Prompt length:', prompt.length, 'chars');
        console.log('[generate-customer-summary] Prompt preview:', prompt.substring(0, 200) + '...');

        console.log('[generate-customer-summary] Calling Gemini API...');
        const startTime = Date.now();

        const result = await model.generateContent(prompt);

        const duration = Date.now() - startTime;
        console.log('[generate-customer-summary] API call completed in', duration, 'ms');

        // Debug the response structure
        console.log('[generate-customer-summary] Response structure:', {
            hasResponse: !!result?.response,
            responseType: typeof result?.response,
            hasText: typeof result?.response?.text === 'function'
        });

        const summary = result.response.text().trim();

        if (!summary) {
            console.log('[generate-customer-summary] Empty response from Gemini, using fallback');
            return res.status(200).json({
                success: true,
                summary: generateFallbackMessage(customerName, jobTitle, companyName, normalizedUpdateType),
                tone,
                source: 'fallback',
                reason: 'Empty AI response'
            });
        }

        console.log('[generate-customer-summary] Successfully generated summary');
        console.log('[generate-customer-summary] Summary length:', summary.length, 'chars');
        console.log('[generate-customer-summary] Summary preview:', summary.substring(0, 100) + '...');

        return res.status(200).json({
            success: true,
            summary,
            tone,
            source: 'ai'
        });

    } catch (error) {
        // Detailed error logging
        console.error('[generate-customer-summary] ===== ERROR DETAILS =====');
        console.error('[generate-customer-summary] Error name:', error.name);
        console.error('[generate-customer-summary] Error message:', error.message);
        console.error('[generate-customer-summary] Error code:', error.code);
        console.error('[generate-customer-summary] Error status:', error.status);

        // Check for specific Gemini API errors
        if (error.message?.includes('API_KEY')) {
            console.error('[generate-customer-summary] API Key issue detected');
        }
        if (error.message?.includes('quota')) {
            console.error('[generate-customer-summary] Quota issue detected');
        }
        if (error.message?.includes('model')) {
            console.error('[generate-customer-summary] Model issue detected - try gemini-pro or gemini-1.5-pro');
        }

        // Log full error for debugging
        console.error('[generate-customer-summary] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        console.error('[generate-customer-summary] ===== END ERROR =====');

        // Return fallback on any error with error info
        return res.status(200).json({
            success: true,
            summary: generateFallbackMessage(customerName, jobTitle, companyName, normalizedUpdateType),
            tone,
            source: 'fallback',
            reason: error.message || 'Unknown error',
            errorCode: error.code || error.status || null
        });
    }
}
