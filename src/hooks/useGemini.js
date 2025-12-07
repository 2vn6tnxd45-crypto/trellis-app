// src/hooks/useGemini.js
import { useState } from 'react';
import { geminiModel } from '../config/firebase';
import { getBase64Data } from '../lib/images';
import { toProperCase } from '../lib/utils';
import { CATEGORIES, ROOMS } from '../config/constants';

export const useGemini = () => {
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    // ... (suggestMaintenance remains the same) ...
    const suggestMaintenance = async (record) => {
        if (!geminiModel) return null;
        if (!record.item && !record.category) {
            alert("Please enter an Item Name or Category first.");
            return null;
        }
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
            const roomsStr = ROOMS.join(', ');

            // UPDATED PROMPT: Added Cost Extraction
            const prompt = `
                Analyze this document (receipt/invoice/proposal).
                
                VALID CATEGORIES: [${categoriesStr}]
                VALID ROOMS: [${roomsStr}]

                STEP 1: GLOBAL CONTEXT
                - Look for a "Material" or "System" summary (e.g., "Material: California Cool Roof"). Use this to infer the Brand/Model for generic items like "Shingles".
                - Identify the Store/Contractor and Date.

                STEP 2: ITEM EXTRACTION RULES
                - Extract PHYSICAL installed items only.
                - IGNORE "Labor", "Haul Away", "Dump Fees" UNLESS it is the only line item.
                - EXTRACT COST: Find the line item price. If it's a total project invoice, try to estimate the cost per item or assign the full total to the main item.
                - DEDUPLICATE: If "Flashing" is listed twice (e.g. for Main Roof and Patio), create ONE item "Flashing" and mention "Main Roof & Patio" in the notes.
                - NAME CLEANING: Remove warranty info or verbs from the Name.

                STEP 3: OUTPUT
                Return JSON: 
                { 
                  "store": "Contractor Name",
                  "date": "YYYY-MM-DD",
                  "primaryCategory": "Category", 
                  "primaryArea": "Room",
                  "items": [
                    { 
                      "item": "Clean Product Name (max 4-5 words)", 
                      "category": "Best Fit",
                      "area": "Best Fit",
                      "brand": "Inferred", 
                      "model": "Inferred", 
                      "cost": 0.00,
                      "notes": "Include location, warranty details, and specs here." 
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
            
            if (data.items) {
                data.items = data.items.map(item => ({
                    ...item,
                    item: toProperCase(item.item),
                    brand: toProperCase(item.brand),
                    category: item.category || data.primaryCategory || "",
                    area: item.area || data.primaryArea || "",
                    notes: item.notes || "",
                    cost: item.cost || 0 // Ensure cost exists
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

    return { suggestMaintenance, scanReceipt, isSuggesting, isScanning };
};
