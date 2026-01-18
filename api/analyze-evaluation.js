// api/analyze-evaluation.js
// ============================================
// AI EVALUATION ANALYSIS API
// ============================================
// Analyzes homeowner-submitted photos and descriptions
// using Gemini's vision capabilities to generate
// smart summaries for contractors.
//
// Input: photos (URLs), description, answers to prompts
// Output: AI-generated problem summary, severity, suggestions
//
// IMPORTANT: This endpoint should NEVER return 500 errors.
// Always return 200 with fallback analysis on any error.

import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================
// SEVERITY LEVELS
// ============================================
const SEVERITY_LEVELS = {
    LOW: 'low',           // Cosmetic or minor issue
    MEDIUM: 'medium',     // Needs attention but not urgent
    HIGH: 'high',         // Should be addressed soon
    URGENT: 'urgent'      // Safety concern or major damage
};

// ============================================
// FETCH IMAGE AS BASE64 - Robust version
// ============================================
async function fetchImageAsBase64(url, timeoutMs = 8000) {
    // Validate URL
    if (!url || typeof url !== 'string') {
        console.warn('[analyze-evaluation] Invalid image URL provided');
        return null;
    }

    // Skip blob URLs (can't be fetched server-side)
    if (url.startsWith('blob:')) {
        console.warn('[analyze-evaluation] Skipping blob URL (client-side only)');
        return null;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'image/*',
                'User-Agent': 'Krib-Evaluation-AI/1.0'
            }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`[analyze-evaluation] Image fetch failed: ${response.status} for ${url.substring(0, 50)}...`);
            return null;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // Validate it's actually an image
        if (!contentType.startsWith('image/')) {
            console.warn(`[analyze-evaluation] Not an image: ${contentType}`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();

        // Check size (skip if too large - over 10MB)
        if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
            console.warn('[analyze-evaluation] Image too large, skipping');
            return null;
        }

        // Check size (skip if too small - likely broken)
        if (arrayBuffer.byteLength < 1000) {
            console.warn('[analyze-evaluation] Image too small, likely broken');
            return null;
        }

        const base64 = Buffer.from(arrayBuffer).toString('base64');

        return {
            inlineData: {
                mimeType: contentType.split(';')[0], // Remove charset if present
                data: base64
            }
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn(`[analyze-evaluation] Image fetch timeout: ${url.substring(0, 50)}...`);
        } else {
            console.warn(`[analyze-evaluation] Image fetch error: ${error.message}`);
        }
        return null;
    }
}

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://mykrib.app',
    'https://www.mykrib.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
].filter(Boolean);

// ============================================
// MAIN HANDLER - With comprehensive error handling
// ============================================
export default async function handler(req, res) {
    // CORS headers - restrict to allowed origins
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

    // Wrap EVERYTHING in try/catch to prevent 500 errors
    try {
        // Safely destructure with defaults
        const body = req.body || {};
        const photos = Array.isArray(body.photos) ? body.photos : [];
        const videos = Array.isArray(body.videos) ? body.videos : [];
        const description = typeof body.description === 'string' ? body.description : '';
        const answers = typeof body.answers === 'object' && body.answers !== null ? body.answers : {};
        const prompts = Array.isArray(body.prompts) ? body.prompts : [];
        const jobCategory = typeof body.jobCategory === 'string' ? body.jobCategory : '';
        const propertyType = typeof body.propertyType === 'string' ? body.propertyType : '';

        console.log('[analyze-evaluation] Request received:', {
            photoCount: photos.length,
            videoCount: videos.length,
            hasDescription: !!description,
            answerCount: Object.keys(answers).length
        });

        // Validate we have something to analyze
        if (photos.length === 0 && !description && Object.keys(answers).length === 0) {
            console.log('[analyze-evaluation] No content to analyze');
            return res.status(200).json({
                success: true,
                analysis: getBasicSummary('', {}, 0),
                warning: 'No content provided for analysis'
            });
        }

        // Check for API key
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.warn('[analyze-evaluation] No GEMINI_API_KEY environment variable');
            return res.status(200).json({
                success: true,
                analysis: getBasicSummary(description, answers, photos.length),
                warning: 'AI analysis unavailable (API key not configured)'
            });
        }

        // Initialize Gemini with error handling
        let genAI, model;
        try {
            genAI = new GoogleGenerativeAI(apiKey);
            model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        } catch (initError) {
            console.error('[analyze-evaluation] Failed to initialize Gemini:', initError);
            return res.status(200).json({
                success: true,
                analysis: getBasicSummary(description, answers, photos.length),
                warning: 'AI service initialization failed'
            });
        }

        // Fetch images with comprehensive error handling
        let validImages = [];
        if (photos.length > 0) {
            const photosToAnalyze = photos.slice(0, 5);
            console.log(`[analyze-evaluation] Fetching ${photosToAnalyze.length} images...`);

            try {
                const imagePromises = photosToAnalyze.map(photo =>
                    fetchImageAsBase64(photo?.url).catch(err => {
                        console.warn(`[analyze-evaluation] Failed to fetch image: ${err.message}`);
                        return null;
                    })
                );
                const imageResults = await Promise.all(imagePromises);
                validImages = imageResults.filter(img => img !== null);
                console.log(`[analyze-evaluation] Successfully fetched ${validImages.length} images`);
            } catch (fetchError) {
                console.error('[analyze-evaluation] Image fetch batch error:', fetchError);
                // Continue without images
                validImages = [];
            }
        }

        // Build the prompt
        const textPrompt = buildAnalysisPrompt({
            photos,
            videos,
            description,
            answers,
            prompts,
            jobCategory,
            propertyType,
            imageCount: validImages.length
        });

        // Build content parts for Gemini
        const contentParts = [];

        if (validImages.length > 0) {
            contentParts.push({ text: `I'm providing ${validImages.length} photo(s) of the issue. Please analyze them carefully:\n\n` });
            validImages.forEach((img, idx) => {
                if (img && img.inlineData) {
                    contentParts.push(img);
                    const caption = photos[idx]?.caption || photos[idx]?.name || '';
                    if (caption) {
                        contentParts.push({ text: `\n[Photo ${idx + 1} caption: ${caption}]\n` });
                    }
                }
            });
            contentParts.push({ text: '\n\n' });
        }

        contentParts.push({ text: textPrompt });

        // Call Gemini API with error handling
        let responseText;
        try {
            console.log('[analyze-evaluation] Calling Gemini API...');
            const result = await model.generateContent(contentParts);
            responseText = result.response.text();
            console.log('[analyze-evaluation] Gemini response received, length:', responseText?.length || 0);
        } catch (geminiError) {
            console.error('[analyze-evaluation] Gemini API error:', geminiError);

            // Check for specific error types
            const errorMessage = geminiError.message || '';
            if (errorMessage.includes('API_KEY')) {
                console.error('[analyze-evaluation] API key issue detected');
            } else if (errorMessage.includes('quota') || errorMessage.includes('rate')) {
                console.error('[analyze-evaluation] Rate limit or quota issue');
            } else if (errorMessage.includes('blocked') || errorMessage.includes('safety')) {
                console.error('[analyze-evaluation] Content was blocked by safety filters');
            }

            return res.status(200).json({
                success: true,
                analysis: getBasicSummary(description, answers, photos.length),
                warning: `AI analysis failed: ${errorMessage.substring(0, 100)}`
            });
        }

        // Parse the response
        let analysis;
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                analysis = parseTextResponse(responseText);
            }
        } catch (parseError) {
            console.warn('[analyze-evaluation] JSON parse failed:', parseError.message);
            analysis = parseTextResponse(responseText || '');
        }

        // Sanitize and validate the analysis
        const sanitizedAnalysis = {
            summary: typeof analysis.summary === 'string' ? analysis.summary : 'Analysis completed',
            issues: Array.isArray(analysis.issues) ? analysis.issues.slice(0, 10) : [],
            severity: Object.values(SEVERITY_LEVELS).includes(analysis.severity)
                ? analysis.severity
                : SEVERITY_LEVELS.MEDIUM,
            suggestedQuestions: Array.isArray(analysis.suggestedQuestions)
                ? analysis.suggestedQuestions.slice(0, 5)
                : [],
            recommendations: typeof analysis.recommendations === 'string' ? analysis.recommendations : '',
            readyToQuote: typeof analysis.readyToQuote === 'boolean' ? analysis.readyToQuote : false,
            confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.7,
            analyzedAt: new Date().toISOString(),
            photoCount: photos.length,
            photosAnalyzed: validImages.length,
            videoCount: videos.length,
            usedVision: validImages.length > 0
        };

        console.log('[analyze-evaluation] Analysis complete:', {
            severity: sanitizedAnalysis.severity,
            issueCount: sanitizedAnalysis.issues.length,
            photosAnalyzed: sanitizedAnalysis.photosAnalyzed
        });

        return res.status(200).json({
            success: true,
            analysis: sanitizedAnalysis
        });

    } catch (error) {
        // This catches ANY uncaught error in the entire handler
        console.error('[analyze-evaluation] Unhandled error:', error);
        console.error('[analyze-evaluation] Error stack:', error.stack);

        // NEVER return 500 - always return 200 with fallback
        return res.status(200).json({
            success: true,
            analysis: {
                summary: 'Evaluation submitted - manual review required',
                issues: ['AI analysis temporarily unavailable'],
                severity: 'medium',
                suggestedQuestions: [],
                recommendations: 'Please review the submitted materials manually',
                readyToQuote: false,
                confidence: 0,
                analyzedAt: new Date().toISOString(),
                photoCount: 0,
                photosAnalyzed: 0,
                videoCount: 0,
                usedVision: false,
                isError: true,
                errorMessage: error.message || 'Unknown error'
            },
            warning: 'AI analysis encountered an error, showing basic summary'
        });
    }
}

// ============================================
// BUILD ANALYSIS PROMPT
// ============================================
function buildAnalysisPrompt({ photos, videos, description, answers, prompts, jobCategory, propertyType, imageCount }) {
    // Build context from answers
    const answersContext = Object.entries(answers)
        .map(([promptId, answer]) => {
            const prompt = prompts.find(p => p.id === promptId);
            const question = prompt?.question || prompt?.label || 'Question';
            return `Q: ${question}\nA: ${answer}`;
        })
        .join('\n\n');

    const videoContext = videos.length > 0
        ? `\nVIDEOS SUBMITTED: ${videos.length} video(s) provided (not analyzed, contractor should review)`
        : '';

    // Note about photos that weren't analyzed
    const extraPhotosNote = photos.length > imageCount
        ? `\nNote: ${photos.length - imageCount} additional photo(s) were submitted but not analyzed. Contractor should review all photos.`
        : '';

    return `You are an expert home service analyst helping contractors quickly understand customer problems.

TASK: Analyze this home service evaluation request and provide a structured summary.
${imageCount > 0 ? `\nIMPORTANT: You have been provided ${imageCount} actual photo(s) of the issue. Carefully examine the images to identify visible problems, damage, wear, or conditions that need attention.` : ''}

${jobCategory ? `SERVICE CATEGORY: ${jobCategory}` : ''}
${propertyType ? `PROPERTY TYPE: ${propertyType}` : ''}

CUSTOMER'S PROBLEM DESCRIPTION:
${description || 'No description provided'}

${answersContext ? `CUSTOMER'S ANSWERS TO QUESTIONS:\n${answersContext}` : ''}
${videoContext}
${extraPhotosNote}

Based on ALL the information provided (especially the photos if available), generate a JSON response with this exact structure:
{
    "summary": "A clear 2-3 sentence summary of the problem that a contractor can quickly read. If you analyzed photos, describe what you observed.",
    "issues": [
        "Specific issue 1 identified from photos/description",
        "Specific issue 2 if applicable",
        "Specific issue 3 if applicable"
    ],
    "severity": "low|medium|high|urgent",
    "suggestedQuestions": [
        "Question the contractor might want to ask before quoting",
        "Another clarifying question if needed"
    ],
    "recommendations": "Brief recommendation on next steps (e.g., 'Site visit recommended to assess hidden damage' or 'Photos show enough detail to provide estimate')",
    "readyToQuote": true or false,
    "confidence": 0.0 to 1.0 (how confident you are in this assessment based on photo quality and information provided)
}

SEVERITY GUIDE:
- "low": Cosmetic issues, minor inconveniences, routine maintenance
- "medium": Functional problems that should be addressed but aren't emergencies
- "high": Issues that could worsen significantly if not addressed soon
- "urgent": Safety hazards, active leaks/damage, issues requiring immediate attention

Be specific about what you see in the photos. If you notice specific damage, discoloration, wear patterns, or conditions, describe them.
Focus on information that helps the contractor give an accurate quote.
Return ONLY the JSON object, no other text.`;
}

// ============================================
// PARSE TEXT RESPONSE (Fallback)
// ============================================
function parseTextResponse(text) {
    // Try to extract meaningful content from unstructured response
    const lines = text.split('\n').filter(l => l.trim());

    return {
        summary: lines[0] || 'Analysis completed',
        issues: lines.slice(1, 4).filter(l => l.length > 10),
        severity: SEVERITY_LEVELS.MEDIUM,
        suggestedQuestions: [],
        recommendations: 'Please review the submitted materials',
        readyToQuote: false,
        confidence: 0.5
    };
}

// ============================================
// BASIC SUMMARY (No AI Fallback)
// ============================================
function getBasicSummary(description, answers, photoCount) {
    const answerCount = Object.keys(answers).length;
    const hasDescription = description && description.length > 10;

    let summary = 'Customer has submitted an evaluation request';
    if (hasDescription) {
        // Take first 200 chars of description
        summary = description.substring(0, 200) + (description.length > 200 ? '...' : '');
    }

    const issues = [];
    if (photoCount > 0) issues.push(`${photoCount} photo(s) provided for review`);
    if (answerCount > 0) issues.push(`${answerCount} question(s) answered`);
    if (hasDescription) issues.push('Problem description provided');

    return {
        summary,
        issues,
        severity: SEVERITY_LEVELS.MEDIUM,
        suggestedQuestions: [
            'Review the submitted photos carefully',
            'Consider if a site visit is needed for accurate quoting'
        ],
        recommendations: 'Review all submitted materials before creating quote',
        readyToQuote: photoCount >= 2 && hasDescription,
        confidence: 0.5,
        analyzedAt: new Date().toISOString(),
        photoCount,
        photosAnalyzed: 0,
        videoCount: 0,
        isBasicSummary: true,
        usedVision: false
    };
}
