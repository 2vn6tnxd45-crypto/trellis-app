// src/features/evaluations/lib/evaluationAI.js
// ============================================
// EVALUATION AI HELPERS
// ============================================
// Client-side utilities for AI-powered evaluation analysis

import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { appId } from '../../../config/constants';

// ============================================
// CONSTANTS
// ============================================

export const SEVERITY_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium', 
    HIGH: 'high',
    URGENT: 'urgent'
};

export const SEVERITY_CONFIG = {
    [SEVERITY_LEVELS.LOW]: {
        label: 'Low Priority',
        color: 'slate',
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-600',
        borderClass: 'border-slate-200',
        description: 'Cosmetic or minor issue'
    },
    [SEVERITY_LEVELS.MEDIUM]: {
        label: 'Medium Priority',
        color: 'amber',
        bgClass: 'bg-amber-100',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
        description: 'Should be addressed soon'
    },
    [SEVERITY_LEVELS.HIGH]: {
        label: 'High Priority',
        color: 'orange',
        bgClass: 'bg-orange-100',
        textClass: 'text-orange-700',
        borderClass: 'border-orange-200',
        description: 'Needs prompt attention'
    },
    [SEVERITY_LEVELS.URGENT]: {
        label: 'Urgent',
        color: 'red',
        bgClass: 'bg-red-100',
        textClass: 'text-red-700',
        borderClass: 'border-red-200',
        description: 'Requires immediate attention'
    }
};

// ============================================
// ANALYZE EVALUATION
// ============================================

/**
 * Call the AI analysis API to analyze evaluation submissions
 * 
 * @param {Object} params
 * @param {Array} params.photos - Array of { url, name, caption }
 * @param {Array} params.videos - Array of { url, name }
 * @param {string} params.description - Main problem description
 * @param {Object} params.answers - Answers to prompts { promptId: answer }
 * @param {Array} params.prompts - Original prompts for context
 * @param {string} params.jobCategory - Category like "Plumbing"
 * @param {string} params.propertyType - Property type
 * @returns {Promise<Object>} Analysis result
 */
export async function analyzeEvaluation({
    photos = [],
    videos = [],
    description = '',
    answers = {},
    prompts = [],
    jobCategory = '',
    propertyType = ''
}) {
    try {
        const response = await fetch('/api/analyze-evaluation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                photos,
                videos,
                description,
                answers,
                prompts,
                jobCategory,
                propertyType
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Analysis failed');
        }

        return {
            success: true,
            analysis: data.analysis,
            warning: data.warning || null
        };

    } catch (error) {
        console.error('[evaluationAI] Analysis error:', error);
        
        // Return a fallback analysis
        return {
            success: false,
            error: error.message,
            analysis: {
                summary: description || 'Evaluation submitted - manual review required',
                issues: photos.length > 0 ? [`${photos.length} photo(s) submitted for review`] : [],
                severity: SEVERITY_LEVELS.MEDIUM,
                suggestedQuestions: [],
                recommendations: 'Please review the submitted materials manually',
                readyToQuote: false,
                confidence: 0,
                isError: true
            }
        };
    }
}

// ============================================
// SAVE ANALYSIS TO EVALUATION
// ============================================

/**
 * Save AI analysis to the evaluation document in Firestore
 * 
 * @param {string} contractorId 
 * @param {string} evaluationId 
 * @param {Object} analysis 
 */
export async function saveAnalysisToEvaluation(contractorId, evaluationId, analysis) {
    try {
        const evalRef = doc(
            db, 
            'artifacts', appId, 
            'public', 'data',
            'contractors', contractorId, 
            'evaluations', evaluationId
        );

        await updateDoc(evalRef, {
            aiAnalysis: {
                ...analysis,
                savedAt: new Date().toISOString()
            },
            updatedAt: serverTimestamp()
        });

        return { success: true };

    } catch (error) {
        console.error('[evaluationAI] Error saving analysis:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// ANALYZE AND SAVE (Combined)
// ============================================

/**
 * Analyze evaluation and save results to Firestore
 * Call this after homeowner submits their evaluation
 * 
 * @param {string} contractorId 
 * @param {string} evaluationId 
 * @param {Object} submissionData - The data being submitted
 * @param {Object} evaluationContext - Context from the evaluation request
 */
export async function analyzeAndSaveEvaluation(
    contractorId, 
    evaluationId, 
    submissionData,
    evaluationContext = {}
) {
    // Run analysis
    const { success, analysis, warning } = await analyzeEvaluation({
        photos: submissionData.photos || [],
        videos: submissionData.videos || [],
        description: evaluationContext.jobDescription || '',
        answers: submissionData.answers || {},
        prompts: evaluationContext.prompts || [],
        jobCategory: evaluationContext.jobCategory || '',
        propertyType: evaluationContext.propertyType || ''
    });

    if (success) {
        // Save to Firestore
        await saveAnalysisToEvaluation(contractorId, evaluationId, analysis);
    }

    return { success, analysis, warning };
}

// ============================================
// UTILITY: GET SEVERITY BADGE PROPS
// ============================================

export function getSeverityConfig(severity) {
    return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG[SEVERITY_LEVELS.MEDIUM];
}

// ============================================
// UTILITY: FORMAT CONFIDENCE
// ============================================

export function formatConfidence(confidence) {
    if (typeof confidence !== 'number') return 'Unknown';
    const percent = Math.round(confidence * 100);
    if (percent >= 80) return 'High confidence';
    if (percent >= 60) return 'Moderate confidence';
    if (percent >= 40) return 'Low confidence';
    return 'Very low confidence';
}
