// src/features/tech-mobile/TechMobileApp.jsx
// ============================================
// TECH MOBILE PWA - MAIN APP SHELL
// ============================================
// Mobile-optimized app for field technicians
// Provides navigation, authentication, and page routing

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// Components
import { TechHeader } from './components/TechHeader';
import { TechNavigation } from './components/TechNavigation';

// Pages
import { TechDashboard } from './pages/TechDashboard';
import { TechJobView } from './pages/TechJobView';
import { TechSchedule } from './pages/TechSchedule';

// Hooks
import { useTechSession } from './hooks/useTechSession';

// Auth Screen (from contractor-pro)
import { TechAuthScreen } from '../contractor-pro/components/TechAuthScreen';

// ============================================
// MAIN APP COMPONENT
// ============================================
export const TechMobileApp = () => {
    const {
        session,
        isLoading,
        isAuthenticated,
        sessionError,
        techProfile,
        contractor,
        techName,
        techColor,
        techInitials,
        logout,
        refreshSession
    } = useTechSession();

    // Navigation state
    const [activeTab, setActiveTab] = useState('home');
    const [selectedJob, setSelectedJob] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Listen for online/offline status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Handle navigation
    const handleNavigate = (tabId, path) => {
        setActiveTab(tabId);
        setSelectedJob(null);
    };

    // Handle job selection
    const handleSelectJob = (job) => {
        setSelectedJob(job);
    };

    // Handle back from job view
    const handleBackFromJob = () => {
        setSelectedJob(null);
    };

    // Handle job completion
    const handleJobComplete = () => {
        setSelectedJob(null);
        setActiveTab('home');
    };

    // Handle refresh
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshSession();
        setIsRefreshing(false);
    };

    // Handle profile click
    const handleProfileClick = () => {
        setActiveTab('profile');
    };

    // ============================================
    // LOADING STATE
    // ============================================
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center">
                <div className="text-center text-white">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                    <p className="text-lg font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    // ============================================
    // AUTH SCREEN
    // ============================================
    if (!isAuthenticated) {
        return (
            <TechAuthScreen
                onAuthSuccess={() => {
                    // Session will be detected by useTechSession
                    window.location.reload();
                }}
                error={sessionError}
            />
        );
    }

    // ============================================
    // JOB DETAIL VIEW
    // ============================================
    if (selectedJob) {
        return (
            <TechJobView
                job={selectedJob}
                onBack={handleBackFromJob}
                onComplete={handleJobComplete}
            />
        );
    }

    // ============================================
    // MAIN APP
    // ============================================
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <TechHeader
                techName={techName}
                techColor={techColor}
                techInitials={techInitials}
                contractorName={contractor?.businessName}
                contractorLogo={contractor?.logoUrl}
                isOnline={isOnline}
                onProfileClick={handleProfileClick}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
            />

            {/* Page Content */}
            <main className="flex-1 flex flex-col">
                {activeTab === 'home' && (
                    <TechDashboard onSelectJob={handleSelectJob} />
                )}

                {activeTab === 'schedule' && (
                    <TechSchedule onSelectJob={handleSelectJob} />
                )}

                {activeTab === 'timesheet' && (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center">
                            <p className="text-gray-500">Timesheet feature coming soon</p>
                        </div>
                    </div>
                )}

                {activeTab === 'profile' && (
                    <div className="flex-1 p-4 pb-24">
                        <div className="bg-white rounded-2xl p-6 border border-gray-200">
                            <div className="flex items-center gap-4 mb-6">
                                <div
                                    className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                                    style={{ backgroundColor: techColor }}
                                >
                                    {techInitials}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{techName}</h2>
                                    <p className="text-gray-500">{techProfile?.role || 'Technician'}</p>
                                </div>
                            </div>

                            {/* Profile Details */}
                            <div className="space-y-3">
                                {techProfile?.phone && (
                                    <div className="flex justify-between py-2 border-b border-gray-100">
                                        <span className="text-gray-500">Phone</span>
                                        <span className="text-gray-900">{techProfile.phone}</span>
                                    </div>
                                )}
                                {techProfile?.email && (
                                    <div className="flex justify-between py-2 border-b border-gray-100">
                                        <span className="text-gray-500">Email</span>
                                        <span className="text-gray-900">{techProfile.email}</span>
                                    </div>
                                )}
                                {contractor?.businessName && (
                                    <div className="flex justify-between py-2 border-b border-gray-100">
                                        <span className="text-gray-500">Company</span>
                                        <span className="text-gray-900">{contractor.businessName}</span>
                                    </div>
                                )}
                            </div>

                            {/* Skills */}
                            {techProfile?.skills?.length > 0 && (
                                <div className="mt-6">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Skills</p>
                                    <div className="flex flex-wrap gap-2">
                                        {techProfile.skills.map((skill, idx) => (
                                            <span
                                                key={idx}
                                                className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Logout */}
                            <button
                                onClick={logout}
                                className="w-full mt-8 py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Navigation */}
            <TechNavigation
                activeTab={activeTab}
                onNavigate={handleNavigate}
            />
        </div>
    );
};

// ============================================
// ROUTER WRAPPER (for standalone use)
// ============================================
export const TechMobileRouter = () => {
    // Add PWA meta tags and styles
    useEffect(() => {
        // Set viewport for mobile
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
        }

        // Add mobile-specific styles
        document.body.classList.add('tech-mobile-app');

        // Prevent pull-to-refresh on mobile
        document.body.style.overscrollBehavior = 'none';

        return () => {
            document.body.classList.remove('tech-mobile-app');
            document.body.style.overscrollBehavior = '';
        };
    }, []);

    return <TechMobileApp />;
};

export default TechMobileApp;
