// src/features/marketplace/lib/contractorMarketplaceService.js
// ============================================
// CONTRACTOR MARKETPLACE SERVICE
// ============================================
// Handles public contractor profiles, search, and filtering.
// Allows homeowners to browse and discover contractors.

import { 
    collection, doc, getDoc, getDocs, setDoc, updateDoc,
    query, where, orderBy, limit, startAfter, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { appId } from '../../../config/constants';

// ============================================
// COLLECTION PATH
// ============================================

// Public contractor directory (separate from private contractor data)
const getPublicProfilesPath = () => 
    `artifacts/${appId}/public/data/contractorProfiles`;

// Reviews collection
const getReviewsPath = (contractorId) => 
    `artifacts/${appId}/public/data/contractorProfiles/${contractorId}/reviews`;

// ============================================
// PUBLIC PROFILE FIELDS
// ============================================

// Minimum required fields for a public profile
export const REQUIRED_PROFILE_FIELDS = [
    'businessName',
    'primaryTrade',
    'zipCode'
];

// Fields that can be displayed publicly
export const PUBLIC_PROFILE_SCHEMA = {
    // Identity
    businessName: '',
    ownerName: '',
    tagline: '', // Short description
    about: '', // Longer bio
    logoUrl: '',
    coverPhotoUrl: '',
    
    // Trades & services
    primaryTrade: '',
    additionalTrades: [],
    servicesOffered: [], // Specific services within trades
    
    // Location & service area
    zipCode: '',
    city: '',
    state: '',
    maxTravelMiles: 25,
    serviceAreas: [], // List of zip codes or cities served
    
    // Credentials (self-attestation for MVP)
    yearsInBusiness: null,
    licensed: false,
    licenseNumber: '', // Optional display
    insured: false,
    bonded: false,
    certifications: [], // ['EPA Certified', 'Master Plumber', etc.]
    
    // Contact preferences (what to show)
    showPhone: true,
    showEmail: true,
    phone: '',
    email: '',
    website: '',
    
    // Social proof
    averageRating: null,
    reviewCount: 0,
    completedJobCount: 0,
    responseRate: null, // % of leads responded to
    averageResponseTime: null, // in hours
    
    // Portfolio
    portfolioItems: [], // [{ imageUrl, caption, category, date }]
    
    // Availability
    acceptingNewClients: true,
    availabilityNote: '', // "Booking 2 weeks out"
    emergencyAvailable: false,
    
    // Business details
    paymentMethods: [], // ['Cash', 'Check', 'Card', 'Financing']
    financing: false,
    freeEstimates: true,
    
    // Visibility
    isPublic: false,
    profileComplete: false,
    lastActiveAt: null,
    
    // Verification status (for future)
    verificationStatus: 'unverified', // unverified, pending, verified
    verifiedAt: null
};

// ============================================
// PUBLISH/UNPUBLISH PUBLIC PROFILE
// ============================================

export const publishContractorProfile = async (contractorId, profileData) => {
    try {
        // Validate required fields
        const missingFields = REQUIRED_PROFILE_FIELDS.filter(field => !profileData[field]);
        if (missingFields.length > 0) {
            return { 
                success: false, 
                error: `Missing required fields: ${missingFields.join(', ')}` 
            };
        }
        
        const publicProfileRef = doc(db, getPublicProfilesPath(), contractorId);
        
        // Build public profile from provided data
        const publicProfile = {
            id: contractorId,
            
            // Identity
            businessName: profileData.businessName || '',
            ownerName: profileData.ownerName || profileData.name || '',
            tagline: profileData.tagline || '',
            about: profileData.about || profileData.bio || '',
            logoUrl: profileData.logoUrl || profileData.photoUrl || '',
            coverPhotoUrl: profileData.coverPhotoUrl || '',
            
            // Trades
            primaryTrade: profileData.primaryTrade || profileData.trades?.[0] || '',
            additionalTrades: profileData.additionalTrades || profileData.trades?.slice(1) || [],
            servicesOffered: profileData.servicesOffered || [],
            
            // Location
            zipCode: profileData.zipCode || profileData.homeZip || '',
            city: profileData.city || '',
            state: profileData.state || '',
            maxTravelMiles: profileData.maxTravelMiles || profileData.maxTravel || 25,
            serviceAreas: profileData.serviceAreas || [],
            
            // Credentials
            yearsInBusiness: profileData.yearsInBusiness || null,
            licensed: profileData.licensed ?? false,
            licenseNumber: profileData.showLicenseNumber ? profileData.licenseNumber : '',
            insured: profileData.insured ?? false,
            bonded: profileData.bonded ?? false,
            certifications: profileData.certifications || [],
            
            // Contact
            showPhone: profileData.showPhone ?? true,
            showEmail: profileData.showEmail ?? true,
            phone: profileData.showPhone ? (profileData.phone || '') : '',
            email: profileData.showEmail ? (profileData.email || '') : '',
            website: profileData.website || '',
            
            // Social proof (pulled from actual metrics)
            averageRating: profileData.averageRating || null,
            reviewCount: profileData.reviewCount || 0,
            completedJobCount: profileData.completedJobCount || 0,
            responseRate: profileData.responseRate || null,
            averageResponseTime: profileData.averageResponseTime || null,
            
            // Portfolio
            portfolioItems: (profileData.portfolioItems || []).slice(0, 20), // Max 20 items
            
            // Availability
            acceptingNewClients: profileData.acceptingNewClients ?? true,
            availabilityNote: profileData.availabilityNote || '',
            emergencyAvailable: profileData.emergencyAvailable ?? false,
            
            // Business
            paymentMethods: profileData.paymentMethods || [],
            financing: profileData.financing ?? false,
            freeEstimates: profileData.freeEstimates ?? true,
            
            // Status
            isPublic: true,
            profileComplete: true,
            lastActiveAt: serverTimestamp(),
            publishedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            
            // Verification
            verificationStatus: 'unverified',
            verifiedAt: null
        };
        
        await setDoc(publicProfileRef, publicProfile, { merge: true });
        
        return { success: true, profile: publicProfile };
    } catch (error) {
        console.error('Error publishing profile:', error);
        return { success: false, error: error.message };
    }
};

export const unpublishContractorProfile = async (contractorId) => {
    try {
        const publicProfileRef = doc(db, getPublicProfilesPath(), contractorId);
        await updateDoc(publicProfileRef, {
            isPublic: false,
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error unpublishing profile:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// SEARCH/BROWSE PUBLIC PROFILES
// ============================================

export const searchContractors = async (filters = {}, options = {}) => {
    try {
        const { 
            trade = null,
            zipCode = null,
            minRating = null,
            mustBeInsured = false,
            mustBeLicensed = false,
            emergencyOnly = false,
            sortBy = 'rating', // rating, reviews, newest
            pageSize = 20,
            lastDoc = null
        } = { ...filters, ...options };
        
        let q = query(
            collection(db, getPublicProfilesPath()),
            where('isPublic', '==', true),
            where('acceptingNewClients', '==', true)
        );
        
        // Add trade filter
        if (trade) {
            // Note: Firestore doesn't support OR on different fields easily
            // So we filter client-side for additionalTrades
            q = query(q, where('primaryTrade', '==', trade));
        }
        
        // Add sorting
        switch (sortBy) {
            case 'rating':
                q = query(q, orderBy('averageRating', 'desc'));
                break;
            case 'reviews':
                q = query(q, orderBy('reviewCount', 'desc'));
                break;
            case 'newest':
                q = query(q, orderBy('publishedAt', 'desc'));
                break;
            default:
                q = query(q, orderBy('averageRating', 'desc'));
        }
        
        // Pagination
        q = query(q, limit(pageSize));
        if (lastDoc) {
            q = query(q, startAfter(lastDoc));
        }
        
        const snapshot = await getDocs(q);
        const contractors = [];
        
        snapshot.forEach(doc => {
            const profile = doc.data();
            
            // Client-side filtering for fields Firestore can't handle
            if (mustBeInsured && !profile.insured) return;
            if (mustBeLicensed && !profile.licensed) return;
            if (emergencyOnly && !profile.emergencyAvailable) return;
            if (minRating && (profile.averageRating || 0) < minRating) return;
            
            // Zip code proximity (simple check for MVP)
            if (zipCode && profile.zipCode) {
                const isNearby = isZipCodeNearby(zipCode, profile.zipCode, profile.maxTravelMiles);
                if (!isNearby) return;
            }
            
            contractors.push(profile);
        });
        
        const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
        
        return { 
            success: true, 
            contractors,
            lastDoc: lastVisible,
            hasMore: snapshot.docs.length === pageSize
        };
    } catch (error) {
        console.error('Error searching contractors:', error);
        return { success: false, error: error.message, contractors: [] };
    }
};

// Simple zip code proximity check (placeholder)
const isZipCodeNearby = (searchZip, contractorZip, maxMiles) => {
    if (!searchZip || !contractorZip) return true;
    // For MVP: match first 3 digits (same metro area)
    const searchPrefix = searchZip.toString().substring(0, 3);
    const contractorPrefix = contractorZip.toString().substring(0, 3);
    return searchPrefix === contractorPrefix;
};

// ============================================
// GET SINGLE PUBLIC PROFILE
// ============================================

export const getPublicProfile = async (contractorId) => {
    try {
        const profileRef = doc(db, getPublicProfilesPath(), contractorId);
        const profileSnap = await getDoc(profileRef);
        
        if (!profileSnap.exists()) {
            return { success: false, error: 'Profile not found' };
        }
        
        const profile = profileSnap.data();
        
        if (!profile.isPublic) {
            return { success: false, error: 'Profile is not public' };
        }
        
        return { success: true, profile };
    } catch (error) {
        console.error('Error fetching profile:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// REVIEWS
// ============================================

export const getContractorReviews = async (contractorId, options = {}) => {
    try {
        const { limitCount = 10, sortBy = 'newest' } = options;
        
        let q = query(
            collection(db, getReviewsPath(contractorId)),
            orderBy(sortBy === 'newest' ? 'createdAt' : 'rating', 'desc'),
            limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        const reviews = [];
        snapshot.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
        
        return { success: true, reviews };
    } catch (error) {
        console.error('Error fetching reviews:', error);
        return { success: false, error: error.message, reviews: [] };
    }
};

export const addReview = async (contractorId, reviewData) => {
    try {
        // Validate - must be from a verified transaction (job completion)
        if (!reviewData.jobId) {
            return { success: false, error: 'Reviews must be linked to a completed job' };
        }
        
        const reviewsRef = collection(db, getReviewsPath(contractorId));
        const reviewRef = doc(reviewsRef);
        
        const review = {
            id: reviewRef.id,
            contractorId,
            homeownerId: reviewData.homeownerId,
            jobId: reviewData.jobId,
            
            // Review content
            rating: reviewData.rating, // 1-5
            title: reviewData.title || '',
            comment: reviewData.comment || '',
            
            // What was reviewed
            category: reviewData.category || '',
            workDescription: reviewData.workDescription || '',
            
            // Verification
            verified: true, // Since it requires jobId
            
            // Display preferences
            homeownerName: reviewData.showName ? reviewData.homeownerName : 'Krib User',
            showName: reviewData.showName ?? false,
            
            // Timestamps
            createdAt: serverTimestamp(),
            jobCompletedAt: reviewData.jobCompletedAt || null
        };
        
        await setDoc(reviewRef, review);
        
        // Update contractor's aggregate ratings
        await updateContractorRating(contractorId);
        
        return { success: true, reviewId: reviewRef.id };
    } catch (error) {
        console.error('Error adding review:', error);
        return { success: false, error: error.message };
    }
};

// Recalculate contractor's average rating
const updateContractorRating = async (contractorId) => {
    try {
        const reviewsSnap = await getDocs(collection(db, getReviewsPath(contractorId)));
        
        let totalRating = 0;
        let count = 0;
        
        reviewsSnap.forEach(doc => {
            const review = doc.data();
            if (review.rating) {
                totalRating += review.rating;
                count++;
            }
        });
        
        const averageRating = count > 0 ? (totalRating / count) : null;
        
        const profileRef = doc(db, getPublicProfilesPath(), contractorId);
        await updateDoc(profileRef, {
            averageRating: averageRating ? Math.round(averageRating * 10) / 10 : null,
            reviewCount: count,
            updatedAt: serverTimestamp()
        });
        
        return { success: true, averageRating, reviewCount: count };
    } catch (error) {
        console.error('Error updating rating:', error);
        return { success: false };
    }
};

// ============================================
// UPDATE METRICS (Called from job completion)
// ============================================

export const incrementCompletedJobs = async (contractorId) => {
    try {
        const profileRef = doc(db, getPublicProfilesPath(), contractorId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            await updateDoc(profileRef, {
                completedJobCount: (profileSnap.data().completedJobCount || 0) + 1,
                lastActiveAt: serverTimestamp()
            });
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error updating job count:', error);
        return { success: false };
    }
};

export const updateResponseMetrics = async (contractorId, responseTimeHours) => {
    try {
        const profileRef = doc(db, getPublicProfilesPath(), contractorId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const current = profileSnap.data();
            const currentAvg = current.averageResponseTime || responseTimeHours;
            const currentCount = current.responseCount || 0;
            
            // Running average
            const newAvg = ((currentAvg * currentCount) + responseTimeHours) / (currentCount + 1);
            
            await updateDoc(profileRef, {
                averageResponseTime: Math.round(newAvg * 10) / 10,
                responseCount: currentCount + 1,
                lastActiveAt: serverTimestamp()
            });
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error updating response metrics:', error);
        return { success: false };
    }
};

// ============================================
// FEATURED/PROMOTED CONTRACTORS (Ad Support)
// ============================================

export const getFeaturedContractors = async (trade = null, zipCode = null, count = 3) => {
    try {
        // For MVP: Just get top-rated contractors
        // Future: This would pull from a "sponsored" collection
        let q = query(
            collection(db, getPublicProfilesPath()),
            where('isPublic', '==', true),
            where('acceptingNewClients', '==', true),
            orderBy('averageRating', 'desc'),
            limit(count * 2) // Get more to allow filtering
        );
        
        if (trade) {
            q = query(
                collection(db, getPublicProfilesPath()),
                where('isPublic', '==', true),
                where('primaryTrade', '==', trade),
                orderBy('averageRating', 'desc'),
                limit(count * 2)
            );
        }
        
        const snapshot = await getDocs(q);
        const contractors = [];
        
        snapshot.forEach(doc => {
            if (contractors.length >= count) return;
            const profile = doc.data();
            
            // Filter by location if provided
            if (zipCode && !isZipCodeNearby(zipCode, profile.zipCode, profile.maxTravelMiles)) {
                return;
            }
            
            contractors.push({
                ...profile,
                isFeatured: true // Mark as featured for UI styling
            });
        });
        
        return { success: true, contractors };
    } catch (error) {
        console.error('Error fetching featured contractors:', error);
        return { success: false, contractors: [] };
    }
};

export default {
    REQUIRED_PROFILE_FIELDS,
    PUBLIC_PROFILE_SCHEMA,
    publishContractorProfile,
    unpublishContractorProfile,
    searchContractors,
    getPublicProfile,
    getContractorReviews,
    addReview,
    incrementCompletedJobs,
    updateResponseMetrics,
    getFeaturedContractors
};
