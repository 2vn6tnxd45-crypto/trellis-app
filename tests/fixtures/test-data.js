// tests/fixtures/test-data.js
/**
 * Test Data and Fixtures for Krib E2E Tests
 *
 * Contains test users, properties, quotes, and other data
 * used across multiple test files.
 */

// ============================================
// TEST USERS
// ============================================

// IMPORTANT: These accounts should exist in Firebase Auth
// The seeded account has pre-populated data created by generateRandomJobs.cjs
// Run: node scripts/generateRandomJobs.cjs --contractor-id=<UID> --reset --count=20

export const TEST_USERS = {
    // New homeowner (for fresh signup tests - account created during test)
    newHomeowner: {
        email: 'test.homeowner.new@gmail.com',
        password: 'TestPass123!',
        name: 'Test Homeowner New',
    },

    // SEEDED: Homeowner with existing data
    // This account has: property, items, maintenance tasks, quotes
    fullHomeowner: {
        email: 'devonandrewdavila@gmail.com',
        password: 'Test1234',
        name: 'Devon Davila',
        uid: 'fPOyi1ZeblUwayfqwx29nNdsTjC2',
    },

    // New contractor (for fresh signup tests - account created during test)
    newContractor: {
        email: 'test.contractor.new@gmail.com',
        password: 'TestPass123!',
        name: 'Test Contractor New',
        businessName: 'Test HVAC Services',
    },

    // SEEDED: Contractor with existing data (same account, has contractor profile)
    // This account has: jobs, crew, vehicles, quotes, membership plans, customers
    fullContractor: {
        email: 'danvdova@gmail.com',
        password: 'Test1234',
        name: 'Dan Davila',
        businessName: 'Davila Home Services',
        uid: 'xLmC8rxrucPGD2pe4P5FSRmVsqc2',
    },

    // Invalid credentials for negative tests
    invalidUser: {
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!',
    },

    // Weak password for validation tests
    weakPassword: {
        email: 'weak.password@example.com',
        password: '123',
    },
};

// ============================================
// TEST PROPERTIES
// ============================================

export const TEST_PROPERTIES = {
    mainHouse: {
        address: '1234 Test Street, Austin, TX 78701',
        nickname: 'Main House',
        bedrooms: 4,
        bathrooms: 2.5,
        squareFootage: 2400,
        yearBuilt: 2010,
        propertyType: 'single_family',
    },

    rentalProperty: {
        address: '5678 Rental Ave, Austin, TX 78702',
        nickname: 'Rental Property',
        bedrooms: 2,
        bathrooms: 1,
        squareFootage: 1200,
        yearBuilt: 2015,
        propertyType: 'condo',
    },
};

// ============================================
// TEST RECORDS
// ============================================

export const TEST_RECORDS = {
    hvacSystem: {
        item: 'Carrier Central AC Unit',
        category: 'HVAC & Systems',
        room: 'Exterior',
        brand: 'Carrier',
        model: '24ACC636A003',
        purchaseDate: '2023-06-20',
        cost: 5500,
        warrantyExpires: '2033-06-20',
        notes: 'Annual filter change required',
    },

    waterHeater: {
        item: 'Rheem Water Heater',
        category: 'Plumbing',
        room: 'Garage',
        brand: 'Rheem',
        model: 'PROG50-38N RH67',
        purchaseDate: '2022-03-10',
        cost: 1200,
        notes: '50 gallon, natural gas',
    },

    refrigerator: {
        item: 'Samsung French Door Refrigerator',
        category: 'Appliances',
        room: 'Kitchen',
        brand: 'Samsung',
        model: 'RF28R7551SR',
        purchaseDate: '2024-01-15',
        cost: 2499.99,
    },

    // For core-flows.spec.js Manual Record Creation tests
    hvacMaintenance: {
        title: 'Annual HVAC Filter Change',
        category: 'HVAC',
        description: 'Replaced all air filters and cleaned condenser coils',
        date: '2024-01-15',
        cost: 150,
        provider: 'ABC HVAC Services',
    },

    plumbingRepair: {
        title: 'Kitchen Faucet Replacement',
        category: 'Plumbing',
        description: 'Replaced leaky kitchen faucet with new Moen model',
        date: '2024-02-01',
        cost: 350,
        provider: 'Quick Plumbing Co',
        warrantyExpires: '2026-02-01',
    },
};

// ============================================
// TEST QUOTES
// ============================================

export const TEST_QUOTES = {
    hvacInstall: {
        title: 'HVAC System Installation',
        customer: {
            name: 'John Smith',
            email: 'john.smith@example.com',
            phone: '512-555-0101',
            address: '123 Oak Street, Austin, TX 78701',
        },
        lineItems: [
            {
                description: 'Trane XR15 Heat Pump',
                type: 'material',
                quantity: 1,
                price: 4500,
                brand: 'Trane',
                model: '4TWR5036E1000A',
                addToHomeRecord: true,
            },
            {
                description: 'Trane Air Handler',
                type: 'material',
                quantity: 1,
                price: 2300,
                brand: 'Trane',
                model: 'TAM7A0C42H31SA',
                addToHomeRecord: true,
            },
            {
                description: 'Installation Labor',
                type: 'labor',
                quantity: 8,
                price: 150, // per hour
            },
        ],
        depositRequired: true,
        depositType: 'percentage',
        depositValue: 50,
        taxRate: 8.25,
    },

    plumbingRepair: {
        title: 'Kitchen Faucet Replacement',
        customer: {
            name: 'Sarah Johnson',
            email: 'sarah.j@example.com',
            phone: '512-555-0102',
            address: '456 Maple Ave, Austin, TX 78702',
        },
        lineItems: [
            {
                description: 'Delta Kitchen Faucet',
                type: 'material',
                quantity: 1,
                price: 189,
                brand: 'Delta',
                model: 'K-560-VS',
                addToHomeRecord: true,
            },
            {
                description: 'Labor',
                type: 'labor',
                quantity: 2,
                price: 85,
            },
        ],
        depositRequired: false,
        taxRate: 8.25,
    },
};

// ============================================
// SELECTORS
// ============================================

export const SELECTORS = {
    // Auth
    emailInput: 'input[type="email"]',
    passwordInput: 'input[type="password"]',
    nameInput: 'input[placeholder*="name" i]',
    submitButton: 'button[type="submit"]',
    googleSignInButton: 'button:has-text("Google")',
    signUpLink: 'text=Sign up',
    signInLink: 'text=Sign in',
    forgotPasswordLink: 'text=Forgot password',

    // Navigation
    bottomNav: '[class*="BottomNav"]',
    dashboardTab: 'text=Dashboard',
    itemsTab: 'text=Items',
    maintenanceTab: 'text=Maintenance',
    contractorsTab: 'text=Contractors',
    settingsTab: 'text=Settings',

    // Records
    addRecordButton: 'button:has-text("Add")',
    recordCard: '[class*="RecordCard"]',
    scanButton: 'button:has-text("Scan")',

    // Quotes
    quoteBuilder: '[class*="QuoteBuilder"]',
    lineItemRow: '[class*="line-item"]',
    addLineItemButton: 'button:has-text("Add Line")',
    sendQuoteButton: 'button:has-text("Send")',

    // Common
    loadingSpinner: '[class*="Loader"], [class*="loading"], [class*="spinner"]',
    toast: '[class*="toast"]',
    modal: '[role="dialog"]',
    closeButton: 'button:has(svg[class*="X"])',
};

// ============================================
// HELPERS
// ============================================

/**
 * Generate a unique email for test isolation
 */
export const generateTestEmail = (prefix = 'test') => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}.${timestamp}.${random}@test.krib.app`;
};

/**
 * Generate a unique phone number for test isolation
 */
export const generateTestPhone = () => {
    return `555-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
};

/**
 * Generate a random string for unique test data
 */
export const generateRandomString = (length = 8) => {
    return Math.random().toString(36).substring(2, 2 + length);
};

/**
 * Wait helper with custom timeout
 */
export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Format phone number for input
 */
export const formatPhone = (phone) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
};

// ============================================
// DATA GENERATORS
// ============================================

/**
 * Generate unique test identifier
 */
export const generateTestId = (prefix = 'test') => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
};

/**
 * Generate quote data with defaults
 */
export const generateQuoteData = (overrides = {}) => ({
    customerName: `Test Customer ${generateTestId('cust')}`,
    customerEmail: generateTestEmail('quote'),
    customerPhone: generateTestPhone(),
    propertyAddress: '123 Test Street, Anytown, CA 90210',
    lineItems: [
        {
            description: 'Water Heater Installation',
            quantity: 1,
            unitPrice: 850.00,
            category: 'Plumbing'
        }
    ],
    notes: 'Test quote created by automated testing',
    ...overrides
});

/**
 * Generate multiple line items for quote testing
 */
export const generateMultipleLineItems = (count = 3) => {
    const items = [
        { description: 'Water Heater - 50 Gallon', quantity: 1, unitPrice: 650.00, category: 'Plumbing' },
        { description: 'Labor - Installation', quantity: 4, unitPrice: 85.00, category: 'Labor' },
        { description: 'Permit Fee', quantity: 1, unitPrice: 150.00, category: 'Permits' },
        { description: 'Supply Lines', quantity: 2, unitPrice: 25.00, category: 'Materials' },
        { description: 'Disposal Fee', quantity: 1, unitPrice: 75.00, category: 'Fees' }
    ];
    return items.slice(0, count);
};

/**
 * Generate customer/homeowner data
 */
export const generateCustomerData = (overrides = {}) => ({
    name: `Customer ${generateTestId('ho')}`,
    email: generateTestEmail('homeowner'),
    phone: generateTestPhone(),
    address: {
        street: `${Math.floor(100 + Math.random() * 9900)} Main Street`,
        city: 'Anytown',
        state: 'CA',
        zip: '90210'
    },
    ...overrides
});

/**
 * Generate home record data
 */
export const generateHomeRecordData = (overrides = {}) => ({
    itemName: `Test Item ${generateTestId('item')}`,
    category: 'Appliance',
    manufacturer: 'Test Brand',
    modelNumber: `MODEL-${Math.floor(1000 + Math.random() * 9000)}`,
    serialNumber: `SN-${generateTestId('sn')}`,
    purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    warrantyExpiration: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: 'Test record created by automated testing',
    ...overrides
});

/**
 * Generate job data
 */
export const generateJobData = (overrides = {}) => ({
    title: `Test Job ${generateTestId('job')}`,
    description: 'Automated test job for E2E testing',
    scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    estimatedDuration: 2,
    priority: 'normal',
    status: 'scheduled',
    ...overrides
});

/**
 * Generate evaluation data
 */
export const generateEvaluationData = (overrides = {}) => ({
    type: 'site_visit',
    jobDescription: `Evaluation for ${generateTestId('eval')}`,
    propertyAddress: '123 Test Street, Anytown, CA 90210',
    preferredDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferredTime: '10:00 AM',
    notes: 'Test evaluation created by automated testing',
    ...overrides
});

/**
 * Generate service request data
 */
export const generateServiceRequestData = (overrides = {}) => ({
    category: 'Plumbing',
    subcategory: 'Repair',
    description: `Service request: ${generateTestId('req')} - Leaking faucet in kitchen`,
    urgency: 'normal',
    preferredDates: [
        new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    ],
    photos: [],
    ...overrides
});

/**
 * Generate invitation data
 */
export const generateInvitationData = (overrides = {}) => ({
    customerName: `Invited Customer ${generateTestId('inv')}`,
    customerEmail: generateTestEmail('invited'),
    customerPhone: generateTestPhone(),
    propertyAddress: '456 Invite Lane, Testville, CA 90211',
    items: [
        {
            name: 'Water Heater',
            category: 'Plumbing',
            notes: 'Tankless, installed 2020'
        }
    ],
    message: 'Welcome to your home management portal!',
    ...overrides
});

/**
 * Generate invoice data
 */
export const generateInvoiceData = (overrides = {}) => ({
    invoiceNumber: `INV-${Date.now()}`,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    lineItems: generateMultipleLineItems(3),
    notes: 'Test invoice - payment due within 30 days',
    terms: 'Net 30',
    ...overrides
});

// ============================================
// FORM OPTIONS
// ============================================

export const FORM_OPTIONS = {
    recordCategories: [
        'Appliance',
        'HVAC',
        'Plumbing',
        'Electrical',
        'Roofing',
        'Structure',
        'Other'
    ],
    quoteCategories: [
        'Labor',
        'Materials',
        'Permits',
        'Fees',
        'Equipment',
        'Other'
    ],
    serviceCategories: [
        'Plumbing',
        'Electrical',
        'HVAC',
        'Roofing',
        'General Repair',
        'Inspection'
    ],
    urgencyLevels: [
        'low',
        'normal',
        'high',
        'emergency'
    ],
    jobStatuses: [
        'pending',
        'scheduled',
        'in_progress',
        'completed',
        'cancelled'
    ]
};

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
    TEST_USERS,
    TEST_PROPERTIES,
    TEST_RECORDS,
    TEST_QUOTES,
    SELECTORS,
    FORM_OPTIONS,
    generateTestEmail,
    generateTestPhone,
    generateRandomString,
    generateTestId,
    generateQuoteData,
    generateMultipleLineItems,
    generateCustomerData,
    generateHomeRecordData,
    generateJobData,
    generateEvaluationData,
    generateServiceRequestData,
    generateInvitationData,
    generateInvoiceData,
    formatPhone,
    wait
};
