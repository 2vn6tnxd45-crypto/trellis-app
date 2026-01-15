// src/features/evaluations/lib/evaluationService.js
// ============================================
// EVALUATION SERVICE
// ============================================
// Handles pre-quote evaluations (virtual & site visits)
// for jobs requiring assessment before accurate quoting.

import { 
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../config/firebase';
import { appId } from '../../../config/constants';

// ============================================
// CONSTANTS
// ============================================

export const EVALUATION_TYPES = {
    VIRTUAL: 'virtual',
    SITE_VISIT: 'site_visit'
};

export const EVALUATION_STATUS = {
    REQUESTED: 'requested',           // Contractor sent request
    MEDIA_PENDING: 'media_pending',   // Waiting for homeowner uploads (virtual)
    INFO_REQUESTED: 'info_requested', // Contractor asked for more info
    SCHEDULED: 'scheduled',           // Site visit or video call scheduled
    COMPLETED: 'completed',           // Evaluation done, ready to quote
    QUOTED: 'quoted',                 // Quote has been created
    EXPIRED: 'expired',               // Homeowner didn't respond in time
    CANCELLED: 'cancelled'
};

export const FEE_STATUS = {
    NOT_APPLICABLE: 'not_applicable', // Free evaluation
    PENDING: 'pending',               // Fee required, not paid
    PAID: 'paid',
    WAIVED: 'waived'                  // Waived because they hired
};

// Default expiration: 7 days
export const DEFAULT_EXPIRATION_DAYS = 7;

// ============================================
// COLLECTION PATH
// ============================================

const getEvaluationsPath = (contractorId) => 
    `artifacts/${appId}/public/data/contractors/${contractorId}/evaluations`;

// ============================================
// UPLOAD EVALUATION MEDIA TO STORAGE
// ============================================

export const uploadEvaluationFile = async (contractorId, evaluationId, file, type = 'photo') => {
    try {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `evaluations/${contractorId}/${evaluationId}/${type}s/${timestamp}_${sanitizedName}`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        return {
            url,
            name: file.name,
            size: file.size,
            type: file.type,
            storagePath,
            uploadedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Error uploading ${type}:`, error);
        throw error;
    }
};

// ============================================
// CREATE EVALUATION REQUEST
// ============================================

export const createEvaluationRequest = async (contractorId, evaluationData) => {
    try {
        const evaluationsRef = collection(db, getEvaluationsPath(contractorId));
        const newEvalRef = doc(evaluationsRef);
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (evaluationData.expirationDays || DEFAULT_EXPIRATION_DAYS));
        
        const evaluation = {
            id: newEvalRef.id,
            contractorId,
            
            // Customer info
            customerName: evaluationData.customerName || '',
            customerEmail: evaluationData.customerEmail || '',
            customerPhone: evaluationData.customerPhone || '',
            propertyAddress: evaluationData.propertyAddress || '',
            
            // Job details
            jobCategory: evaluationData.jobCategory || 'general',
            jobDescription: evaluationData.jobDescription || '',
            
            // Evaluation type
            type: evaluationData.type || EVALUATION_TYPES.VIRTUAL,
            
            // Fee structure
            fee: {
                amount: evaluationData.feeAmount || 0,
                waivedIfHired: evaluationData.feeWaivedIfHired || false,
                status: evaluationData.feeAmount > 0 ? FEE_STATUS.PENDING : FEE_STATUS.NOT_APPLICABLE
            },
            
            // Prompts for homeowner (virtual evaluations)
            prompts: evaluationData.prompts || [],
            
            // Scheduling (populated when scheduled)
            scheduling: {
                status: 'pending',
                scheduledFor: null,
                duration: evaluationData.estimatedDuration || 30,
                videoCallLink: null,
                confirmedAt: null
            },
            
            // Homeowner submissions (populated as they respond)
            submissions: {
                photos: [],
                videos: [],
                answers: {}
            },
            
            // Contractor findings (populated after review)
            findings: {
                notes: '',
                photos: [],
                recommendations: '',
                scopeAssessment: null,
                readyToQuote: false
            },
            
            // Communication thread for additional info requests
            messages: [],
            
            // Lifecycle
            status: EVALUATION_STATUS.REQUESTED,
            expiresAt: expiresAt,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            completedAt: null,
            
            // Result
            quoteId: null
        };
        
        await setDoc(newEvalRef, evaluation);
        
        return { evaluationId: newEvalRef.id, evaluation };
        
    } catch (error) {
        console.error('Error creating evaluation request:', error);
        throw error;
    }
};

// ============================================
// GET EVALUATION
// ============================================

export const getEvaluation = async (contractorId, evaluationId) => {
    try {
        const evalRef = doc(db, getEvaluationsPath(contractorId), evaluationId);
        const evalSnap = await getDoc(evalRef);
        
        if (!evalSnap.exists()) {
            return null;
        }
        
        return { id: evalSnap.id, ...evalSnap.data() };
        
    } catch (error) {
        console.error('Error getting evaluation:', error);
        throw error;
    }
};

// ============================================
// GET EVALUATIONS FOR CONTRACTOR
// ============================================

export const getContractorEvaluations = async (contractorId, statusFilter = null) => {
    try {
        const evaluationsRef = collection(db, getEvaluationsPath(contractorId));
        
        let q;
        if (statusFilter) {
            q = query(
                evaluationsRef,
                where('status', '==', statusFilter),
                orderBy('createdAt', 'desc')
            );
        } else {
            q = query(evaluationsRef, orderBy('createdAt', 'desc'));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
    } catch (error) {
        console.error('Error getting contractor evaluations:', error);
        throw error;
    }
};

// ============================================
// HOMEOWNER: SUBMIT MEDIA/ANSWERS
// ============================================

export const submitEvaluationMedia = async (contractorId, evaluationId, submissionData) => {
    try {
        const evalRef = doc(db, getEvaluationsPath(contractorId), evaluationId);
        const evalSnap = await getDoc(evalRef);
        
        if (!evalSnap.exists()) {
            throw new Error('Evaluation not found');
        }
        
        const evaluation = evalSnap.data();
        
        // Check if expired
        if (evaluation.expiresAt && new Date(evaluation.expiresAt.toDate()) < new Date()) {
            throw new Error('This evaluation request has expired');
        }
        
        // Merge new submissions with existing
        const updatedSubmissions = {
            photos: [
                ...(evaluation.submissions?.photos || []),
                ...(submissionData.photos || [])
            ],
            videos: [
                ...(evaluation.submissions?.videos || []),
                ...(submissionData.videos || [])
            ],
            answers: {
                ...(evaluation.submissions?.answers || {}),
                ...(submissionData.answers || {})
            }
        };
        
        await updateDoc(evalRef, {
            submissions: updatedSubmissions,
            status: EVALUATION_STATUS.MEDIA_PENDING,
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
        
    } catch (error) {
        console.error('Error submitting evaluation media:', error);
        throw error;
    }
};

// ============================================
// HOMEOWNER: MARK SUBMISSION COMPLETE
// ============================================

export const completeSubmission = async (contractorId, evaluationId, customerInfo = null) => {
    try {
        const evalRef = doc(db, getEvaluationsPath(contractorId), evaluationId);

        const updateData = {
            status: EVALUATION_STATUS.COMPLETED,
            'submissions.completedAt': serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // If customer info provided, link the homeowner to this evaluation
        // This is critical for quotes to appear on the homeowner's dashboard
        if (customerInfo?.customerId) {
            updateData.customerId = customerInfo.customerId;
            if (customerInfo.customerPropertyId) {
                updateData.customerPropertyId = customerInfo.customerPropertyId;
            }
            if (customerInfo.customerName) {
                updateData.customerName = customerInfo.customerName;
            }
            if (customerInfo.customerEmail) {
                updateData.customerEmail = customerInfo.customerEmail;
            }
        }

        await updateDoc(evalRef, updateData);

        return { success: true };

    } catch (error) {
        console.error('Error completing submission:', error);
        throw error;
    }
};

// ============================================
// HOMEOWNER: LINK CUSTOMER TO EVALUATION
// ============================================
// Call this after homeowner creates account or when they claim an evaluation
export const linkCustomerToEvaluation = async (contractorId, evaluationId, customerInfo) => {
    try {
        const evalRef = doc(db, getEvaluationsPath(contractorId), evaluationId);

        await updateDoc(evalRef, {
            customerId: customerInfo.customerId,
            customerPropertyId: customerInfo.customerPropertyId || null,
            customerName: customerInfo.customerName || null,
            customerEmail: customerInfo.customerEmail || null,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error linking customer to evaluation:', error);
        throw error;
    }
};

// ============================================
// CONTRACTOR: REQUEST ADDITIONAL INFO
// ============================================

export const requestAdditionalInfo = async (contractorId, evaluationId, message, additionalPrompts = []) => {
    try {
        const evalRef = doc(db, getEvaluationsPath(contractorId), evaluationId);
        const evalSnap = await getDoc(evalRef);
        
        if (!evalSnap.exists()) {
            throw new Error('Evaluation not found');
        }
        
        const evaluation = evalSnap.data();
        
        // Add message to thread
        const newMessage = {
            id: Date.now().toString(),
            from: 'contractor',
            message,
            additionalPrompts,
            createdAt: new Date().toISOString()
        };
        
        // Extend expiration by 3 days when requesting more info
        const newExpiration = new Date();
        newExpiration.setDate(newExpiration.getDate() + 3);
        
        await updateDoc(evalRef, {
            status: EVALUATION_STATUS.INFO_REQUESTED,
            messages: [...(evaluation.messages || []), newMessage],
            prompts: [...(evaluation.prompts || []), ...additionalPrompts],
            expiresAt: newExpiration,
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
        
    } catch (error) {
        console.error('Error requesting additional info:', error);
        throw error;
    }
};

// ============================================
// CONTRACTOR: SCHEDULE SITE VISIT / VIDEO CALL
// ============================================

export const scheduleEvaluation = async (contractorId, evaluationId, scheduleData) => {
    try {
        const evalRef = doc(db, getEvaluationsPath(contractorId), evaluationId);
        
        await updateDoc(evalRef, {
            'scheduling.status': 'scheduled',
            'scheduling.scheduledFor': scheduleData.scheduledFor,
            'scheduling.duration': scheduleData.duration || 30,
            'scheduling.videoCallLink': scheduleData.videoCallLink || null,
            'scheduling.confirmedAt': serverTimestamp(),
            status: EVALUATION_STATUS.SCHEDULED,
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
        
    } catch (error) {
        console.error('Error scheduling evaluation:', error);
        throw error;
    }
};

// ============================================
// CONTRACTOR: COMPLETE EVALUATION WITH FINDINGS
// ============================================

export const completeEvaluation = async (contractorId, evaluationId, findings) => {
    try {
        const evalRef = doc(db, getEvaluationsPath(contractorId), evaluationId);
        
        await updateDoc(evalRef, {
            findings: {
                notes: findings.notes || '',
                photos: findings.photos || [],
                recommendations: findings.recommendations || '',
                scopeAssessment: findings.scopeAssessment || 'as_expected',
                readyToQuote: true
            },
            status: EVALUATION_STATUS.COMPLETED,
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
        
    } catch (error) {
        console.error('Error completing evaluation:', error);
        throw error;
    }
};

// ============================================
// LINK QUOTE TO EVALUATION
// ============================================

export const linkQuoteToEvaluation = async (contractorId, evaluationId, quoteId) => {
    try {
        const evalRef = doc(db, getEvaluationsPath(contractorId), evaluationId);
        
        await updateDoc(evalRef, {
            quoteId,
            status: EVALUATION_STATUS.QUOTED,
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
        
    } catch (error) {
        console.error('Error linking quote to evaluation:', error);
        throw error;
    }
};

// ============================================
// CANCEL EVALUATION
// ============================================

export const cancelEvaluation = async (contractorId, evaluationId, reason = '') => {
    try {
        const evalRef = doc(db, getEvaluationsPath(contractorId), evaluationId);
        
        await updateDoc(evalRef, {
            status: EVALUATION_STATUS.CANCELLED,
            cancelledAt: serverTimestamp(),
            cancellationReason: reason,
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
        
    } catch (error) {
        console.error('Error cancelling evaluation:', error);
        throw error;
    }
};

// ============================================
// CHECK & MARK EXPIRED EVALUATIONS
// ============================================

export const checkExpiredEvaluations = async (contractorId) => {
    try {
        const evaluationsRef = collection(db, getEvaluationsPath(contractorId));
        const q = query(
            evaluationsRef,
            where('status', 'in', [
                EVALUATION_STATUS.REQUESTED,
                EVALUATION_STATUS.MEDIA_PENDING,
                EVALUATION_STATUS.INFO_REQUESTED
            ])
        );
        
        const snapshot = await getDocs(q);
        const now = new Date();
        const batch = writeBatch(db);
        let expiredCount = 0;
        
        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.expiresAt && data.expiresAt.toDate() < now) {
                batch.update(docSnap.ref, {
                    status: EVALUATION_STATUS.EXPIRED,
                    updatedAt: serverTimestamp()
                });
                expiredCount++;
            }
        });
        
        if (expiredCount > 0) {
            await batch.commit();
        }
        
        return { expiredCount };
        
    } catch (error) {
        console.error('Error checking expired evaluations:', error);
        throw error;
    }
};

// ============================================
// UTILITY: CALCULATE TIME REMAINING
// ============================================

export const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    
    const expiration = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
    const now = new Date();
    const diff = expiration - now;
    
    if (diff <= 0) {
        return { expired: true, display: 'Expired' };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
        return { 
            expired: false, 
            days, 
            hours, 
            display: `${days}d ${hours}h remaining`,
            urgent: days <= 1
        };
    } else if (hours > 0) {
        return { 
            expired: false, 
            days: 0, 
            hours, 
            minutes,
            display: `${hours}h ${minutes}m remaining`,
            urgent: true
        };
    } else {
        return { 
            expired: false, 
            days: 0, 
            hours: 0, 
            minutes,
            display: `${minutes}m remaining`,
            urgent: true
        };
    }
};

// ============================================
// UTILITY: PREPARE QUOTE DATA FROM EVALUATION
// ============================================

export const prepareQuoteFromEvaluation = (evaluation) => {
    return {
        // Link to homeowner if they've claimed the evaluation
        customerId: evaluation.customerId || null,
        propertyId: evaluation.customerPropertyId || null,
        
        // Pre-fill customer info (nested object format for QuoteBuilder)
        customer: {
            name: evaluation.customerName || '',
            email: evaluation.customerEmail || '',
            phone: evaluation.customerPhone || '',
            address: evaluation.propertyAddress || ''
        },
        
        // Also provide flat versions for backwards compatibility
        customerName: evaluation.customerName,
        customerEmail: evaluation.customerEmail,
        customerPhone: evaluation.customerPhone,
        propertyAddress: evaluation.propertyAddress,
        
        // Pre-fill job details
        jobCategory: evaluation.jobCategory,
        title: evaluation.jobDescription || '',
        description: [
            evaluation.jobDescription,
            evaluation.findings?.notes,
            evaluation.findings?.recommendations
        ].filter(Boolean).join('\n\n'),
        
        // Attach evaluation photos
        attachments: [
            ...(evaluation.submissions?.photos || []),
            ...(evaluation.findings?.photos || [])
        ],
        
        // Link back
        evaluationId: evaluation.id,
        
        // Fee credit (if applicable)
        evaluationFeeCredit: evaluation.fee?.status === FEE_STATUS.PAID && evaluation.fee?.waivedIfHired
            ? evaluation.fee.amount
            : 0
    };
};
