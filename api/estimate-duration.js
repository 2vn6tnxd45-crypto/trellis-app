// api/estimate-duration.js
// ============================================
// AI DURATION ESTIMATION API
// ============================================
// Vercel serverless function for AI-powered job duration estimation
// Uses Gemini to analyze quote details and suggest duration + crew size

import { GoogleGenerativeAI } from '@google/generative-ai';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://mykrib.app',
    'https://www.mykrib.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
].filter(Boolean);

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

    const { title, lineItems, notes, category, customerAddress, propertyType } = req.body;

    if (!title && (!lineItems || lineItems.length === 0)) {
        return res.status(400).json({ error: 'Missing required fields: title or lineItems' });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.warn('No Gemini API key - using fallback estimation');
            return res.status(200).json(getFallbackEstimate(title, lineItems, category));
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Build context from quote data
        const laborItems = (lineItems || []).filter(item => item.type === 'labor');
        const materialItems = (lineItems || []).filter(item => item.type === 'material');

        const prompt = `You are an expert contractor estimator with 20+ years of experience. Analyze this job quote and provide a realistic duration estimate.

JOB DETAILS:
- Title: ${title || 'Service Job'}
- Category: ${category || 'General'}
${notes ? `- Notes/Description: ${notes}` : ''}
${propertyType ? `- Property Type: ${propertyType}` : ''}
${customerAddress ? `- Location: ${customerAddress}` : ''}

LABOR ITEMS:
${laborItems.length > 0
            ? laborItems.map(item => `- ${item.description || 'Labor'}${item.crewSize ? ` (Crew: ${item.crewSize})` : ''}${item.quantity > 1 ? ` x${item.quantity}` : ''}`).join('\n')
            : '- No specific labor items listed'}

MATERIALS/EQUIPMENT:
${materialItems.length > 0
            ? materialItems.map(item => `- ${item.description || 'Material'}${item.brand ? ` (${item.brand})` : ''}${item.model ? ` ${item.model}` : ''}${item.quantity > 1 ? ` x${item.quantity}` : ''}`).join('\n')
            : '- No specific materials listed'}

Based on industry standards and the scope of work described, estimate:
1. Total duration (be realistic - account for setup, cleanup, unexpected issues)
2. Recommended crew size
3. If this is likely a multi-day job

IMPORTANT: Be practical. A simple repair might be 1-2 hours. A full system installation is typically 4-8 hours. Major renovations span multiple days.

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
    "duration": {
        "value": <number>,
        "unit": "<minutes|hours|days>",
        "display": "<human readable string like '6-8 hours' or '2-3 days'>"
    },
    "crew": {
        "recommended": <number>,
        "minimum": <number>,
        "reasoning": "<brief explanation>"
    },
    "isMultiDay": <boolean>,
    "confidence": "<high|medium|low>",
    "reasoning": "<1-2 sentence explanation of the estimate>",
    "breakdown": [
        {"task": "<task name>", "duration": "<time estimate>"}
    ]
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error('Failed to parse Gemini response:', text);
            return res.status(200).json(getFallbackEstimate(title, lineItems, category));
        }

        // Validate and sanitize response
        const sanitized = {
            duration: {
                value: Number(data.duration?.value) || 2,
                unit: ['minutes', 'hours', 'days'].includes(data.duration?.unit) ? data.duration.unit : 'hours',
                display: String(data.duration?.display || '2 hours')
            },
            crew: {
                recommended: Number(data.crew?.recommended) || 1,
                minimum: Number(data.crew?.minimum) || 1,
                reasoning: String(data.crew?.reasoning || '')
            },
            isMultiDay: Boolean(data.isMultiDay),
            confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'medium',
            reasoning: String(data.reasoning || 'Based on standard industry estimates.'),
            breakdown: Array.isArray(data.breakdown) ? data.breakdown.slice(0, 6).map(b => ({
                task: String(b.task || ''),
                duration: String(b.duration || '')
            })) : [],
            source: 'ai'
        };

        return res.status(200).json(sanitized);

    } catch (error) {
        console.error('Duration estimation error:', error);
        return res.status(200).json(getFallbackEstimate(title, lineItems, category));
    }
}

// ============================================
// FALLBACK ESTIMATION (No AI)
// ============================================
function getFallbackEstimate(title, lineItems, category) {
    const titleLower = (title || '').toLowerCase();
    const categoryLower = (category || '').toLowerCase();

    // Duration defaults by category/keywords
    const DURATION_MAP = {
        // Roofing
        'roof replacement': { value: 3, unit: 'days', crew: 3 },
        'full roof': { value: 3, unit: 'days', crew: 3 },
        'new roof': { value: 3, unit: 'days', crew: 3 },
        'roof repair': { value: 4, unit: 'hours', crew: 2 },
        'roof inspection': { value: 1, unit: 'hours', crew: 1 },
        'shingle': { value: 2, unit: 'days', crew: 2 },
        'roofing': { value: 1, unit: 'days', crew: 2 },

        // HVAC
        'hvac installation': { value: 8, unit: 'hours', crew: 2 },
        'hvac replacement': { value: 8, unit: 'hours', crew: 2 },
        'hvac system': { value: 8, unit: 'hours', crew: 2 },
        'hvac repair': { value: 2, unit: 'hours', crew: 1 },
        'hvac maintenance': { value: 1, unit: 'hours', crew: 1 },
        'hvac': { value: 4, unit: 'hours', crew: 1 },
        'furnace install': { value: 6, unit: 'hours', crew: 2 },
        'furnace replace': { value: 6, unit: 'hours', crew: 2 },
        'furnace': { value: 4, unit: 'hours', crew: 1 },
        'air conditioning install': { value: 6, unit: 'hours', crew: 2 },
        'air conditioning': { value: 4, unit: 'hours', crew: 1 },
        'ac install': { value: 6, unit: 'hours', crew: 2 },
        'mini split': { value: 6, unit: 'hours', crew: 2 },
        'heat pump': { value: 8, unit: 'hours', crew: 2 },
        'ductwork': { value: 2, unit: 'days', crew: 2 },
        'duct cleaning': { value: 3, unit: 'hours', crew: 2 },

        // Plumbing
        'water heater install': { value: 4, unit: 'hours', crew: 1 },
        'water heater replace': { value: 4, unit: 'hours', crew: 1 },
        'water heater': { value: 4, unit: 'hours', crew: 1 },
        'tankless': { value: 6, unit: 'hours', crew: 1 },
        'drain cleaning': { value: 1, unit: 'hours', crew: 1 },
        'clogged': { value: 1, unit: 'hours', crew: 1 },
        'pipe repair': { value: 3, unit: 'hours', crew: 1 },
        'pipe replace': { value: 4, unit: 'hours', crew: 1 },
        'leak repair': { value: 2, unit: 'hours', crew: 1 },
        'bathroom remodel': { value: 5, unit: 'days', crew: 2 },
        'kitchen remodel': { value: 7, unit: 'days', crew: 2 },
        'plumbing': { value: 2, unit: 'hours', crew: 1 },
        'sewer line': { value: 2, unit: 'days', crew: 2 },
        'sewer': { value: 4, unit: 'hours', crew: 2 },
        're-pipe': { value: 3, unit: 'days', crew: 2 },
        'repipe': { value: 3, unit: 'days', crew: 2 },
        'garbage disposal': { value: 1, unit: 'hours', crew: 1 },
        'faucet': { value: 1, unit: 'hours', crew: 1 },
        'toilet': { value: 1, unit: 'hours', crew: 1 },

        // Electrical
        'panel upgrade': { value: 6, unit: 'hours', crew: 2 },
        'electrical panel': { value: 6, unit: 'hours', crew: 2 },
        'breaker panel': { value: 6, unit: 'hours', crew: 2 },
        'whole house rewire': { value: 4, unit: 'days', crew: 2 },
        'rewire': { value: 3, unit: 'days', crew: 2 },
        'outlet install': { value: 1, unit: 'hours', crew: 1 },
        'outlet': { value: 1, unit: 'hours', crew: 1 },
        'switch': { value: 1, unit: 'hours', crew: 1 },
        'ceiling fan': { value: 1, unit: 'hours', crew: 1 },
        'light fixture': { value: 1, unit: 'hours', crew: 1 },
        'chandelier': { value: 2, unit: 'hours', crew: 1 },
        'electrical': { value: 2, unit: 'hours', crew: 1 },
        'ev charger': { value: 4, unit: 'hours', crew: 1 },
        'generator': { value: 6, unit: 'hours', crew: 2 },

        // Windows/Doors
        'window replacement': { value: 2, unit: 'days', crew: 2 },
        'window install': { value: 4, unit: 'hours', crew: 2 },
        'window': { value: 2, unit: 'hours', crew: 1 },
        'door install': { value: 3, unit: 'hours', crew: 1 },
        'door replace': { value: 3, unit: 'hours', crew: 1 },
        'door': { value: 2, unit: 'hours', crew: 1 },
        'garage door': { value: 4, unit: 'hours', crew: 2 },

        // Flooring
        'flooring install': { value: 2, unit: 'days', crew: 2 },
        'hardwood': { value: 3, unit: 'days', crew: 2 },
        'tile install': { value: 2, unit: 'days', crew: 2 },
        'tile': { value: 1, unit: 'days', crew: 1 },
        'carpet': { value: 1, unit: 'days', crew: 2 },
        'vinyl': { value: 1, unit: 'days', crew: 2 },
        'laminate': { value: 1, unit: 'days', crew: 2 },

        // Painting
        'interior painting': { value: 2, unit: 'days', crew: 2 },
        'exterior painting': { value: 3, unit: 'days', crew: 3 },
        'painting': { value: 1, unit: 'days', crew: 2 },
        'paint': { value: 4, unit: 'hours', crew: 1 },

        // General/Services
        'inspection': { value: 1, unit: 'hours', crew: 1 },
        'evaluation': { value: 45, unit: 'minutes', crew: 1 },
        'estimate': { value: 30, unit: 'minutes', crew: 1 },
        'consultation': { value: 30, unit: 'minutes', crew: 1 },
        'service call': { value: 1, unit: 'hours', crew: 1 },
        'maintenance': { value: 1, unit: 'hours', crew: 1 },
        'tune-up': { value: 1, unit: 'hours', crew: 1 },
        'repair': { value: 2, unit: 'hours', crew: 1 }
    };

    // Find best match - check title first, then category
    let match = null;
    const searchTerms = [titleLower, categoryLower];

    for (const term of searchTerms) {
        if (!term) continue;
        for (const [keyword, estimate] of Object.entries(DURATION_MAP)) {
            if (term.includes(keyword)) {
                match = estimate;
                break;
            }
        }
        if (match) break;
    }

    // Check line items for clues if no title/category match
    if (!match && lineItems && lineItems.length > 0) {
        for (const item of lineItems) {
            const desc = (item.description || '').toLowerCase();
            for (const [keyword, estimate] of Object.entries(DURATION_MAP)) {
                if (desc.includes(keyword)) {
                    match = estimate;
                    break;
                }
            }
            if (match) break;
        }
    }

    // Default fallback
    if (!match) {
        match = { value: 2, unit: 'hours', crew: 1 };
    }

    const isMultiDay = match.unit === 'days';
    const display = match.unit === 'minutes'
        ? `${match.value} minutes`
        : match.unit === 'hours'
            ? `${match.value} hour${match.value > 1 ? 's' : ''}`
            : `${match.value} day${match.value > 1 ? 's' : ''}`;

    return {
        duration: {
            value: match.value,
            unit: match.unit,
            display
        },
        crew: {
            recommended: match.crew,
            minimum: 1,
            reasoning: 'Based on standard industry estimates for this type of work.'
        },
        isMultiDay,
        confidence: 'medium',
        reasoning: `Standard estimate for ${title || category || 'general service'}.`,
        breakdown: [],
        source: 'fallback'
    };
}
