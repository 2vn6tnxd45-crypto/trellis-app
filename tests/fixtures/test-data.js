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

export const TEST_USERS = {
    // New homeowner (no existing data)
    newHomeowner: {
        email: 'test.homeowner.new@gmail.com',
        password: 'TestPass123!',
        name: 'Test Homeowner New',
    },

    // Homeowner with existing data
    fullHomeowner: {
        email: 'test.homeowner.full@gmail.com',
        password: 'TestPass123!',
        name: 'Test Homeowner Full',
    },

    // New contractor (no existing data)
    newContractor: {
        email: 'test.contractor.new@gmail.com',
        password: 'TestPass123!',
        name: 'Test Contractor New',
        businessName: 'Test HVAC Services',
    },

    // Contractor with existing data
    fullContractor: {
        email: 'test.contractor.full@gmail.com',
        password: 'TestPass123!',
        name: 'Test Contractor Full',
        businessName: 'Test HVAC Services LLC',
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
