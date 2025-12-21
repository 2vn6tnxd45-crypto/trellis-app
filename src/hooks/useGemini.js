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

    // --- NEW HELPER: Match AI guess to Constants ---
    // Smart room matching with item-based inference as fallback
    const findBestRoomMatch = (guess, itemName = '', category = '') => {
        // ===== DEBUG =====
        console.log(`🔍 findBestRoomMatch called:`, { guess, itemName, category });
        // ===== END DEBUG =====
        
        // First, try to match the AI's guess
        if (guess && guess.toLowerCase() !== 'general') {
            const lowerGuess = guess.toLowerCase();
            const exact = ROOMS.find(r => r.toLowerCase() === lowerGuess);
            if (exact) {
                console.log(`   ✅ Exact match: "${exact}"`);
                return exact;
            }
            const partial = ROOMS.find(r => r.toLowerCase().includes(lowerGuess) || lowerGuess.includes(r.toLowerCase()));
            if (partial) {
                console.log(`   ✅ Partial match: "${partial}"`);
                return partial;
            }
            if (guess.trim()) {
                console.log(`   ⚠️ No match, using AI guess as custom: "${guess}"`);
                return guess;
            }
        }
        
        // Fallback: infer from item name or category
        const searchText = `${itemName} ${category}`.toLowerCase();
        console.log(`   🔎 Fallback search text: "${searchText}"`);
        
        if (/dishwasher|refrigerator|fridge|oven|stove|range|microwave|garbage disposal|kitchen/.test(searchText)) {
            console.log(`   ✅ Inferred: Kitchen`);
            return 'Kitchen';
        }
        if (/toilet|vanity|shower|bathtub|faucet|bathroom|bath\b/.test(searchText)) {
            console.log(`   ✅ Inferred: Bathroom`);
            return 'Bathroom';
        }
        if (/washer|dryer|laundry/.test(searchText)) {
            console.log(`   ✅ Inferred: Laundry Room`);
            return 'Laundry Room';
        }
        if (/water heater|garage door|opener|water softener/.test(searchText)) {
            console.log(`   ✅ Inferred: Garage`);
            return 'Garage';
        }
        if (/air handler|furnace|attic/.test(searchText)) {
            console.log(`   ✅ Inferred: Attic`);
            return 'Attic';
        }
        if (/condenser|heat pump|compressor|pool|pump|sprinkler|irrigation|outdoor|patio|deck|fence|roof|gutter|siding/.test(searchText)) {
            console.log(`   ✅ Inferred: Exterior`);
            return 'Exterior';
        }
        
        console.log(`   ❌ No inference possible, returning: "${guess || 'General'}"`);
        return guess || 'General';
    };

    // --- NEW: Bulletproof Address Check Helper ---
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

    // --- UPDATED SCANNER LOGIC ---
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
            const roomsStr = ROOMS.join(', '); // NEW: List of rooms for AI context

            // --- REFINED ADDRESS EXCLUSION (Preserved Original) ---
            // Only exclude the specific street address to avoid blocking local pros in the same city.
            let userStreet = "";
            let fullUserAddress = "";
            
            if (userAddress) {
                if (typeof userAddress === 'string') {
                    fullUserAddress = userAddress;
                    // Try to grab just the street part (e.g., "123 Main St")
                    userStreet = userAddress.split(',')[0]; 
                } else if (typeof userAddress === 'object') {
                    fullUserAddress = `${userAddress.street || ''} ${userAddress.city || ''} ${userAddress.state || ''} ${userAddress.zip || ''}`.trim();
                    userStreet = userAddress.street || "";
                }
            }
            // --------------------------------

            // UPDATED PROMPT: Original text preserved, Section 6 inserted.
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
                
                2. **EXTRACT PHYSICAL ITEMS**:
                   - Look for physical equipment (HVAC units, Water Heaters, Appliances).
                   - **SPLIT RULE**: If a line lists multiple distinct models (e.g. Air Handler AND Heat Pump), create separate items for them.
                   - **EXCLUDE**: Do NOT create items for warranties, labor, permits, or miscellaneous materials.

                3. **EXTRACT WARRANTY INFO**:
                   - Look for text indicating coverage (e.g. "10 year parts", "1 year labor").
                   - Return this as a single string in the "warranty" field.
                
                4. **EXTRACT COSTS**:
                   - If the invoice lists a bundled "Job Total", assign the FULL cost to the MAIN unit (e.g. Heat Pump).
                   - Assign 0.00 to secondary components to avoid double-counting.
                
                5. **INTELLIGENT MAINTENANCE TASKS (CRITICAL)**:
                   - Based on the item, suggest specific maintenance tasks.
                   - Example: If HVAC, suggest "Replace Filter" (quarterly) AND "Professional Tune-up" (annual).
                   - Example: If Refrigerator, suggest "Clean Coils" (annual) AND "Change Water Filter" (semiannual).
                   - Calculate the *first due date* for each task starting from the invoice date (or today).
                
                6. **EXTRACT INSTALLATION LOCATION (CRITICAL - READ THE DOCUMENT)**:
                   - **STEP 1 - SEARCH FOR EXPLICIT LOCATIONS**: Carefully read the ENTIRE invoice text for phrases that indicate WHERE the item was installed. Look for:
                     - "in attic", "in garage", "in basement", "in crawlspace"
                     - "side of house", "backyard", "front yard", "exterior"
                     - "master bedroom", "master bathroom", "kitchen", "laundry room"
                     - "relocated to...", "installed in...", "moved to..."
                     - Any room name mentioned near the item description
                   - **STEP 2 - MAP TO CLOSEST OPTION**: Match what you find to the closest option from: ${roomsStr}
                     - "in attic" -> "Attic"
                     - "side of house", "backyard", "exterior", "outside" -> "Exterior"  
                     - "garage" -> "Garage"
                     - "basement" -> "Basement"
                     - "laundry" -> "Laundry Room"
                     - "master bath" -> "Master Bathroom"
                     - "kitchen" -> "Kitchen"
                   - **STEP 3 - SMART INFERENCE (only if no location mentioned)**: If NO location is explicitly stated, infer based on item type:
                     - HVAC outdoor units (condenser, heat pump) -> "Exterior"
                     - HVAC indoor units (air handler, furnace) -> Check document, often "Attic" or "Garage"
                     - Water heaters -> "Garage" (most common) or "Utility Room"
                     - Dishwashers, refrigerators, ovens -> "Kitchen"
                     - Washers, dryers -> "Laundry Room"
                     - Toilets, vanities, showers -> "Bathroom"
                   - **IMPORTANT**: Do NOT default to "General" if you can find or reasonably infer a location. "General" should only be used for whole-house items like "Roof" or when truly ambiguous.

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
            // This runs immediately after parsing to sanitize the data before it touches the app
            if (data.vendorAddress && userStreet && isSameAddress(data.vendorAddress, userStreet)) {
                console.warn(`⚠️ Safety Trigger: AI identified user address (${userStreet}) as vendor address. Clearing field.`);
                data.vendorAddress = ''; // Wipe it out so we don't save bad data
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
