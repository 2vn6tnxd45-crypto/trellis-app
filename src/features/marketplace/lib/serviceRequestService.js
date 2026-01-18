// src/features/marketplace/lib/serviceRequestService.js
// ============================================
// SERVICE REQUEST SERVICE (MARKETPLACE LEADS)
// ============================================
// Handles "send up a flare" functionality - homeowners broadcast
// service needs to matching contractors in the marketplace.
// FREE tier - ad-supported model, no lead fees.

import {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    query, where, orderBy, limit, serverTimestamp, arrayUnion, increment,
    onSnapshot, Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../config/firebase';
import { appId } from '../../../config/constants';
import { updateResponseMetrics } from './contractorMarketplaceService';
import { compressImage } from '../../../lib/images';

// ============================================
// CONSTANTS
// ============================================

export const SERVICE_CATEGORIES = [
    { id: 'hvac', label: 'HVAC / Heating & Cooling', icon: 'Thermometer' },
    { id: 'plumbing', label: 'Plumbing', icon: 'Droplet' },
    { id: 'electrical', label: 'Electrical', icon: 'Zap' },
    { id: 'roofing', label: 'Roofing', icon: 'Home' },
    { id: 'appliance', label: 'Appliance Repair', icon: 'Refrigerator' },
    { id: 'landscaping', label: 'Landscaping / Lawn', icon: 'Trees' },
    { id: 'painting', label: 'Painting', icon: 'Paintbrush' },
    { id: 'flooring', label: 'Flooring', icon: 'Grid3x3' },
    { id: 'carpentry', label: 'Carpentry / Woodwork', icon: 'Hammer' },
    { id: 'windows', label: 'Windows & Doors', icon: 'DoorOpen' },
    { id: 'garage', label: 'Garage Door', icon: 'Car' },
    { id: 'pest', label: 'Pest Control', icon: 'Bug' },
    { id: 'cleaning', label: 'Cleaning Services', icon: 'Sparkles' },
    { id: 'pool', label: 'Pool / Spa', icon: 'Waves' },
    { id: 'security', label: 'Security / Smart Home', icon: 'Shield' },
    { id: 'handyman', label: 'General Handyman', icon: 'Wrench' },
    { id: 'other', label: 'Other', icon: 'HelpCircle' }
];

export const URGENCY_LEVELS = {
    EMERGENCY: 'emergency',      // Same day
    THIS_WEEK: 'this_week',      // Within 7 days
    FLEXIBLE: 'flexible'         // 2+ weeks out, no rush
};

export const REQUEST_STATUS = {
    DRAFT: 'draft',              // Homeowner still editing
    OPEN: 'open',                // Live, accepting responses
    REVIEWING: 'reviewing',      // Homeowner reviewing bids
    SELECTED: 'selected',        // Contractor chosen
    SCHEDULED: 'scheduled',      // Converted to job
    COMPLETED: 'completed',      // Work done
    EXPIRED: 'expired',          // No response / timed out
    CANCELLED: 'cancelled'       // Homeowner cancelled
};

export const VISIBILITY_TYPES = {
    BROADCAST: 'broadcast',      // Visible to all matching contractors
    INVITED: 'invited',          // Only invited contractors can see
    PRIVATE: 'private'           // Hidden (draft or completed)
};

// Default expiration periods by urgency
export const EXPIRATION_DAYS = {
    [URGENCY_LEVELS.EMERGENCY]: 2,
    [URGENCY_LEVELS.THIS_WEEK]: 7,
    [URGENCY_LEVELS.FLEXIBLE]: 14
};

// ============================================
// COLLECTION PATHS
// ============================================

// Global service requests (browsable by contractors)
const getServiceRequestsPath = () => 
    `artifacts/${appId}/public/data/serviceRequests`;

// Per-homeowner requests (for their dashboard)
const getUserRequestsPath = (userId) => 
    `artifacts/${appId}/users/${userId}/serviceRequests`;

// Contractor responses subcollection
const getResponsesPath = (requestId) =>
    `artifacts/${appId}/public/data/serviceRequests/${requestId}/responses`;

// ============================================
// UPLOAD SERVICE REQUEST PHOTO
// ============================================
export const uploadServiceRequestPhoto = async (userId, file) => {
    try {
        // Compress image before upload
        const compressedFile = await compressImage(file, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.8
        });

        // Create unique filename
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `service-requests/${userId}/${timestamp}_${safeName}`;

        // Upload to Firebase Storage
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, compressedFile);

        // Get download URL
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
    } catch (error) {
        console.error('Failed to upload service request photo:', error);
        throw new Error('Failed to upload photo. Please try again.');
    }
};

// ============================================
// CREATE SERVICE REQUEST
// ============================================

export const createServiceRequest = async (homeownerId, requestData) => {
    try {
        const requestsRef = collection(db, getServiceRequestsPath());
        const newRequestRef = doc(requestsRef);
        
        // Calculate expiration based on urgency
        const expiresAt = new Date();
        const expirationDays = EXPIRATION_DAYS[requestData.urgency] || 7;
        expiresAt.setDate(expiresAt.getDate() + expirationDays);
        
        const serviceRequest = {
            id: newRequestRef.id,
            homeownerId,
            propertyId: requestData.propertyId || null,
            
            // Request details
            category: requestData.category,
            title: requestData.title,
            description: requestData.description || '',
            photos: requestData.photos || [],
            
            // Location (for matching)
            zipCode: requestData.zipCode,
            city: requestData.city || '',
            state: requestData.state || '',
            
            // Urgency & timing
            urgency: requestData.urgency || URGENCY_LEVELS.FLEXIBLE,
            preferredTimes: requestData.preferredTimes || [],
            
            // Budget (optional - homeowner can choose to share)
            budgetRange: requestData.budgetRange || null, // { min: null, max: 500 }
            showBudget: requestData.showBudget ?? false,
            
            // Requirements (self-attestation filters)
            requirements: {
                mustBeInsured: requestData.mustBeInsured ?? false,
                mustBeLicensed: requestData.mustBeLicensed ?? false,
                mustBeLocal: requestData.mustBeLocal ?? true, // Within travel radius
                minYearsExperience: requestData.minYearsExperience || 0,
                minRating: requestData.minRating || 0
            },
            
            // Visibility & status
            status: REQUEST_STATUS.OPEN,
            visibility: requestData.visibility || VISIBILITY_TYPES.BROADCAST,
            
            // Invited contractors (for invited_only visibility)
            invitedContractorIds: requestData.invitedContractorIds || [],
            
            // Metrics
            viewCount: 0,
            responseCount: 0,
            
            // Timestamps
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            expiresAt: Timestamp.fromDate(expiresAt),
            
            // Outcome tracking
            selectedContractorId: null,
            selectedAt: null,
            convertedToJobId: null,
            
            // Homeowner contact preferences
            contactPreferences: {
                allowCalls: requestData.allowCalls ?? true,
                allowTexts: requestData.allowTexts ?? true,
                allowMessages: requestData.allowMessages ?? true,
                preferredMethod: requestData.preferredMethod || 'message'
            }
        };
        
        // Save to global collection
        await setDoc(newRequestRef, serviceRequest);
        
        // Also save reference in user's collection for their dashboard
        const userRequestRef = doc(db, getUserRequestsPath(homeownerId), newRequestRef.id);
        await setDoc(userRequestRef, {
            requestId: newRequestRef.id,
            category: requestData.category,
            title: requestData.title,
            status: REQUEST_STATUS.OPEN,
            responseCount: 0,
            createdAt: serverTimestamp()
        });
        
        return { success: true, requestId: newRequestRef.id, request: serviceRequest };
    } catch (error) {
        console.error('Error creating service request:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// GET SERVICE REQUESTS (FOR CONTRACTORS)
// ============================================

export const getOpenRequestsForContractor = async (contractorProfile, options = {}) => {
    try {
        const { limitCount = 20, category = null } = options;
        
        // Build query for open, broadcast requests
        let q = query(
            collection(db, getServiceRequestsPath()),
            where('status', '==', REQUEST_STATUS.OPEN),
            where('visibility', '==', VISIBILITY_TYPES.BROADCAST),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        const requests = [];
        
        snapshot.forEach(doc => {
            const request = doc.data();
            
            // Client-side filtering based on contractor profile
            if (matchesContractor(request, contractorProfile, category)) {
                requests.push(request);
            }
        });
        
        return { success: true, requests };
    } catch (error) {
        console.error('Error fetching service requests:', error);
        return { success: false, error: error.message, requests: [] };
    }
};

// Match request to contractor based on profile
const matchesContractor = (request, contractor, categoryFilter) => {
    // Category filter
    if (categoryFilter && request.category !== categoryFilter) {
        return false;
    }
    
    // Trade/specialty match
    const contractorTrades = contractor.trades || contractor.specialties || [];
    if (contractorTrades.length > 0 && !contractorTrades.includes(request.category)) {
        // Allow 'handyman' to see all
        if (!contractorTrades.includes('handyman')) {
            return false;
        }
    }
    
    // Location match (zip code + travel radius)
    if (request.requirements?.mustBeLocal && contractor.homeZip && contractor.maxTravel) {
        const distance = estimateZipDistance(request.zipCode, contractor.homeZip);
        if (distance > contractor.maxTravel) {
            return false;
        }
    }
    
    // Requirements match (self-attestation)
    if (request.requirements?.mustBeInsured && !contractor.insured) {
        return false;
    }
    if (request.requirements?.mustBeLicensed && !contractor.licensed) {
        return false;
    }
    if (request.requirements?.minYearsExperience > (contractor.yearsInBusiness || 0)) {
        return false;
    }
    if (request.requirements?.minRating > (contractor.averageRating || 0)) {
        return false;
    }
    
    return true;
};

// Simple zip code distance estimate (placeholder - would use real geo in production)
const estimateZipDistance = (zip1, zip2) => {
    // For MVP, just check if first 3 digits match (same area)
    if (!zip1 || !zip2) return 0;
    const prefix1 = zip1.toString().substring(0, 3);
    const prefix2 = zip2.toString().substring(0, 3);
    return prefix1 === prefix2 ? 10 : 50; // Same area = ~10 miles, different = ~50
};

// ============================================
// SUBSCRIBE TO REQUESTS (REAL-TIME)
// ============================================

export const subscribeToOpenRequests = (contractorProfile, callback) => {
    const q = query(
        collection(db, getServiceRequestsPath()),
        where('status', '==', REQUEST_STATUS.OPEN),
        where('visibility', '==', VISIBILITY_TYPES.BROADCAST),
        orderBy('createdAt', 'desc'),
        limit(50)
    );
    
    return onSnapshot(q, (snapshot) => {
        const requests = [];
        snapshot.forEach(doc => {
            const request = doc.data();
            if (matchesContractor(request, contractorProfile, null)) {
                requests.push(request);
            }
        });
        callback(requests);
    });
};

// ============================================
// GET HOMEOWNER'S REQUESTS
// ============================================

export const getHomeownerRequests = async (homeownerId) => {
    try {
        const q = query(
            collection(db, getServiceRequestsPath()),
            where('homeownerId', '==', homeownerId),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const requests = [];
        snapshot.forEach(doc => requests.push(doc.data()));
        
        return { success: true, requests };
    } catch (error) {
        console.error('Error fetching homeowner requests:', error);
        return { success: false, error: error.message, requests: [] };
    }
};

// ============================================
// CONTRACTOR RESPONSE TO REQUEST
// ============================================

export const submitContractorResponse = async (requestId, contractorId, responseData) => {
    try {
        // Get the request first
        const requestRef = doc(db, getServiceRequestsPath(), requestId);
        const requestSnap = await getDoc(requestRef);
        
        if (!requestSnap.exists()) {
            return { success: false, error: 'Request not found' };
        }
        
        const request = requestSnap.data();
        
        if (request.status !== REQUEST_STATUS.OPEN) {
            return { success: false, error: 'Request is no longer accepting responses' };
        }
        
        // Create response in subcollection
        const responsesRef = collection(db, getResponsesPath(requestId));
        const responseRef = doc(responsesRef, contractorId); // Use contractorId as doc ID to prevent duplicates
        
        const response = {
            id: responseRef.id,
            requestId,
            contractorId,
            
            // Response content
            message: responseData.message || '',
            estimateRange: responseData.estimateRange || null, // { min: 200, max: 400 }
            estimateType: responseData.estimateType || 'range', // 'range', 'fixed', 'need_evaluation'
            
            // Availability
            availableDates: responseData.availableDates || [],
            canDoEmergency: responseData.canDoEmergency ?? false,
            estimatedDuration: responseData.estimatedDuration || null, // '2-3 hours'
            
            // Contractor snapshot (for display without extra queries)
            contractorSnapshot: {
                name: responseData.contractorName || '',
                businessName: responseData.businessName || '',
                phone: responseData.phone || '',
                email: responseData.email || '',
                averageRating: responseData.averageRating || null,
                reviewCount: responseData.reviewCount || 0,
                yearsInBusiness: responseData.yearsInBusiness || null,
                insured: responseData.insured ?? false,
                licensed: responseData.licensed ?? false,
                photoUrl: responseData.photoUrl || null
            },
            
            // Status
            status: 'pending', // pending, viewed, selected, declined
            
            // Timestamps
            createdAt: serverTimestamp(),
            viewedAt: null,
            selectedAt: null
        };
        
        await setDoc(responseRef, response);

        // Update request response count
        await updateDoc(requestRef, {
            responseCount: increment(1),
            updatedAt: serverTimestamp()
        });

        // Calculate response time and update contractor metrics
        try {
            const requestCreatedAt = request.createdAt?.toDate?.() || new Date(request.createdAt);
            const responseTime = new Date();
            const hoursToRespond = (responseTime - requestCreatedAt) / (1000 * 60 * 60);

            // Only track if response was within reasonable time (< 7 days)
            if (hoursToRespond > 0 && hoursToRespond < 168) {
                await updateResponseMetrics(contractorId, hoursToRespond);
            }
        } catch (metricsError) {
            // Non-critical - log but don't fail the response
            console.warn('Failed to update response metrics:', metricsError);
        }

        return { success: true, responseId: responseRef.id };
    } catch (error) {
        console.error('Error submitting response:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// GET RESPONSES FOR REQUEST
// ============================================

export const getRequestResponses = async (requestId) => {
    try {
        const q = query(
            collection(db, getResponsesPath(requestId)),
            orderBy('createdAt', 'asc')
        );
        
        const snapshot = await getDocs(q);
        const responses = [];
        snapshot.forEach(doc => responses.push(doc.data()));
        
        return { success: true, responses };
    } catch (error) {
        console.error('Error fetching responses:', error);
        return { success: false, error: error.message, responses: [] };
    }
};

// ============================================
// SELECT CONTRACTOR
// ============================================

export const selectContractor = async (requestId, contractorId, homeownerId) => {
    try {
        const requestRef = doc(db, getServiceRequestsPath(), requestId);
        const requestSnap = await getDoc(requestRef);
        
        if (!requestSnap.exists()) {
            return { success: false, error: 'Request not found' };
        }
        
        const request = requestSnap.data();
        
        if (request.homeownerId !== homeownerId) {
            return { success: false, error: 'Unauthorized' };
        }
        
        // Update request
        await updateDoc(requestRef, {
            status: REQUEST_STATUS.SELECTED,
            selectedContractorId: contractorId,
            selectedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // Update the winning response
        const responseRef = doc(db, getResponsesPath(requestId), contractorId);
        await updateDoc(responseRef, {
            status: 'selected',
            selectedAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error selecting contractor:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// INCREMENT VIEW COUNT
// ============================================

export const incrementRequestView = async (requestId) => {
    try {
        const requestRef = doc(db, getServiceRequestsPath(), requestId);
        await updateDoc(requestRef, {
            viewCount: increment(1)
        });
        return { success: true };
    } catch (error) {
        console.error('Error incrementing view:', error);
        return { success: false };
    }
};

// ============================================
// AUTO-EXPIRE OLD REQUESTS
// ============================================

/**
 * Check and expire any service requests past their expiration date
 * Call this on component mount to clean up stale data
 * @returns {object} - { success, expiredCount }
 */
export const expireOldRequests = async () => {
    try {
        const now = Timestamp.now();

        // Query for open requests that have expired
        const q = query(
            collection(db, getServiceRequestsPath()),
            where('status', '==', REQUEST_STATUS.OPEN),
            where('expiresAt', '<=', now)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { success: true, expiredCount: 0 };
        }

        // Expire each request
        const expirePromises = snapshot.docs.map(async (docSnap) => {
            const requestRef = doc(db, getServiceRequestsPath(), docSnap.id);
            await updateDoc(requestRef, {
                status: REQUEST_STATUS.EXPIRED,
                visibility: VISIBILITY_TYPES.PRIVATE,
                updatedAt: serverTimestamp()
            });
        });

        await Promise.all(expirePromises);

        console.log(`Auto-expired ${snapshot.size} old service requests`);
        return { success: true, expiredCount: snapshot.size };
    } catch (error) {
        console.error('Error expiring old requests:', error);
        return { success: false, expiredCount: 0, error: error.message };
    }
};

// ============================================
// CANCEL/EXPIRE REQUEST
// ============================================

export const cancelRequest = async (requestId, homeownerId) => {
    try {
        const requestRef = doc(db, getServiceRequestsPath(), requestId);
        const requestSnap = await getDoc(requestRef);
        
        if (!requestSnap.exists()) {
            return { success: false, error: 'Request not found' };
        }
        
        if (requestSnap.data().homeownerId !== homeownerId) {
            return { success: false, error: 'Unauthorized' };
        }
        
        await updateDoc(requestRef, {
            status: REQUEST_STATUS.CANCELLED,
            visibility: VISIBILITY_TYPES.PRIVATE,
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error cancelling request:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// CONVERT TO JOB
// ============================================

export const linkToJob = async (requestId, jobId) => {
    try {
        const requestRef = doc(db, getServiceRequestsPath(), requestId);
        await updateDoc(requestRef, {
            status: REQUEST_STATUS.SCHEDULED,
            convertedToJobId: jobId,
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error linking to job:', error);
        return { success: false, error: error.message };
    }
};

export default {
    SERVICE_CATEGORIES,
    URGENCY_LEVELS,
    REQUEST_STATUS,
    createServiceRequest,
    getOpenRequestsForContractor,
    subscribeToOpenRequests,
    getHomeownerRequests,
    submitContractorResponse,
    getRequestResponses,
    selectContractor,
    incrementRequestView,
    expireOldRequests,
    cancelRequest,
    linkToJob
};
