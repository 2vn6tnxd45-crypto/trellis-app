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

    // ... (suggestMaintenance function remains the same) ...
    const suggestMaintenance = async (record) => {
        if (!geminiModel) return null;
        if (!record.item && !record.category) return null;
        setIsSuggesting(true);
        try {
            const prompt = `
                I have a home maintenance record.
                Category: ${record.category || 'Unknown'}
                Item: ${record.item}
                Brand: ${record.brand || 'Unknown'}
                
                1. Recommend a maintenance frequency (one of: quarterly, semiannual, annual, biennial, quinquennial, none).
                2. List 3-5 specific maintenance tasks for this item.
                
                Return ONLY valid JSON in this format:
                {
                  "frequency": "annual",
                  "tasks": ["Task 1", "Task 2", "Task 3"]
                }
            `;
            const result = await geminiModel.generateContent(prompt);
            const text = result.response.text().replace(/```json|```/g, '').trim(); 
            return JSON.parse(text);
        } catch (error) {
            console.error("AI Error:", error);
            return null;
        } finally {
            setIsSuggesting(false);
        }
    };

    const scanReceipt = async (file, base64Str) => {
        if (!geminiModel || !file) return null;
        setIsScanning(true);
        try {
            const base64Data = getBase64Data(base64Str);
            const mimeType = file.type || "image/jpeg";
            const categoriesStr = CATEGORIES.join(', ');

            // UPDATED PROMPT: Specific instruction for Contractor Details and Equipment Specs
            const prompt = `
                Analyze this document (receipt/invoice/proposal) for a Home Inventory App.
                VALID CATEGORIES: [${categoriesStr}]

                YOUR TASKS:
                1. IDENTIFY CONTRACTOR: Look for company name, phone number, email, and physical address.
                2. EXTRACT ITEMS: Look for line items. If it's a general service invoice, create a summary item.
                3. EXTRACT SPECS: Look specifically for 'Model', 'M/N', 'Serial', 'S/N' numbers.
                4. EXTRACT COST: Total invoice amount.

                Return JSON: 
                { 
                  "store": "Contractor/Company Name",
                  "contractorPhone": "555-0199 (if found)",
                  "contractorEmail": "contact@company.com (if found)",
                  "contractorAddress": "123 Main St (if found)",
                  "date": "YYYY-MM-DD",
                  "totalAmount": 0.00,
                  "items": [
                    { 
                      "item": "Product Name or Service Description", 
                      "category": "Best Fit Category",
                      "brand": "Brand Name", 
                      "model": "Model Number", 
                      "serial": "Serial Number",
                      "cost": 0.00,
                      "notes": "Any other details" 
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
            
            // Clean up data
            if (data.items) {
                data.items = data.items.map(item => ({
                    ...item,
                    item: toProperCase(item.item),
                    brand: toProperCase(item.brand),
                    category: item.category || "Other",
                    // Ensure contractor details are passed down to items if needed
                    contractor: data.store,
                    contractorPhone: data.contractorPhone,
                    contractorEmail: data.contractorEmail
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

    // ... (scanRoom and getCountyRecordGuide remain the same) ...
    const scanRoom = async (files, base64Array) => {
        if (!geminiModel || !files || files.length === 0) return null;
        setIsScanning(true);
        try {
            const imageParts = base64Array.map((b64, index) => ({
                inlineData: { data: getBase64Data(b64), mimeType: files[index].type || "image/jpeg" }
            }));
            const categoriesStr = CATEGORIES.join(', ');
            const prompt = `
                Act as a Home Inventory App. Identify distinct fixtures/appliances/furniture.
                DEDUPLICATE: List unique items only.
                RULES:
                1. Describe visually if brand hidden.
                2. Guess style/model.
                3. CATEGORY: [${categoriesStr}].
                
                Return JSON: { "items": [{ "item": "Name", "category": "Category", "brand": "Brand", "model": "Model", "notes": "Details" }] }
            `;
            const result = await geminiModel.generateContent([prompt, ...imageParts]);
            const text = result.response.text().replace(/```json|```/g, '').trim();
            return JSON.parse(text);
        } catch (error) {
            console.error("Room Scan Error:", error);
            return null;
        } finally {
            setIsScanning(false);
        }
    };

    const getCountyRecordGuide = async (county, state) => {
        if (!geminiModel) return null;
        setIsSearching(true);
        try {
            const prompt = `Find property tax/assessor records for: ${county}, ${state}. Return JSON: { "department": "Name", "url": "URL", "tips": "Tips" }`;
            const result = await geminiModel.generateContent(prompt);
            const text = result.response.text().replace(/```json|```/g, '').trim(); 
            return JSON.parse(text);
        } catch (error) { return null; } finally { setIsSearching(false); }
    };

    return { suggestMaintenance, scanReceipt, scanRoom, getCountyRecordGuide, isSuggesting, isScanning, isSearching };
};
