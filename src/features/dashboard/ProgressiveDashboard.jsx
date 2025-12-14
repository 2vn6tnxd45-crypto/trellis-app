// src/features/dashboard/ProgressiveDashboard.jsx
import React, { useMemo } from 'react';
// ... (imports remain the same)
import { Camera, Plus, Package, FileText, Wrench, ChevronRight, Sparkles, Home, ArrowRight, DollarSign, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { ReportTeaser } from './ReportTeaser';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { ModernDashboard } from './ModernDashboard';

// ... (Helpers and Subcomponents like EmptyHomeState, GettingStartedDashboard remain exactly the same)
// ...

export const ProgressiveDashboard = ({
    records = [],
    contractors = [],
    activeProperty,
    onScanReceipt,
    onAddRecord,
    onNavigateToItems,
    onNavigateToContractors,
    onNavigateToReports,
    onCreateContractorLink,
    onNavigateToMaintenance,
    // NEW PROPS PASSED FROM APP
    onBookService, 
    onMarkTaskDone 
}) => {
    // Determine user stage
    const stage = useMemo(() => {
        if (records.length === 0) return 'empty';
        if (records.length < 5) return 'getting-started';
        return 'established';
    }, [records.length]);

    switch (stage) {
        case 'empty':
            return <EmptyHomeState propertyName={activeProperty?.name} onAddItem={onAddRecord} onScanReceipt={onScanReceipt} />;
        
        case 'getting-started':
            return <GettingStartedDashboard records={records} propertyName={activeProperty?.name} onAddItem={onAddRecord} onScanReceipt={onScanReceipt} onNavigateToItems={onNavigateToItems} />;
        
        case 'established':
        default:
            return (
                <ModernDashboard 
                    records={records}
                    contractors={contractors}
                    activeProperty={activeProperty}
                    onScanReceipt={onScanReceipt}
                    onAddRecord={onAddRecord}
                    onNavigateToItems={onNavigateToItems}
                    onNavigateToContractors={onNavigateToContractors}
                    onNavigateToReports={onNavigateToReports}
                    onCreateContractorLink={onCreateContractorLink}
                    onNavigateToMaintenance={onNavigateToMaintenance}
                    // PASSING NEW HANDLERS
                    onBookService={onBookService}
                    onMarkTaskDone={onMarkTaskDone}
                />
            );
    }
};

export default ProgressiveDashboard;
