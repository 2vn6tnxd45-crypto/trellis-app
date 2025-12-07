// src/hooks/useGemini.js
import { useState } from 'react';
import { geminiModel } from '../config/firebase';
import { getBase64Data } from '../lib/images';
import { toProperCase } from '../lib/utils';
import { CATEGORIES, ROOMS } from '../config/constants';

export const useGemini = () => {
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isSearching, setIsSearching] = useState(false); // <--- This was likely missing

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

            const prompt = `
                Analyze this document (receipt/invoice/proposal).
                VALID CATEGORIES: [${categoriesStr}]
                VALID ROOMS: [${roomsStr}]

                STEP 1: GLOBAL CONTEXT
                - Look for a "Material" or "System" summary.
                - Identify the Store/Contractor and Date.

                STEP 2: ITEM EXTRACTION RULES
                - Extract PHYSICAL installed items only.
                - IGNORE Labor/Haul Away unless it's the only item.
                - EXTRACT COST: Find the line item price.
                - DEDUPLICATE items.
                - NAME CLEANING: Remove warranty info or verbs.

                STEP 3: OUTPUT
                Return JSON: 
                { 
                  "store": "Contractor Name",
                  "date": "YYYY-MM-DD",
                  "primaryCategory": "Category", 
                  "primaryArea": "Room",
                  "items": [
                    { 
                      "item": "Clean Product Name", 
                      "category": "Best Fit",
                      "area": "Best Fit",
                      "brand": "Inferred", 
                      "model": "Inferred", 
                      "cost": 0.00,
                      "notes": "Details" 
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
                    cost: item.cost || 0
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

    const getCountyRecordGuide = async (county, state) => {
        if (!geminiModel) return null;
        setIsSearching(true);
        try {
            const prompt = `
                I need to find property tax or assessor records for: ${county}, ${state}.
                
                1. What is the official name of the department (e.g. "Orange County Property Appraiser")?
                2. What is the likely URL for their property search tool?
                3. Are there any specific tips for searching (e.g. "Search by address not name")?
                
                Return JSON only:
                {
                    "department": "Name of Dept",
                    "url": "https://...",
                    "tips": "Short tip string"
                }
            `;
            const result = await geminiModel.generateContent(prompt);
            const text = result.response.text().replace(/```json|```/g, '').trim(); 
            return JSON.parse(text);
        } catch (error) {
            console.error("AI Search Error:", error);
            return null;
        } finally {
            setIsSearching(false);
        }
    };

    return { suggestMaintenance, scanReceipt, getCountyRecordGuide, isSuggesting, isScanning, isSearching };
};
