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

            // UPDATED PROMPT: Focus on Main Service and Vendor Extraction
            const prompt = `
                Analyze this invoice/receipt for a Home History App.
                
                1. **IDENTIFY VENDOR (Contractor)**: Look for the company doing the work (e.g. "Prime HVAC"). Do NOT confuse with the "Bill To" client.
                   - Extract: Name, Phone, Email, Address, License Number.
                
                2. **IDENTIFY PRIMARY JOB**: What was the MAIN service performed?
                   - If there are multiple line items, pick the one with the highest cost.
                   - Example: If line 1 is "Demo ($0)" and line 2 is "Install Heat Pump ($11k)", the Primary Job is "Heat Pump Install".
                
                3. **EXTRACT LINE ITEMS**: List all distinct services/products.
                   - Look specifically for MODEL numbers and SERIAL numbers in the item descriptions.
                
                4. **CATEGORIZE**: Best fit from: [${categoriesStr}].

                Return JSON:
                {
                  "vendorName": "Contractor Company Name",
                  "vendorPhone": "Phone Number",
                  "vendorEmail": "Email",
                  "vendorAddress": "Full Address",
                  "date": "YYYY-MM-DD",
                  "totalAmount": 0.00,
                  "primaryJobDescription": "Short title of the main work performed",
                  "items": [
                    { 
                      "item": "Description of line item", 
                      "category": "Category",
                      "brand": "Brand", 
                      "model": "Model Number", 
                      "serial": "Serial Number",
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

    // ... scanRoom and other functions remain the same ...
    const scanRoom = async (files, base64Array) => {
        // (Keep existing implementation)
        return null; 
    };

    const getCountyRecordGuide = async (county, state) => {
        // (Keep existing implementation)
        return null;
    };

    return { suggestMaintenance, scanReceipt, scanRoom, getCountyRecordGuide, isSuggesting, isScanning, isSearching };
};
