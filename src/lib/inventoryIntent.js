// src/lib/inventoryIntent.js
// ============================================
// INVENTORY INTENT SYSTEM
// ============================================
// The unified data structure that flows from Quote → Job → Completion → House Record
// This ensures no data is lost at any handoff in the contractor-to-homeowner pipeline.
//
// USAGE:
// - When contractor adds a line item to a quote, they can flag it as "Add to Home Record"
// - This creates an InventoryIntent that carries all the data through the pipeline
// - At job completion, the intent is pre-populated — contractor just adds serial numbers
// - When homeowner accepts, the intent becomes a full house_record with maintenance schedule

// ============================================
// MAINTENANCE TEMPLATES BY CATEGORY
// ============================================
// These are sensible defaults that contractors can customize.
// Based on manufacturer recommendations and industry standards.

export const MAINTENANCE_TEMPLATES = {
    'HVAC & Systems': [
        {
            task: 'Replace air filter',
            frequency: 'quarterly',
            months: 3,
            notes: 'Use filter size specified on unit. MERV 8-13 recommended.',
            defaultSelected: true
        },
        {
            task: 'Professional tune-up',
            frequency: 'annual',
            months: 12,
            notes: 'Recommended before cooling season. Often required for warranty.',
            defaultSelected: true
        },
        {
            task: 'Clean condenser coils',
            frequency: 'annual',
            months: 12,
            notes: 'Remove debris, rinse with hose. Do not use pressure washer.',
            defaultSelected: false
        },
        {
            task: 'Check refrigerant levels',
            frequency: 'annual',
            months: 12,
            notes: 'Requires licensed technician.',
            defaultSelected: false
        },
        {
            task: 'Inspect ductwork',
            frequency: 'annual',
            months: 12,
            notes: 'Check for leaks, damage, or disconnections.',
            defaultSelected: false
        }
    ],
    
    'Plumbing': [
        {
            task: 'Flush water heater',
            frequency: 'annual',
            months: 12,
            notes: 'Drain 2-3 gallons to remove sediment buildup.',
            defaultSelected: true
        },
        {
            task: 'Check anode rod',
            frequency: 'every 3 years',
            months: 36,
            notes: 'Replace if less than 1/2 inch thick or coated with calcium.',
            defaultSelected: true
        },
        {
            task: 'Test T&P relief valve',
            frequency: 'annual',
            months: 12,
            notes: 'Lift lever briefly to ensure valve operates. Water should flow.',
            defaultSelected: true
        },
        {
            task: 'Inspect for leaks',
            frequency: 'quarterly',
            months: 3,
            notes: 'Check visible pipes, connections, and under sinks.',
            defaultSelected: false
        },
        {
            task: 'Clean aerators',
            frequency: 'semiannual',
            months: 6,
            notes: 'Remove and soak in vinegar to clear mineral deposits.',
            defaultSelected: false
        }
    ],
    
    'Electrical': [
        {
            task: 'Test GFCI outlets',
            frequency: 'monthly',
            months: 1,
            notes: 'Press TEST button, then RESET. Replace if not working.',
            defaultSelected: true
        },
        {
            task: 'Check panel for hot spots',
            frequency: 'annual',
            months: 12,
            notes: 'Feel for warm breakers. Warmth may indicate loose connection.',
            defaultSelected: false
        },
        {
            task: 'Inspect outdoor fixtures',
            frequency: 'annual',
            months: 12,
            notes: 'Check for water intrusion, corrosion, or damage.',
            defaultSelected: false
        }
    ],
    
    'Appliances': [
        {
            task: 'Clean refrigerator coils',
            frequency: 'annual',
            months: 12,
            notes: 'Vacuum coils at bottom or back of unit.',
            defaultSelected: true
        },
        {
            task: 'Clean dryer vent',
            frequency: 'annual',
            months: 12,
            notes: 'Disconnect and vacuum duct. Check exterior flap.',
            defaultSelected: true
        },
        {
            task: 'Clean dishwasher filter',
            frequency: 'monthly',
            months: 1,
            notes: 'Remove filter and rinse under water.',
            defaultSelected: true
        },
        {
            task: 'Descale washing machine',
            frequency: 'quarterly',
            months: 3,
            notes: 'Run empty hot cycle with washing machine cleaner or vinegar.',
            defaultSelected: false
        },
        {
            task: 'Replace water filter',
            frequency: 'semiannual',
            months: 6,
            notes: 'Check manufacturer recommendation for specific interval.',
            defaultSelected: false
        }
    ],
    
    'Roof & Exterior': [
        {
            task: 'Inspect roof',
            frequency: 'annual',
            months: 12,
            notes: 'Check for missing/damaged shingles, flashing, and moss growth.',
            defaultSelected: true
        },
        {
            task: 'Clean gutters',
            frequency: 'semiannual',
            months: 6,
            notes: 'Remove debris in spring and fall. Flush downspouts.',
            defaultSelected: true
        },
        {
            task: 'Check caulking and seals',
            frequency: 'annual',
            months: 12,
            notes: 'Inspect around windows, doors, and penetrations.',
            defaultSelected: false
        },
        {
            task: 'Trim overhanging branches',
            frequency: 'annual',
            months: 12,
            notes: 'Keep branches 10+ feet from roof surface.',
            defaultSelected: false
        }
    ],
    
    'Interior': [
        {
            task: 'Check caulking',
            frequency: 'annual',
            months: 12,
            notes: 'Inspect tubs, showers, sinks. Re-caulk if peeling or moldy.',
            defaultSelected: true
        },
        {
            task: 'Test smoke detectors',
            frequency: 'monthly',
            months: 1,
            notes: 'Press test button. Replace batteries annually.',
            defaultSelected: true
        },
        {
            task: 'Test CO detectors',
            frequency: 'monthly',
            months: 1,
            notes: 'Press test button. Replace unit every 5-7 years.',
            defaultSelected: true
        }
    ],
    
    'Safety': [
        {
            task: 'Test smoke detectors',
            frequency: 'monthly',
            months: 1,
            notes: 'Press test button on each unit.',
            defaultSelected: true
        },
        {
            task: 'Replace batteries',
            frequency: 'annual',
            months: 12,
            notes: 'Replace all detector batteries, even if still working.',
            defaultSelected: true
        },
        {
            task: 'Test CO detectors',
            frequency: 'monthly',
            months: 1,
            notes: 'Press test button. Replace unit every 5-7 years.',
            defaultSelected: true
        },
        {
            task: 'Check fire extinguisher',
            frequency: 'annual',
            months: 12,
            notes: 'Verify pressure gauge is in green zone. Check expiration.',
            defaultSelected: false
        }
    ],
    
    'Landscaping': [
        {
            task: 'Irrigation system check',
            frequency: 'seasonal',
            months: 3,
            notes: 'Test all zones, check for leaks and coverage.',
            defaultSelected: true
        },
        {
            task: 'Winterize irrigation',
            frequency: 'annual',
            months: 12,
            notes: 'Blow out lines before first freeze.',
            defaultSelected: true
        },
        {
            task: 'Fertilize lawn',
            frequency: 'quarterly',
            months: 3,
            notes: 'Use seasonal-appropriate fertilizer.',
            defaultSelected: false
        }
    ],
    
    'Service & Repairs': [
        // Generic category - typically no recurring maintenance
        {
            task: 'Inspect repair',
            frequency: 'annual',
            months: 12,
            notes: 'Check that repair is holding and no new issues.',
            defaultSelected: false
        }
    ],
    
    'Paint & Finishes': [
        {
            task: 'Inspect for wear',
            frequency: 'annual',
            months: 12,
            notes: 'Check high-traffic areas for chips, fading, or peeling.',
            defaultSelected: false
        },
        {
            task: 'Touch up as needed',
            frequency: 'annual',
            months: 12,
            notes: 'Address minor damage before it spreads.',
            defaultSelected: false
        }
    ],
    
    'Flooring': [
        {
            task: 'Deep clean',
            frequency: 'annual',
            months: 12,
            notes: 'Professional cleaning extends life of flooring.',
            defaultSelected: false
        },
        {
            task: 'Inspect grout and seams',
            frequency: 'annual',
            months: 12,
            notes: 'Re-grout or re-seal as needed.',
            defaultSelected: false
        }
    ],
    
    'Pest Control': [
        {
            task: 'Perimeter treatment',
            frequency: 'quarterly',
            months: 3,
            notes: 'Apply barrier treatment around foundation.',
            defaultSelected: true
        },
        {
            task: 'Termite inspection',
            frequency: 'annual',
            months: 12,
            notes: 'Professional inspection recommended.',
            defaultSelected: true
        }
    ],
    
    'Other': []
};

// ============================================
// FREQUENCY HELPERS
// ============================================

export const FREQUENCY_OPTIONS = [
    { value: 'monthly', label: 'Monthly', months: 1 },
    { value: 'quarterly', label: 'Quarterly (every 3 months)', months: 3 },
    { value: 'semiannual', label: 'Semi-annual (every 6 months)', months: 6 },
    { value: 'annual', label: 'Annual (yearly)', months: 12 },
    { value: 'every 2 years', label: 'Every 2 years', months: 24 },
    { value: 'every 3 years', label: 'Every 3 years', months: 36 },
    { value: 'every 5 years', label: 'Every 5 years', months: 60 },
    { value: 'none', label: 'No regular maintenance', months: 0 },
];

/**
 * Convert frequency string to months
 */
export const frequencyToMonths = (frequency) => {
    const option = FREQUENCY_OPTIONS.find(f => f.value === frequency);
    return option?.months || 12;
};

/**
 * Get the shortest frequency from a list of tasks (for overall item frequency)
 */
export const getShortestFrequency = (tasks) => {
    if (!tasks || tasks.length === 0) return 'none';
    
    const selectedTasks = tasks.filter(t => t.selected !== false);
    if (selectedTasks.length === 0) return 'none';
    
    let shortestMonths = Infinity;
    let shortestFrequency = 'annual';
    
    selectedTasks.forEach(task => {
        const months = task.months || frequencyToMonths(task.frequency);
        if (months > 0 && months < shortestMonths) {
            shortestMonths = months;
            shortestFrequency = task.frequency;
        }
    });
    
    return shortestFrequency;
};

/**
 * Calculate next service date based on install date and frequency
 */
export const calculateNextServiceDate = (installDate, frequency) => {
    if (!installDate || frequency === 'none') return null;
    
    const months = frequencyToMonths(frequency);
    if (months === 0) return null;
    
    const date = new Date(installDate);
    date.setMonth(date.getMonth() + months);
    
    return date.toISOString().split('T')[0];
};

// ============================================
// INVENTORY INTENT FACTORY
// ============================================

/**
 * Create a new InventoryIntent with sensible defaults
 * Called when contractor toggles "Add to Home Record" on a line item
 */
export const createInventoryIntent = ({
    lineItemId = null,
    priceBookItemId = null,
    item = '',
    description = '',
    category = 'Other',
    area = '',
    brand = '',
    model = '',
    cost = null,
    warranty = '',
    warrantyDetails = null,
    maintenanceTasks = null,  // If null, will use templates
} = {}) => {
    
    // Generate unique ID
    const id = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get default maintenance tasks for category if not provided
    const tasks = maintenanceTasks || getDefaultMaintenanceTasks(category);
    
    return {
        // ═══════════════════════════════════════════════════════════════
        // IDENTITY
        // ═══════════════════════════════════════════════════════════════
        id,
        linkedLineItemId: lineItemId,
        priceBookItemId: priceBookItemId,
        
        // ═══════════════════════════════════════════════════════════════
        // CORE ITEM DATA
        // ═══════════════════════════════════════════════════════════════
        item: item || '',
        description: description || '',
        category: category || 'Other',
        area: area || '',
        
        // ═══════════════════════════════════════════════════════════════
        // PRODUCT INFO
        // ═══════════════════════════════════════════════════════════════
        brand: brand || '',
        model: model || '',
        serialNumber: '',  // Filled at completion
        
        // ═══════════════════════════════════════════════════════════════
        // COST
        // ═══════════════════════════════════════════════════════════════
        cost: cost,
        laborCost: null,
        partsCost: null,
        
        // ═══════════════════════════════════════════════════════════════
        // WARRANTY
        // ═══════════════════════════════════════════════════════════════
        warranty: warranty || '',
        warrantyDetails: warrantyDetails || createDefaultWarrantyDetails(),
        
        // ═══════════════════════════════════════════════════════════════
        // MAINTENANCE
        // ═══════════════════════════════════════════════════════════════
        maintenanceTasks: tasks,
        
        // ═══════════════════════════════════════════════════════════════
        // COMPLETION DATA (filled later)
        // ═══════════════════════════════════════════════════════════════
        dateInstalled: null,
        photos: [],
        notes: '',
        
        // ═══════════════════════════════════════════════════════════════
        // TRACKING
        // ═══════════════════════════════════════════════════════════════
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceStage: 'quote',
    };
};

/**
 * Get default maintenance tasks for a category
 * Tasks are pre-selected based on `defaultSelected` flag
 */
export const getDefaultMaintenanceTasks = (category) => {
    const templates = MAINTENANCE_TEMPLATES[category] || MAINTENANCE_TEMPLATES['Other'] || [];
    
    return templates.map((template, idx) => ({
        id: `task_${Date.now()}_${idx}`,
        task: template.task,
        frequency: template.frequency,
        months: template.months,
        notes: template.notes || '',
        selected: template.defaultSelected ?? false,
    }));
};

/**
 * Create empty warranty details structure
 */
export const createDefaultWarrantyDetails = () => ({
    hasCoverage: false,
    type: null,  // 'parts_only' | 'labor_only' | 'parts_and_labor' | 'extended'
    partsMonths: null,
    laborMonths: null,
    startDate: null,
    provider: null,  // 'manufacturer' | 'contractor' | 'third_party'
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    registrationNumber: '',
    transferable: false,
    requiresService: false,
    notes: '',
});

// ============================================
// CONVERSION HELPERS
// ============================================

/**
 * Create InventoryIntent from a Price Book item
 * Called when contractor adds a price book item to quote and toggles "Add to Home Record"
 */
export const createIntentFromPriceBookItem = (priceBookItem, lineItemId = null) => {
    // If price book item has an inventory template, use it
    const template = priceBookItem.inventoryTemplate || {};
    
    return createInventoryIntent({
        lineItemId,
        priceBookItemId: priceBookItem.id,
        item: template.item || priceBookItem.name || '',
        description: priceBookItem.description || '',
        category: template.category || priceBookItem.category || 'Other',
        brand: template.brand || priceBookItem.brand || '',
        model: template.model || priceBookItem.model || '',
        warranty: template.warranty || priceBookItem.defaultWarranty || '',
        warrantyDetails: template.warrantyDetails || null,
        maintenanceTasks: template.maintenanceTasks || null,
    });
};

/**
 * Create InventoryIntent from a quote line item (manual entry, no price book)
 */
export const createIntentFromLineItem = (lineItem) => {
    return createInventoryIntent({
        lineItemId: lineItem.id,
        priceBookItemId: lineItem.priceBookItemId || null,
        item: lineItem.description || '',
        description: '',
        category: lineItem.category || 'Service & Repairs',
        area: lineItem.area || '',
        brand: lineItem.brand || '',
        model: lineItem.model || '',
        cost: lineItem.amount || (lineItem.unitPrice * (lineItem.quantity || 1)) || null,
        warranty: lineItem.warranty || '',
    });
};

/**
 * Convert InventoryIntent to house_record format
 * Called by acceptJobCompletion() when creating the final record
 */
export const intentToHouseRecord = (intent, jobData, completionData = {}) => {
    // Calculate overall frequency from selected tasks
    const overallFrequency = getShortestFrequency(intent.maintenanceTasks);
    
    // Filter to only selected tasks
    const selectedTasks = (intent.maintenanceTasks || [])
        .filter(t => t.selected !== false)
        .map(t => ({
            task: t.task,
            frequency: t.frequency,
            months: t.months,
            notes: t.notes || '',
            // Calculate first due date from install date
            nextDueDate: calculateNextServiceDate(intent.dateInstalled, t.frequency),
        }));
    
    return {
        // Core item data
        item: intent.item || 'Unnamed Item',
        category: intent.category || 'Service & Repairs',
        area: intent.area || 'General',
        brand: intent.brand || '',
        model: intent.model || '',
        serialNumber: intent.serialNumber || '',
        
        // Dates
        dateInstalled: intent.dateInstalled || new Date().toISOString().split('T')[0],
        
        // Costs
        cost: intent.cost || null,
        laborCost: intent.laborCost || null,
        partsCost: intent.partsCost || null,
        
        // Warranty (both string and structured)
        warranty: intent.warranty || '',
        warrantyDetails: intent.warrantyDetails?.hasCoverage 
            ? {
                ...intent.warrantyDetails,
                startDate: intent.warrantyDetails.startDate || intent.dateInstalled,
            }
            : null,
        
        // Maintenance
        maintenanceFrequency: overallFrequency,
        maintenanceTasks: selectedTasks,
        nextServiceDate: calculateNextServiceDate(intent.dateInstalled, overallFrequency),
        
        // Job linkage
        sourceJobId: jobData.id || jobData.jobId || null,
        sourceQuoteId: jobData.sourceQuoteId || null,
        importedFrom: 'job_completion',
        
        // Contractor linkage (critical for "Book Again")
        contractor: jobData.contractorName || '',
        contractorId: jobData.contractorId || null,
        contractorPhone: jobData.contractorPhone || '',
        contractorEmail: jobData.contractorEmail || '',
        
        // Attachments
        attachments: [
            ...(intent.photos || []).map(p => ({
                name: p.caption || 'Completion Photo',
                type: 'Image',
                url: p.url,
                dateAdded: new Date().toISOString(),
            })),
            ...(completionData.invoice?.url ? [{
                name: 'Invoice',
                type: 'Document',
                url: completionData.invoice.url,
                dateAdded: new Date().toISOString(),
            }] : []),
        ],
        imageUrl: intent.photos?.[0]?.url || '',
        
        // Notes
        notes: intent.notes || '',
        
        // Tracking
        inventoryIntentId: intent.id,
    };
};

// ============================================
// VALIDATION
// ============================================

/**
 * Check if an InventoryIntent has minimum required data
 */
export const isValidIntent = (intent) => {
    if (!intent) return false;
    if (!intent.item || intent.item.trim() === '') return false;
    return true;
};

/**
 * Check if intent is ready for completion (has all completion-time fields)
 */
export const isReadyForCompletion = (intent) => {
    if (!isValidIntent(intent)) return false;
    // At minimum, we need an install date
    if (!intent.dateInstalled) return false;
    return true;
};

/**
 * Get validation errors for an intent
 */
export const getIntentValidationErrors = (intent) => {
    const errors = [];
    
    if (!intent.item || intent.item.trim() === '') {
        errors.push('Item name is required');
    }
    
    if (!intent.category) {
        errors.push('Category is required');
    }
    
    return errors;
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Deep clone an intent (for editing without mutation)
 */
export const cloneIntent = (intent) => {
    return JSON.parse(JSON.stringify(intent));
};

/**
 * Merge updates into an intent
 */
export const updateIntent = (intent, updates) => {
    return {
        ...intent,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
};

/**
 * Get a summary string for display (e.g., in lists)
 */
export const getIntentSummary = (intent) => {
    const parts = [intent.item];
    if (intent.brand) parts.push(intent.brand);
    if (intent.model) parts.push(intent.model);
    return parts.join(' - ');
};

/**
 * Count selected maintenance tasks
 */
export const countSelectedTasks = (intent) => {
    if (!intent.maintenanceTasks) return 0;
    return intent.maintenanceTasks.filter(t => t.selected !== false).length;
};

export default {
    // Templates
    MAINTENANCE_TEMPLATES,
    FREQUENCY_OPTIONS,
    
    // Creators
    createInventoryIntent,
    createIntentFromPriceBookItem,
    createIntentFromLineItem,
    createDefaultWarrantyDetails,
    getDefaultMaintenanceTasks,
    
    // Converters
    intentToHouseRecord,
    
    // Helpers
    frequencyToMonths,
    getShortestFrequency,
    calculateNextServiceDate,
    
    // Validation
    isValidIntent,
    isReadyForCompletion,
    getIntentValidationErrors,
    
    // Utilities
    cloneIntent,
    updateIntent,
    getIntentSummary,
    countSelectedTasks,
};
