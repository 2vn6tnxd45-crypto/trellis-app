// src/hooks/useGemini.js
// ... imports ...

export const useGemini = () => {
    // ... existing state ...
    const [isSearching, setIsSearching] = useState(false);

    // ... existing functions ...

    // NEW FUNCTION
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
