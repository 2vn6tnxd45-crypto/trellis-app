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
    const findBestRoomMatch = (guess) => {
        if (!guess) return '';
        const lowerGuess = guess.toLowerCase();
        // Exact match (insensitive)
        const exact = ROOMS.find(r => r.toLowerCase() === lowerGuess);
        if (exact) return exact;
        // Partial match (e.g. "Master Bath" -> "Master Bathroom")
        const partial = ROOMS.find(r => r.toLowerCase().includes(lowerGuess) || lowerGuess.includes(r.toLowerCase()));
        return partial || guess; // Return guess (as custom) if no match
    };

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
                
                6. **INFER ROOM/AREA**:
                   - Guess the room this item belongs in based on context.
                   - Options: ${roomsStr}.
                   - Examples: "Dishwasher" -> "Kitchen", "Vanity" -> "Bathroom", "Water Heater" -> "Garage".

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
            
            // Validate Structure
            if (!Array.isArray(data.items)) data.items = [];
            data.vendorName = String(data.vendorName || '');
            data.totalAmount = data.totalAmount || 0;
            
            // Clean up items
            data.items = data.items.map(item => ({
                ...item,
                item: toProperCase(String(item.item || 'Unknown Item')),
                brand: toProperCase(String(item.brand || '')),
                category: item.category || "Other",
                // NEW: Map AI guess to Room Constants
                area: findBestRoomMatch(item.area) || "General",
                cost: item.cost || 0,
                warranty: item.warranty || data.warranty || '',
                maintenanceFrequency: item.maintenanceFrequency || 'annual',
                maintenanceNotes: item.maintenanceNotes || '',
                // Ensure tasks array is present
                suggestedTasks: Array.isArray(item.suggestedTasks) ? item.suggestedTasks : []
            }));

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
