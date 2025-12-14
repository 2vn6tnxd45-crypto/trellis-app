// src/hooks/useGemini.js
import { useState } from 'react';
import { geminiModel } from '../config/firebase';
import { getBase64Data } from '../lib/images';
import { toProperCase } from '../lib/utils';
import { CATEGORIES } from '../config/constants';

export const useGemini = () => {
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Maintenance suggestion logic
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

    // THE ROBUST SCANNER LOGIC
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

            // Format user address for the negative constraint
            let excludeAddressString = "";
            if (userAddress) {
                if (typeof userAddress === 'string') {
                    excludeAddressString = userAddress;
                } else if (typeof userAddress === 'object') {
                    excludeAddressString = `${userAddress.street || ''} ${userAddress.city || ''} ${userAddress.state || ''} ${userAddress.zip || ''}`.trim();
                }
            }

            // UPDATED PROMPT: MAINTENANCE SCHEDULE, WARRANTY, CLEAN ADDRESS, BUNDLED COSTS
            const prompt = `
                Analyze this invoice/receipt for a Home Inventory App.
                
                1. **IDENTIFY VENDOR (CONTRACTOR)**:
                   - Vendor is the company PERFORMING the service.
                   - **NEGATIVE CONSTRAINT**: Do NOT use the address "${excludeAddressString}". That is the client. If only that address is found, return empty string for vendor address.
                   - **ADDRESS CLEANING**: Check for missing spaces between Street and City (e.g. "123 Main StSanta Ana"). Insert a space if needed ("123 Main St, Santa Ana").
                   - Extract: Vendor Name, Phone, Email, Address.
                
                2. **EXTRACT PHYSICAL ITEMS**:
                   - Look for physical equipment (HVAC units, Water Heaters, Appliances).
                   - **SPLIT RULE**: If a line lists multiple distinct models (e.g. Air Handler AND Heat Pump), create separate items for them.
                   - **EXCLUDE**: Do NOT create items for warranties, labor, permits, or miscellaneous materials.

                3. **DETERMINE MAINTENANCE SCHEDULE (CRITICAL)**:
                   - Based on the item type, determine the industry standard maintenance frequency.
                   - Use ONLY these values: 'monthly', 'quarterly', 'semiannual', 'annual', 'biennial', 'none'.
                   - Examples: HVAC = 'semiannual' or 'annual'. Water Heater = 'annual'. Roof = 'annual'. Fridge = 'annual'.
                   - If it is a service/repair invoice, set frequency to 'annual' to prompt a check-up.
                
                4. **EXTRACT WARRANTY INFO**:
                   - Look for text indicating coverage (e.g. "10 year parts", "1 year labor").
                   - Return this as a single string in the "warranty" field. Do NOT make it a line item.
                
                5. **EXTRACT COSTS (BUNDLED LOGIC)**:
                   - If the invoice lists a single "Job Total" (e.g. $11,000) for a system installation, but lists components (Air Handler, Condenser) without individual prices:
                   - Assign the **FULL** cost to the MAIN unit (e.g. the Condenser or Heat Pump).
                   - Assign **0.00** to the secondary components (e.g. Air Handler, Coil) to avoid inflating the total.
                   - Ensure the sum of item costs roughly equals the Job Total.
                
                6. **PRIMARY JOB**: Short summary title (e.g. "Heat Pump Installation").

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
                      "brand": "String", 
                      "model": "String", 
                      "serial": "String",
                      "cost": 0.00,
                      "maintenanceFrequency": "String (one of the allowed values)",
                      "maintenanceNotes": "String (e.g. 'Recommended Annual Tune-up')"
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
            data.warranty = String(data.warranty || ''); // Capture global warranty
            
            // Clean up items
            data.items = data.items.map(item => ({
                ...item,
                item: toProperCase(String(item.item || 'Unknown Item')),
                brand: toProperCase(String(item.brand || '')),
                category: item.category || "Other",
                cost: item.cost || 0,
                // Ensure the global warranty is applied if the item doesn't have a specific one
                warranty: item.warranty || data.warranty,
                maintenanceFrequency: item.maintenanceFrequency || 'none',
                maintenanceNotes: item.maintenanceNotes || ''
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
