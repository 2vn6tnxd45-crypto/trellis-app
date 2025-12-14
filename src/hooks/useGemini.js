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

            // UPDATED PROMPT: WARRANTY LINE ITEMS + ADDRESS CLEANING
            const prompt = `
                Analyze this invoice/receipt for a Home Inventory App.
                
                1. **IDENTIFY VENDOR (CONTRACTOR)**:
                   - The Vendor is the company PERFORMING the service.
                   - **LOCATION CUES**: Header (Top) or Footer.
                   - **NEGATIVE CONSTRAINT**: Do NOT use the address "${excludeAddressString}". That is the client. If the only address matches this, return empty string.
                   - **ADDRESS FORMATTING**: Ensure there is a space or comma between the Street and City (e.g. "123 Main St, Santa Ana" NOT "123 Main StSanta Ana"). Fix any concatenation issues.
                   - Extract: Vendor Name, Phone, Email, Address.
                
                2. **EXTRACT PHYSICAL ITEMS**:
                   - Look for physical equipment (HVAC, Water Heater, Appliances).
                   - **SPLIT RULE**: If a line lists multiple distinct models (e.g. Air Handler AND Heat Pump), create TWO separate items.
                
                3. **EXTRACT WARRANTIES AS ITEMS**:
                   - Look for text like "10 year parts warranty" or "2 year labor warranty".
                   - **ACTION**: Create a NEW ITEM in the 'items' list for EACH distinct warranty period found.
                   - **NAMING**: Name them clearly, e.g. "Parts Warranty (10 Year)" and "Labor Warranty (2 Year)".
                   - **CATEGORY**: Set category to "Service & Repairs" or "Other".
                   - **COST**: Set cost to 0.00.
                
                4. **EXTRACT COSTS**:
                   - If "Amount Due" is $0 (paid), use "Job Total".
                
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
                  "items": [
                    { 
                      "item": "String", 
                      "category": "String (Best match from: ${categoriesStr})",
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
