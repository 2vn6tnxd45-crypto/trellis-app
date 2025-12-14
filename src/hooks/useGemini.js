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

    // Maintenance suggestion logic (unchanged)
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

    // UPDATED SCANNER LOGIC: Now accepts userAddress
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
                    // Combine parts: "123 Main St, Springfield, IL 62704"
                    excludeAddressString = `${userAddress.street || ''} ${userAddress.city || ''} ${userAddress.state || ''} ${userAddress.zip || ''}`.trim();
                }
            }

            // UPDATED PROMPT: DYNAMIC EXCLUSION
            const prompt = `
                Analyze this invoice/receipt for a Home Inventory App.
                
                1. **IDENTIFY VENDOR (CONTRACTOR)**:
                   - The Vendor is the company PERFORMING the service.
                   - **LOCATION CUES**: Look for logos or bold text at the very TOP (Header) or very BOTTOM (Footer).
                   - **NEGATIVE CONSTRAINT (CRITICAL)**: Do NOT use the address "${excludeAddressString}" or any variation of it. That is the Client/Homeowner. If the only address you find matches this, return an empty string for the vendor address.
                   - **IGNORE**: "Bill To", "Sold To", "Ship To", "Service Address".
                   - Extract: Vendor Name, Phone, Email, Address.
                
                2. **EXTRACT PHYSICAL ITEMS (SPLIT LOGIC)**:
                   - Look for physical equipment (HVAC, Water Heater, Appliances) or Services.
                   - **SPLIT RULE**: If a single line item lists multiple pieces of equipment with distinct Model numbers (e.g. "Air Handler Model X" AND "Heat Pump Model Y"), create TWO separate items.
                   - **IGNORE**: Do NOT create separate items for "Warranty", "Labor", "Demo", "Permits", or "Misc Materials" unless they are the only things on the invoice.
                
                3. **EXTRACT COSTS**:
                   - If "Amount Due" is $0 (paid), use "Job Total" or "Subtotal".
                   - If items were split, try to estimate the cost split or assign the total cost to the main unit and $0 to the secondary unit.
                
                4. **EXTRACT WARRANTY**:
                   - Look for text indicating coverage (e.g. "10 year parts", "1 year labor").
                   - Combine into a single string.
                
                5. **PRIMARY JOB**: Short summary title (e.g. "HVAC System Replacement").

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
                      "category": "String (Best fit from: ${categoriesStr})",
                      "brand": "String", 
                      "model": "String", 
                      "serial": "String",
                      "cost": 0.00
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
            data.warranty = String(data.warranty || '');
            
            // Clean up items
            data.items = data.items.map(item => ({
                ...item,
                item: toProperCase(String(item.item || 'Unknown Item')),
                brand: toProperCase(String(item.brand || '')),
                category: item.category || "Other",
                cost: item.cost || 0
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
