// src/features/integration/KribAppIntegration.jsx
// ============================================
// 🔌 INTEGRATION EXAMPLE
// ============================================
// Shows how to integrate all new UX components
// into the existing Krib app structure.

import React, { useState, useCallback } from 'react';

// New imports to add to existing App.jsx
import { ProgressiveDashboard } from '../dashboard/ProgressiveDashboard';
import { SmartScanner } from '../scanner/SmartScanner';
import { 
    CelebrationRenderer, 
    useCelebrations 
} from '../celebrations/CelebrationMoments';

// ============================================
// INTEGRATION STEPS
// ============================================
/*
STEP 1: Add CSS import to main index.css or App.jsx:
----------------------------------------
import './styles/krib-theme.css';

STEP 2: Replace MaintenanceDashboard with ProgressiveDashboard:
----------------------------------------
See HomeView integration below.

STEP 3: Add SmartScanner as primary capture method:
----------------------------------------
See scanner integration below.

STEP 4: Add celebration hooks to record creation:
----------------------------------------
See celebration integration below.
*/

// ============================================
// EXAMPLE: INTEGRATED HOME VIEW
// ============================================

export const IntegratedHomeView = ({
    records,
    contractors,
    activeProperty,
    // ... other existing props
}) => {
    // Celebration state
    const {
        celebration,
        toast,
        checkMilestone,
        showToast,
        closeCelebration,
        closeToast,
    } = useCelebrations();
    
    // Scanner state
    const [showScanner, setShowScanner] = useState(false);
    const [lastAddedItem, setLastAddedItem] = useState(null);
    
    // Navigation handlers (connect to your existing navigation)
    const handleNavigateToItems = useCallback(() => {
        // setActiveView('items') or navigate('/items')
    }, []);
    
    const handleNavigateToContractors = useCallback(() => {
        // setActiveView('contractors')
    }, []);
    
    const handleNavigateToReports = useCallback(() => {
        // setActiveView('reports')
    }, []);
    
    // Scanner handlers
    const handleOpenScanner = useCallback(() => {
        setShowScanner(true);
    }, []);
    
    const handleCloseScanner = useCallback(() => {
        setShowScanner(false);
    }, []);
    
    // Handle scanned/extracted data
    const handleScanComplete = useCallback(async (extractedData) => {
        setShowScanner(false);
        
        // Get previous count before adding
        const previousCount = records.length;
        
        // Add the record (connect to your existing addRecord function)
        // await addRecord(extractedData);
        
        // Check for milestones
        const newCount = previousCount + 1;
        const hasMilestone = checkMilestone(previousCount, newCount);
        
        // Store item name for celebration
        setLastAddedItem(extractedData.item || 'New item');
        
        // If no milestone celebration, show simple toast
        if (!hasMilestone) {
            showToast(`${extractedData.item || 'Item'} added!`);
        }
    }, [records.length, checkMilestone, showToast]);
    
    // Handle "add another" from celebration modal
    const handleAddAnother = useCallback(() => {
        closeCelebration();
        setShowScanner(true);
    }, [closeCelebration]);
    
    return (
        <div className="min-h-screen bg-warm-50">
            {/* Main Content */}
            <div className="max-w-lg mx-auto px-4 py-6">
                <ProgressiveDashboard 
                    records={records}
                    contractors={contractors}
                    activeProperty={activeProperty}
                    onScanReceipt={handleOpenScanner}
                    onAddRecord={handleOpenScanner}
                    onNavigateToItems={handleNavigateToItems}
                    onNavigateToContractors={handleNavigateToContractors}
                    onNavigateToReports={handleNavigateToReports}
                />
            </div>
            
            {/* Smart Scanner Modal */}
            {showScanner && (
                <SmartScanner 
                    onClose={handleCloseScanner}
                    onProcessComplete={handleScanComplete}
                    // Connect your AI analysis function here:
                    // analyzeImage={analyzeImage}
                />
            )}
            
            {/* Celebration Overlays */}
            <CelebrationRenderer 
                celebration={celebration}
                toast={toast}
                itemName={lastAddedItem}
                onCloseCelebration={closeCelebration}
                onCloseToast={closeToast}
                onAddAnother={handleAddAnother}
            />
        </div>
    );
};

// ============================================
// EXAMPLE: MODIFIED App.jsx STRUCTURE
// ============================================

export const ModifiedAppExample = () => {
    // Your existing state
    const [records, setRecords] = useState([]);
    const [contractors, setContractors] = useState([]);
    const [activeProperty, setActiveProperty] = useState(null);
    const [activeView, setActiveView] = useState('home');
    
    // Add celebration hook at app level
    const celebrations = useCelebrations();
    
    // Modified addRecord function with celebrations
    const addRecord = useCallback(async (recordData) => {
        const previousCount = records.length;
        
        // Add to state/database
        const newRecord = {
            id: Date.now().toString(),
            ...recordData,
            createdAt: new Date().toISOString(),
        };
        
        setRecords(prev => [newRecord, ...prev]);
        
        // Check for milestones
        const newCount = previousCount + 1;
        celebrations.checkMilestone(previousCount, newCount);
        
        return newRecord;
    }, [records.length, celebrations]);
    
    return (
        <div>
            {/* Your existing app structure */}
            {/* ... */}
            
            {/* Global celebration renderer */}
            <CelebrationRenderer 
                celebration={celebrations.celebration}
                toast={celebrations.toast}
                onCloseCelebration={celebrations.closeCelebration}
                onCloseToast={celebrations.closeToast}
            />
        </div>
    );
};

// ============================================
// EXAMPLE: CONDITIONAL HEALTH SCORE
// ============================================

export const ConditionalHealthScore = ({ records, score }) => {
    // Feature 4: Hide health score for users with <5 items
    if (records.length < 5) {
        return null;
    }
    
    return (
        <div className="bg-white p-4 rounded-2xl border border-warm-200">
            <h3 className="font-bold text-warm-800">Home Health Score</h3>
            <p className="text-3xl font-extrabold text-sage-600">{score}</p>
        </div>
    );
};

// ============================================
// QUICK INTEGRATION CHECKLIST
// ============================================
/*
□ Add CSS import: import './styles/krib-theme.css'

□ Replace dashboard rendering:
  - FROM: <MaintenanceDashboard ... />
  - TO: <ProgressiveDashboard ... />

□ Add scanner state and modal:
  const [showScanner, setShowScanner] = useState(false);
  {showScanner && <SmartScanner onClose={() => setShowScanner(false)} />}

□ Add celebrations hook:
  const celebrations = useCelebrations();
  
□ Modify addRecord to check milestones:
  celebrations.checkMilestone(previousCount, newCount);

□ Add CelebrationRenderer at app level:
  <CelebrationRenderer celebration={...} toast={...} />

□ Hide health score when records.length < 5:
  {records.length >= 5 && <HealthScore />}

□ Remove getSeasonalTheme() calls from dashboard
*/

// ============================================
// FILE STRUCTURE
// ============================================
/*
src/
├── features/
│   ├── dashboard/
│   │   ├── ProgressiveDashboard.jsx  ← NEW
│   │   └── ReportTeaser.jsx          ← NEW
│   ├── scanner/
│   │   └── SmartScanner.jsx          ← NEW
│   └── celebrations/
│       └── CelebrationMoments.jsx    ← NEW
├── styles/
│   ├── theme.js                      ← NEW
│   └── krib-theme.css                ← NEW
└── App.jsx                           ← MODIFY
*/

export default IntegratedHomeView;
