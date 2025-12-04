// src/lib/utils.js

export const toProperCase = (str) => {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};

export const calculateNextDate = (startDate, frequency) => {
    if (!startDate || !frequency || frequency === 'none') return null;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null; 
    const freqMap = { 'quarterly': 3, 'semiannual': 6, 'annual': 12, 'biennial': 24, 'quinquennial': 60 };
    const monthsToAdd = freqMap[frequency];
    if (!monthsToAdd) return null;
    const nextDate = new Date(start);
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
    return nextDate.toISOString().split('T')[0]; 
};
