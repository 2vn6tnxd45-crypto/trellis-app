// src/components/common/index.js
// ============================================
// COMMON COMPONENTS BARREL EXPORT
// ============================================
// Central export point for all shared/common components

// Loading States
export {
    FullPageLoader,
    SectionLoader,
    ButtonLoader,
    SkeletonCard,
    SkeletonText,
    SkeletonList,
    InlineLoader
} from './LoadingStates';

// Skeletons (legacy - consider migrating to LoadingStates)
export {
    Shimmer,
    RecordCardSkeleton,
    DashboardSkeleton,
    AppShellSkeleton,
    QuoteCardSkeleton,
    ListItemSkeleton,
    FormSkeleton,
    TableSkeleton
} from './Skeletons';

// Loading Overlay
export { LoadingOverlay } from './LoadingOverlay';

// Modals
export { ConfirmationModal } from './ConfirmationModal';
export { DeleteConfirmModal } from './DeleteConfirmModal';
export { TaskCompletionModal } from './TaskCompletionModal';

// Error Boundaries
export { FeatureErrorBoundary } from './FeatureErrorBoundary';
export { GlobalErrorBoundary } from './GlobalErrorBoundary';

// UI Components
export { EmptyState } from './EmptyState';
export { CalendarPicker } from './CalendarPicker';
export { CountdownTimer } from './CountdownTimer';
export { CookieConsent } from './CookieConsent';
export { DashboardSection } from './DashboardSection';
export { NotificationPermissionPrompt } from './NotificationPermissionPrompt';
export { RebookProButton } from './RebookProButton';
export { RoomSelector } from './RoomSelector';

// Branding
export { Logo } from './Logo';
export { LogoLockup } from './LogoLockup';
export { Wordmark } from './Wordmark';
