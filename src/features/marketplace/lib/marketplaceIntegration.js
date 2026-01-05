// src/features/marketplace/lib/marketplaceIntegration.js
// ============================================
// MARKETPLACE INTEGRATION SERVICE
// ============================================
// Connects marketplace selections to the job system
// Handles: contractor selection → job creation → linking

import { 
    doc, 
    addDoc, 
    updateDoc, 
    getDoc,
    collection, 
    serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { 
    REQUESTS_COLLECTION_PATH, 
    appId 
} from '../../../config/constants';
import { selectContractor, linkToJob } from './serviceRequestService';

// ============================================
// CREATE JOB FROM MARKETPLACE SELECTION
// ============================================
/**
 * When a homeowner selects a contractor from marketplace responses,
 * this creates a job and links everything together.
 * 
 * @param {object} params
 * @param {string} params.serviceRequestId - The marketplace service request ID
 * @param {object} params.response - The contractor's response object
 * @param {object} params.serviceRequest - The original service request data
 * @param {string} params.homeownerId - The homeowner's user ID
 * @param {string} params.propertyId - The property ID (optional)
 * @returns {Promise<{success: boolean, jobId?: string, error?: string}>}
 */
export const createJobFromMarketplaceSelection = async ({
    serviceRequestId,
    response,
    serviceRequest,
    homeownerId,
    propertyId = null
}) => {
    try {
        // 1. Create the job document in the existing jobs collection
        const jobData = {
            // Core identifiers
            createdBy: homeownerId,
            propertyId: propertyId,
            
            // Source tracking
            source: 'marketplace',
            sourceRequestId: serviceRequestId,
            
            // Job details from service request
            description: serviceRequest.title || serviceRequest.description || 'Service Request',
            category: serviceRequest.category || 'Other',
            propertyName: serviceRequest.propertyName || 'My Home',
            propertyAddress: serviceRequest.location?.address || null,
            
            // Contractor info from the winning response
            contractorId: response.contractorId,
            contractorName: response.contractorName || response.businessName || 'Contractor',
            contractorPhone: response.contractorPhone || null,
            contractorEmail: response.contractorEmail || null,
            
            // Estimate info from response
            estimate: response.estimate || null,
            estimateType: response.estimateType || null, // 'fixed', 'range', 'evaluation_needed'
            
            // Photos from the request
            photos: serviceRequest.photos || [],
            
            // Requirements
            requirements: serviceRequest.requirements || {},
            
            // Urgency
            urgency: serviceRequest.urgency || 'flexible',
            
            // Status - pending schedule so contractor can offer times
            status: 'pending_schedule',
            
            // Timestamps
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastActivity: serverTimestamp(),
            
            // Scheduling (to be filled by contractor)
            scheduling: {
                offeredSlots: [],
                selectedSlot: null
            },
            
            // Message from contractor's response
            contractorMessage: response.message || null,
            contractorAvailability: response.availability || null
        };
        
        const jobRef = await addDoc(
            collection(db, REQUESTS_COLLECTION_PATH), 
            jobData
        );
        
        const jobId = jobRef.id;
        
        // 2. Mark the contractor as selected on the service request
        await selectContractor(serviceRequestId, response.id);
        
        // 3. Link the service request to the new job
        await linkToJob(serviceRequestId, jobId);
        
        // 4. Add contractor to homeowner's "pros" list for future reference
        try {
            const prosRef = collection(db, 'artifacts', appId, 'users', homeownerId, 'pros');
            
            // Check if this contractor is already in their pros list
            // (We don't want duplicates)
            // For now, just add - deduplication can be handled elsewhere
            await addDoc(prosRef, {
                name: response.contractorName || response.businessName || 'Contractor',
                contractorId: response.contractorId,
                phone: response.contractorPhone || null,
                email: response.contractorEmail || null,
                logoUrl: response.contractorLogo || null,
                specialty: serviceRequest.category || null,
                isOnPlatform: true,
                addedAt: serverTimestamp(),
                addedFrom: 'marketplace'
            });
        } catch (prosError) {
            // Non-critical - log but don't fail
            console.warn('Could not add contractor to pros list:', prosError);
        }
        
        return { 
            success: true, 
            jobId 
        };
        
    } catch (error) {
        console.error('Error creating job from marketplace selection:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
};

// ============================================
// GET SERVICE REQUEST WITH RESPONSES
// ============================================
/**
 * Helper to fetch a service request and its responses for the selection flow
 */
export const getServiceRequestForSelection = async (requestId) => {
    try {
        const requestRef = doc(
            db, 
            'artifacts', appId, 'public', 'data', 'serviceRequests', 
            requestId
        );
        const requestSnap = await getDoc(requestRef);
        
        if (!requestSnap.exists()) {
            return { success: false, error: 'Service request not found' };
        }
        
        return {
            success: true,
            serviceRequest: { id: requestSnap.id, ...requestSnap.data() }
        };
        
    } catch (error) {
        console.error('Error fetching service request:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// CREATE CHAT CHANNEL FOR MARKETPLACE CONNECTION
// ============================================
/**
 * Creates or gets a chat channel between homeowner and contractor
 * from a marketplace connection
 */
export const createMarketplaceChatChannel = async ({
    homeownerId,
    contractorId,
    contractorName,
    homeownerName,
    serviceRequestId,
    jobId
}) => {
    try {
        // Use the standard channel ID format: homeownerId_contractorId
        const channelId = `${homeownerId}_${contractorId}`;
        
        const channelRef = doc(db, 'channels', channelId);
        const channelSnap = await getDoc(channelRef);
        
        const channelData = {
            channelId,
            participants: [homeownerId, contractorId],
            homeownerName: homeownerName || 'Homeowner',
            contractorName: contractorName || 'Contractor',
            source: 'marketplace',
            sourceRequestId: serviceRequestId,
            linkedJobId: jobId,
            lastMessageTime: serverTimestamp(),
            createdAt: channelSnap.exists() ? channelSnap.data().createdAt : serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        // Use set with merge to create or update
        const { setDoc } = await import('firebase/firestore');
        await setDoc(channelRef, channelData, { merge: true });
        
        return { 
            success: true, 
            channelId 
        };
        
    } catch (error) {
        console.error('Error creating chat channel:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
};

export default {
    createJobFromMarketplaceSelection,
    getServiceRequestForSelection,
    createMarketplaceChatChannel
};
