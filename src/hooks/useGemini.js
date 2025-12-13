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
        if (!geminiModel || !file) {
            console.error("Gemini Model or File missing");
            return null;
        }
        setIsScanning(true);
        try {
            const base64Data = getBase64Data(base64Str);
            const mimeType = file.type || "image/jpeg";
            const categoriesStr = CATEGORIES.join(', ');

            const prompt = `
                Analyze this invoice/receipt.
                1. IDENTIFY VENDOR (Contractor): Name, Phone, Email, Address. Ignore "Bill To".
                2. EXTRACT ITEMS: Split "Air Handler" and "Heat Pump" into separate items if listed.
                3. COSTS: If "Amount Due" is 0, use "Job Total".
                4. RETURN JSON ONLY.
                
                Format:
                {
                  "vendorName": "String", "vendorPhone": "String", "vendorEmail": "String", "vendorAddress": "String",
                  "date": "YYYY-MM-DD", "totalAmount": 0.00, "primaryJobDescription": "String",
                  "items": [{ "item": "String", "category": "String", "brand": "String", "model": "String", "serial": "String", "cost": 0.00 }]
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
            
            // --- SAFETY HARDENING ---
            // Ensure items is ALWAYS an array
            if (!Array.isArray(data.items)) data.items = [];
            
            // Ensure strings are strings (prevents object render crashes)
            data.vendorName = String(data.vendorName || '');
            data.totalAmount = data.totalAmount || 0;
            
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
