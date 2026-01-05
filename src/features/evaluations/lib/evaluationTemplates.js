// src/features/evaluations/lib/evaluationTemplates.js
// ============================================
// EVALUATION TEMPLATES
// ============================================
// Default prompts by job category for virtual evaluations.
// Contractors can use these as-is or customize.

// ============================================
// PROMPT TYPES
// ============================================

export const PROMPT_TYPES = {
    PHOTO: 'photo',
    VIDEO: 'video',
    TEXT: 'text',
    SELECT: 'select',
    NUMBER: 'number',
    YES_NO: 'yes_no'
};

// ============================================
// JOB CATEGORIES
// ============================================

export const JOB_CATEGORIES = {
    HVAC: 'hvac',
    PLUMBING: 'plumbing',
    ELECTRICAL: 'electrical',
    ROOFING: 'roofing',
    FLOORING: 'flooring',
    PAINTING: 'painting',
    APPLIANCE: 'appliance',
    GARAGE_DOOR: 'garage_door',
    WATER_HEATER: 'water_heater',
    GENERAL: 'general'
};

// ============================================
// CATEGORY DISPLAY NAMES
// ============================================

export const CATEGORY_LABELS = {
    [JOB_CATEGORIES.HVAC]: 'HVAC / Air Conditioning',
    [JOB_CATEGORIES.PLUMBING]: 'Plumbing',
    [JOB_CATEGORIES.ELECTRICAL]: 'Electrical',
    [JOB_CATEGORIES.ROOFING]: 'Roofing',
    [JOB_CATEGORIES.FLOORING]: 'Flooring',
    [JOB_CATEGORIES.PAINTING]: 'Painting',
    [JOB_CATEGORIES.APPLIANCE]: 'Appliance Repair/Install',
    [JOB_CATEGORIES.GARAGE_DOOR]: 'Garage Door',
    [JOB_CATEGORIES.WATER_HEATER]: 'Water Heater',
    [JOB_CATEGORIES.GENERAL]: 'General / Other'
};

// ============================================
// DEFAULT TEMPLATES BY CATEGORY
// ============================================

export const EVALUATION_TEMPLATES = {
    // ----------------------------------------
    // HVAC
    // ----------------------------------------
    [JOB_CATEGORIES.HVAC]: {
        name: 'HVAC Evaluation',
        description: 'For AC, heating, and ventilation assessments',
        estimatedDuration: 15,
        prompts: [
            {
                id: 'hvac_unit_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of current HVAC unit',
                hint: 'Include the model/serial number plate if visible',
                required: true
            },
            {
                id: 'hvac_area_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of area around the unit',
                hint: 'Show clearance and accessibility',
                required: true
            },
            {
                id: 'hvac_thermostat_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of thermostat',
                hint: 'Show current settings if possible',
                required: false
            },
            {
                id: 'hvac_panel_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of electrical panel',
                hint: 'Open the panel door to show breakers',
                required: false
            },
            {
                id: 'hvac_ductwork_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of accessible ductwork',
                hint: 'Attic or basement ductwork if accessible',
                required: false
            },
            {
                id: 'hvac_age',
                type: PROMPT_TYPES.SELECT,
                label: 'Approximate age of current system',
                required: true,
                options: [
                    { value: 'under_5', label: 'Less than 5 years' },
                    { value: '5_10', label: '5-10 years' },
                    { value: '10_15', label: '10-15 years' },
                    { value: '15_20', label: '15-20 years' },
                    { value: 'over_20', label: 'Over 20 years' },
                    { value: 'unknown', label: 'Unknown' }
                ]
            },
            {
                id: 'hvac_issue',
                type: PROMPT_TYPES.TEXT,
                label: 'Describe the issue or what you need',
                hint: 'When did it start? Any unusual sounds or smells?',
                required: true
            },
            {
                id: 'hvac_home_sqft',
                type: PROMPT_TYPES.NUMBER,
                label: 'Approximate home square footage',
                required: false
            }
        ]
    },

    // ----------------------------------------
    // PLUMBING
    // ----------------------------------------
    [JOB_CATEGORIES.PLUMBING]: {
        name: 'Plumbing Evaluation',
        description: 'For pipe, drain, and fixture assessments',
        estimatedDuration: 10,
        prompts: [
            {
                id: 'plumb_issue_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of the problem area',
                hint: 'Leak location, clogged drain, broken fixture, etc.',
                required: true
            },
            {
                id: 'plumb_under_sink_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo under the sink (if applicable)',
                hint: 'Show pipes and connections',
                required: false
            },
            {
                id: 'plumb_water_heater_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of water heater (if related)',
                hint: 'Include age label if visible',
                required: false
            },
            {
                id: 'plumb_access_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo showing access to pipes',
                hint: 'Crawl space, basement, or wall access',
                required: false
            },
            {
                id: 'plumb_issue_type',
                type: PROMPT_TYPES.SELECT,
                label: 'Type of issue',
                required: true,
                options: [
                    { value: 'leak', label: 'Leak' },
                    { value: 'clog', label: 'Clog / Slow drain' },
                    { value: 'no_water', label: 'No water / Low pressure' },
                    { value: 'fixture', label: 'Fixture repair/replacement' },
                    { value: 'water_heater', label: 'Water heater issue' },
                    { value: 'sewer', label: 'Sewer / Main line' },
                    { value: 'other', label: 'Other' }
                ]
            },
            {
                id: 'plumb_description',
                type: PROMPT_TYPES.TEXT,
                label: 'Describe the problem',
                hint: 'When did it start? Constant or intermittent?',
                required: true
            },
            {
                id: 'plumb_home_age',
                type: PROMPT_TYPES.SELECT,
                label: 'Age of home',
                required: false,
                options: [
                    { value: 'under_10', label: 'Less than 10 years' },
                    { value: '10_30', label: '10-30 years' },
                    { value: '30_50', label: '30-50 years' },
                    { value: 'over_50', label: 'Over 50 years' },
                    { value: 'unknown', label: 'Unknown' }
                ]
            }
        ]
    },

    // ----------------------------------------
    // ELECTRICAL
    // ----------------------------------------
    [JOB_CATEGORIES.ELECTRICAL]: {
        name: 'Electrical Evaluation',
        description: 'For wiring, panel, and electrical assessments',
        estimatedDuration: 15,
        prompts: [
            {
                id: 'elec_panel_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of electrical panel (open)',
                hint: 'Show breakers and any labels',
                required: true
            },
            {
                id: 'elec_panel_label_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of panel label/rating',
                hint: 'Usually inside the panel door',
                required: false
            },
            {
                id: 'elec_issue_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of problem area',
                hint: 'Outlet, switch, fixture, or affected area',
                required: true
            },
            {
                id: 'elec_work_type',
                type: PROMPT_TYPES.SELECT,
                label: 'Type of work needed',
                required: true,
                options: [
                    { value: 'repair', label: 'Repair existing' },
                    { value: 'outlet_switch', label: 'Add outlet/switch' },
                    { value: 'lighting', label: 'Lighting installation' },
                    { value: 'panel', label: 'Panel upgrade/repair' },
                    { value: 'ev_charger', label: 'EV charger installation' },
                    { value: 'rewire', label: 'Rewiring' },
                    { value: 'other', label: 'Other' }
                ]
            },
            {
                id: 'elec_description',
                type: PROMPT_TYPES.TEXT,
                label: 'Describe what you need',
                hint: 'Be specific about locations and requirements',
                required: true
            },
            {
                id: 'elec_panel_amps',
                type: PROMPT_TYPES.SELECT,
                label: 'Current panel amperage (if known)',
                required: false,
                options: [
                    { value: '100', label: '100 amps' },
                    { value: '150', label: '150 amps' },
                    { value: '200', label: '200 amps' },
                    { value: '400', label: '400 amps' },
                    { value: 'unknown', label: 'Unknown' }
                ]
            }
        ]
    },

    // ----------------------------------------
    // ROOFING
    // ----------------------------------------
    [JOB_CATEGORIES.ROOFING]: {
        name: 'Roofing Evaluation',
        description: 'For roof repair or replacement assessments',
        estimatedDuration: 20,
        prompts: [
            {
                id: 'roof_overview_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of roof from street view',
                hint: 'Show as much of the roof as possible',
                required: true
            },
            {
                id: 'roof_damage_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of damage or problem area',
                hint: 'Close-up of leaks, missing shingles, etc.',
                required: true
            },
            {
                id: 'roof_interior_damage_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of interior damage (if any)',
                hint: 'Ceiling stains, water damage, etc.',
                required: false
            },
            {
                id: 'roof_attic_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo from attic (if accessible)',
                hint: 'Show underside of roof, any visible damage',
                required: false
            },
            {
                id: 'roof_type',
                type: PROMPT_TYPES.SELECT,
                label: 'Current roof type',
                required: true,
                options: [
                    { value: 'asphalt_shingle', label: 'Asphalt shingles' },
                    { value: 'tile', label: 'Tile (clay or concrete)' },
                    { value: 'metal', label: 'Metal' },
                    { value: 'flat', label: 'Flat / Built-up' },
                    { value: 'wood', label: 'Wood shake/shingle' },
                    { value: 'slate', label: 'Slate' },
                    { value: 'unknown', label: 'Unknown' }
                ]
            },
            {
                id: 'roof_age',
                type: PROMPT_TYPES.SELECT,
                label: 'Approximate roof age',
                required: true,
                options: [
                    { value: 'under_10', label: 'Less than 10 years' },
                    { value: '10_20', label: '10-20 years' },
                    { value: '20_30', label: '20-30 years' },
                    { value: 'over_30', label: 'Over 30 years' },
                    { value: 'unknown', label: 'Unknown' }
                ]
            },
            {
                id: 'roof_work_type',
                type: PROMPT_TYPES.SELECT,
                label: 'Work needed',
                required: true,
                options: [
                    { value: 'repair', label: 'Repair only' },
                    { value: 'partial', label: 'Partial replacement' },
                    { value: 'full', label: 'Full replacement' },
                    { value: 'inspection', label: 'Inspection / Assessment' },
                    { value: 'unsure', label: 'Not sure' }
                ]
            },
            {
                id: 'roof_sqft',
                type: PROMPT_TYPES.NUMBER,
                label: 'Approximate roof square footage',
                hint: 'If unknown, provide home square footage',
                required: false
            }
        ]
    },

    // ----------------------------------------
    // WATER HEATER
    // ----------------------------------------
    [JOB_CATEGORIES.WATER_HEATER]: {
        name: 'Water Heater Evaluation',
        description: 'For water heater repair or replacement',
        estimatedDuration: 10,
        prompts: [
            {
                id: 'wh_unit_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of water heater',
                hint: 'Show the full unit',
                required: true
            },
            {
                id: 'wh_label_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of data plate/label',
                hint: 'Shows model, serial, capacity, and age',
                required: true
            },
            {
                id: 'wh_connections_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of water and gas/electric connections',
                hint: 'Show pipes and power source',
                required: false
            },
            {
                id: 'wh_type',
                type: PROMPT_TYPES.SELECT,
                label: 'Water heater type',
                required: true,
                options: [
                    { value: 'gas_tank', label: 'Gas (tank)' },
                    { value: 'electric_tank', label: 'Electric (tank)' },
                    { value: 'gas_tankless', label: 'Gas tankless' },
                    { value: 'electric_tankless', label: 'Electric tankless' },
                    { value: 'heat_pump', label: 'Heat pump / Hybrid' },
                    { value: 'unknown', label: 'Unknown' }
                ]
            },
            {
                id: 'wh_issue',
                type: PROMPT_TYPES.SELECT,
                label: 'Issue type',
                required: true,
                options: [
                    { value: 'no_hot', label: 'No hot water' },
                    { value: 'not_enough', label: 'Not enough hot water' },
                    { value: 'leaking', label: 'Leaking' },
                    { value: 'noisy', label: 'Strange noises' },
                    { value: 'replacement', label: 'Want to replace / upgrade' },
                    { value: 'other', label: 'Other' }
                ]
            },
            {
                id: 'wh_description',
                type: PROMPT_TYPES.TEXT,
                label: 'Additional details',
                required: false
            }
        ]
    },

    // ----------------------------------------
    // APPLIANCE
    // ----------------------------------------
    [JOB_CATEGORIES.APPLIANCE]: {
        name: 'Appliance Evaluation',
        description: 'For appliance repair or installation',
        estimatedDuration: 10,
        prompts: [
            {
                id: 'app_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of appliance',
                hint: 'Show the full appliance',
                required: true
            },
            {
                id: 'app_model_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of model/serial label',
                hint: 'Usually inside door or on back',
                required: true
            },
            {
                id: 'app_issue_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of issue (if visible)',
                hint: 'Error codes, damage, leak, etc.',
                required: false
            },
            {
                id: 'app_type',
                type: PROMPT_TYPES.SELECT,
                label: 'Appliance type',
                required: true,
                options: [
                    { value: 'refrigerator', label: 'Refrigerator' },
                    { value: 'dishwasher', label: 'Dishwasher' },
                    { value: 'washer', label: 'Washing machine' },
                    { value: 'dryer', label: 'Dryer' },
                    { value: 'oven_range', label: 'Oven / Range' },
                    { value: 'microwave', label: 'Microwave' },
                    { value: 'garbage_disposal', label: 'Garbage disposal' },
                    { value: 'other', label: 'Other' }
                ]
            },
            {
                id: 'app_work_type',
                type: PROMPT_TYPES.SELECT,
                label: 'Work needed',
                required: true,
                options: [
                    { value: 'repair', label: 'Repair' },
                    { value: 'install_new', label: 'Install (new purchase)' },
                    { value: 'replace', label: 'Replace existing' },
                    { value: 'diagnosis', label: 'Diagnosis only' }
                ]
            },
            {
                id: 'app_description',
                type: PROMPT_TYPES.TEXT,
                label: 'Describe the issue or need',
                required: true
            }
        ]
    },

    // ----------------------------------------
    // GARAGE DOOR
    // ----------------------------------------
    [JOB_CATEGORIES.GARAGE_DOOR]: {
        name: 'Garage Door Evaluation',
        description: 'For garage door repair or replacement',
        estimatedDuration: 10,
        prompts: [
            {
                id: 'gd_exterior_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of garage door (exterior)',
                hint: 'Show the full door',
                required: true
            },
            {
                id: 'gd_interior_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of door mechanism (interior)',
                hint: 'Show springs, tracks, and opener',
                required: true
            },
            {
                id: 'gd_issue_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of problem area',
                hint: 'Damaged panel, broken spring, etc.',
                required: false
            },
            {
                id: 'gd_door_type',
                type: PROMPT_TYPES.SELECT,
                label: 'Door type',
                required: true,
                options: [
                    { value: 'single', label: 'Single car' },
                    { value: 'double', label: 'Double car' },
                    { value: 'custom', label: 'Custom / Oversized' }
                ]
            },
            {
                id: 'gd_issue_type',
                type: PROMPT_TYPES.SELECT,
                label: 'Issue type',
                required: true,
                options: [
                    { value: 'wont_open', label: "Won't open" },
                    { value: 'wont_close', label: "Won't close" },
                    { value: 'noisy', label: 'Noisy operation' },
                    { value: 'spring', label: 'Broken spring' },
                    { value: 'panel', label: 'Damaged panel' },
                    { value: 'opener', label: 'Opener issue' },
                    { value: 'replace', label: 'Want to replace' },
                    { value: 'other', label: 'Other' }
                ]
            },
            {
                id: 'gd_description',
                type: PROMPT_TYPES.TEXT,
                label: 'Additional details',
                required: false
            }
        ]
    },

    // ----------------------------------------
    // GENERAL
    // ----------------------------------------
    [JOB_CATEGORIES.GENERAL]: {
        name: 'General Evaluation',
        description: 'For other job types',
        estimatedDuration: 15,
        prompts: [
            {
                id: 'gen_area_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Photo of work area',
                hint: 'Show the area where work is needed',
                required: true
            },
            {
                id: 'gen_detail_photo',
                type: PROMPT_TYPES.PHOTO,
                label: 'Close-up photo of issue/area',
                hint: 'Show specific details',
                required: false
            },
            {
                id: 'gen_video',
                type: PROMPT_TYPES.VIDEO,
                label: 'Video walkthrough (optional)',
                hint: '30-60 seconds showing the area',
                required: false
            },
            {
                id: 'gen_description',
                type: PROMPT_TYPES.TEXT,
                label: 'Describe what you need',
                hint: 'Be as specific as possible',
                required: true
            }
        ]
    }
};

// ============================================
// HELPER: GET TEMPLATE FOR CATEGORY
// ============================================

export const getTemplateForCategory = (category) => {
    return EVALUATION_TEMPLATES[category] || EVALUATION_TEMPLATES[JOB_CATEGORIES.GENERAL];
};

// ============================================
// HELPER: GET PROMPTS FOR CATEGORY
// ============================================

export const getPromptsForCategory = (category) => {
    const template = getTemplateForCategory(category);
    return template.prompts || [];
};

// ============================================
// HELPER: CREATE CUSTOM PROMPT
// ============================================

export const createCustomPrompt = ({ type, label, hint = '', required = false, options = null }) => {
    return {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        label,
        hint,
        required,
        ...(options && { options })
    };
};

// ============================================
// HELPER: MERGE TEMPLATE WITH CUSTOM PROMPTS
// ============================================

export const mergePrompts = (templatePrompts, customPrompts) => {
    return [...templatePrompts, ...customPrompts];
};

// ============================================
// CATEGORIES THAT TYPICALLY NEED EVALUATION
// ============================================

export const CATEGORIES_REQUIRING_EVALUATION = [
    JOB_CATEGORIES.HVAC,
    JOB_CATEGORIES.ROOFING,
    JOB_CATEGORIES.ELECTRICAL, // for panel upgrades, rewiring
    JOB_CATEGORIES.PLUMBING,   // for main line, water heater
];

// ============================================
// CATEGORIES THAT USUALLY DON'T NEED EVAL
// ============================================

export const CATEGORIES_SIMPLE = [
    // These often can be quoted from description alone
    // But contractor can still request eval if needed
];

// ============================================
// SUGGESTED EVALUATION TYPE BY CATEGORY
// ============================================

export const SUGGESTED_EVAL_TYPE = {
    [JOB_CATEGORIES.HVAC]: 'virtual',         // Can often quote from photos
    [JOB_CATEGORIES.ROOFING]: 'site_visit',   // Usually needs in-person
    [JOB_CATEGORIES.ELECTRICAL]: 'virtual',   // Depends on scope
    [JOB_CATEGORIES.PLUMBING]: 'virtual',     // Can often quote from photos
    [JOB_CATEGORIES.WATER_HEATER]: 'virtual', // Usually straightforward
    [JOB_CATEGORIES.APPLIANCE]: 'virtual',    // Model info is key
    [JOB_CATEGORIES.GARAGE_DOOR]: 'virtual',  // Usually visible issues
    [JOB_CATEGORIES.FLOORING]: 'site_visit',  // Need measurements
    [JOB_CATEGORIES.PAINTING]: 'site_visit',  // Need measurements
    [JOB_CATEGORIES.GENERAL]: 'virtual'       // Start virtual, escalate if needed
};
