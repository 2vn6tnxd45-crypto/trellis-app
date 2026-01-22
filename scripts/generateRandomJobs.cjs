#!/usr/bin/env node
/**
 * Firebase Admin Script: Generate Random Jobs for Scheduling Testing
 *
 * This script creates random jobs with:
 * - Valid addresses within a specified radius of a center point
 * - Random durations from 30 minutes to 3 days
 * - Random crew requirements from 1 to 8
 *
 * SETUP:
 * 1. Go to Firebase Console > Project Settings > Service Accounts
 * 2. Click "Generate new private key" and download the JSON file
 * 3. Save it as `serviceAccountKey.json` in the `scripts/` folder
 * 4. Run: node scripts/generateRandomJobs.js
 *
 * OPTIONS:
 *   --contractor-id=<id>     Specify contractor ID (default: uses test.contractor.full@gmail.com)
 *   --contractor-email=<email> Look up contractor by email address
 *   --count=<n>              Number of jobs to create (default: 20)
 *   --center-lat=<lat>       Center latitude (default: Austin, TX - 30.2672)
 *   --center-lng=<lng>       Center longitude (default: Austin, TX - -97.7431)
 *   --radius=<miles>         Radius in miles (default: 15)
 *   --dry-run                Preview jobs without creating them
 *
 * EXAMPLES:
 *   node scripts/generateRandomJobs.js --count=50
 *   node scripts/generateRandomJobs.js --contractor-id=abc123 --count=30 --radius=20
 *   node scripts/generateRandomJobs.js --center-lat=37.7749 --center-lng=-122.4194 --radius=10
 *   node scripts/generateRandomJobs.js --dry-run
 */

const admin = require('firebase-admin');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const APP_ID = 'krib-app';
const REQUESTS_COLLECTION = `artifacts/${APP_ID}/public/data/requests`;
const CONTRACTORS_COLLECTION = `artifacts/${APP_ID}/public/data/contractors`;

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.replace('--', '').split('=');
    acc[key] = value === undefined ? true : value;
    return acc;
}, {});

const CONFIG = {
    contractorId: args['contractor-id'] || null,
    contractorEmail: args['contractor-email'] || null,
    count: parseInt(args['count']) || 20,
    centerLat: parseFloat(args['center-lat']) || 30.2672,  // Austin, TX
    centerLng: parseFloat(args['center-lng']) || -97.7431,
    radiusMiles: parseFloat(args['radius']) || 15,
    dryRun: args['dry-run'] || false
};

// ============================================
// SAMPLE DATA FOR REALISTIC JOBS
// ============================================

const JOB_CATEGORIES = [
    'HVAC', 'Plumbing', 'Electrical', 'Roofing', 'Landscaping',
    'Painting', 'Flooring', 'General Contracting', 'Carpentry',
    'Concrete', 'Fencing', 'Drywall', 'Remodeling', 'Demolition'
];

const JOB_TEMPLATES = [
    // Quick jobs (30 min - 2 hours)
    { title: 'Thermostat Installation', category: 'HVAC', minDuration: 30, maxDuration: 90, minCrew: 1, maxCrew: 1 },
    { title: 'Faucet Repair', category: 'Plumbing', minDuration: 30, maxDuration: 60, minCrew: 1, maxCrew: 1 },
    { title: 'Outlet Installation', category: 'Electrical', minDuration: 30, maxDuration: 60, minCrew: 1, maxCrew: 1 },
    { title: 'Garbage Disposal Replacement', category: 'Plumbing', minDuration: 45, maxDuration: 90, minCrew: 1, maxCrew: 1 },
    { title: 'Light Fixture Installation', category: 'Electrical', minDuration: 30, maxDuration: 60, minCrew: 1, maxCrew: 1 },
    { title: 'AC Filter Service', category: 'HVAC', minDuration: 30, maxDuration: 45, minCrew: 1, maxCrew: 1 },
    { title: 'Ceiling Fan Installation', category: 'Electrical', minDuration: 45, maxDuration: 90, minCrew: 1, maxCrew: 2 },

    // Half-day jobs (2-4 hours)
    { title: 'Water Heater Inspection', category: 'Plumbing', minDuration: 120, maxDuration: 180, minCrew: 1, maxCrew: 2 },
    { title: 'AC Tune-Up', category: 'HVAC', minDuration: 60, maxDuration: 120, minCrew: 1, maxCrew: 1 },
    { title: 'Sprinkler System Repair', category: 'Landscaping', minDuration: 120, maxDuration: 240, minCrew: 1, maxCrew: 2 },
    { title: 'Interior Door Installation', category: 'Carpentry', minDuration: 90, maxDuration: 180, minCrew: 1, maxCrew: 2 },
    { title: 'Toilet Replacement', category: 'Plumbing', minDuration: 90, maxDuration: 150, minCrew: 1, maxCrew: 1 },
    { title: 'Electrical Panel Inspection', category: 'Electrical', minDuration: 120, maxDuration: 180, minCrew: 1, maxCrew: 1 },
    { title: 'Gutter Cleaning & Repair', category: 'Roofing', minDuration: 120, maxDuration: 240, minCrew: 1, maxCrew: 2 },

    // Full-day jobs (4-8 hours)
    { title: 'Bathroom Sink & Vanity Install', category: 'Plumbing', minDuration: 240, maxDuration: 360, minCrew: 1, maxCrew: 2 },
    { title: 'Deck Repair', category: 'Carpentry', minDuration: 300, maxDuration: 480, minCrew: 2, maxCrew: 3 },
    { title: 'Fence Section Replacement', category: 'Fencing', minDuration: 240, maxDuration: 420, minCrew: 2, maxCrew: 3 },
    { title: 'Single Room Painting', category: 'Painting', minDuration: 240, maxDuration: 360, minCrew: 1, maxCrew: 2 },
    { title: 'Hardwood Floor Repair', category: 'Flooring', minDuration: 300, maxDuration: 480, minCrew: 2, maxCrew: 3 },
    { title: 'Mini Split Installation', category: 'HVAC', minDuration: 360, maxDuration: 480, minCrew: 2, maxCrew: 3 },
    { title: 'Drywall Repair (Large Area)', category: 'Drywall', minDuration: 300, maxDuration: 480, minCrew: 2, maxCrew: 3 },
    { title: 'Electrical Rewiring (Room)', category: 'Electrical', minDuration: 360, maxDuration: 480, minCrew: 2, maxCrew: 3 },

    // Multi-day jobs (1-3 days)
    { title: 'Full Bathroom Remodel', category: 'Remodeling', minDuration: 1440, maxDuration: 2880, minCrew: 3, maxCrew: 5 },
    { title: 'Kitchen Cabinet Installation', category: 'Carpentry', minDuration: 960, maxDuration: 1920, minCrew: 2, maxCrew: 4 },
    { title: 'Roof Replacement (Section)', category: 'Roofing', minDuration: 720, maxDuration: 1440, minCrew: 3, maxCrew: 6 },
    { title: 'HVAC System Replacement', category: 'HVAC', minDuration: 480, maxDuration: 960, minCrew: 2, maxCrew: 4 },
    { title: 'Whole House Interior Paint', category: 'Painting', minDuration: 1440, maxDuration: 2880, minCrew: 3, maxCrew: 5 },
    { title: 'Concrete Patio Installation', category: 'Concrete', minDuration: 960, maxDuration: 1920, minCrew: 3, maxCrew: 5 },
    { title: 'New Fence Installation', category: 'Fencing', minDuration: 720, maxDuration: 1920, minCrew: 2, maxCrew: 4 },
    { title: 'Flooring Installation (Whole House)', category: 'Flooring', minDuration: 1440, maxDuration: 2880, minCrew: 3, maxCrew: 5 },
    { title: 'Full Roof Replacement', category: 'Roofing', minDuration: 1440, maxDuration: 4320, minCrew: 4, maxCrew: 8 },
    { title: 'Garage Conversion', category: 'Remodeling', minDuration: 2880, maxDuration: 4320, minCrew: 4, maxCrew: 6 },
    { title: 'Room Addition Framing', category: 'General Contracting', minDuration: 2400, maxDuration: 4320, minCrew: 4, maxCrew: 8 },
    { title: 'Complete Kitchen Remodel', category: 'Remodeling', minDuration: 2880, maxDuration: 4320, minCrew: 4, maxCrew: 7 },
    { title: 'Basement Waterproofing', category: 'General Contracting', minDuration: 1440, maxDuration: 2880, minCrew: 3, maxCrew: 5 },
    { title: 'Demolition Project', category: 'Demolition', minDuration: 480, maxDuration: 1440, minCrew: 3, maxCrew: 6 }
];

const CUSTOMER_FIRST_NAMES = [
    'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
    'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Lisa', 'Daniel', 'Nancy',
    'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
    'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle'
];

const CUSTOMER_LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
    'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
    'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
];

// Valid street names that exist in most cities
const STREET_NAMES = [
    'Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Washington', 'Lake', 'Hill',
    'Park', 'Spring', 'River', 'Church', 'Mill', 'Forest', 'Meadow', 'Valley',
    'Highland', 'Sunset', 'Ridge', 'Grove', 'Summit', 'Willow', 'Cherry', 'Birch',
    'Walnut', 'Hickory', 'Chestnut', 'Magnolia', 'Poplar', 'Sycamore', 'Aspen',
    'Cypress', 'Laurel', 'Holly', 'Ivy', 'Rose', 'Jasmine', 'Pecan', 'Mesquite'
];

const STREET_TYPES = ['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Rd', 'Way', 'Ct', 'Pl', 'Cir'];

const JOB_PRIORITIES = ['low', 'normal', 'normal', 'normal', 'high', 'urgent']; // weighted towards normal

const JOB_STATUSES = ['pending_schedule', 'scheduled', 'in_progress'];

// ============================================
// HELPER FUNCTIONS
// ============================================

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateJobNumber() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const part1 = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const part2 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `JOB-${part1}-${part2}`;
}

function generatePhoneNumber() {
    const areaCode = randomInt(200, 999);
    const prefix = randomInt(200, 999);
    const line = randomInt(1000, 9999);
    return `(${areaCode}) ${prefix}-${line}`;
}

function generateEmail(firstName, lastName) {
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
    const separators = ['.', '_', ''];
    const sep = randomElement(separators);
    const num = Math.random() > 0.5 ? randomInt(1, 99) : '';
    return `${firstName.toLowerCase()}${sep}${lastName.toLowerCase()}${num}@${randomElement(domains)}`;
}

/**
 * Generate a random point within a radius of a center point
 * Uses the haversine formula in reverse
 */
function randomPointInRadius(centerLat, centerLng, radiusMiles) {
    const radiusKm = radiusMiles * 1.60934;
    const radiusEarth = 6371; // km

    // Random distance and bearing
    const distance = Math.sqrt(Math.random()) * radiusKm; // sqrt for uniform distribution
    const bearing = Math.random() * 2 * Math.PI;

    const lat1 = centerLat * Math.PI / 180;
    const lng1 = centerLng * Math.PI / 180;

    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(distance / radiusEarth) +
        Math.cos(lat1) * Math.sin(distance / radiusEarth) * Math.cos(bearing)
    );

    const lng2 = lng1 + Math.atan2(
        Math.sin(bearing) * Math.sin(distance / radiusEarth) * Math.cos(lat1),
        Math.cos(distance / radiusEarth) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
        lat: lat2 * 180 / Math.PI,
        lng: lng2 * 180 / Math.PI
    };
}

/**
 * Generate a realistic-looking street address
 */
function generateAddress(cityName = 'Austin', state = 'TX') {
    const streetNumber = randomInt(100, 9999);
    const streetName = randomElement(STREET_NAMES);
    const streetType = randomElement(STREET_TYPES);
    const zipCode = randomInt(10000, 99999);

    return `${streetNumber} ${streetName} ${streetType}, ${cityName}, ${state} ${zipCode}`;
}

/**
 * Generate a random future date within the next 30 days
 */
function randomFutureDate(maxDays = 30) {
    const now = new Date();
    const daysAhead = randomInt(1, maxDays);
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    return futureDate;
}

/**
 * Generate a random time between 7am and 5pm
 */
function randomWorkTime() {
    const hour = randomInt(7, 16); // 7am to 4pm start
    const minute = randomElement([0, 15, 30, 45]);
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Calculate if a job spans multiple days based on duration
 */
function isMultiDayJob(durationMinutes) {
    return durationMinutes > 480; // More than 8 hours
}

/**
 * Generate schedule blocks for multi-day jobs
 */
function generateScheduleBlocks(startDate, durationMinutes, dailyHours = 8) {
    const blocks = [];
    let remainingMinutes = durationMinutes;
    let currentDate = new Date(startDate);
    const dailyMinutes = dailyHours * 60;

    while (remainingMinutes > 0) {
        const dayMinutes = Math.min(remainingMinutes, dailyMinutes);
        const startHour = 8; // Start at 8am
        const endHour = startHour + Math.floor(dayMinutes / 60);
        const endMinute = dayMinutes % 60;

        blocks.push({
            date: currentDate.toISOString().split('T')[0],
            startTime: `${startHour.toString().padStart(2, '0')}:00`,
            endTime: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
        });

        remainingMinutes -= dayMinutes;
        currentDate.setDate(currentDate.getDate() + 1);

        // Skip weekends
        while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    return blocks;
}

// ============================================
// JOB GENERATION
// ============================================

function generateJob(contractorId, index) {
    // Select a random job template
    const template = randomElement(JOB_TEMPLATES);

    // Generate duration within template range (or full random range if desired)
    // To honor "30 minutes to 3 days" requirement, we can also do full random:
    const useTemplateRange = Math.random() > 0.3; // 70% use template, 30% full random
    let duration;
    let crewSize;

    if (useTemplateRange) {
        duration = randomInt(template.minDuration, template.maxDuration);
        crewSize = randomInt(template.minCrew, template.maxCrew);
    } else {
        // Full random: 30 min to 3 days (4320 min), crew 1-8
        duration = randomInt(30, 4320);
        crewSize = randomInt(1, 8);
    }

    // Generate customer info
    const firstName = randomElement(CUSTOMER_FIRST_NAMES);
    const lastName = randomElement(CUSTOMER_LAST_NAMES);
    const customerName = `${firstName} ${lastName}`;
    const customerEmail = generateEmail(firstName, lastName);
    const customerPhone = generatePhoneNumber();

    // Generate location
    const coords = randomPointInRadius(CONFIG.centerLat, CONFIG.centerLng, CONFIG.radiusMiles);
    const address = generateAddress();

    // Generate scheduling info
    const scheduledDate = randomFutureDate(30);
    const scheduledTime = randomWorkTime();
    const status = randomElement(JOB_STATUSES);
    const isMultiDay = isMultiDayJob(duration);

    // Build the job object
    const job = {
        // Identity
        jobNumber: generateJobNumber(),
        contractorId: contractorId,
        source: 'direct',
        type: 'job',

        // Job details
        title: template.title,
        description: `${template.title} for ${customerName}. ${isMultiDay ? 'Multi-day project.' : 'Standard service call.'}`,
        category: template.category,
        serviceType: template.category,
        estimatedDuration: duration,
        price: Math.round(duration * (randomInt(50, 150) / 60) * 100) / 100, // $50-150/hour
        priority: randomElement(JOB_PRIORITIES),

        // Customer
        customer: {
            name: customerName,
            phone: customerPhone,
            email: customerEmail,
            address: address
        },
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail,

        // Location
        propertyAddress: address,
        serviceLocation: {
            address: address,
            coordinates: coords
        },

        // Status & Scheduling
        status: status,
        scheduledDate: scheduledDate.toISOString(),
        scheduledTime: `${scheduledDate.toISOString().split('T')[0]}T${scheduledTime}:00`,
        scheduledTimezone: 'America/Chicago',
        isMultiDay: isMultiDay,

        // Crew requirements
        crewRequirements: {
            required: crewSize,
            minimum: Math.max(1, crewSize - 1),
            maximum: Math.min(8, crewSize + 2),
            source: 'specified',
            requiresMultipleTechs: crewSize > 1,
            totalLaborHours: (duration / 60) * crewSize,
            notes: [],
            extractedAt: new Date().toISOString()
        },
        requiredCrewSize: crewSize,

        // Assignment (unassigned by default)
        assignedTechId: null,
        assignedTechName: null,
        assignedVehicleId: null,
        assignedCrew: [],
        assignedCrewIds: [],

        // Timestamps
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),

        // Metadata
        notes: `Generated test job #${index + 1}`,
        createdBy: 'script:generateRandomJobs',

        // Homeowner linking (not linked)
        homeownerLinked: false,
        homeownerId: null,
        propertyId: null
    };

    // Add multi-day schedule blocks if needed
    if (isMultiDay) {
        job.scheduleBlocks = generateScheduleBlocks(scheduledDate, duration);
        job.multiDaySchedule = {
            segments: job.scheduleBlocks,
            dailyStartTime: '08:00',
            dailyEndTime: '17:00'
        };
    }

    return job;
}

// ============================================
// MAIN SCRIPT
// ============================================

async function initializeFirebase() {
    try {
        const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
        const serviceAccount = require(serviceAccountPath);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log('✅ Firebase Admin initialized');
        return admin.firestore();
    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin');
        console.error('   Make sure serviceAccountKey.json exists in the scripts/ folder');
        console.error('   Error:', error.message);
        process.exit(1);
    }
}

async function getContractorId(db) {
    if (CONFIG.contractorId) {
        // Verify the contractor exists
        const contractorDoc = await db.doc(`${CONTRACTORS_COLLECTION}/${CONFIG.contractorId}`).get();
        if (!contractorDoc.exists) {
            console.error(`❌ Contractor with ID '${CONFIG.contractorId}' not found`);
            process.exit(1);
        }
        return CONFIG.contractorId;
    }

    // Try to find contractor by email if provided
    if (CONFIG.contractorEmail) {
        console.log(`🔍 Looking up contractor by email: ${CONFIG.contractorEmail}...`);
        try {
            // Search Firestore for contractor with matching email
            const contractorsSnapshot = await db.collection(CONTRACTORS_COLLECTION)
                .where('email', '==', CONFIG.contractorEmail)
                .limit(1)
                .get();

            if (!contractorsSnapshot.empty) {
                const doc = contractorsSnapshot.docs[0];
                const data = doc.data();
                console.log(`   Found contractor: ${doc.id}`);
                console.log(`   Business: ${data.businessName || data.profile?.companyName || data.name || 'Unknown'}`);
                return doc.id;
            }

            // Also check profile.email field
            const profileSnapshot = await db.collection(CONTRACTORS_COLLECTION)
                .where('profile.email', '==', CONFIG.contractorEmail)
                .limit(1)
                .get();

            if (!profileSnapshot.empty) {
                const doc = profileSnapshot.docs[0];
                const data = doc.data();
                console.log(`   Found contractor: ${doc.id}`);
                console.log(`   Business: ${data.businessName || data.profile?.companyName || data.name || 'Unknown'}`);
                return doc.id;
            }

            console.error(`❌ Could not find contractor with email '${CONFIG.contractorEmail}'`);
            console.log('   Listing available contractors...');
        } catch (error) {
            console.error(`❌ Error searching for contractor: ${error.message}`);
        }
    }

    // Try to find the test contractor by email in Firestore
    if (!CONFIG.contractorEmail) {
        console.log('🔍 Looking for test.contractor.full@gmail.com...');
        try {
            const testSnapshot = await db.collection(CONTRACTORS_COLLECTION)
                .where('email', '==', 'test.contractor.full@gmail.com')
                .limit(1)
                .get();

            if (!testSnapshot.empty) {
                const doc = testSnapshot.docs[0];
                console.log(`   Found contractor: ${doc.id}`);
                return doc.id;
            }
        } catch (error) {
            // Not found, continue to list available contractors
        }
    }

    // List available contractors
    console.log('\n📋 Available contractors:');
    const contractorsSnapshot = await db.collection(CONTRACTORS_COLLECTION).limit(10).get();
    if (contractorsSnapshot.empty) {
        console.error('❌ No contractors found. Please run createTestAccounts.js first or specify --contractor-id');
        process.exit(1);
    }

    contractorsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   ${doc.id}: ${data.businessName || data.profile?.companyName || data.name || 'Unknown'}`);
    });

    console.error('\n❌ Please specify a contractor ID with --contractor-id=<id> or --contractor-email=<email>');
    process.exit(1);
}

async function main() {
    console.log('\n🏗️  RANDOM JOB GENERATOR FOR SCHEDULING TESTING\n');
    console.log('=' .repeat(60));
    console.log('\nConfiguration:');
    console.log(`   Jobs to create: ${CONFIG.count}`);
    console.log(`   Center point: ${CONFIG.centerLat}, ${CONFIG.centerLng}`);
    console.log(`   Radius: ${CONFIG.radiusMiles} miles`);
    console.log(`   Duration range: 30 minutes to 3 days`);
    console.log(`   Crew size range: 1 to 8`);
    console.log(`   Dry run: ${CONFIG.dryRun ? 'Yes (no jobs will be created)' : 'No'}`);
    console.log('');

    const db = await initializeFirebase();
    const contractorId = await getContractorId(db);

    console.log(`\n📝 Generating ${CONFIG.count} random jobs for contractor: ${contractorId}\n`);

    const jobs = [];
    const stats = {
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        totalCrew: 0,
        minCrew: Infinity,
        maxCrew: 0,
        multiDayCount: 0,
        byCategory: {}
    };

    // Generate all jobs
    for (let i = 0; i < CONFIG.count; i++) {
        const job = generateJob(contractorId, i);
        jobs.push(job);

        // Collect stats
        stats.totalDuration += job.estimatedDuration;
        stats.minDuration = Math.min(stats.minDuration, job.estimatedDuration);
        stats.maxDuration = Math.max(stats.maxDuration, job.estimatedDuration);
        stats.totalCrew += job.requiredCrewSize;
        stats.minCrew = Math.min(stats.minCrew, job.requiredCrewSize);
        stats.maxCrew = Math.max(stats.maxCrew, job.requiredCrewSize);
        if (job.isMultiDay) stats.multiDayCount++;
        stats.byCategory[job.category] = (stats.byCategory[job.category] || 0) + 1;
    }

    // Print preview
    console.log('📊 Job Statistics:');
    console.log(`   Duration range: ${stats.minDuration} min - ${stats.maxDuration} min`);
    console.log(`   Average duration: ${Math.round(stats.totalDuration / CONFIG.count)} min`);
    console.log(`   Crew size range: ${stats.minCrew} - ${stats.maxCrew}`);
    console.log(`   Average crew size: ${(stats.totalCrew / CONFIG.count).toFixed(1)}`);
    console.log(`   Multi-day jobs: ${stats.multiDayCount} (${Math.round(stats.multiDayCount / CONFIG.count * 100)}%)`);
    console.log('\n   By Category:');
    Object.entries(stats.byCategory)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
            console.log(`      ${cat}: ${count}`);
        });

    // Show sample jobs
    console.log('\n📋 Sample Jobs (first 3):');
    jobs.slice(0, 3).forEach((job, i) => {
        console.log(`\n   ${i + 1}. ${job.title}`);
        console.log(`      Customer: ${job.customerName}`);
        console.log(`      Address: ${job.propertyAddress}`);
        console.log(`      Duration: ${job.estimatedDuration} min (${(job.estimatedDuration / 60).toFixed(1)} hrs)`);
        console.log(`      Crew: ${job.requiredCrewSize}`);
        console.log(`      Status: ${job.status}`);
        console.log(`      Multi-day: ${job.isMultiDay ? 'Yes' : 'No'}`);
    });

    if (CONFIG.dryRun) {
        console.log('\n⚠️  DRY RUN MODE - No jobs were created');
        console.log('   Remove --dry-run flag to create jobs\n');
        process.exit(0);
    }

    // Create jobs in Firestore
    console.log('\n⏳ Creating jobs in Firestore...');

    const batchSize = 500; // Firestore batch limit
    let created = 0;

    for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = db.batch();
        const batchJobs = jobs.slice(i, i + batchSize);

        for (const job of batchJobs) {
            const docRef = db.collection(REQUESTS_COLLECTION).doc();
            batch.set(docRef, job);
        }

        await batch.commit();
        created += batchJobs.length;
        console.log(`   Created ${created}/${jobs.length} jobs...`);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ COMPLETE!');
    console.log(`   Created ${CONFIG.count} random jobs for contractor: ${contractorId}`);
    console.log('\n   You can now test scheduling with these jobs.\n');

    process.exit(0);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
