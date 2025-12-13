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

    // ... suggestMaintenance remains the same ...
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

    const scanReceipt = async (file, base64Str) => {
        if (!geminiModel || !file) return null;
        setIsScanning(true);
        try {
            const base64Data = getBase64Data(base64Str);
            const mimeType = file.type || "image/jpeg";
            const categoriesStr = CATEGORIES.join(', ');

            // UPDATED PROMPT: STRICTER RULES FOR VENDOR & ITEM SPLITTING
            const prompt = `
                Analyze this invoice/receipt for a Home Inventory App.
                
                1. **IDENTIFY VENDOR (CONTRACTOR)**:
                   - Find the company performing the work (e.g., Logo at top, Header).
                   - CRITICAL: Do NOT use the "Bill To", "Customer", or "Ship To" name. The user (Devon Davila) is the CUSTOMER, not the vendor.
                   - Extract: Vendor Name, Phone, Email, Address.
                
                2. **EXTRACT PHYSICAL ITEMS (SPLIT LOGIC)**:
                   - Look for physical equipment (HVAC, Water Heater, Appliances).
                   - **SPLIT RULE**: If a single line item lists multiple pieces of equipment with distinct Model numbers (e.g. "Air Handler Model X" AND "Heat Pump Model Y"), create TWO separate items.
                   - **IGNORE**: Do NOT create separate items for "Warranty", "Labor", "Demo", "Permits", or "Misc Materials" unless they are the only things on the invoice.
                
                3. **EXTRACT COSTS**:
                   - If "Amount Due" is $0 (paid), use "Job Total" or "Subtotal".
                   - If items were split (see above), try to estimate the cost split or assign the total cost to the main unit and $0 to the secondary unit to avoid double-counting.
                
                4. **PRIMARY JOB**: Short summary title (e.g. "HVAC System Replacement").

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
                      "item": "Specific Equipment Name (e.g. Trane Air Handler)", 
                      "category": "String",
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
            const data = JSON.parse(text);
            
            // Post-processing
            if (data.items) {
                data.items = data.items.map(item => ({
                    ...item,
                    item: toProperCase(item.item),
                    brand: toProperCase(item.brand),
                    category: item.category || "Other"
                }));
            }
            return data;
        } catch (error) {
            console.error("Scan Error:", error);
            return null;
        } finally {
            setIsScanning(false);
        }
    };

    // ... scanRoom and getCountyRecordGuide remain the same ...
    const scanRoom = async (files, base64Array) => {
        // ... (keep existing)
        return null;
    };

    const getCountyRecordGuide = async (county, state) => {
        // ... (keep existing)
        return null;
    };

    return { suggestMaintenance, scanReceipt, scanRoom, getCountyRecordGuide, isSuggesting, isScanning, isSearching };
};
