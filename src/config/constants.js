// src/config/constants.js
export const appId = 'krib-app';
// Ideally, move this API key to import.meta.env.VITE_GOOGLE_MAPS_API_KEY
export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const REQUESTS_COLLECTION_PATH = `/artifacts/${appId}/public/data/requests`;
export const INVITATIONS_COLLECTION_PATH = `/artifacts/${appId}/public/data/invitations`;
export const STANDARD_MAINTENANCE_ITEMS = [
    { category: "HVAC & Systems", item: "Replace HVAC Filters", maintenanceFrequency: "quarterly", tasks: ["Check filter size", "Replace if dirty", "Mark installation date"] },
    { category: "HVAC & Systems", item: "Clean AC Condenser Unit", maintenanceFrequency: "annual", tasks: ["Remove leaves/debris", "Spray down fins with water", "Check for damage"] },
    { category: "Safety", item: "Test Smoke Detectors", maintenanceFrequency: "quarterly", tasks: ["Press test button", "Vacuum dust from cover"] },
    { category: "Plumbing", item: "Flush Water Heater", maintenanceFrequency: "annual", tasks: ["Connect hose to drain valve", "Flush sediment until clear", "Check anode rod"] },
    { category: "Appliances", item: "Clean Dryer Vent Duct", maintenanceFrequency: "annual", tasks: ["Disconnect duct", "Vacuum lint from hose and wall", "Check exterior flap"] },
    { category: "Appliances", item: "Clean Refrigerator Coils", maintenanceFrequency: "annual", tasks: ["Vacuum coils at bottom/back", "Clean drip pan"] },
    { category: "Roof & Exterior", item: "Clean Gutters", maintenanceFrequency: "semiannual", tasks: ["Remove debris", "Flush downspouts", "Check for leaks"] },
    { category: "Roof & Exterior", item: "Inspect Roof", maintenanceFrequency: "annual", tasks: ["Check for missing shingles", "Inspect flashing", "Look for moss growth"] },
    { category: "Plumbing", item: "Test Sump Pump", maintenanceFrequency: "semiannual", tasks: ["Pour water in pit", "Ensure float triggers pump", "Check discharge line"] },
    { category: "Interior", item: "Inspect Caulking", maintenanceFrequency: "annual", tasks: ["Check tubs/showers", "Check sink seals", "Re-caulk if peeling"] }
];
export const CATEGORIES = [
"Paint & Finishes", 
"Appliances", 
"Flooring", 
"HVAC & Systems", 
"Plumbing", 
"Electrical", 
"Roof & Exterior", 
"Landscaping", 
"Service & Repairs", 
"Safety", 
"Pest Control", 
"Interior", 
"Other"
];
export const ROOMS = [
"Kitchen", 
"Living Room", 
"Dining Room", 
"Master Bedroom", 
"Bedroom", 
"Master Bathroom", 
"Bathroom", 
"Office", 
"Laundry Room", 
"Garage", 
"Basement", 
"Attic", 
"Exterior", 
"Hallway", 
"Entryway", 
"Patio/Deck", 
"Other (Custom)"
];
export const PAINT_SHEENS = ["Flat/Matte", "Eggshell", "Satin", "Semi-Gloss", "High-Gloss", "Exterior"];
export const ROOF_MATERIALS = ["Asphalt Shingles", "Metal", "Clay/Concrete Tile", "Slate", "Wood Shake", "Composite", "Other"];
export const FLOORING_TYPES = ["Hardwood", "Laminate", "Vinyl/LVP", "Tile", "Carpet", "Concrete", "Other"];
// Keep as Array for Dashboard compatibility
export const MAINTENANCE_FREQUENCIES = [
    { label: "None (One-time)", value: "none", months: 0 },
    { label: "Monthly", value: "monthly", months: 1 },
    { label: "Quarterly (Every 3 Mo)", value: "quarterly", months: 3 },
    { label: "Bi-Annually (Every 6 Mo)", value: "semiannual", months: 6 }, // legacy key
    { label: "Bi-Annually (Every 6 Mo)", value: "biannual", months: 6 },   // new key
    { label: "Annually (Every 12 Mo)", value: "annual", months: 12 },
    { label: "Every 2 Years", value: "biennial", months: 24 }, // legacy key
    { label: "Every 2 Years", value: "2years", months: 24 },   // new key
    { label: "Every 5 Years", value: "quinquennial", months: 60 }, // legacy key
    { label: "Every 5 Years", value: "5years", months: 60 }    // new key
];
