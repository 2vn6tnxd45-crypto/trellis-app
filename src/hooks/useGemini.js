// src/hooks/useGemini.js
import { useState } from 'react';
import { geminiModel } from '../config/firebase';
import { getBase64Data } from '../lib/images';
import { toProperCase } from '../lib/utils';

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
            const prompt = `
                Analyze this image (receipt/invoice/label).
                Identify all distinct line items.
                Expand abbreviations (e.g., "Fauc" -> "Faucet").
                For EACH item, extract:
                - item: CLEAN product name.
                - category: Best guess category.
                - brand: Manufacturer.
                - model: Model #.
                - contractor: Store name.
                - dateInstalled: YYYY-MM-DD.
                Return JSON: { "items": [{...}] }
            `;
            const result = await geminiModel.generateContent([
                prompt,
                { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
            ]);
            const text = result.response.text().replace(/```json|```/g, '').trim();
            const data = JSON.parse(text);
            
            // Clean up the data immediately
            if (data.items) {
                data.items = data.items.map(item => ({
                    ...item,
                    item: toProperCase(item.item),
                    brand: toProperCase(item.brand),
                    contractor: toProperCase(item.contractor)
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
