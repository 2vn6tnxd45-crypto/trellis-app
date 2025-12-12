// src/features/index.js
// ============================================
// 📦 KRIB UX COMPONENTS - MAIN EXPORTS
// ============================================
// Single import point for all new UX improvements

// Dashboard Components
export { 
    ProgressiveDashboard,
    default as ProgressiveDashboardDefault 
} from './dashboard/ProgressiveDashboard';

export { 
    ReportTeaser,
    default as ReportTeaserDefault 
} from './dashboard/ReportTeaser';

// Scanner Components
export { 
    SmartScanner,
    default as SmartScannerDefault 
} from './scanner/SmartScanner';

// Celebration Components
export { 
    FirstItemCelebration,
    MilestoneCelebration,
    SuccessToast,
    useCelebrations,
    CelebrationRenderer,
    default as CelebrationDefault 
} from './celebrations/CelebrationMoments';

// Theme
export { 
    default as theme,
    colors,
    gradients,
    shadows,
    components,
    cssVariables,
    tailwindExtend,
    getButtonClasses,
    getCardClasses,
    getBadgeClasses,
    ThemeProvider,
    useTheme,
} from '../styles/theme';

// ============================================
// QUICK START EXAMPLE
// ============================================
/*
import {
  ProgressiveDashboard,
  SmartScanner,
  useCelebrations,
  CelebrationRenderer,
  theme,
} from './features';

function App() {
  const celebrations = useCelebrations();
  const [showScanner, setShowScanner] = useState(false);

  return (
    <div>
      <ProgressiveDashboard 
        records={records}
        onScanReceipt={() => setShowScanner(true)}
      />
      
      {showScanner && (
        <SmartScanner 
          onClose={() => setShowScanner(false)}
          onProcessComplete={(data) => {
            // Add record
            celebrations.checkMilestone(prevCount, newCount);
          }}
        />
      )}
      
      <CelebrationRenderer 
        celebration={celebrations.celebration}
        toast={celebrations.toast}
        onCloseCelebration={celebrations.closeCelebration}
        onCloseToast={celebrations.closeToast}
      />
    </div>
  );
}
*/
