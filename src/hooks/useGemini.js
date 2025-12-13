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

            // UPDATED PROMPT: Prioritize "Job Total" over "Amount Due" and handle multiple items
            const prompt = `
                Analyze this invoice/receipt for a Home Inventory App.
                
                1. **IDENTIFY VENDOR**: Company Name, Phone, Email, Address.
                
                2. **EXTRACT TOTAL COST**: 
                   - CRITICAL: If "Amount Due" is $0.00 (paid), look for "Job Total", "Subtotal", or "Total" to find the actual value of work performed.
                   - Do NOT return 0.00 unless the work was actually free.
                
                3. **EXTRACT ALL LINE ITEMS**: 
                   - List every distinct service or product as a separate item.
                   - Ignore "Warranty" or "Info" lines unless they are the only items.
                   - For each item, look for: Description, Category (from [${categoriesStr}]), Brand, Model #, Serial #, and Cost.
                
                4. **PRIMARY JOB**: Create a short summary title for the entire invoice (e.g. "Heat Pump Install").

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
                      "item": "Detailed Name", 
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
