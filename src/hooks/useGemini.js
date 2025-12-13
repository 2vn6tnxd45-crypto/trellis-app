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
                - Identify the Store/Contractor Name.
                - Look for Contractor Contact Info: Phone Number and Email Address if present.
                - Identify the Date.

                STEP 2: ITEM EXTRACTION RULES
                - Extract PHYSICAL installed items only.
                - IGNORE Labor/Haul Away unless it's the only item.
                - EXTRACT COST: Find the line item price.
                - DEDUPLICATE items.
                - NAME CLEANING: Remove warranty info or verbs.
                - BRAND/MODEL: Only include if explicitly visible on document. Leave empty string "" if not found or not applicable (e.g., for services like pest control, plumbing labor, etc.)

                STEP 3: OUTPUT
                Return JSON:
                {
                  "store": "Contractor Name",
                  "phone": "555-0199 (if found, else empty string)",
                  "email": "contact@company.com (if found, else empty string)",
                  "date": "YYYY-MM-DD",
                  "primaryCategory": "Category",
                  "primaryArea": "Room",
                  "items": [
                    {
                      "item": "Clean Product Name",
                      "category": "Best Fit",
                      "area": "Best Fit",
                      "brand": "",
                      "model": "",
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

    // UPDATED: Support multiple images and deduplication
    const scanRoom = async (files, base64Array) => {
        if (!geminiModel || !files || files.length === 0) return null;
        setIsScanning(true);
        try {
            // Prepare image parts for the API
            const imageParts = base64Array.map((b64, index) => ({
                inlineData: { 
                    data: getBase64Data(b64), 
                    mimeType: files[index].type || "image/jpeg" 
                }
            }));

            const categoriesStr = CATEGORIES.join(', ');

            const prompt = `
                Act as a specialized Home Inventory App. 
                I am providing ${files.length} photo(s) of a room (or parts of a room).
                
                YOUR GOAL: 
                Identify the distinct fixtures, appliances, and major furniture visible.
                
                CRITICAL DEDUPLICATION RULE: 
                If the same item appears in multiple photos (e.g., the same "Vanity" seen from two angles, or a wide shot and a close up), only list it ONCE. Consolidate your findings into a single record for that object.

                RULES FOR IDENTIFICATION:
                1. **NO "UNKNOWN"**: Describe visually if brand is hidden (e.g. "Modern Floating Vanity", "Matte Black Faucet").
                2. **GUESS THE STYLE/MODEL**: Suggest models if recognizable (e.g. "Likely IKEA Godmorgon").
                3. **CATEGORY**: Pick the best fit from: [${categoriesStr}].
                4. **NOTES**: Include specific details like color, finish, and condition.

                Return JSON only:
                {
                    "items": [
                        { 
                            "item": "Descriptive Name", 
                            "category": "Category", 
                            "brand": "Brand or Style", 
                            "model": "Estimated Series/Model",
                            "notes": "Color, finish, and condition notes." 
                        }
                    ]
                }
            `;

            const result = await geminiModel.generateContent([
                prompt,
                ...imageParts
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
