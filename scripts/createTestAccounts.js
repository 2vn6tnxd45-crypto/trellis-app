#!/usr/bin/env node
/**
 * Firebase Admin Script: Create Test Accounts for Krib Testing
 *
 * This script creates test accounts with realistic data for testing:
 * - test.homeowner.new@gmail.com (no data)
 * - test.homeowner.full@gmail.com (with sample data)
 * - test.contractor.new@gmail.com (no data)
 * - test.contractor.full@gmail.com (with sample data)
 *
 * SETUP:
 * 1. Go to Firebase Console > Project Settings > Service Accounts
 * 2. Click "Generate new private key" and download the JSON file
 * 3. Save it as `serviceAccountKey.json` in the `scripts/` folder
 * 4. Run: node scripts/createTestAccounts.js
 *
 * IMPORTANT: Never commit serviceAccountKey.json to version control!
 */

const admin = require('firebase-admin');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const APP_ID = 'krib-app';
const TEST_PASSWORD = 'TestPass123!'; // Meets all validation rules

const TEST_ACCOUNTS = {
    'test.homeowner.new@gmail.com': {
        displayName: 'Test Homeowner (New)',
        role: 'homeowner',
        hasData: false
    },
    'test.homeowner.full@gmail.com': {
        displayName: 'Test Homeowner (Full)',
        role: 'homeowner',
        hasData: true
    },
    'test.contractor.new@gmail.com': {
        displayName: 'Test Contractor (New)',
        role: 'contractor',
        hasData: false
    },
    'test.contractor.full@gmail.com': {
        displayName: 'Test Contractor (Full)',
        role: 'contractor',
        hasData: true
    }
};

// ============================================
// SAMPLE DATA GENERATORS
// ============================================

const generateHomeownerRecords = () => [
    {
        name: 'Samsung French Door Refrigerator',
        category: 'Appliances',
        room: 'Kitchen',
        purchaseDate: '2023-01-15',
        price: 2499.99,
        brand: 'Samsung',
        model: 'RF28R7551SR',
        warrantyExpires: '2026-01-15',
        notes: 'Stainless steel, ice maker works great',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        name: 'Carrier Central AC Unit',
        category: 'HVAC & Systems',
        room: 'Exterior',
        purchaseDate: '2022-06-20',
        price: 5500.00,
        brand: 'Carrier',
        model: '24ACC636A003',
        warrantyExpires: '2032-06-20',
        maintenanceFrequency: 'annual',
        lastMaintenance: '2024-06-15',
        nextMaintenance: '2025-06-15',
        notes: '3-ton unit, annual filter change required',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        name: 'Water Heater',
        category: 'Plumbing',
        room: 'Garage',
        purchaseDate: '2021-03-10',
        price: 1200.00,
        brand: 'Rheem',
        model: 'PROG50-38N RH67',
        warrantyExpires: '2027-03-10',
        maintenanceFrequency: 'annual',
        notes: '50 gallon, natural gas',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        name: 'LG Front Load Washer',
        category: 'Appliances',
        room: 'Laundry Room',
        purchaseDate: '2023-08-05',
        price: 999.99,
        brand: 'LG',
        model: 'WM4000HWA',
        warrantyExpires: '2025-08-05',
        notes: 'Steam clean feature',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        name: 'LG Electric Dryer',
        category: 'Appliances',
        room: 'Laundry Room',
        purchaseDate: '2023-08-05',
        price: 899.99,
        brand: 'LG',
        model: 'DLEX4000W',
        warrantyExpires: '2025-08-05',
        notes: 'Sensor dry, lint trap clean monthly',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        name: 'Interior Paint - Living Room',
        category: 'Paint & Finishes',
        room: 'Living Room',
        purchaseDate: '2024-02-20',
        price: 185.00,
        brand: 'Benjamin Moore',
        colorCode: 'OC-17 White Dove',
        notes: 'Eggshell finish, 2 coats applied',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        name: 'Hardwood Flooring',
        category: 'Flooring',
        room: 'Living Room',
        purchaseDate: '2020-11-15',
        price: 4500.00,
        brand: 'Bruce',
        model: 'Natural Oak',
        warrantyExpires: '2045-11-15',
        notes: 'Refinished in 2024',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        name: 'Roof Shingles',
        category: 'Roof & Exterior',
        room: 'Exterior',
        purchaseDate: '2019-04-10',
        price: 12000.00,
        brand: 'GAF',
        model: 'Timberline HDZ',
        warrantyExpires: '2044-04-10',
        maintenanceFrequency: 'annual',
        notes: 'Charcoal color, inspected annually',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        name: 'Smoke Detectors (6 units)',
        category: 'Safety',
        room: 'Hallway',
        purchaseDate: '2024-01-01',
        price: 180.00,
        brand: 'First Alert',
        model: 'SA320CN',
        warrantyExpires: '2034-01-01',
        maintenanceFrequency: 'monthly',
        notes: 'Battery test monthly, replace batteries annually',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        name: 'Garage Door Opener',
        category: 'Electrical',
        room: 'Garage',
        purchaseDate: '2022-09-18',
        price: 450.00,
        brand: 'Chamberlain',
        model: 'B4545',
        warrantyExpires: '2025-09-18',
        notes: 'Smart home enabled, battery backup',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }
];

const generatePendingQuotes = (homeownerUid) => [
    {
        homeownerId: homeownerUid,
        title: 'HVAC Annual Maintenance',
        description: 'Annual AC tune-up and inspection',
        status: 'pending',
        amount: 189.00,
        category: 'HVAC & Systems',
        requestedDate: admin.firestore.FieldValue.serverTimestamp(),
        notes: 'Requested filter replacement and coil cleaning',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        homeownerId: homeownerUid,
        title: 'Kitchen Faucet Replacement',
        description: 'Replace leaky kitchen faucet with new Delta model',
        status: 'pending',
        amount: 350.00,
        category: 'Plumbing',
        requestedDate: admin.firestore.FieldValue.serverTimestamp(),
        notes: 'Homeowner prefers brushed nickel finish',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }
];

const generateActiveJob = (homeownerUid) => ({
    homeownerId: homeownerUid,
    title: 'Electrical Panel Upgrade',
    description: 'Upgrade from 100A to 200A panel',
    status: 'in_progress',
    amount: 2800.00,
    category: 'Electrical',
    scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
    notes: 'Permit obtained, inspection scheduled after completion',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
});

const generateContractorCustomers = (contractorUid) => [
    {
        contractorId: contractorUid,
        name: 'John Smith',
        email: 'john.smith@example.com',
        phone: '555-0101',
        address: '123 Oak Street, Austin, TX 78701',
        notes: 'Prefers morning appointments',
        totalJobs: 5,
        totalRevenue: 3250.00,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        name: 'Sarah Johnson',
        email: 'sarah.j@example.com',
        phone: '555-0102',
        address: '456 Maple Ave, Austin, TX 78702',
        notes: 'Has two dogs - call before arrival',
        totalJobs: 3,
        totalRevenue: 1850.00,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        name: 'Mike Davis',
        email: 'mike.d@example.com',
        phone: '555-0103',
        address: '789 Pine Road, Austin, TX 78703',
        notes: 'Gate code: 1234',
        totalJobs: 8,
        totalRevenue: 5400.00,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        name: 'Emily Wilson',
        email: 'emily.w@example.com',
        phone: '555-0104',
        address: '321 Cedar Lane, Austin, TX 78704',
        notes: 'New customer - referred by John Smith',
        totalJobs: 1,
        totalRevenue: 450.00,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        name: 'Robert Brown',
        email: 'r.brown@example.com',
        phone: '555-0105',
        address: '654 Elm Street, Austin, TX 78705',
        notes: 'Commercial property - parking in rear',
        totalJobs: 12,
        totalRevenue: 8900.00,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }
];

const generateContractorJobs = (contractorUid) => [
    {
        contractorId: contractorUid,
        customerName: 'John Smith',
        title: 'AC Repair',
        description: 'Compressor not starting - needs capacitor replacement',
        status: 'scheduled',
        amount: 350.00,
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        category: 'HVAC',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        customerName: 'Sarah Johnson',
        title: 'Furnace Tune-up',
        description: 'Annual maintenance and filter replacement',
        status: 'in_progress',
        amount: 189.00,
        scheduledDate: new Date(),
        category: 'HVAC',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        customerName: 'Robert Brown',
        title: 'Commercial HVAC Install',
        description: 'Install 5-ton rooftop unit for warehouse',
        status: 'pending_approval',
        amount: 8500.00,
        scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        category: 'HVAC',
        notes: 'Waiting on permit approval',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }
];

const generatePriceBookItems = (contractorUid) => [
    {
        contractorId: contractorUid,
        name: 'AC Tune-up',
        description: 'Complete AC system inspection, cleaning, and tune-up',
        price: 189.00,
        category: 'Maintenance',
        duration: 60, // minutes
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        name: 'Furnace Tune-up',
        description: 'Complete furnace inspection, cleaning, and tune-up',
        price: 169.00,
        category: 'Maintenance',
        duration: 60,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        name: 'Diagnostic Service Call',
        description: 'Troubleshoot and diagnose HVAC system issues',
        price: 89.00,
        category: 'Service',
        duration: 45,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        name: 'Capacitor Replacement',
        description: 'Replace failed capacitor (part + labor)',
        price: 250.00,
        category: 'Repair',
        duration: 30,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        name: 'Thermostat Installation',
        description: 'Install and program new smart thermostat',
        price: 175.00,
        category: 'Installation',
        duration: 45,
        notes: 'Price does not include thermostat cost',
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        name: 'Duct Cleaning',
        description: 'Complete duct system cleaning (up to 10 vents)',
        price: 399.00,
        category: 'Maintenance',
        duration: 180,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        name: 'Refrigerant Recharge',
        description: 'Check for leaks and recharge refrigerant',
        price: 350.00,
        category: 'Repair',
        duration: 60,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
        contractorId: contractorUid,
        name: 'Filter Replacement',
        description: 'Replace standard air filter (filter included)',
        price: 45.00,
        category: 'Maintenance',
        duration: 15,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }
];

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

async function createOrGetUser(email, displayName) {
    try {
        // Try to get existing user
        const existingUser = await admin.auth().getUserByEmail(email);
        console.log(`   Found existing user: ${email} (${existingUser.uid})`);
        return existingUser;
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            // Create new user
            const newUser = await admin.auth().createUser({
                email,
                password: TEST_PASSWORD,
                displayName,
                emailVerified: true
            });
            console.log(`   Created new user: ${email} (${newUser.uid})`);
            return newUser;
        }
        throw error;
    }
}

async function createHomeownerData(db, uid, email) {
    const batch = db.batch();
    const basePath = `artifacts/${APP_ID}/users/${uid}`;

    // Create profile
    const profileRef = db.doc(`${basePath}/settings/profile`);
    batch.set(profileRef, {
        name: 'Test Homeowner (Full)',
        email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create property
    const propertyRef = db.doc(`${basePath}/properties/test-property-1`);
    batch.set(propertyRef, {
        address: '1234 Test Street, Austin, TX 78701',
        nickname: 'Main House',
        isActive: true,
        propertyType: 'single_family',
        bedrooms: 4,
        bathrooms: 2.5,
        squareFootage: 2400,
        yearBuilt: 2010,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create house records
    const records = generateHomeownerRecords();
    records.forEach((record, index) => {
        const recordRef = db.doc(`${basePath}/house_records/record-${index + 1}`);
        batch.set(recordRef, {
            ...record,
            propertyId: 'test-property-1'
        });
    });

    await batch.commit();
    console.log(`   Created ${records.length} house records`);

    // Create quotes (separate batch)
    const quotesBatch = db.batch();
    const quotes = generatePendingQuotes(uid);
    quotes.forEach((quote, index) => {
        const quoteRef = db.doc(`artifacts/${APP_ID}/public/data/quotes/quote-${uid}-${index + 1}`);
        quotesBatch.set(quoteRef, quote);
    });
    await quotesBatch.commit();
    console.log(`   Created ${quotes.length} pending quotes`);

    // Create active job
    const jobRef = db.doc(`artifacts/${APP_ID}/public/data/jobs/job-${uid}-active`);
    await jobRef.set(generateActiveJob(uid));
    console.log('   Created 1 active job');
}

async function createContractorData(db, uid, email) {
    const batch = db.batch();

    // Create contractor profile
    const profileRef = db.doc(`artifacts/${APP_ID}/public/data/contractors/${uid}`);
    batch.set(profileRef, {
        name: 'Test Contractor (Full)',
        email,
        businessName: 'Test HVAC Services LLC',
        phone: '555-TEST-PRO',
        address: '999 Contractor Way, Austin, TX 78799',
        services: ['HVAC', 'Heating', 'Cooling', 'Maintenance'],
        isVerified: true,
        rating: 4.8,
        reviewCount: 47,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create customers
    const customers = generateContractorCustomers(uid);
    customers.forEach((customer, index) => {
        const customerRef = db.doc(`artifacts/${APP_ID}/public/data/contractors/${uid}/customers/customer-${index + 1}`);
        batch.set(customerRef, customer);
    });

    // Create price book items
    const priceItems = generatePriceBookItems(uid);
    priceItems.forEach((item, index) => {
        const itemRef = db.doc(`artifacts/${APP_ID}/public/data/contractors/${uid}/priceBook/item-${index + 1}`);
        batch.set(itemRef, item);
    });

    await batch.commit();
    console.log(`   Created contractor profile with ${customers.length} customers and ${priceItems.length} price book items`);

    // Create jobs (separate batch)
    const jobsBatch = db.batch();
    const jobs = generateContractorJobs(uid);
    jobs.forEach((job, index) => {
        const jobRef = db.doc(`artifacts/${APP_ID}/public/data/contractors/${uid}/jobs/job-${index + 1}`);
        jobsBatch.set(jobRef, job);
    });
    await jobsBatch.commit();
    console.log(`   Created ${jobs.length} active jobs`);
}

async function main() {
    console.log('\n🏠 KRIB TEST ACCOUNT SETUP SCRIPT\n');
    console.log('=' .repeat(50));

    const db = await initializeFirebase();

    for (const [email, config] of Object.entries(TEST_ACCOUNTS)) {
        console.log(`\n📧 Processing: ${email}`);

        try {
            const user = await createOrGetUser(email, config.displayName);

            if (config.hasData) {
                if (config.role === 'homeowner') {
                    await createHomeownerData(db, user.uid, email);
                } else if (config.role === 'contractor') {
                    await createContractorData(db, user.uid, email);
                }
            } else {
                console.log('   (No data - new user account only)');
            }

            console.log(`   ✅ Complete`);
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
        }
    }

    console.log('\n' + '=' .repeat(50));
    console.log('\n✅ SETUP COMPLETE!\n');
    console.log('Test credentials:');
    console.log(`   Password: ${TEST_PASSWORD}`);
    console.log('\nAccounts created:');
    Object.entries(TEST_ACCOUNTS).forEach(([email, config]) => {
        console.log(`   ${config.hasData ? '📊' : '🆕'} ${email}`);
    });
    console.log('\n');

    process.exit(0);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
