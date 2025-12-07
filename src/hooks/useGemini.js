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

    // 1. MAINTENANCE SUGGESTIONS
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

    // 2. RECEIPT SCANNER
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
                - Identify the Store/Contractor Name.
                - Look for Contractor Contact Info: Phone Number and Email Address if present.
                - Identify the Date.

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
                  "phone": "555-0199 (if found)",
                  "email": "contact@company.com (if found)",
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

    // 3. ROOM SCANNER (Updated for "Reverse Image Search" logic)
    const scanRoom = async (file, base64Str) => {
        if (!geminiModel || !file) return null;
        setIsScanning(true);
        try {
            const base64Data = getBase64Data(base64Str);
            const mimeType = file.type || "image/jpeg";
            const categoriesStr = CATEGORIES.join(', ');

            const prompt = `
                Act as a visual search engine for home inventory. Analyze this photo.
                
                GOAL: Identify major appliances, furniture, flooring, and fixtures.
                
                SPECIFICITY RULES:
                1. Do not just say "Tiles". Use visual cues to estimate "Travertine Tile" or "Ceramic Subway Tile".
                2. Do not just say "Chair". Try to identify the style (e.g. "Eames Style Lounge Chair", "Mid-Century Modern Sofa").
                3. MODEL IDENTIFICATION: If you see an appliance, try to identify the specific series or model based on its visual features (e.g. "Samsung Bespoke Series Fridge" instead of just "Fridge").
                
                Return JSON only:
                {
                    "items": [
                        { 
                            "item": "Specific Product Name", 
                            "category": "Best fit from: ${categoriesStr}", 
                            "brand": "Estimated Brand", 
                            "model": "Estimated Series/Model (if visible)",
                            "notes": "Visual description (color, material, condition)" 
                        }
                    ]
                }
            `;

            const result = await geminiModel.generateContent([
                prompt,
                { inlineData: { data: base64Data, mimeType: mimeType } }
            ]);
            const text = result.response.text().replace(/```json|```/g, '').trim();
            return JSON.parse(text);
        } catch (error) {
            console.error("Room Scan Error:", error);
            return null;
        } finally {
            setIsScanning(false);
        }
    };

    // 4. COUNTY RECORDS GUIDE
    const getCountyRecordGuide = async (county, state) => {
        if (!geminiModel) return null;
        setIsSearching(true);
        try {
            const prompt = `
                I need to find property tax or assessor records for: ${county}, ${state}.
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

    return { suggestMaintenance, scanReceipt, scanRoom, getCountyRecordGuide, isSuggesting, isScanning, isSearching };
};
