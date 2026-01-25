#!/usr/bin/env node
/**
 * Firebase Admin Script: Generate Test Data for E2E Testing
 *
 * This script populates a contractor/homeowner account with ALL data needed
 * for Playwright tests to run properly:
 * 
 * CONTRACTOR DATA:
 * - Business hours (random but normal-ish)
 * - Team members (1-6) with individual working hours
 * - Fleet vehicles
 * - Random jobs in various statuses (pending_schedule, scheduled, in_progress, completed)
 * - Membership plans (Gold, Silver, VIP)
 * - Customers (some with active memberships)
 * - Quotes (draft and sent)
 *
 * HOMEOWNER DATA (when --homeowner-id is provided):
 * - Property with address
 * - Home items (HVAC, water heater, appliances) with maintenance tasks
 * - Some tasks will be overdue for calendar testing
 *
 * SETUP:
 * 1. Save your Firebase service account key as `scripts/serviceAccountKey.json`
 * 2. Run: node scripts/generateRandomJobs.cjs --contractor-id=<UID> --count=20
 *
 * OPTIONS:
 *   --contractor-id=<id>     Contractor Firebase UID (required)
 *   --homeowner-id=<id>      Homeowner UID for property/items (defaults to contractor-id)
 *   --count=<n>              Number of jobs to create (default: 20)
 *   --crew-count=<n>         Number of crew members to create (default: random 2-6)
 *   --vehicle-count=<n>      Number of vehicles (default: matches crew roughly)
 *   --radius=<miles>         Radius in miles from Austin center (default: 15)
 *   --skip-homeowner         Skip homeowner property/items generation
 *   --reset                   DELETE existing data before creating new (clean slate)
 *   --dry-run                Preview without creating anything
 */

const admin = require('firebase-admin');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const APP_ID = 'krib-app';
const CONTRACTORS_COLLECTION = `artifacts/${APP_ID}/public/data/contractors`;
const REQUESTS_COLLECTION = `artifacts/${APP_ID}/public/data/requests`;

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.replace('--', '').split('=');
    acc[key] = value === undefined ? true : value;
    return acc;
}, {});

const CONFIG = {
    contractorId: args['contractor-id'] || null,
    homeownerId: args['homeowner-id'] || args['contractor-id'] || null, // Same account can be both
    count: parseInt(args['count']) || 20,
    crewCount: args['crew-count'] ? parseInt(args['crew-count']) : null, // null = random 2-6
    vehicleCount: args['vehicle-count'] ? parseInt(args['vehicle-count']) : null,
    radiusMiles: parseFloat(args['radius']) || 15,
    dryRun: args['dry-run'] || false,
    skipHomeowner: args['skip-homeowner'] || false,
    reset: args['reset'] || false  // Delete existing data before creating new
};

// Additional collection paths
const QUOTES_COLLECTION = `artifacts/${APP_ID}/public/data/quotes`;
const MEMBERSHIPS_COLLECTION = `artifacts/${APP_ID}/public/data/memberships`;
const MEMBERSHIP_PLANS_COLLECTION = `artifacts/${APP_ID}/public/data/membershipPlans`;
const CUSTOMERS_COLLECTION = `artifacts/${APP_ID}/public/data/customers`;
// PROPERTIES_COLLECTION and ITEMS_COLLECTION removed as they are user-specific

// ============================================
// VALID AUSTIN, TX ADDRESSES
// These are real addresses in the Austin metro area
// ============================================
const AUSTIN_ADDRESSES = [
    { address: '1100 Congress Ave, Austin, TX 78701', lat: 30.2747, lng: -97.7443 },
    { address: '2400 E Cesar Chavez St, Austin, TX 78702', lat: 30.2555, lng: -97.7227 },
    { address: '4001 S Lamar Blvd, Austin, TX 78704', lat: 30.2401, lng: -97.7923 },
    { address: '8650 Spicewood Springs Rd, Austin, TX 78759', lat: 30.4159, lng: -97.7637 },
    { address: '3300 Bee Cave Rd, Austin, TX 78746', lat: 30.2921, lng: -97.8158 },
    { address: '9500 S IH-35, Austin, TX 78748', lat: 30.1564, lng: -97.7924 },
    { address: '12901 N MoPac Expy, Austin, TX 78727', lat: 30.4252, lng: -97.6988 },
    { address: '1000 E 41st St, Austin, TX 78751', lat: 30.3011, lng: -97.7211 },
    { address: '5501 Ed Bluestein Blvd, Austin, TX 78723', lat: 30.2994, lng: -97.6717 },
    { address: '7701 N Lamar Blvd, Austin, TX 78752', lat: 30.3505, lng: -97.6938 },
    { address: '2901 S Capital of Texas Hwy, Austin, TX 78746', lat: 30.2610, lng: -97.8024 },
    { address: '11200 Lakeline Mall Dr, Cedar Park, TX 78613', lat: 30.4731, lng: -97.8037 },
    { address: '4301 W William Cannon Dr, Austin, TX 78749', lat: 30.2108, lng: -97.8413 },
    { address: '6001 Airport Blvd, Austin, TX 78752', lat: 30.3207, lng: -97.6845 },
    { address: '901 Little Texas Ln, Austin, TX 78745', lat: 30.2001, lng: -97.7814 },
    { address: '5000 Burnet Rd, Austin, TX 78756', lat: 30.3242, lng: -97.7394 },
    { address: '1601 S MoPac Expy, Austin, TX 78746', lat: 30.2571, lng: -97.7929 },
    { address: '10515 N MoPac Expy, Austin, TX 78759', lat: 30.3982, lng: -97.7392 },
    { address: '3600 Presidential Blvd, Austin, TX 78719', lat: 30.1927, lng: -97.6700 },
    { address: '2110 W Slaughter Ln, Austin, TX 78748', lat: 30.1734, lng: -97.8423 },
    { address: '7112 Ed Bluestein Blvd, Austin, TX 78723', lat: 30.3101, lng: -97.6591 },
    { address: '4970 US-290 W, Austin, TX 78735', lat: 30.2403, lng: -97.8889 },
    { address: '1819 Rosewood Ave, Austin, TX 78702', lat: 30.2670, lng: -97.7211 },
    { address: '5300 Duval Rd, Austin, TX 78727', lat: 30.4109, lng: -97.7192 },
    { address: '13201 Ranch Rd 620 N, Austin, TX 78717', lat: 30.4897, lng: -97.7880 },
    { address: '4115 Guadalupe St, Austin, TX 78751', lat: 30.2984, lng: -97.7364 },
    { address: '6406 N IH-35, Austin, TX 78752', lat: 30.3306, lng: -97.6901 },
    { address: '8900 Shoal Creek Blvd, Austin, TX 78757', lat: 30.3708, lng: -97.7407 },
    { address: '3500 Greystone Dr, Austin, TX 78731', lat: 30.3612, lng: -97.7651 },
    { address: '2525 W Anderson Ln, Austin, TX 78757', lat: 30.3596, lng: -97.7385 },
    { address: '1506 S 1st St, Austin, TX 78704', lat: 30.2512, lng: -97.7545 },
    { address: '4534 Westgate Blvd, Austin, TX 78745', lat: 30.2208, lng: -97.7986 },
    { address: '14028 N US-183, Austin, TX 78717', lat: 30.4825, lng: -97.7625 },
    { address: '9607 Research Blvd, Austin, TX 78759', lat: 30.3916, lng: -97.7478 },
    { address: '1023 Springdale Rd, Austin, TX 78721', lat: 30.2635, lng: -97.6945 },
    { address: '6800 West Gate Blvd, Austin, TX 78745', lat: 30.2045, lng: -97.8102 },
    { address: '2901 S Lamar Blvd, Austin, TX 78704', lat: 30.2459, lng: -97.7881 },
    { address: '3801 S Congress Ave, Austin, TX 78704', lat: 30.2352, lng: -97.7562 },
    { address: '12233 Ranch Rd 620 N, Austin, TX 78750', lat: 30.4486, lng: -97.8086 },
    { address: '1700 S Pleasant Valley Rd, Austin, TX 78741', lat: 30.2391, lng: -97.7199 },
    { address: '5601 Brodie Ln, Austin, TX 78745', lat: 30.2012, lng: -97.8324 },
    { address: '7800 Shoal Creek Blvd, Austin, TX 78757', lat: 30.3564, lng: -97.7403 },
    { address: '10901 N Lamar Blvd, Austin, TX 78753', lat: 30.3918, lng: -97.6869 },
    { address: '2200 S Pleasant Valley Rd, Austin, TX 78741', lat: 30.2335, lng: -97.7165 },
    { address: '4700 E Oltorf St, Austin, TX 78741', lat: 30.2322, lng: -97.7103 },
    { address: '6500 N Lamar Blvd, Austin, TX 78752', lat: 30.3367, lng: -97.6966 },
    { address: '501 E Riverside Dr, Austin, TX 78704', lat: 30.2453, lng: -97.7381 },
    { address: '4477 S Lamar Blvd, Austin, TX 78745', lat: 30.2308, lng: -97.7955 },
    { address: '11301 Lakeline Blvd, Austin, TX 78717', lat: 30.4682, lng: -97.7851 },
    { address: '2700 W Anderson Ln, Austin, TX 78757', lat: 30.3604, lng: -97.7428 }
];

// Home base options (contractor office locations)
const HOME_BASE_OPTIONS = [
    { address: '3500 Jefferson St, Austin, TX 78731', lat: 30.3461, lng: -97.7549 },
    { address: '6701 Burnet Rd, Austin, TX 78757', lat: 30.3481, lng: -97.7361 },
    { address: '2200 S Lamar Blvd, Austin, TX 78704', lat: 30.2485, lng: -97.7838 },
    { address: '8868 Research Blvd, Austin, TX 78758', lat: 30.3803, lng: -97.7254 },
    { address: '4030 W Braker Ln, Austin, TX 78759', lat: 30.3939, lng: -97.7377 },
];

// ============================================
// NAME AND JOB DATA
// ============================================

const FIRST_NAMES = [
    'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
    'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Lisa', 'Daniel', 'Nancy',
    'Matthew', 'Ashley', 'Anthony', 'Emily', 'Mark', 'Donna', 'Steven', 'Michelle',
    'Andrew', 'Kimberly', 'Paul', 'Sandra', 'Joshua', 'Betty', 'Kenneth', 'Margaret'
];

const LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
    'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker'
];

const TECH_ROLES = ['technician', 'senior_tech', 'lead', 'apprentice'];
const TECH_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];

const TECH_SKILLS = [
    'HVAC Installation', 'HVAC Repair', 'Electrical Wiring', 'Plumbing',
    'Carpentry', 'Roofing', 'Painting', 'Drywall', 'Concrete',
    'Flooring', 'Welding', 'Landscaping', 'Fencing', 'Demolition'
];

const VEHICLE_MAKES_MODELS = [
    { make: 'Ford', model: 'Transit', type: 'van', year: 2022 },
    { make: 'Ford', model: 'F-150', type: 'truck', year: 2023 },
    { make: 'Ford', model: 'F-250', type: 'truck', year: 2021 },
    { make: 'Chevrolet', model: 'Express', type: 'van', year: 2022 },
    { make: 'Chevrolet', model: 'Silverado 1500', type: 'truck', year: 2023 },
    { make: 'Ram', model: '1500', type: 'truck', year: 2022 },
    { make: 'Ram', model: 'ProMaster', type: 'van', year: 2021 },
    { make: 'Toyota', model: 'Tacoma', type: 'truck', year: 2023 },
    { make: 'Mercedes-Benz', model: 'Sprinter', type: 'van', year: 2022 },
    { make: 'Nissan', model: 'NV2500', type: 'van', year: 2021 },
];

const VEHICLE_EQUIPMENT = [
    'ladder_6ft', 'ladder_extension', 'basic_tools', 'power_tools',
    'diagnostic_equipment', 'drain_camera', 'multimeter', 'generator',
    'welding_kit', 'first_aid', 'fire_extinguisher', 'safety_cones'
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
    { title: 'Demolition Project', category: 'Demolition', minDuration: 480, maxDuration: 1440, minCrew: 3, maxCrew: 6 }
];

const JOB_PRIORITIES = ['low', 'normal', 'normal', 'normal', 'high', 'urgent'];

// ============================================
// JOB STATUS DISTRIBUTION (for realistic testing)
// ============================================
const JOB_STATUS_DISTRIBUTION = [
    { status: 'pending_schedule', weight: 3 },   // 3 jobs needing scheduling
    { status: 'scheduled', weight: 4 },          // 4 scheduled jobs (for reschedule tests)
    { status: 'in_progress', weight: 2 },        // 2 in-progress jobs (for status update tests)
    { status: 'completed', weight: 3 }           // 3 completed jobs (for import/history tests)
];

// ============================================
// MEMBERSHIP PLANS (for membership-lifecycle tests)
// ============================================
const MEMBERSHIP_PLAN_TEMPLATES = [
    {
        name: 'Gold Maintenance Plan',
        description: 'Priority service with 15% discount on all labor',
        features: ['Priority scheduling', '15% labor discount', 'Free annual inspection', 'No service call fees'],
        billingInterval: 'monthly',
        price: 49.99,
        discountPercent: 15,
        active: true
    },
    {
        name: 'Silver Service Plan',
        description: 'Basic maintenance coverage with 10% discount',
        features: ['10% labor discount', 'Reduced service call fee', 'Annual tune-up included'],
        billingInterval: 'monthly',
        price: 29.99,
        discountPercent: 10,
        active: true
    },
    {
        name: 'Annual VIP Plan',
        description: 'Best value - pay yearly and save 20%',
        features: ['20% discount on all services', 'Priority emergency response', 'Free quarterly inspections', 'Extended warranty coverage'],
        billingInterval: 'yearly',
        price: 399.99,
        discountPercent: 20,
        active: true
    }
];

// ============================================
// QUOTE TEMPLATES (for quote tests)
// ============================================
const QUOTE_TEMPLATES = [
    {
        title: 'Water Heater Replacement',
        lineItems: [
            { description: '50 Gallon Water Heater - Rheem', quantity: 1, unitPrice: 850, type: 'material' },
            { description: 'Installation Labor', quantity: 4, unitPrice: 125, type: 'labor' },
            { description: 'Permit Fee', quantity: 1, unitPrice: 150, type: 'fee' }
        ],
        depositPercent: 50
    },
    {
        title: 'AC System Tune-Up',
        lineItems: [
            { description: 'Complete AC Inspection & Service', quantity: 1, unitPrice: 189, type: 'service' },
            { description: 'Filter Replacement (2-pack)', quantity: 1, unitPrice: 45, type: 'material' }
        ],
        depositPercent: 0
    },
    {
        title: 'Kitchen Faucet Installation',
        lineItems: [
            { description: 'Delta Kitchen Faucet', quantity: 1, unitPrice: 289, type: 'material' },
            { description: 'Installation Labor', quantity: 2, unitPrice: 85, type: 'labor' },
            { description: 'Under-sink supply lines', quantity: 2, unitPrice: 25, type: 'material' }
        ],
        depositPercent: 25
    }
];

// ============================================
// HOME ITEMS (for homeowner/pedigree tests)
// ============================================
const HOME_ITEM_TEMPLATES = [
    {
        item: 'Carrier Central AC Unit',
        category: 'HVAC & Systems',
        brand: 'Carrier',
        model: '24ACC636A003',
        area: 'Exterior',
        cost: 5500,
        maintenanceTasks: [
            { name: 'Filter Replacement', intervalDays: 90, description: 'Replace air filter every 3 months' },
            { name: 'Annual Tune-Up', intervalDays: 365, description: 'Professional HVAC inspection and maintenance' },
            { name: 'Refrigerant Check', intervalDays: 365, description: 'Check refrigerant levels and system pressure' }
        ],
        warranty: '10 year parts warranty'
    },
    {
        item: 'Rheem Water Heater',
        category: 'Plumbing',
        brand: 'Rheem',
        model: 'PROG50-38N RH67',
        area: 'Garage',
        cost: 1200,
        maintenanceTasks: [
            { name: 'Anode Rod Inspection', intervalDays: 365, description: 'Inspect anode rod for corrosion' },
            { name: 'Flush Tank', intervalDays: 365, description: 'Drain and flush tank to remove sediment' }
        ],
        warranty: '6 year parts warranty'
    },
    {
        item: 'Bosch Dishwasher',
        category: 'Appliances',
        brand: 'Bosch',
        model: 'SHPM88Z75N',
        area: 'Kitchen',
        cost: 899,
        maintenanceTasks: [
            { name: 'Clean Filter', intervalDays: 30, description: 'Remove and clean the filter basket' },
            { name: 'Descale', intervalDays: 180, description: 'Run descaling cycle to remove mineral buildup' }
        ],
        warranty: '2 year manufacturer warranty'
    },
    {
        item: 'Roof (Composition Shingle)',
        category: 'Roofing',
        brand: 'GAF',
        model: 'Timberline HDZ',
        area: 'Exterior',
        cost: 12500,
        maintenanceTasks: [
            { name: 'Annual Inspection', intervalDays: 365, description: 'Check for damaged or missing shingles' },
            { name: 'Gutter Cleaning', intervalDays: 180, description: 'Clear debris from gutters and downspouts' }
        ],
        warranty: '25 year limited warranty'
    },
    {
        item: 'Garage Door & Opener',
        category: 'Structure',
        brand: 'LiftMaster',
        model: '8500W',
        area: 'Garage',
        cost: 1800,
        maintenanceTasks: [
            { name: 'Lubricate Moving Parts', intervalDays: 180, description: 'Apply lubricant to springs, hinges, and rollers' },
            { name: 'Safety Sensor Test', intervalDays: 90, description: 'Test safety reverse sensors' }
        ],
        warranty: '5 year motor warranty'
    }
];

// ============================================
// PROPERTY TEMPLATE
// ============================================
const PROPERTY_TEMPLATE = {
    address: '1234 Test Street, Austin, TX 78701',
    nickname: 'Main Residence',
    type: 'Single Family',
    yearBuilt: 2015,
    squareFeet: 2400,
    bedrooms: 4,
    bathrooms: 2.5,
    lotSize: 0.25
};


// ============================================
// HELPER FUNCTIONS
// ============================================

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset(arr, min, max) {
    const count = randomInt(min, Math.min(max, arr.length));
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

function generateJobNumber() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const part1 = Array.from({ length: 6 }, () => chars[randomInt(0, chars.length - 1)]).join('');
    const part2 = Array.from({ length: 3 }, () => chars[randomInt(0, chars.length - 1)]).join('');
    return `JOB-${part1}-${part2}`;
}

function generatePhone() {
    return `(${randomInt(512, 737)}) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`;
}

function generateEmail(firstName, lastName) {
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com'];
    const num = Math.random() > 0.5 ? randomInt(1, 99) : '';
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${num}@${randomElement(domains)}`;
}

function generateLicensePlate() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return `${letters[randomInt(0, 25)]}${letters[randomInt(0, 25)]}${letters[randomInt(0, 25)]}-${randomInt(1000, 9999)}`;
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ============================================
// BUSINESS HOURS GENERATION
// ============================================

function generateBusinessHours() {
    // Generate "normal-ish" but varied business hours
    const startOptions = ['06:30', '07:00', '07:00', '07:30', '07:30', '08:00', '08:00', '08:30'];
    const endOptions = ['16:00', '16:30', '17:00', '17:00', '17:30', '17:30', '18:00', '18:30'];

    const weekdayStart = randomElement(startOptions);
    const weekdayEnd = randomElement(endOptions);

    // Saturday: some businesses work half days
    const saturdayEnabled = Math.random() > 0.3; // 70% chance
    const satStart = randomElement(['07:00', '07:30', '08:00', '08:30', '09:00']);
    const satEnd = randomElement(['12:00', '13:00', '14:00', '15:00']);

    // Sunday: most contractors don't work
    const sundayEnabled = Math.random() > 0.8; // 20% chance

    return {
        monday: { enabled: true, start: weekdayStart, end: weekdayEnd },
        tuesday: { enabled: true, start: weekdayStart, end: weekdayEnd },
        wednesday: { enabled: true, start: weekdayStart, end: weekdayEnd },
        thursday: { enabled: true, start: weekdayStart, end: weekdayEnd },
        friday: { enabled: true, start: weekdayStart, end: weekdayEnd },
        saturday: { enabled: saturdayEnabled, start: satStart, end: satEnd },
        sunday: { enabled: sundayEnabled, start: '09:00', end: '13:00' }
    };
}

// ============================================
// CREW MEMBER GENERATION
// ============================================

function generateCrewMember(index, businessHours) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const role = index === 0 ? 'lead' : randomElement(TECH_ROLES);

    // Generate individual working hours - slight variations from business hours
    const workingHours = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    for (const day of days) {
        const bizDay = businessHours[day];
        if (!bizDay.enabled) {
            workingHours[day] = { enabled: false, start: bizDay.start, end: bizDay.end };
            continue;
        }

        // Small chance crew member has a day off (not Mon/Tue)
        if (day !== 'monday' && day !== 'tuesday' && Math.random() < 0.1) {
            workingHours[day] = { enabled: false, start: bizDay.start, end: bizDay.end };
            continue;
        }

        // Slight time variations: +/- 30 min from business hours
        let startMinutes = timeToMinutes(bizDay.start);
        let endMinutes = timeToMinutes(bizDay.end);

        startMinutes += randomElement([-30, 0, 0, 0, 30]);
        endMinutes += randomElement([-30, 0, 0, 0, 30]);

        // Clamp to reasonable range
        startMinutes = Math.max(360, Math.min(startMinutes, 540)); // 6:00 - 9:00
        endMinutes = Math.max(900, Math.min(endMinutes, 1140));    // 15:00 - 19:00

        workingHours[day] = {
            enabled: true,
            start: minutesToTime(startMinutes),
            end: minutesToTime(endMinutes)
        };
    }

    return {
        id: `tech_${Date.now()}_${index}`,
        name: `${firstName} ${lastName}`,
        email: generateEmail(firstName, lastName),
        phone: generatePhone(),
        role: role,
        color: TECH_COLORS[index % TECH_COLORS.length],
        skills: randomSubset(TECH_SKILLS, 2, 5),
        certifications: [],
        homeZip: randomElement(['78701', '78702', '78704', '78745', '78748', '78751', '78757', '78759']),
        maxTravelMiles: randomInt(15, 40),
        maxJobsPerDay: randomInt(3, 6),
        maxHoursPerDay: randomInt(7, 10),
        defaultBufferMinutes: randomElement([15, 15, 30, 30, 30, 45]),
        hourlyRate: randomInt(25, 65).toString(),
        primaryVehicleId: null, // Set after vehicles are created
        workingHours: workingHours,
        hireDate: new Date(Date.now() - randomInt(90, 1825) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: ''
    };
}

// ============================================
// FLEET/VEHICLE GENERATION
// ============================================

function generateVehicle(index, crewMembers) {
    const vehicle = randomElement(VEHICLE_MAKES_MODELS);
    const assignedTech = index < crewMembers.length ? crewMembers[index] : null;

    return {
        name: `${vehicle.type === 'van' ? 'Van' : 'Truck'} #${index + 1}`,
        type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year + randomInt(-2, 1),
        licensePlate: generateLicensePlate(),
        color: randomElement(['#374151', '#1F2937', '#FFFFFF', '#1E40AF', '#DC2626', '#059669']),
        capacity: {
            passengers: randomInt(2, vehicle.type === 'van' ? 3 : 5),
            cargoLbs: vehicle.type === 'van' ? randomInt(2000, 4000) : randomInt(1000, 2500)
        },
        equipment: randomSubset(VEHICLE_EQUIPMENT, 3, 7),
        defaultTechId: assignedTech?.id || null,
        defaultTechName: assignedTech?.name || null,
        status: 'available',
        homeLocation: null, // Set to home base later
        notes: '',
        maintenanceNotes: '',
        currentMileage: randomInt(15000, 85000),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

// ============================================
// JOB GENERATION (respects business hours)
// ============================================

// Pick a weighted random status from distribution
function pickWeightedStatus() {
    const totalWeight = JOB_STATUS_DISTRIBUTION.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    for (const item of JOB_STATUS_DISTRIBUTION) {
        random -= item.weight;
        if (random <= 0) return item.status;
    }
    return 'pending_schedule';
}

function generateJob(contractorId, index, businessHours, crewMembers, forcedStatus = null) {
    const template = randomElement(JOB_TEMPLATES);

    // Duration within template range
    const duration = randomInt(template.minDuration, template.maxDuration);

    // Crew size: respect template but cap at available crew
    const maxCrew = Math.min(template.maxCrew, crewMembers.length);
    const minCrew = Math.min(template.minCrew, maxCrew);
    const crewSize = randomInt(minCrew, maxCrew);

    // Customer info
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const customerName = `${firstName} ${lastName}`;

    // Pick a valid Austin address
    const location = randomElement(AUSTIN_ADDRESSES);

    // Schedule the job within business hours
    const schedule = generateValidSchedule(duration, businessHours);
    const isMultiDay = duration > getWorkdayMinutes(businessHours, schedule.dayOfWeek);

    // Pick a varied status for realistic testing
    // Pick a varied status for realistic testing
    const status = forcedStatus || pickWeightedStatus();

    // Assign crew for scheduled/in_progress/completed jobs
    let assignedTechId = null;
    let assignedTechName = null;
    let assignedCrew = [];
    let assignedCrewIds = [];

    if (status !== 'pending_schedule' && crewMembers.length > 0) {
        // Select random crew members up to required crew size
        const selectedCrew = randomSubset(crewMembers, Math.min(crewSize, crewMembers.length), Math.min(crewSize, crewMembers.length));
        assignedTechId = selectedCrew[0]?.id || null;
        assignedTechName = selectedCrew[0]?.name || null;
        assignedCrew = selectedCrew.map(c => ({ id: c.id, name: c.name, role: c.role }));
        assignedCrewIds = selectedCrew.map(c => c.id);
    }

    // Set schedule based on status
    let scheduledDate = schedule.date.toISOString();
    let scheduledTime = schedule.startTimeISO;
    let scheduledEndTime = schedule.endTimeISO;

    // Completed jobs should be in the past
    if (status === 'completed') {
        const pastDays = randomInt(7, 60);
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - pastDays);
        scheduledDate = pastDate.toISOString();
        const dateStr = pastDate.toISOString().split('T')[0];
        scheduledTime = `${dateStr}T${schedule.startTime}:00`;
        scheduledEndTime = `${dateStr}T${schedule.endTime}:00`;
    }

    // In-progress jobs should be today or yesterday
    if (status === 'in_progress') {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - randomInt(0, 1));
        scheduledDate = recentDate.toISOString();
        const dateStr = recentDate.toISOString().split('T')[0];
        scheduledTime = `${dateStr}T${schedule.startTime}:00`;
        scheduledEndTime = `${dateStr}T${schedule.endTime}:00`;
    }

    const job = {
        jobNumber: generateJobNumber(),
        contractorId: contractorId,
        source: 'direct',
        type: 'job',
        title: template.title,
        description: `${template.title} - ${customerName}. ${isMultiDay ? 'Multi-day project.' : 'Standard service call.'}`,
        category: template.category,
        serviceType: template.category,
        estimatedDuration: duration,
        price: Math.round(duration * (randomInt(50, 150) / 60) * 100) / 100,
        priority: randomElement(JOB_PRIORITIES),
        customer: {
            name: customerName,
            phone: generatePhone(),
            email: generateEmail(firstName, lastName),
            address: location.address
        },
        customerName: customerName,
        customerPhone: generatePhone(),
        customerEmail: generateEmail(firstName, lastName),
        propertyAddress: location.address,
        serviceLocation: {
            address: location.address,
            coordinates: { lat: location.lat, lng: location.lng }
        },
        status: status,
        scheduledDate: scheduledDate,
        scheduledTime: scheduledTime,
        scheduledEndTime: scheduledEndTime,
        scheduledTimezone: 'America/Chicago',
        isMultiDay: isMultiDay,
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
        assignedTechId: assignedTechId,
        assignedTechName: assignedTechName,
        assignedVehicleId: null,
        assignedCrew: assignedCrew,
        assignedCrewIds: assignedCrewIds,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
        notes: `Generated test job #${index + 1}`,
        createdBy: 'script:generateRandomJobs',
        homeownerLinked: false,
        homeownerId: null,
        propertyId: null
    };

    if (isMultiDay) {
        job.scheduleBlocks = generateScheduleBlocks(schedule.date, duration, businessHours);
        job.multiDaySchedule = {
            segments: job.scheduleBlocks,
            dailyStartTime: businessHours.monday.start,
            dailyEndTime: businessHours.monday.end
        };
    }

    return job;
}

function generateValidSchedule(durationMinutes, businessHours) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Pick a random date 1-30 days in the future
    const daysAhead = randomInt(1, 30);
    let date = new Date();
    date.setDate(date.getDate() + daysAhead);

    // Find the next enabled work day
    let attempts = 0;
    while (attempts < 7) {
        const dayName = days[date.getDay()];
        const dayHours = businessHours[dayName];

        if (dayHours.enabled) {
            const startMinutes = timeToMinutes(dayHours.start);
            const endMinutes = timeToMinutes(dayHours.end);
            const availableMinutes = endMinutes - startMinutes;

            // For single-day jobs, cap to available time
            const effectiveDuration = Math.min(durationMinutes, availableMinutes);

            // Random start time that allows job to finish within hours
            const latestStart = endMinutes - Math.min(effectiveDuration, availableMinutes);
            const jobStartMinutes = randomInt(startMinutes, Math.max(startMinutes, latestStart));
            const jobEndMinutes = Math.min(jobStartMinutes + effectiveDuration, endMinutes);

            const startTime = minutesToTime(jobStartMinutes);
            const endTime = minutesToTime(jobEndMinutes);
            const dateStr = date.toISOString().split('T')[0];

            return {
                date: date,
                dayOfWeek: dayName,
                startTime: startTime,
                endTime: endTime,
                startTimeISO: `${dateStr}T${startTime}:00`,
                endTimeISO: `${dateStr}T${endTime}:00`
            };
        }

        date.setDate(date.getDate() + 1);
        attempts++;
    }

    // Fallback: use Monday hours
    const startTime = businessHours.monday.start;
    const dateStr = date.toISOString().split('T')[0];
    return {
        date: date,
        dayOfWeek: 'monday',
        startTime: startTime,
        endTime: businessHours.monday.end,
        startTimeISO: `${dateStr}T${startTime}:00`,
        endTimeISO: `${dateStr}T${businessHours.monday.end}:00`
    };
}

function getWorkdayMinutes(businessHours, dayName) {
    const day = businessHours[dayName];
    if (!day || !day.enabled) return 480;
    return timeToMinutes(day.end) - timeToMinutes(day.start);
}

function generateScheduleBlocks(startDate, durationMinutes, businessHours) {
    const blocks = [];
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    let remainingMinutes = durationMinutes;
    let currentDate = new Date(startDate);

    while (remainingMinutes > 0 && blocks.length < 14) {
        const dayName = days[currentDate.getDay()];
        const dayHours = businessHours[dayName];

        if (dayHours && dayHours.enabled) {
            const startMin = timeToMinutes(dayHours.start);
            const endMin = timeToMinutes(dayHours.end);
            const availableMinutes = endMin - startMin;
            const dayMinutes = Math.min(remainingMinutes, availableMinutes);
            const blockEnd = startMin + dayMinutes;

            blocks.push({
                date: currentDate.toISOString().split('T')[0],
                startTime: dayHours.start,
                endTime: minutesToTime(blockEnd)
            });

            remainingMinutes -= dayMinutes;
        }

        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return blocks;
}

// ============================================
// MEMBERSHIP PLAN GENERATION
// ============================================

function generateMembershipPlan(contractorId, template, index) {
    return {
        id: `plan_${Date.now()}_${index}`,
        contractorId: contractorId,
        name: template.name,
        description: template.description,
        features: template.features,
        billingInterval: template.billingInterval,
        price: template.price,
        discountPercent: template.discountPercent,
        active: template.active,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

// ============================================
// CUSTOMER GENERATION (with optional membership)
// ============================================

function generateCustomer(contractorId, index, membershipPlan = null) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const location = randomElement(AUSTIN_ADDRESSES);

    const customer = {
        id: `customer_${Date.now()}_${index}`,
        contractorId: contractorId,
        name: `${firstName} ${lastName}`,
        email: generateEmail(firstName, lastName),
        phone: generatePhone(),
        address: location.address,
        coordinates: { lat: location.lat, lng: location.lng },
        notes: '',
        tags: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Add membership if provided
    if (membershipPlan) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - randomInt(30, 180));
        const expiresAt = new Date(startDate);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        customer.membership = {
            planId: membershipPlan.id,
            planName: membershipPlan.name,
            status: 'active',
            startDate: startDate.toISOString(),
            expiresAt: expiresAt.toISOString(),
            discountPercent: membershipPlan.discountPercent,
            autoRenew: Math.random() > 0.3
        };
    }

    return customer;
}

// ============================================
// QUOTE GENERATION
// ============================================

function generateQuote(contractorId, template, customer, status = 'draft') {
    const lineItems = template.lineItems.map((item, idx) => ({
        id: `line_${idx}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        type: item.type
    }));

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxRate = 0.0825;
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = subtotal + tax;
    const deposit = template.depositPercent > 0 ? Math.round(total * template.depositPercent / 100 * 100) / 100 : 0;

    return {
        contractorId: contractorId,
        quoteNumber: `QTE-${Date.now()}-${randomInt(100, 999)}`,
        title: template.title,
        status: status,
        customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address
        },
        lineItems: lineItems,
        subtotal: subtotal,
        taxRate: taxRate,
        tax: tax,
        total: total,
        depositRequired: template.depositPercent > 0,
        depositPercent: template.depositPercent,
        depositAmount: deposit,
        validDays: 30,
        notes: `Generated test quote for ${customer.name}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        sentAt: status === 'sent' ? admin.firestore.FieldValue.serverTimestamp() : null
    };
}

// ============================================
// HOMEOWNER PROPERTY & ITEMS GENERATION
// ============================================

function generateProperty(homeownerId) {
    return {
        id: `property_${Date.now()}`,
        homeownerId: homeownerId,
        ...PROPERTY_TEMPLATE,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

function generateHomeItem(homeownerId, propertyId, template, index) {
    const installDate = new Date();
    installDate.setDate(installDate.getDate() - randomInt(90, 730)); // 3 months to 2 years ago

    // Generate maintenance tasks with due dates
    const maintenanceTasks = template.maintenanceTasks.map((task, idx) => {
        const lastCompletedDate = new Date(installDate);
        lastCompletedDate.setDate(lastCompletedDate.getDate() + randomInt(0, task.intervalDays));

        const nextDueDate = new Date(lastCompletedDate);
        nextDueDate.setDate(nextDueDate.getDate() + task.intervalDays);

        const now = new Date();
        const isOverdue = nextDueDate < now;

        return {
            id: `task_${index}_${idx}`,
            name: task.name,
            description: task.description,
            intervalDays: task.intervalDays,
            lastCompleted: lastCompletedDate.toISOString(),
            nextDue: nextDueDate.toISOString(),
            status: isOverdue ? 'overdue' : 'upcoming'
        };
    });

    return {
        id: `item_${Date.now()}_${index}`,
        homeownerId: homeownerId,
        propertyId: propertyId,
        item: template.item,
        category: template.category,
        brand: template.brand,
        model: template.model,
        area: template.area,
        cost: template.cost,
        dateInstalled: installDate.toISOString().split('T')[0],
        warranty: template.warranty,
        maintenanceTasks: maintenanceTasks,
        photos: [],
        notes: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

// ============================================
// MAIN SCRIPT
// ============================================

/**
 * Delete all existing test data for a contractor/homeowner
 * This provides a clean slate before populating fresh data
 */
async function cleanExistingData(db, contractorId, homeownerId) {
    console.log('\n--- RESET MODE: Cleaning existing data ---');
    let totalDeleted = 0;

    // Helper to delete docs matching a query
    async function deleteMatchingDocs(collection, field, value, label) {
        try {
            const snapshot = await db.collection(collection)
                .where(field, '==', value)
                .get();

            if (snapshot.empty) {
                console.log(`   ${label}: 0 (none found)`);
                return 0;
            }

            // Delete in batches to avoid timeouts
            const batchSize = 50;
            let deleted = 0;
            const docs = snapshot.docs;

            for (let i = 0; i < docs.length; i += batchSize) {
                const batch = db.batch();
                const chunk = docs.slice(i, i + batchSize);
                chunk.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                deleted += chunk.length;
            }

            console.log(`   ${label}: ${deleted} deleted`);
            return deleted;
        } catch (error) {
            console.log(`   ${label}: error - ${error.message}`);
            return 0;
        }
    }

    // Clean contractor data
    totalDeleted += await deleteMatchingDocs(REQUESTS_COLLECTION, 'contractorId', contractorId, 'Jobs');
    totalDeleted += await deleteMatchingDocs(QUOTES_COLLECTION, 'contractorId', contractorId, 'Quotes');
    totalDeleted += await deleteMatchingDocs(CUSTOMERS_COLLECTION, 'contractorId', contractorId, 'Customers');
    totalDeleted += await deleteMatchingDocs(MEMBERSHIP_PLANS_COLLECTION, 'contractorId', contractorId, 'Membership Plans');

    // Clean contractor vehicles subcollection
    try {
        const vehiclesRef = db.collection(`${CONTRACTORS_COLLECTION}/${contractorId}/vehicles`);
        const vehicleSnapshot = await vehiclesRef.get();
        if (!vehicleSnapshot.empty) {
            const batch = db.batch();
            vehicleSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log(`   Vehicles: ${vehicleSnapshot.size} deleted`);
            totalDeleted += vehicleSnapshot.size;
        } else {
            console.log('   Vehicles: 0 (none found)');
        }
    } catch (error) {
        console.log(`   Vehicles: error - ${error.message}`);
    }

    // Clean homeowner data if specified
    if (homeownerId) {
        totalDeleted += await deleteMatchingDocs(PROPERTIES_COLLECTION, 'homeownerId', homeownerId, 'Properties');
        totalDeleted += await deleteMatchingDocs(ITEMS_COLLECTION, 'homeownerId', homeownerId, 'Home Items');
    }

    console.log(`   TOTAL: ${totalDeleted} documents deleted\n`);
    return totalDeleted;
}

async function initializeFirebase() {
    try {
        const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
        const serviceAccount = require(serviceAccountPath);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log('Firebase Admin initialized\n');
        return admin.firestore();
    } catch (error) {
        console.error('Failed to initialize Firebase Admin');
        console.error('Make sure serviceAccountKey.json exists in the scripts/ folder');
        console.error('Error:', error.message);
        process.exit(1);
    }
}

async function main() {
    if (!CONFIG.contractorId) {
        console.error('ERROR: --contractor-id is required');
        console.error('Usage: node scripts/generateRandomJobs.cjs --contractor-id=<UID> --count=20');
        process.exit(1);
    }

    console.log('\n=== RANDOM JOB GENERATOR FOR SCHEDULING TESTING ===\n');

    const db = await initializeFirebase();
    const contractorRef = db.doc(`${CONTRACTORS_COLLECTION}/${CONFIG.contractorId}`);

    // Determine crew and vehicle counts
    const crewCount = CONFIG.crewCount || randomInt(2, 6);
    const vehicleCount = CONFIG.vehicleCount || Math.max(1, crewCount - randomInt(0, 1));

    console.log(`Contractor ID: ${CONFIG.contractorId}`);
    console.log(`Jobs to create: ${CONFIG.count}`);
    console.log(`Crew members: ${crewCount}`);
    console.log(`Vehicles: ${vehicleCount}`);
    console.log(`Reset mode: ${CONFIG.reset ? 'Yes (will delete existing data)' : 'No'}`);
    console.log(`Dry run: ${CONFIG.dryRun ? 'Yes' : 'No'}\n`);

    // ---- Step 0: Clean existing data if reset flag is set ----
    if (CONFIG.reset && !CONFIG.dryRun) {
        await cleanExistingData(db, CONFIG.contractorId, CONFIG.homeownerId);
    } else if (CONFIG.reset && CONFIG.dryRun) {
        console.log('\n--- RESET MODE: Would delete existing data (dry run) ---\n');
    }

    // ---- Step 1: Generate Business Hours ----
    console.log('--- Step 1: Business Hours ---');
    const businessHours = generateBusinessHours();
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of daysOfWeek) {
        const d = businessHours[day];
        const status = d.enabled ? `${d.start} - ${d.end}` : 'Closed';
        console.log(`   ${day.padEnd(10)}: ${status}`);
    }

    // ---- Step 2: Generate Crew Members ----
    console.log('\n--- Step 2: Crew Members ---');
    const crewMembers = [];
    for (let i = 0; i < crewCount; i++) {
        const member = generateCrewMember(i, businessHours);
        crewMembers.push(member);
        const enabledDays = Object.entries(member.workingHours).filter(([, v]) => v.enabled).length;
        console.log(`   ${member.name} (${member.role}) - ${enabledDays} days/wk, ${member.skills.slice(0, 3).join(', ')}`);
    }

    // ---- Step 3: Generate Vehicles ----
    console.log('\n--- Step 3: Fleet Vehicles ---');
    const vehicles = [];
    const homeBase = randomElement(HOME_BASE_OPTIONS);
    console.log(`   Home base: ${homeBase.address}`);
    for (let i = 0; i < vehicleCount; i++) {
        const vehicle = generateVehicle(i, crewMembers);
        vehicle.homeLocation = {
            address: homeBase.address,
            coordinates: { lat: homeBase.lat, lng: homeBase.lng }
        };
        vehicles.push(vehicle);
        console.log(`   ${vehicle.name}: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})${vehicle.defaultTechName ? ' -> ' + vehicle.defaultTechName : ''}`);
    }

    // Assign vehicles to crew members
    for (let i = 0; i < crewMembers.length && i < vehicles.length; i++) {
        crewMembers[i].primaryVehicleId = `vehicle_${i}`;
    }

    // ---- Step 4: Generate Jobs ----
    console.log(`\n--- Step 4: Generating ${CONFIG.count} Jobs ---`);
    const jobs = [];
    const stats = { totalDuration: 0, minDuration: Infinity, maxDuration: 0, multiDay: 0, byCategory: {} };

    // Force statuses for test coverage: pending, completed, in_progress, scheduled, pending
    const jobStatuses = [null, 'completed', 'in_progress', 'scheduled', null];

    for (let i = 0; i < CONFIG.count; i++) {
        const job = generateJob(CONFIG.contractorId, i, businessHours, crewMembers, jobStatuses[i]);
        jobs.push(job);
        stats.totalDuration += job.estimatedDuration;
        stats.minDuration = Math.min(stats.minDuration, job.estimatedDuration);
        stats.maxDuration = Math.max(stats.maxDuration, job.estimatedDuration);
        if (job.isMultiDay) stats.multiDay++;
        stats.byCategory[job.category] = (stats.byCategory[job.category] || 0) + 1;
    }

    console.log(`   Duration range: ${stats.minDuration} min - ${stats.maxDuration} min`);
    console.log(`   Average duration: ${Math.round(stats.totalDuration / CONFIG.count)} min`);
    console.log(`   Multi-day jobs: ${stats.multiDay} (${Math.round(stats.multiDay / CONFIG.count * 100)}%)`);
    console.log('   Categories:', Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', '));

    console.log('\n   Sample jobs:');
    jobs.slice(0, 3).forEach((job, i) => {
        const time = job.scheduledTime?.split('T')[1]?.replace(':00', '') || 'N/A';
        console.log(`     ${i + 1}. ${job.title} | ${job.estimatedDuration}min | crew:${job.requiredCrewSize} | ${time} | ${job.propertyAddress}`);
    });

    if (CONFIG.dryRun) {
        console.log('\n*** DRY RUN - Nothing was created ***\n');
        process.exit(0);
    }

    // ---- Write to Firestore ----
    console.log('\n--- Writing to Firestore ---');

    // Write scheduling data (business hours + crew) to contractor profile
    const schedulingData = {
        teamType: crewCount > 1 ? 'team' : 'solo',
        teamSize: crewCount,
        vehicles: vehicleCount,
        timezone: 'America/Chicago',
        workingHours: businessHours,
        bufferMinutes: randomElement([15, 30, 30, 30, 45]),
        defaultJobDuration: 120,
        serviceRadiusMiles: CONFIG.radiusMiles,
        maxJobsPerDay: randomInt(3, 6),
        homeBase: {
            address: homeBase.address,
            coordinates: { lat: homeBase.lat, lng: homeBase.lng }
        },
        teamMembers: crewMembers
    };

    await contractorRef.set({
        scheduling: schedulingData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('   Saved business hours + crew members');

    // Write vehicles to subcollection
    for (let i = 0; i < vehicles.length; i++) {
        const vehicleRef = contractorRef.collection('vehicles').doc(`vehicle_${i}`);
        await vehicleRef.set(vehicles[i]);
    }
    console.log(`   Saved ${vehicles.length} vehicles`);

    // Write jobs individually to avoid timeout
    let created = 0;
    const statusStats = {};
    for (const job of jobs) {
        const docRef = db.collection(REQUESTS_COLLECTION).doc();
        await docRef.set(job);
        created++;
        statusStats[job.status] = (statusStats[job.status] || 0) + 1;
        if (created % 5 === 0) {
            process.stdout.write(`   Saved ${created}/${jobs.length} jobs...\r`);
        }
    }
    console.log(`   Saved ${created}/${jobs.length} jobs       `);
    console.log(`   Status distribution: ${Object.entries(statusStats).map(([k, v]) => `${k}:${v}`).join(', ')}`);

    // ---- Step 5: Generate and Write Membership Plans ----
    console.log('\n--- Step 5: Membership Plans ---');
    const membershipPlans = [];
    for (let i = 0; i < MEMBERSHIP_PLAN_TEMPLATES.length; i++) {
        const plan = generateMembershipPlan(CONFIG.contractorId, MEMBERSHIP_PLAN_TEMPLATES[i], i);
        membershipPlans.push(plan);
        const planRef = db.collection(MEMBERSHIP_PLANS_COLLECTION).doc(plan.id);
        await planRef.set(plan);
        console.log(`   Created plan: ${plan.name} ($${plan.price}/${plan.billingInterval})`);
    }

    // ---- Step 6: Generate and Write Customers (some with memberships) ----
    console.log('\n--- Step 6: Customers ---');
    const customers = [];
    const customerCount = 5;
    for (let i = 0; i < customerCount; i++) {
        // First 2 customers get memberships
        const membershipPlan = i < 2 ? membershipPlans[i % membershipPlans.length] : null;
        const customer = generateCustomer(CONFIG.contractorId, i, membershipPlan);

        // FORCE first customer to be our test homeowner so they receive quotes
        if (i === 0) {
            customer.email = 'danvdova@gmail.com';
            customer.name = 'Dan Vdova';
            console.log('   -> Overriding Customer 0 to danvdova@gmail.com');
        }

        customers.push(customer);
        const customerRef = db.collection(CUSTOMERS_COLLECTION).doc(customer.id);
        await customerRef.set(customer);
        console.log(`   Created customer: ${customer.name}${membershipPlan ? ` (${membershipPlan.name} member)` : ''}`);
    }

    // ---- Step 7: Generate and Write Quotes ----
    console.log('\n--- Step 7: Quotes ---');
    const quoteStatuses = ['sent', 'draft', 'sent', 'sent', 'sent']; // Force first one to be SENT

    for (let i = 0; i < QUOTE_TEMPLATES.length; i++) {
        const customer = customers[i % customers.length];
        const status = quoteStatuses[i] || 'draft';

        // If this is the test customer (index 0), use the known UID (which matches contractorId in our test setup)
        // Otherwise use the random customer ID
        const customerIdForQuote = (i === 0) ? CONFIG.contractorId : customer.id;

        const quote = generateQuote(CONFIG.contractorId, QUOTE_TEMPLATES[i], customer, status);
        quote.customerId = customerIdForQuote; // Explicitly add customerId field for queries

        const quoteRef = db.collection(QUOTES_COLLECTION).doc();
        await quoteRef.set(quote);
        console.log(`   Created ${status} quote: ${quote.title} - $${quote.total.toFixed(2)} for ${customer.name} (customerId: ${customerIdForQuote})`);
    }

    // ---- Step 8: Generate Homeowner Property & Items ----
    if (!CONFIG.skipHomeowner && CONFIG.homeownerId) {
        console.log('\n--- Step 8: Homeowner Property & Items ---');

        // Create property and update user profile
        const property = generateProperty(CONFIG.homeownerId);

        // 1. Update User Profile with Property Metadata (Critical for App recognition)
        const profileRef = db.collection('artifacts').doc(APP_ID).collection('users').doc(CONFIG.homeownerId).collection('settings').doc('profile');
        const profileUpdate = {
            properties: [{
                id: property.id,
                name: property.nickname,
                address: property.address, // Object or string, app handles both
                coordinates: { lat: 30.2672, lng: -97.7431 } // Default to Austin center if missing
            }],
            activePropertyId: property.id,
            updatedAt: new Date()
        };
        await profileRef.set(profileUpdate, { merge: true });
        console.log(`   Updated user profile with property: ${property.nickname}`);

        // 2. Create Home Items in User's house_records collection
        const recordsRef = db.collection('artifacts').doc(APP_ID).collection('users').doc(CONFIG.homeownerId).collection('house_records');

        for (let i = 0; i < HOME_ITEM_TEMPLATES.length; i++) {
            const item = generateHomeItem(CONFIG.homeownerId, property.id, HOME_ITEM_TEMPLATES[i], i);
            await recordsRef.doc(item.id).set(item);

            const overdueTasks = item.maintenanceTasks.filter(t => t.status === 'overdue').length;
            console.log(`   Created item: ${item.item} (${item.maintenanceTasks.length} tasks, ${overdueTasks} overdue)`);
        }
    } else {
        console.log('\n--- Step 8: Skipped homeowner data (use --homeowner-id to include) ---');
    }

    console.log('\n=== COMPLETE ===');
    console.log(`Contractor ${CONFIG.contractorId} now has:`);
    console.log(`   - Business hours configured (${daysOfWeek.filter(d => businessHours[d].enabled).length} days/wk)`);
    console.log(`   - ${crewCount} crew members with individual schedules`);
    console.log(`   - ${vehicleCount} vehicles`);
    console.log(`   - ${CONFIG.count} jobs (${Object.entries(statusStats).map(([k, v]) => `${k}:${v}`).join(', ')})`);
    console.log(`   - ${membershipPlans.length} membership plans`);
    console.log(`   - ${customers.length} customers (${customers.filter(c => c.membership).length} with memberships)`);
    console.log(`   - ${QUOTE_TEMPLATES.length} quotes`);
    if (!CONFIG.skipHomeowner && CONFIG.homeownerId) {
        console.log(`   - 1 property with ${HOME_ITEM_TEMPLATES.length} home items`);
    }
    console.log('');

    process.exit(0);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
