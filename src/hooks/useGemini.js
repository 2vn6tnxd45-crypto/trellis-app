// src/hooks/useGemini.js
import { useState } from 'react';
import { geminiModel } from '../config/firebase';
import { getBase64Data } from '../lib/images';
import { toProperCase } from '../lib/utils';
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

            const categoriesStr = CATEGORIES.join(', ');
            const roomsStr = ROOMS.join(', ');

            // UPDATED PROMPT: SMARTER PARSING
            const prompt = `
                Analyze this document (receipt/invoice/proposal).
                
                VALID CATEGORIES: [${categoriesStr}]
                VALID ROOMS: [${roomsStr}]

                INSTRUCTIONS:
                1. Identify the Store/Contractor name and Date.
                2. Determine the "primaryCategory" and "primaryArea" for the project.
                3. Extract PHYSICAL INSTALLED ITEMS only (e.g., Shingles, Faucets, Lumber).
                
                CRITICAL RULES:
                - DO NOT create separate items for "Warranty", "Labor", "Installation", "Haul Away", or "Services".
                - If a line says "50 Year Warranty", attach "50 Year Warranty" to the NOTES of the relevant product (e.g., the Shingles), do not list it as an item.
                - Look for Brand/Model info anywhere in the text (e.g., "Material: California Cool Roof").
                - Clean up Item Names: "Install 2x2 Drip Edge" -> "Drip Edge Metal".

                For each item return:
                   - item: Concise product name (max 5-6 words).
                   - category: Best fit from list.
                   - area: Best fit from list.
                   - brand: Manufacturer (if found).
                   - model: Model/Style/Color (if found).
                   - notes: Combine warranties, dimensions, or specific installation details here.
                
                Return JSON: 
                { 
                  "store": "Contractor Name",
                  "date": "YYYY-MM-DD",
                  "primaryCategory": "Category", 
                  "primaryArea": "Room",
                  "items": [{ "item": "...", "brand": "...", "model": "...", "notes": "Includes 50yr warranty..." }] 
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
                    notes: item.notes || "" // Ensure notes are passed
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
