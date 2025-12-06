// src/hooks/useGemini.js
import { useState } from 'react';
import { geminiModel } from '../config/firebase';
import { getBase64Data } from '../lib/images';
import { toProperCase } from '../lib/utils';
// NEW: Import constants to teach the AI your specific options
import { CATEGORIES, ROOMS } from '../config/constants';

export const useGemini = () => {
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

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

            // NEW: Inject valid options into the prompt
            const categoriesStr = CATEGORIES.join(', ');
            const roomsStr = ROOMS.join(', ');

            const prompt = `
                Analyze this document (receipt/invoice/label).
                
                VALID CATEGORIES: [${categoriesStr}]
                VALID ROOMS: [${roomsStr}]

                1. Identify the Store/Contractor name.
                2. Identify the Date.
                3. Determine the "primaryCategory" and "primaryArea" that best fits the MAJORITY of items (use the lists above).
                4. Extract line items. For each item:
                   - item: Clean name.
                   - category: Choose the best fit from VALID CATEGORIES list.
                   - area: Choose the best fit from VALID ROOMS list.
                   - brand: Manufacturer.
                   - model: Model #.
                
                Return JSON: 
                { 
                  "store": "Home Depot",
                  "date": "2023-10-25",
                  "primaryCategory": "Plumbing", 
                  "primaryArea": "Kitchen",
                  "items": [{...}] 
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
                    // If AI didn't pick a valid category/area for a specific item, fallback to the primary one
                    category: item.category || data.primaryCategory || "",
                    area: item.area || data.primaryArea || ""
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
