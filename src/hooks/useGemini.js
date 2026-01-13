// src/hooks/useGemini.js
import { useState } from 'react';
import { geminiModel } from '../config/firebase';
import { getBase64Data } from '../lib/images';
import { toProperCase } from '../lib/utils';
import { CATEGORIES, ROOMS } from '../config/constants';

export const useGemini = () => {
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Maintenance suggestion logic (Preserved)
    const suggestMaintenance = async (record) => {
        if (!geminiModel || (!record.item && !record.category)) return null;
        setIsSuggesting(true);
        try {
            const prompt = `
                Home maintenance record:
                Item: ${record.item}, Category: ${record.category}, Brand: ${record.brand || 'Unknown'}
                Return JSON: { "frequency": "annual", "tasks": ["Task 1", "Task 2"] }
            `;
            const result = await geminiModel.generateContent(prompt);
            const text = result.response.text().replace(/```json|```/g, '').trim();
            return JSON.parse(text);
        } catch (error) { return null; } finally { setIsSuggesting(false); }
    };

    // --- HELPER: Match AI guess to Constants ---
    // --- HELPER: Match AI guess to Constants ---
    const findBestRoomMatch = (aiGuess, itemName = '', category = '', invoiceContext = '') => {
        // ===== COMPREHENSIVE DEBUG =====
        console.log(`🔍 findBestRoomMatch called:`, { aiGuess, itemName, category, invoiceContext: invoiceContext?.substring(0, 100) });
        // ================================

        // Combine all text for context search
        const fullContext = `${aiGuess} ${itemName} ${category} ${invoiceContext}`.toLowerCase();

        // ============ STEP 1: Check for EXPLICIT location mentions in context ============
        // These take absolute priority over any inference
        const explicitLocationPatterns = [
            { pattern: /\bin\s+attic\b|\battic\s+install|\brelocate[d]?\s+to\s+attic|\battic\s+unit/i, room: 'Attic' },
            { pattern: /\bin\s+garage\b|\bgarage\s+install/i, room: 'Garage' },
            { pattern: /\bin\s+basement\b|\bbasement\s+install/i, room: 'Basement' },
            { pattern: /\bside\s+of\s+house\b|\bexterior\b|\boutside\b|\boutdoor\s+unit\b|\bbackyard\b/i, room: 'Exterior' },
            { pattern: /\blaundry\s+room\b|\butility\s+room\b/i, room: 'Laundry Room' },
            { pattern: /\bmaster\s+bath|\bmaster\s+bathroom/i, room: 'Master Bathroom' },
            { pattern: /\bkitchen\b/i, room: 'Kitchen' },
        ];

        for (const { pattern, room } of explicitLocationPatterns) {
            if (pattern.test(fullContext)) {
                console.log(`   ✅ EXPLICIT location found: "${room}" (pattern: ${pattern})`);
                return room;
            }
        }
        // =================================================================================

        // ============ STEP 2: Trust AI guess if it's valid ============
        if (aiGuess && aiGuess.toLowerCase() !== 'general') {
            const lowerGuess = aiGuess.toLowerCase();

            // Exact match
            const exact = ROOMS.find(r => r.toLowerCase() === lowerGuess);
            if (exact) {
                console.log(`   ✅ AI guess exact match: "${exact}"`);
                return exact;
            }

            // Partial match
            const partial = ROOMS.find(r =>
                r.toLowerCase().includes(lowerGuess) ||
                lowerGuess.includes(r.toLowerCase())
            );
            if (partial) {
                console.log(`   ✅ AI guess partial match: "${partial}"`);
                return partial;
            }

            // Custom location (AI found something not in our list)
            if (aiGuess.trim() && aiGuess.length > 2) {
                console.log(`   ⚠️ Using AI custom guess: "${aiGuess}"`);
                return aiGuess;
            }
        }
        // ==============================================================

        // ============ STEP 3: Inference based on item type (LAST RESORT) ============
        const searchText = `${itemName} ${category}`.toLowerCase();
        console.log(`   🔎 Fallback inference for: "${searchText}"`);

        // Kitchen items
        if (/dishwasher|refrigerator|fridge|oven|stove|range|microwave|garbage disposal/.test(searchText)) {
            console.log(`   ✅ Inferred: Kitchen`);
            return 'Kitchen';
        }

        // Bathroom items
        if (/toilet|vanity|shower|bathtub|faucet|bathroom|bath\b/.test(searchText)) {
            console.log(`   ✅ Inferred: Bathroom`);
            return 'Bathroom';
        }

        // Laundry items
        if (/washer|dryer|laundry/.test(searchText)) {
            console.log(`   ✅ Inferred: Laundry Room`);
            return 'Laundry Room';
        }

        // Garage items (water heaters, garage doors, etc.)
        if (/water heater|garage door|opener|water softener/.test(searchText)) {
            console.log(`   ✅ Inferred: Garage`);
            return 'Garage';
        }

        // Indoor HVAC (air handlers, furnaces) - default to Attic
        if (/air handler|furnace/.test(searchText)) {
            console.log(`   ✅ Inferred: Attic (indoor HVAC unit)`);
            return 'Attic';
        }

        // ============ CRITICAL FIX FOR HEAT PUMP ============
        // Only infer "Exterior" for heat pump if we DIDN'T find an explicit location above
        // and if the item name specifically includes "condenser" or "outdoor"
        if (/condenser|outdoor\s+unit|compressor/.test(searchText)) {
            console.log(`   ✅ Inferred: Exterior (outdoor unit)`);
            return 'Exterior';
        }

        // Heat pump WITHOUT "outdoor" or "condenser" in name - DON'T auto-assign Exterior
        // This is where the bug was! Heat pump systems can be in attic.
        if (/heat pump/.test(searchText)) {
            // Check if there's ANY attic context before defaulting
            if (/attic/.test(fullContext)) {
                console.log(`   ✅ Heat pump with attic context: Attic`);
                return 'Attic';
            }
            // If truly no context, default to Exterior (most common for standalone heat pump installs)
            console.log(`   ⚠️ Heat pump with no location context: Exterior (default)`);
            return 'Exterior';
        }
        // ====================================================

        // Exterior items (pools, sprinklers, etc.)
        if (/pool|pump|sprinkler|irrigation|outdoor|patio|deck|fence|roof|gutter|siding/.test(searchText)) {
            console.log(`   ✅ Inferred: Exterior`);
            return 'Exterior';
        }

        console.log(`   ❌ No inference possible, returning: "${aiGuess || 'General'}"`);
        return aiGuess || 'General';
    };

    // --- Bulletproof Address Check Helper ---
    const isSameAddress = (vendorAddr, userStreet, fullUserAddress = '') => {
        if (!vendorAddr) return false;

        const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const vendorNorm = normalize(vendorAddr);

        // Check 1: Does vendor address contain the user's street?
        if (userStreet) {
            const streetNorm = normalize(userStreet);
            if (streetNorm.length > 5 && vendorNorm.includes(streetNorm)) {
                console.warn(`⚠️ Address match detected (street): "${vendorAddr}" contains "${userStreet}"`);
                return true;
            }
        }

        // Check 2: Does vendor address match the full user address?
        if (fullUserAddress) {
            const fullNorm = normalize(fullUserAddress);
            // If 80%+ of the full address is contained, it's likely the same
            if (fullNorm.length > 10 && vendorNorm.includes(fullNorm.substring(0, Math.floor(fullNorm.length * 0.8)))) {
                console.warn(`⚠️ Address match detected (full): "${vendorAddr}" matches "${fullUserAddress}"`);
                return true;
            }
        }

        // Check 3: Extract and compare street numbers + first part of street name
        const extractStreetNum = (str) => {
            const match = (str || '').match(/^(\d+)/);
            return match ? match[1] : null;
        };

        const vendorNum = extractStreetNum(vendorAddr);
        const userNum = extractStreetNum(userStreet || fullUserAddress);

        if (vendorNum && userNum && vendorNum === userNum) {
            // Same street number - do a more careful comparison
            const vendorWords = vendorNorm.replace(/\d/g, '').trim();
            const userWords = normalize(userStreet || fullUserAddress).replace(/\d/g, '').trim();

            if (vendorWords.length > 5 && userWords.length > 5) {
                // Check if first significant portion matches (e.g., "sanharoldoway")
                const vendorStart = vendorWords.substring(0, 12);
                const userStart = userWords.substring(0, 12);
                if (vendorStart === userStart) {
                    console.warn(`⚠️ Address match detected (number+street): "${vendorAddr}"`);
                    return true;
                }
            }
        }

        return false;
    };

    // --- Helper: Check if contact info matches user ---
    const isSameContact = (vendorVal, userVal) => {
        if (!vendorVal || !userVal) return false;
        const normalize = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalize(vendorVal) === normalize(userVal);
    };
    // ---------------------------------------------

    // ============================================
    // WARRANTY PROCESSING HELPERS (NEW)
    // ============================================

    // Helper to format structured warranty back to string (for backwards compatibility)
    const formatWarrantyString = (details) => {
        if (!details?.hasCoverage) return '';

        const parts = [];
        if (details.partsMonths) {
            const years = details.partsMonths >= 12 ? Math.floor(details.partsMonths / 12) : null;
            parts.push(years ? `${years} year parts` : `${details.partsMonths} month parts`);
        }
        if (details.laborMonths) {
            const years = details.laborMonths >= 12 ? Math.floor(details.laborMonths / 12) : null;
            parts.push(years ? `${years} year labor` : `${details.laborMonths} month labor`);
        }
        return parts.join(', ');
    };

    // Helper to parse legacy string into structured format (best effort)
    const parseWarrantyString = (str, installDate) => {
        if (!str) return null;

        const lower = str.toLowerCase();
        const result = {
            hasCoverage: true,
            type: 'parts_only',
            partsMonths: 0,
            laborMonths: 0,
            provider: 'manufacturer',
            contactName: null,
            contactPhone: null,
            registrationNumber: null,
            transferable: false,
            requiresService: false,
            startDate: installDate || new Date().toISOString().split('T')[0],
            notes: str // Keep original text
        };

        // Parse years/months for parts
        const partsMatch = lower.match(/(\d+)\s*year\s*parts?/);
        if (partsMatch) result.partsMonths = parseInt(partsMatch[1]) * 12;

        const partsMonthMatch = lower.match(/(\d+)\s*month\s*parts?/);
        if (partsMonthMatch) result.partsMonths = parseInt(partsMonthMatch[1]);

        // Parse years/months for labor
        const laborMatch = lower.match(/(\d+)\s*year\s*labor/);
        if (laborMatch) result.laborMonths = parseInt(laborMatch[1]) * 12;

        const laborMonthMatch = lower.match(/(\d+)\s*month\s*labor/);
        if (laborMonthMatch) result.laborMonths = parseInt(laborMonthMatch[1]);

        // Generic "X year warranty" without type
        if (result.partsMonths === 0 && result.laborMonths === 0) {
            const genericMatch = lower.match(/(\d+)\s*year/);
            if (genericMatch) result.partsMonths = parseInt(genericMatch[1]) * 12;
        }

        // Detect type
        if (result.partsMonths > 0 && result.laborMonths > 0) {
            result.type = 'parts_and_labor';
        } else if (result.laborMonths > 0) {
            result.type = 'labor_only';
        }

        // Check for transferable
        if (/transferable|transfers?/i.test(lower)) {
            result.transferable = true;
        }

        // Check for service requirements
        if (/annual\s+service|service\s+required|maintain/i.test(lower)) {
            result.requiresService = true;
        }

        return result;
    };

    // Process warranty data from AI response
    const processWarrantyData = (data) => {
        // If AI returned structured warranty data, use it
        if (data.warrantyDetails && typeof data.warrantyDetails === 'object') {
            const wd = data.warrantyDetails;
            return {
                warrantyDetails: {
                    ...wd,
                    startDate: wd.startDate || data.date || new Date().toISOString().split('T')[0]
                },
                // Keep legacy string for backwards compatibility
                warranty: data.warranty || formatWarrantyString(wd)
            };
        }

        // Fallback: if AI returned legacy string format only
        if (data.warranty && typeof data.warranty === 'string' && data.warranty.trim()) {
            return {
                warranty: data.warranty,
                warrantyDetails: parseWarrantyString(data.warranty, data.date)
            };
        }

        return { warranty: '', warrantyDetails: null };
    };
    // ============================================

    // --- SCANNER LOGIC ---
    const scanReceipt = async (file, base64Str, userAddress = null) => {
        if (!geminiModel || !file) {
            console.error("Gemini Model or File missing");
            return null;
        }
        setIsScanning(true);
        try {
            const base64Data = getBase64Data(base64Str);
            const mimeType = file.type || "image/jpeg";
            const categoriesStr = CATEGORIES.join(', ');
            const roomsStr = ROOMS.join(', ');

            // Address & Contact Context
            let userStreet = "";
            let fullUserAddress = "";
            let userEmail = "";
            let userPhone = "";

            if (userAddress) {
                if (typeof userAddress === 'string') {
                    fullUserAddress = userAddress;
                    userStreet = userAddress.split(',')[0];
                } else if (typeof userAddress === 'object') {
                    fullUserAddress = `${userAddress.street || ''} ${userAddress.city || ''} ${userAddress.state || ''} ${userAddress.zip || ''}`.trim();
                    userStreet = userAddress.street || "";
                    // Capture contact info if available in the address object
                    userEmail = userAddress.email || "";
                    userPhone = userAddress.phone || "";
                }
            }

            const prompt = `
                Analyze this invoice/receipt for a Home Inventory App.
                
                1. **IDENTIFY VENDOR (CONTRACTOR)**:
                   - Vendor is the company PERFORMING the service.
                   - **CONTEXT CLUES**: Vendor address is usually at the TOP (near logo) or BOTTOM (footer).
                   - **USER/HOMEOWNER**: The address "${fullUserAddress}" is the User. 
                   - **CRITICAL EXCLUSION**: 
                     - **NEVER** return Name, Phone, or Email found under "Bill To", "Ship To", "Customer", or "Service Address".
                     - **NEVER** return the homeowner's name as the Vendor.
                   - **ADDRESS LOGIC**: 
                     - Do NOT return an address if it starts with "${userStreet}" (Street Number + Name match).
                     - **ALLOW**: You MUST allow addresses in the same City/State/Zip as the user, as long as the street is different.
                   - **ADDRESS CLEANING**: Check for missing spaces (e.g. "123 Main StSanta Ana" -> "123 Main St, Santa Ana").
                   - Extract: Vendor Name, Phone, Email, Address.
                
                2. **EXTRACT PHYSICAL ITEMS (UPDATED)**:
                   - Look for physical equipment (HVAC units, Water Heaters, Appliances).
                   - **SPLIT RULE**: If a line lists multiple distinct models (e.g. Air Handler AND Heat Pump), create separate items for them.
                   - **LABOR & SERVICES**: Do NOT create separate items for "Installation", "Labor", or "Permits", BUT...
                   - **CONTEXT RULE**: You MUST read the "Labor" or "Service" descriptions to find the LOCATION of the item. 
                     - Example: If a line says "Install Heat Pump in Attic", do not create an item called "Install", but DO create an item called "Heat Pump" and set its area to "Attic".

                3. **EXTRACT WARRANTY INFO (STRUCTURED)**:
                   Parse warranty information into a STRUCTURED object.
                   
                   Look for patterns like:
                   - "10 year parts warranty" → partsMonths: 120
                   - "1 year labor" → laborMonths: 12
                   - "5 year limited warranty" → partsMonths: 60
                   - "Lifetime warranty" → partsMonths: 600 (50 years)
                   - Registration numbers (e.g., "Reg #12345", "Registration: ABC123")
                   - Warranty phone numbers (often 1-800 numbers in fine print)
                   - "Transferable warranty" → transferable: true
                   - "Annual service required to maintain warranty" → requiresService: true
                   
                   PARSING RULES:
                   - Convert years to months (1 year = 12, 5 years = 60, 10 years = 120)
                   - If only "X year warranty" with no type specified, assume parts_only
                   - If "parts AND labor" or "full warranty", set type to "parts_and_labor"
                   - Look for manufacturer warranty hotlines (often in fine print or warranty section)
                   - Also return as a simple string in the "warranty" field for backwards compatibility
                
                4. **EXTRACT COSTS**:
                   - If the invoice lists a bundled "Job Total", assign the FULL cost to the MAIN unit (e.g. Heat Pump).
                   - Assign 0.00 to secondary components to avoid double-counting.
                
                5. **INTELLIGENT MAINTENANCE TASKS**:
                   - Based on the item, suggest specific maintenance tasks.
                   - Example: If HVAC, suggest "Replace Filter" (quarterly) AND "Professional Tune-up" (annual).
                   - Calculate the *first due date* for each task starting from the invoice date (or today).
                
                6. **EXTRACT INSTALLATION LOCATION (CRITICAL)**:
                   - **ABSOLUTE PRIORITY: READ THE INVOICE TEXT FIRST**
                   - Search for EXPLICIT location phrases ANYWHERE in the invoice, especially in:
                     - Service description lines (e.g., "Install heat pump in attic")
                     - Line item descriptions
                     - Notes or comments sections
                   
                   - **LOCATION KEYWORDS TO SEARCH FOR**:
                     - "in attic", "attic install", "relocate to attic", "attic unit" → "Attic"
                     - "in garage", "garage install" → "Garage"
                     - "side of house", "exterior", "outside", "outdoor unit", "backyard" → "Exterior"
                     - "basement", "crawlspace" → "Basement"
                     - "laundry room", "utility room" → "Laundry Room"
                     - "master bath", "master bathroom" → "Master Bathroom"
                     - "kitchen" → "Kitchen"
                   
                   - **HVAC-SPECIFIC RULES**:
                     - If the invoice says "heat pump system in attic" or "heat pump installed in attic":
                       → The HEAT PUMP item should be "Attic" (NOT Exterior!)
                     - If there's a SEPARATE line for "condenser" or "outdoor unit" being installed outside:
                       → That specific item (if you create it) should be "Exterior"
                     - **Air Handlers** are almost always indoor units → default to "Attic" or "Garage"
                     - **Heat Pump** refers to the SYSTEM, not just the outdoor unit. If invoice says "heat pump in attic", use "Attic"
                   
                   - **CONTEXT MATTERS**: A "Heat Pump System" installed "in attic" means the main unit is in the attic, 
                     even though the outdoor condenser is outside. The SYSTEM location should be where the main work was done.
                   
                   - **ONLY USE INFERENCE** if NO explicit location is mentioned in the invoice:
                     - Generic "HVAC condenser" with no location → "Exterior"
                     - Generic "Air Handler" with no location → "Attic"
                     - Generic "Water Heater" with no location → "Garage"
                   
                   - **NEVER default to "General"** if you can determine or infer a location.

                   EXAMPLE:
                   Invoice text: "Installation of 4 ton Heat-pump system in attic"
                   Items to create:
                   - Air Handler → area: "Attic" (explicit from "in attic")
                   - Heat Pump → area: "Attic" (explicit from "heat-pump system in attic")
                   
                   WRONG: Setting Heat Pump to "Exterior" when invoice says "in attic"

                7. **PRIMARY JOB**: Short summary title (e.g. "Heat Pump Installation").

                Return JSON:
                {
                  "vendorName": "String",
                  "vendorPhone": "String",
                  "vendorEmail": "String",
                  "vendorAddress": "String",
                  "date": "YYYY-MM-DD",
                  "totalAmount": 0.00,
                  "primaryJobDescription": "String",
                  "warranty": "String (e.g. '10 year parts, 1 year labor')",
                  "warrantyDetails": {
                    "hasCoverage": true,
                    "type": "parts_and_labor | parts_only | labor_only | extended",
                    "partsMonths": 120,
                    "laborMonths": 12,
                    "provider": "manufacturer | contractor | third_party",
                    "contactName": "String or null (e.g. 'Trane Warranty Services')",
                    "contactPhone": "String or null (e.g. '1-800-555-1234')",
                    "registrationNumber": "String or null",
                    "transferable": false,
                    "requiresService": false,
                    "notes": "String or null (any special conditions)"
                  },
                  "items": [
                    { 
                      "item": "String", 
                      "category": "String (Best match from: ${categoriesStr})",
                      "area": "String (Best match from: ${roomsStr})",
                      "brand": "String", 
                      "model": "String", 
                      "serial": "String",
                      "cost": 0.00,
                      "maintenanceFrequency": "String (overall frequency)",
                      "maintenanceNotes": "String",
                      "suggestedTasks": [
                        {
                            "task": "String (e.g. Change Filter)",
                            "frequency": "String (quarterly, annual, etc)",
                            "firstDueDate": "YYYY-MM-DD"
                        }
                      ]
                    }
                  ]
                }
            `;

            const result = await geminiModel.generateContent([
                prompt,
                { inlineData: { data: base64Data, mimeType: mimeType } }
            ]);

            const text = result.response.text().replace(/```json|```/g, '').trim();

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error("JSON Parse Error:", text);
                return null;
            }

            // ===== DEBUG: Log raw AI response =====
            console.log("🤖 RAW AI RESPONSE:", JSON.stringify(data, null, 2));

            // ===== Post-process item locations with full context from the job description =====
            if (data.items && data.items.length > 0) {
                data.items = data.items.map(item => {
                    const resolvedArea = findBestRoomMatch(
                        item.area,                          // AI's guess
                        item.item,                          // Item name (e.g., "Heat Pump")
                        item.category || '',                // Category
                        data.primaryJobDescription || ''    // THIS is the context - e.g., "Installation of 4 ton Heat-pump system in attic"
                    );

                    if (item.area !== resolvedArea) {
                        console.log(`📍 LOCATION CORRECTED: "${item.item}" from "${item.area}" → "${resolvedArea}"`);
                    }

                    return { ...item, area: resolvedArea };
                });
            }

            // Continue with existing code...
            console.log("📍 AI returned these areas for items:");
            // ===== END DEBUG =====

            // Validate Structure
            if (!Array.isArray(data.items)) data.items = [];
            data.vendorName = String(data.vendorName || '');
            data.totalAmount = data.totalAmount || 0;

            // === BULLETPROOF CHECK: Remove Vendor Info if it matches User ===
            if (data.vendorAddress && userStreet && isSameAddress(data.vendorAddress, userStreet)) {
                console.warn(`⚠️ Safety Trigger: AI identified user address (${userStreet}) as vendor address. Clearing field.`);
                data.vendorAddress = '';
            }
            if (data.vendorEmail && userEmail && isSameContact(data.vendorEmail, userEmail)) {
                console.warn(`⚠️ Safety Trigger: AI identified user email as vendor. Clearing.`);
                data.vendorEmail = '';
            }
            if (data.vendorPhone && userPhone && isSameContact(data.vendorPhone, userPhone)) {
                console.warn(`⚠️ Safety Trigger: AI identified user phone as vendor. Clearing.`);
                data.vendorPhone = '';
            }
            // ===========================================================================

            // ===== PROCESS WARRANTY DATA (NEW) =====
            const warrantyData = processWarrantyData(data);
            data.warranty = warrantyData.warranty;
            data.warrantyDetails = warrantyData.warrantyDetails;
            console.log("🛡️ PROCESSED WARRANTY:", { warranty: data.warranty, warrantyDetails: data.warrantyDetails });
            // ========================================

            // Clean up items
            data.items = data.items.map(item => {
                const itemName = toProperCase(String(item.item || 'Unknown Item'));
                const category = item.category || "Other";
                return {
                    ...item,
                    item: itemName,
                    brand: toProperCase(String(item.brand || '')),
                    category: category,
                    area: findBestRoomMatch(item.area, itemName, category),
                    cost: item.cost || 0,
                    warranty: item.warranty || data.warranty || '',
                    warrantyDetails: data.warrantyDetails, // Attach structured warranty to each item
                    maintenanceFrequency: item.maintenanceFrequency || 'annual',
                    maintenanceNotes: item.maintenanceNotes || '',
                    suggestedTasks: Array.isArray(item.suggestedTasks) ? item.suggestedTasks : []
                };
            });

            return data;

        } catch (error) {
            console.error("Scan Error:", error);
            return null;
        } finally {
            setIsScanning(false);
        }
    };

    const scanRoom = async (files, base64Array) => { return null; };
    const getCountyRecordGuide = async (county, state) => { return null; };

    return { suggestMaintenance, scanReceipt, scanRoom, getCountyRecordGuide, isSuggesting, isScanning, isSearching };
};
