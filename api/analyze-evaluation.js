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
// FETCH IMAGE AS BASE64
// ============================================
async function fetchImageAsBase64(url, timeoutMs = 10000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'image/*' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        return {
            inlineData: {
                mimeType: contentType,
                data: base64
            }
        };
    } catch (error) {
        console.warn(`[analyze-evaluation] Failed to fetch image: ${error.message}`);
        return null;
    }
}

// ============================================
// MAIN HANDLER
// ============================================
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        photos = [],           // Array of { url, name, caption }
        videos = [],           // Array of { url, name } (noted but not analyzed)
        description = '',      // Main problem description from homeowner
        answers = {},          // Answers to contractor's prompts { promptId: answer }
        prompts = [],          // Original prompts for context
        jobCategory = '',      // e.g., "Plumbing", "HVAC"
        propertyType = ''      // e.g., "Single Family Home"
    } = req.body;

    // Validate we have something to analyze
    if (photos.length === 0 && !description && Object.keys(answers).length === 0) {
        return res.status(400).json({
            error: 'No content to analyze. Provide photos, description, or answers.'
        });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.warn('[analyze-evaluation] No Gemini API key - returning basic summary');
            return res.status(200).json({
                success: true,
                analysis: getBasicSummary(description, answers, photos.length),
                warning: 'AI analysis unavailable (no API key)'
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Fetch actual images for vision analysis (limit to first 5 for performance)
        const photosToAnalyze = photos.slice(0, 5);
        console.log(`[analyze-evaluation] Fetching ${photosToAnalyze.length} images for vision analysis...`);

        const imagePromises = photosToAnalyze.map(photo => fetchImageAsBase64(photo.url));
        const imageResults = await Promise.all(imagePromises);
        const validImages = imageResults.filter(img => img !== null);

        console.log(`[analyze-evaluation] Successfully fetched ${validImages.length}/${photosToAnalyze.length} images`);

        // Build the text prompt
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

        // Build multimodal content array
        const contentParts = [];

        // Add images first (Gemini processes them in order)
        if (validImages.length > 0) {
            contentParts.push({ text: `I'm providing ${validImages.length} photo(s) of the issue. Please analyze them carefully:\n\n` });
            validImages.forEach((img, idx) => {
                contentParts.push(img);
                const caption = photosToAnalyze[idx]?.caption || photosToAnalyze[idx]?.name || '';
                if (caption) {
                    contentParts.push({ text: `\n[Photo ${idx + 1} caption: ${caption}]\n` });
                }
            });
            contentParts.push({ text: '\n\n' });
        }

        // Add the main analysis prompt
        contentParts.push({ text: textPrompt });

        // Generate content with vision
        const result = await model.generateContent(contentParts);
        const responseText = result.response.text();

        // Parse the AI response
        let analysis;
        try {
            // Try to extract JSON from the response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                // If no JSON, create structured response from text
                analysis = parseTextResponse(responseText);
            }
        } catch (parseError) {
            console.warn('[analyze-evaluation] Could not parse AI response as JSON:', parseError);
            analysis = parseTextResponse(responseText);
        }

        // Ensure required fields exist
        const sanitizedAnalysis = {
            summary: analysis.summary || 'Unable to generate summary',
            issues: Array.isArray(analysis.issues) ? analysis.issues : [],
            severity: Object.values(SEVERITY_LEVELS).includes(analysis.severity)
                ? analysis.severity
                : SEVERITY_LEVELS.MEDIUM,
            suggestedQuestions: Array.isArray(analysis.suggestedQuestions)
                ? analysis.suggestedQuestions
                : [],
            recommendations: analysis.recommendations || '',
            readyToQuote: typeof analysis.readyToQuote === 'boolean'
                ? analysis.readyToQuote
                : false,
            confidence: typeof analysis.confidence === 'number'
                ? analysis.confidence
                : 0.7,
            analyzedAt: new Date().toISOString(),
            photoCount: photos.length,
            photosAnalyzed: validImages.length,
            videoCount: videos.length,
            usedVision: validImages.length > 0
        };

        console.log('[analyze-evaluation] Analysis complete:', {
            severity: sanitizedAnalysis.severity,
            issueCount: sanitizedAnalysis.issues.length,
            readyToQuote: sanitizedAnalysis.readyToQuote,
            photosAnalyzed: sanitizedAnalysis.photosAnalyzed
        });

        return res.status(200).json({
            success: true,
            analysis: sanitizedAnalysis
        });

    } catch (error) {
        console.error('[analyze-evaluation] Error:', error);

        // Return a graceful fallback
        return res.status(200).json({
            success: true,
            analysis: getBasicSummary(description, answers, photos.length),
            warning: 'AI analysis unavailable, showing basic summary'
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
