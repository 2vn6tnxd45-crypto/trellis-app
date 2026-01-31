// src/utils/seedMarketplace.js
// ============================================
// MARKETPLACE SEED DATA
// ============================================
// One-time utility to populate Firestore with demo data for investor presentations.
// Call seedMarketplaceData() from browser console or a temporary dev button.

import { doc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { appId } from '../config/constants';

// ============================================
// COLLECTION PATHS
// ============================================
const getContractorProfilesPath = () => `artifacts/${appId}/public/data/contractorProfiles`;
const getServiceRequestsPath = () => `artifacts/${appId}/public/data/serviceRequests`;

// ============================================
// DEMO CONTRACTOR PROFILES
// ============================================
const DEMO_CONTRACTORS = [
    {
        id: 'demo-contractor-1',
        businessName: 'Rodriguez Plumbing Co.',
        ownerName: 'Carlos Rodriguez',
        tagline: 'Licensed & insured — 20 years serving SoCal families',
        about: 'Family-owned plumbing business specializing in residential repairs, water heater installation, and repiping. We treat your home like our own.',
        primaryTrade: 'plumbing',
        additionalTrades: [],
        servicesOffered: ['Leak repair', 'Water heater installation', 'Repiping', 'Drain cleaning', 'Fixture replacement'],
        zipCode: '90638',
        city: 'La Mirada',
        state: 'CA',
        maxTravelMiles: 25,
        serviceAreas: ['90638', '90639', '90631', '90630', '90623'],
        yearsInBusiness: 20,
        licensed: true,
        licenseNumber: 'CA-PLB-884521',
        insured: true,
        bonded: true,
        certifications: ['Master Plumber', 'Backflow Prevention Certified'],
        showPhone: true,
        showEmail: true,
        phone: '(562) 555-0147',
        email: 'carlos@rodriguezplumbing.com',
        website: '',
        averageRating: 4.9,
        reviewCount: 87,
        completedJobCount: 342,
        responseRate: 95,
        averageResponseTime: 2,
        portfolioItems: [],
        acceptingNewClients: true,
        availabilityNote: 'Same-day emergency service available',
        emergencyAvailable: true,
        paymentMethods: ['Cash', 'Check', 'Card'],
        financing: false,
        freeEstimates: true,
        isPublic: true,
        profileComplete: true,
        verificationStatus: 'unverified',
        verifiedAt: null
    },
    {
        id: 'demo-contractor-2',
        businessName: 'Bright Spark Electric',
        ownerName: 'James Chen',
        tagline: 'Panel upgrades, EV chargers, and whole-home rewiring',
        about: 'Certified electrician specializing in modern electrical needs. From smart home wiring to EV charger installation, we handle it all with precision and code compliance.',
        primaryTrade: 'electrical',
        additionalTrades: ['security'],
        servicesOffered: ['Panel upgrade', 'EV charger installation', 'Whole-home rewiring', 'Smart home wiring', 'Outlet/switch replacement', 'Ceiling fan installation'],
        zipCode: '90631',
        city: 'La Habra',
        state: 'CA',
        maxTravelMiles: 30,
        serviceAreas: ['90631', '90638', '90623', '92821', '92831'],
        yearsInBusiness: 12,
        licensed: true,
        licenseNumber: 'CA-ELE-667890',
        insured: true,
        bonded: true,
        certifications: ['Journeyman Electrician', 'Tesla Certified Installer'],
        showPhone: true,
        showEmail: true,
        phone: '(714) 555-0293',
        email: 'james@brightsparkelectric.com',
        website: '',
        averageRating: 4.8,
        reviewCount: 56,
        completedJobCount: 218,
        responseRate: 90,
        averageResponseTime: 4,
        portfolioItems: [],
        acceptingNewClients: true,
        availabilityNote: 'Booking about 1 week out',
        emergencyAvailable: false,
        paymentMethods: ['Card', 'Check', 'Financing Available'],
        financing: true,
        freeEstimates: true,
        isPublic: true,
        profileComplete: true,
        verificationStatus: 'unverified',
        verifiedAt: null
    },
    {
        id: 'demo-contractor-3',
        businessName: 'SoCal Comfort HVAC',
        ownerName: 'Maria Gonzalez',
        tagline: 'Keep your home comfortable year-round',
        about: 'Full-service HVAC company providing installation, repair, and maintenance. EPA certified with expertise in energy-efficient systems that save you money.',
        primaryTrade: 'hvac',
        additionalTrades: [],
        servicesOffered: ['AC installation', 'Furnace repair', 'Duct cleaning', 'Annual tune-up', 'Mini-split installation', 'Thermostat upgrade'],
        zipCode: '90623',
        city: 'Cerritos',
        state: 'CA',
        maxTravelMiles: 20,
        serviceAreas: ['90623', '90638', '90630', '90713', '90715'],
        yearsInBusiness: 8,
        licensed: true,
        licenseNumber: 'CA-HVAC-551234',
        insured: true,
        bonded: false,
        certifications: ['EPA 608 Certified', 'NATE Certified'],
        showPhone: true,
        showEmail: true,
        phone: '(562) 555-0381',
        email: 'maria@socalcomforthvac.com',
        website: '',
        averageRating: 4.7,
        reviewCount: 41,
        completedJobCount: 156,
        responseRate: 88,
        averageResponseTime: 3,
        portfolioItems: [],
        acceptingNewClients: true,
        availabilityNote: '',
        emergencyAvailable: true,
        paymentMethods: ['Cash', 'Card', 'Financing Available'],
        financing: true,
        freeEstimates: true,
        isPublic: true,
        profileComplete: true,
        verificationStatus: 'unverified',
        verifiedAt: null
    },
    {
        id: 'demo-contractor-4',
        businessName: "Dave's Handyman Services",
        ownerName: 'Dave Patterson',
        tagline: 'No job too small — honest work at fair prices',
        about: 'Your go-to handyman for all those little projects around the house. Furniture assembly, drywall patching, door repair, pressure washing, and everything in between.',
        primaryTrade: 'handyman',
        additionalTrades: ['painting', 'cleaning'],
        servicesOffered: ['Drywall repair', 'Door/window repair', 'Furniture assembly', 'Pressure washing', 'Gutter cleaning', 'Minor plumbing', 'Picture hanging', 'Caulking'],
        zipCode: '90639',
        city: 'La Mirada',
        state: 'CA',
        maxTravelMiles: 15,
        serviceAreas: ['90639', '90638', '90631', '90630'],
        yearsInBusiness: 5,
        licensed: false,
        licenseNumber: '',
        insured: true,
        bonded: false,
        certifications: [],
        showPhone: true,
        showEmail: true,
        phone: '(562) 555-0512',
        email: 'dave@daveshandyman.com',
        website: '',
        averageRating: 4.6,
        reviewCount: 28,
        completedJobCount: 94,
        responseRate: 92,
        averageResponseTime: 1,
        portfolioItems: [],
        acceptingNewClients: true,
        availabilityNote: 'Usually available within 2-3 days',
        emergencyAvailable: false,
        paymentMethods: ['Cash', 'Check'],
        financing: false,
        freeEstimates: true,
        isPublic: true,
        profileComplete: true,
        verificationStatus: 'unverified',
        verifiedAt: null
    },
    {
        id: 'demo-contractor-5',
        businessName: 'Summit Roofing & Gutters',
        ownerName: 'Mike Thompson',
        tagline: 'Protecting your home from the top down',
        about: 'Full-service roofing contractor specializing in residential roof replacement, repair, and gutter systems. Free inspections and transparent pricing.',
        primaryTrade: 'roofing',
        additionalTrades: ['painting'],
        servicesOffered: ['Roof replacement', 'Roof repair', 'Leak detection', 'Gutter installation', 'Gutter cleaning', 'Skylight installation'],
        zipCode: '90630',
        city: 'Cypress',
        state: 'CA',
        maxTravelMiles: 35,
        serviceAreas: ['90630', '90638', '90631', '90623', '92821', '92831', '90720'],
        yearsInBusiness: 15,
        licensed: true,
        licenseNumber: 'CA-ROF-773456',
        insured: true,
        bonded: true,
        certifications: ['GAF Master Elite', 'CertainTeed SELECT ShingleMaster'],
        showPhone: true,
        showEmail: true,
        phone: '(714) 555-0678',
        email: 'mike@summitroofing.com',
        website: '',
        averageRating: 4.8,
        reviewCount: 63,
        completedJobCount: 287,
        responseRate: 85,
        averageResponseTime: 6,
        portfolioItems: [],
        acceptingNewClients: true,
        availabilityNote: 'Booking 2-3 weeks out for full replacements',
        emergencyAvailable: true,
        paymentMethods: ['Card', 'Check', 'Financing Available'],
        financing: true,
        freeEstimates: true,
        isPublic: true,
        profileComplete: true,
        verificationStatus: 'unverified',
        verifiedAt: null
    }
];

// ============================================
// DEMO SERVICE REQUESTS
// ============================================
const DEMO_SERVICE_REQUESTS = [
    {
        id: 'demo-request-1',
        homeownerId: 'demo-homeowner-1',
        propertyId: null,
        category: 'plumbing',
        title: 'Leaky kitchen faucet — dripping constantly',
        description: 'Kitchen faucet has been dripping for about a week. Getting worse. Single-handle Moen faucet, probably 8 years old. Not sure if it needs a new cartridge or full replacement. Would love a professional opinion.',
        photos: [],
        zipCode: '90638',
        city: 'La Mirada',
        state: 'CA',
        urgency: 'this_week',
        preferredTimes: [],
        budgetRange: { min: null, max: 300 },
        showBudget: true,
        requirements: {
            mustBeInsured: true,
            mustBeLicensed: false,
            mustBeLocal: true,
            minYearsExperience: 0,
            minRating: 0
        },
        status: 'open',
        visibility: 'broadcast',
        invitedContractorIds: [],
        viewCount: 12,
        responseCount: 2,
        expiresInDays: 7,
        selectedContractorId: null,
        selectedAt: null,
        convertedToJobId: null,
        contactPreferences: {
            allowCalls: true,
            allowTexts: true,
            allowMessages: true,
            preferredMethod: 'message'
        },
        createdDaysAgo: 3
    },
    {
        id: 'demo-request-2',
        homeownerId: 'demo-homeowner-1',
        propertyId: null,
        category: 'hvac',
        title: 'Annual HVAC tune-up before summer',
        description: 'Need a pre-summer tune-up for our central AC system. Trane unit, about 6 years old. Also want the ducts inspected — noticing uneven cooling in the back bedrooms.',
        photos: [],
        zipCode: '90638',
        city: 'La Mirada',
        state: 'CA',
        urgency: 'flexible',
        preferredTimes: [],
        budgetRange: null,
        showBudget: false,
        requirements: {
            mustBeInsured: true,
            mustBeLicensed: true,
            mustBeLocal: true,
            minYearsExperience: 3,
            minRating: 4.0
        },
        status: 'open',
        visibility: 'broadcast',
        invitedContractorIds: [],
        viewCount: 8,
        responseCount: 1,
        expiresInDays: 14,
        selectedContractorId: null,
        selectedAt: null,
        convertedToJobId: null,
        contactPreferences: {
            allowCalls: false,
            allowTexts: true,
            allowMessages: true,
            preferredMethod: 'message'
        },
        createdDaysAgo: 1
    }
];

// ============================================
// SEED FUNCTION
// ============================================
export const seedMarketplaceData = async () => {
    console.log('🌱 Starting marketplace seed...');

    try {
        // Seed contractor profiles
        console.log('📝 Creating contractor profiles...');
        for (const contractor of DEMO_CONTRACTORS) {
            const docRef = doc(db, getContractorProfilesPath(), contractor.id);
            await setDoc(docRef, {
                ...contractor,
                lastActiveAt: serverTimestamp(),
                publishedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log(`  ✓ Created: ${contractor.businessName}`);
        }

        // Seed service requests
        console.log('📝 Creating service requests...');
        for (const request of DEMO_SERVICE_REQUESTS) {
            const { createdDaysAgo, expiresInDays, ...requestData } = request;

            // Calculate timestamps
            const createdAt = Timestamp.fromDate(new Date(Date.now() - createdDaysAgo * 24 * 60 * 60 * 1000));
            const expiresAt = Timestamp.fromDate(new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000));

            const docRef = doc(db, getServiceRequestsPath(), request.id);
            await setDoc(docRef, {
                ...requestData,
                createdAt,
                updatedAt: serverTimestamp(),
                expiresAt
            });
            console.log(`  ✓ Created: ${request.title}`);
        }

        console.log('✅ Marketplace seeded successfully!');
        console.log(`   - ${DEMO_CONTRACTORS.length} contractor profiles`);
        console.log(`   - ${DEMO_SERVICE_REQUESTS.length} service requests`);

        return { success: true, contractors: DEMO_CONTRACTORS.length, requests: DEMO_SERVICE_REQUESTS.length };
    } catch (error) {
        console.error('❌ Seed failed:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// CLEANUP FUNCTION (Optional)
// ============================================
export const clearMarketplaceSeedData = async () => {
    console.log('🧹 Clearing marketplace seed data...');

    try {
        const { deleteDoc } = await import('firebase/firestore');

        // Clear contractor profiles
        for (const contractor of DEMO_CONTRACTORS) {
            const docRef = doc(db, getContractorProfilesPath(), contractor.id);
            await deleteDoc(docRef);
            console.log(`  ✓ Deleted: ${contractor.businessName}`);
        }

        // Clear service requests
        for (const request of DEMO_SERVICE_REQUESTS) {
            const docRef = doc(db, getServiceRequestsPath(), request.id);
            await deleteDoc(docRef);
            console.log(`  ✓ Deleted: ${request.title}`);
        }

        console.log('✅ Seed data cleared!');
        return { success: true };
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        return { success: false, error: error.message };
    }
};

export default { seedMarketplaceData, clearMarketplaceSeedData };
