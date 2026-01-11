// api/analyze-evaluation.js
// ============================================
// AI EVALUATION ANALYSIS API
// ============================================
// Analyzes homeowner-submitted photos and descriptions
// to generate a smart summary for contractors.
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
        videos = [],           // Array of { url, name } (we'll note these but not analyze)
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
            return res.status(200).json(getBasicSummary(description, answers, photos.length));
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Build the analysis prompt
        const prompt = buildAnalysisPrompt({
            photos,
            videos,
            description,
            answers,
            prompts,
            jobCategory,
            propertyType
        });

        // If we have photo URLs, we need to fetch and convert them
        // For now, we'll analyze based on descriptions and any captions
        // In a production system, you'd fetch the images and send as base64
        
        const result = await model.generateContent(prompt);
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
            videoCount: videos.length
        };

        console.log('[analyze-evaluation] Analysis complete:', {
            severity: sanitizedAnalysis.severity,
            issueCount: sanitizedAnalysis.issues.length,
            readyToQuote: sanitizedAnalysis.readyToQuote
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
function buildAnalysisPrompt({ photos, videos, description, answers, prompts, jobCategory, propertyType }) {
    // Build context from answers
    const answersContext = Object.entries(answers)
        .map(([promptId, answer]) => {
            const prompt = prompts.find(p => p.id === promptId);
            const question = prompt?.question || prompt?.label || 'Question';
            return `Q: ${question}\nA: ${answer}`;
        })
        .join('\n\n');

    // Build photo descriptions
    const photoContext = photos.length > 0
        ? `\nPHOTOS SUBMITTED (${photos.length}):\n` + photos.map((p, i) => 
            `- Photo ${i + 1}: ${p.caption || p.name || 'No description'}`
          ).join('\n')
        : '';

    const videoContext = videos.length > 0
        ? `\nVIDEOS SUBMITTED: ${videos.length} video(s) provided`
        : '';

    return `You are an expert home service analyst helping contractors quickly understand customer problems.

TASK: Analyze this home service evaluation request and provide a structured summary.

${jobCategory ? `SERVICE CATEGORY: ${jobCategory}` : ''}
${propertyType ? `PROPERTY TYPE: ${propertyType}` : ''}

CUSTOMER'S PROBLEM DESCRIPTION:
${description || 'No description provided'}

${answersContext ? `CUSTOMER'S ANSWERS TO QUESTIONS:\n${answersContext}` : ''}
${photoContext}
${videoContext}

Based on all the information provided, generate a JSON response with this exact structure:
{
    "summary": "A clear 2-3 sentence summary of the problem that a contractor can quickly read",
    "issues": [
        "Issue 1 identified from the description/photos",
        "Issue 2 if applicable",
        "Issue 3 if applicable"
    ],
    "severity": "low|medium|high|urgent",
    "suggestedQuestions": [
        "Question the contractor might want to ask before quoting",
        "Another clarifying question if needed"
    ],
    "recommendations": "Brief recommendation on next steps (e.g., 'Site visit recommended to assess damage' or 'Can likely quote from photos')",
    "readyToQuote": true or false,
    "confidence": 0.0 to 1.0 (how confident you are in this assessment)
}

SEVERITY GUIDE:
- "low": Cosmetic issues, minor inconveniences, routine maintenance
- "medium": Functional problems that should be addressed but aren't emergencies
- "high": Issues that could worsen significantly if not addressed soon
- "urgent": Safety hazards, active leaks/damage, issues requiring immediate attention

Be helpful and concise. Focus on information that helps the contractor give an accurate quote.
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
        videoCount: 0,
        isBasicSummary: true
    };
}
