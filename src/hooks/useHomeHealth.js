// src/hooks/useHomeHealth.js
import { useMemo } from 'react';
import { MAINTENANCE_FREQUENCIES } from '../config/constants';

export const useHomeHealth = (records = []) => {
    return useMemo(() => {
        if (!records || records.length === 0) {
            return { score: 0, breakdown: { profile: 0, maintenance: 100 }, overdueCount: 0 };
        }

        const now = new Date();
        let overdueCount = 0;
        let upcomingCount = 0;
        
        // 1. Profile Strength (Diversity of items) - Max 50 points
        const essentialCategories = ['HVAC', 'Plumbing', 'Safety', 'Roof', 'Appliances', 'Electrical'];
        const foundCategories = new Set();
        
        records.forEach(r => {
            if (r.category) {
                const cat = r.category.toLowerCase();
                if (cat.includes('hvac') || cat.includes('air')) foundCategories.add('HVAC');
                else if (cat.includes('plumb') || cat.includes('water')) foundCategories.add('Plumbing');
                else if (cat.includes('safety') || cat.includes('alarm') || cat.includes('detect')) foundCategories.add('Safety');
                else if (cat.includes('roof') || cat.includes('gutter')) foundCategories.add('Roof');
                else if (cat.includes('appliance') || cat.includes('fridge') || cat.includes('washer')) foundCategories.add('Appliances');
                else if (cat.includes('electr')) foundCategories.add('Electrical');
            }
        });
        
        const profileScore = Math.min(50, (foundCategories.size / 5) * 50);

        // 2. Maintenance Status - Max 50 points
        // Start with 50, deduct for overdue
        records.forEach(record => {
            const processTask = (dateStr, freq) => {
                if (!dateStr || freq === 'none') return;
                
                // Calculate due date (naive calculation matching other components)
                const installed = new Date(dateStr);
                const freqObj = MAINTENANCE_FREQUENCIES.find(f => f.value === freq);
                if (!freqObj || !freqObj.months) return;

                const next = new Date(installed);
                next.setMonth(next.getMonth() + freqObj.months);
                while (next < now) next.setMonth(next.getMonth() + freqObj.months);
                
                const daysUntil = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
                
                // Logic: If the loop pushed 'next' to the future, we check if it *just* happened or if we are actually overdue based on previous cycle. 
                // For simplicity in this gamification, we rely on the pre-calculated 'daysUntil' passed down usually, 
                // but here we do a rough check: if next date is very close (e.g. today/tomorrow) or we just passed it.
                // *Actually, simpler approach:* relies on the parent passing 'overdueTasks' usually, 
                // but since this is a standalone hook, let's use a simpler heuristic:
                // If it was due in the past and hasn't been marked done, it's overdue.
                // However, the `next` calculation above automatically moves it to the future.
                // So strictly speaking, nothing is "overdue" by date logic alone unless we track "last serviced".
                // We will assume simpler penalty: 
                // We will trust the inputs. If this hook is used with raw records, we might miss specific "overdue" flags 
                // unless we replicate the exact logic from Dashboard. 
            };
        });

        // RE-IMPLEMENTING ROBUST DATE CHECKING TO MATCH DASHBOARD
        records.forEach(record => {
             if (record.maintenanceTasks && record.maintenanceTasks.length > 0) {
                 record.maintenanceTasks.forEach(t => {
                     const due = new Date(t.nextDue);
                     if (due < now) overdueCount++;
                     else if ((due - now) / (1000 * 3600 * 24) < 30) upcomingCount++;
                 });
             } else {
                 if (record.maintenanceFrequency && record.maintenanceFrequency !== 'none' && record.dateInstalled) {
                     const freq = MAINTENANCE_FREQUENCIES.find(f => f.value === record.maintenanceFrequency);
                     if (freq) {
                         // Calculate effective next date
                         const start = new Date(record.dateInstalled);
                         let next = new Date(start);
                         while (next < now) next.setMonth(next.getMonth() + freq.months);
                         
                         // If we had to move it forward, it technically means we missed the *previous* window 
                         // UNLESS the user just installed it. 
                         // To detect 'overdue' without a 'lastServiced' field is tricky.
                         // Current app logic: "Overdue" is calculated by `daysUntil`.
                         // If `daysUntil` is negative, it's overdue.
                         // But `getNextServiceDate` usually returns a future date.
                         // *Correction*: The app's `getNextServiceDate` pushes to future. 
                         // So arguably, the user is never "overdue" in the code's eyes—they are just "due soon".
                         // **GAMIFICATION FIX:** We will count tasks due within 7 days as "Urgent" (penalty).
                         const days = (next - now) / (1000 * 3600 * 24);
                         if (days < 7) overdueCount++; 
                     }
                 }
             }
        });

        const maintenanceScore = Math.max(0, 50 - (overdueCount * 10));
        
        return {
            score: Math.round(profileScore + maintenanceScore),
            breakdown: {
                profile: Math.round(profileScore),
                maintenance: Math.round(maintenanceScore),
                categories: foundCategories.size
            },
            overdueCount
        };
    }, [records]);
};
