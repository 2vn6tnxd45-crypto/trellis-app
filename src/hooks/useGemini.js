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
    const isSameAddress = (vendorAddr, userStreet) => {
        if (!vendorAddr || !userStreet) return false;
        // Normalize: remove spaces, punctuation, make lowercase
        const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
        const v = normalize(vendorAddr);
        const u = normalize(userStreet);
        // If the normalized vendor address contains the normalized user street, it's a match.
        return v.includes(u);
    };
    // ---------------------------------------------

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

            // Address Context
            let userStreet = "";
            let fullUserAddress = "";
            
            if (userAddress) {
                if (typeof userAddress === 'string') {
                    fullUserAddress = userAddress;
                    userStreet = userAddress.split(',')[0]; 
                } else if (typeof userAddress === 'object') {
                    fullUserAddress = `${userAddress.street || ''} ${userAddress.city || ''} ${userAddress.state || ''} ${userAddress.zip || ''}`.trim();
                    userStreet = userAddress.street || "";
                }
            }

            const prompt = `
                Analyze this invoice/receipt for a Home Inventory App.
                
                1. **IDENTIFY VENDOR (CONTRACTOR)**:
                   - Vendor is the company PERFORMING the service.
                   - **CONTEXT CLUES**: Vendor address is usually at the TOP (near logo) or BOTTOM (footer).
                   - **USER ADDRESS**: The address "${fullUserAddress}" is the Homeowner. It will likely appear under "Bill To", "Ship To", or "Service Address".
                   - **EXCLUSION LOGIC**: 
                     - Do NOT return an address if it is explicitly labeled "Bill To" or "Service Location".
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

                3. **EXTRACT WARRANTY INFO**:
                   - Look for text indicating coverage (e.g. "10 year parts", "1 year labor").
                   - Return this as a single string in the "warranty" field.
                
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
                  "warranty": "String",
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
            console.log("📍 AI returned these areas for items:");
            data.items?.forEach((item, i) => {
                console.log(`   Item ${i + 1}: "${item.item}" → area: "${item.area}"`);
            });
            // ===== END DEBUG =====
            
            // Validate Structure
            if (!Array.isArray(data.items)) data.items = [];
            data.vendorName = String(data.vendorName || '');
            data.totalAmount = data.totalAmount || 0;

            // === BULLETPROOF CHECK: Remove Vendor Address if it matches User Address ===
            if (data.vendorAddress && userStreet && isSameAddress(data.vendorAddress, userStreet)) {
                console.warn(`⚠️ Safety Trigger: AI identified user address (${userStreet}) as vendor address. Clearing field.`);
                data.vendorAddress = ''; 
            }
            // ===========================================================================
            
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
