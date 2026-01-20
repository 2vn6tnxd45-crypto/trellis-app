// src/contexts/ModalContext.jsx
// ============================================
// CENTRALIZED MODAL STATE MANAGEMENT
// ============================================
// Manages modal visibility across the app to prevent multiple modals
// opening at once and provide consistent modal handling.

import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Modal Types - Define all modal types in the app
 * Using constants prevents typos and enables autocomplete
 */
export const MODAL_TYPES = {
    // Record management
    ADD_RECORD: 'ADD_RECORD',
    EDIT_RECORD: 'EDIT_RECORD',
    DELETE_CONFIRM: 'DELETE_CONFIRM',

    // Scanning
    SMART_SCANNER: 'SMART_SCANNER',

    // Job/Quote modals
    JOB_DETAIL: 'JOB_DETAIL',
    JOB_COMPLETION: 'JOB_COMPLETION',
    CANCEL_JOB: 'CANCEL_JOB',
    REQUEST_TIMES: 'REQUEST_TIMES',

    // Property management
    PROPERTY_SWITCHER: 'PROPERTY_SWITCHER',
    ADD_PROPERTY: 'ADD_PROPERTY',

    // Contractor/Pro modals
    INVITE_CREATOR: 'INVITE_CREATOR',
    CONTRACTOR_DETAIL: 'CONTRACTOR_DETAIL',

    // Settings/User
    SETTINGS: 'SETTINGS',
    USER_MENU: 'USER_MENU',
    NOTIFICATIONS: 'NOTIFICATIONS',

    // Utility
    CONFIRMATION: 'CONFIRMATION',
    ALERT: 'ALERT',
};

/**
 * Modal Context
 * Provides modal state and actions throughout the app
 */
const ModalContext = createContext(null);

/**
 * ModalProvider Component
 * Wrap your app with this to enable modal management
 */
export function ModalProvider({ children }) {
    // Current active modal (only one can be open at a time)
    const [activeModal, setActiveModal] = useState(null);

    // Props to pass to the active modal
    const [modalProps, setModalProps] = useState({});

    // Modal stack for nested modals (confirmation over detail, etc.)
    const [modalStack, setModalStack] = useState([]);

    /**
     * Open a modal
     * @param {string} modalType - One of MODAL_TYPES
     * @param {object} props - Props to pass to the modal
     */
    const openModal = useCallback((modalType, props = {}) => {
        if (!modalType) {
            console.warn('[ModalContext] openModal called without modalType');
            return;
        }

        // If there's already a modal open, push it to the stack
        if (activeModal) {
            setModalStack(prev => [...prev, { type: activeModal, props: modalProps }]);
        }

        setActiveModal(modalType);
        setModalProps(props);
    }, [activeModal, modalProps]);

    /**
     * Close the current modal
     * If there are stacked modals, pop the previous one
     */
    const closeModal = useCallback(() => {
        if (modalStack.length > 0) {
            // Pop the previous modal from the stack
            const prevModal = modalStack[modalStack.length - 1];
            setModalStack(prev => prev.slice(0, -1));
            setActiveModal(prevModal.type);
            setModalProps(prevModal.props);
        } else {
            setActiveModal(null);
            setModalProps({});
        }
    }, [modalStack]);

    /**
     * Close all modals including stacked ones
     */
    const closeAllModals = useCallback(() => {
        setActiveModal(null);
        setModalProps({});
        setModalStack([]);
    }, []);

    /**
     * Check if a specific modal is open
     * @param {string} modalType - One of MODAL_TYPES
     * @returns {boolean}
     */
    const isModalOpen = useCallback((modalType) => {
        return activeModal === modalType;
    }, [activeModal]);

    /**
     * Update props for the current modal
     * Useful for updating data without closing/reopening
     * @param {object} newProps - Props to merge with existing
     */
    const updateModalProps = useCallback((newProps) => {
        setModalProps(prev => ({ ...prev, ...newProps }));
    }, []);

    // Context value
    const value = {
        // State
        activeModal,
        modalProps,
        hasStackedModals: modalStack.length > 0,

        // Actions
        openModal,
        closeModal,
        closeAllModals,
        isModalOpen,
        updateModalProps,

        // Constants (for convenience)
        MODAL_TYPES,
    };

    return (
        <ModalContext.Provider value={value}>
            {children}
        </ModalContext.Provider>
    );
}

/**
 * Hook to use modal context
 * @returns {object} Modal context value
 * @throws {Error} If used outside ModalProvider
 */
export function useModal() {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
}

/**
 * Hook to check if a specific modal is open
 * More performant than useModal for components that only need to check visibility
 * @param {string} modalType - One of MODAL_TYPES
 * @returns {boolean}
 */
export function useIsModalOpen(modalType) {
    const { activeModal } = useContext(ModalContext) || {};
    return activeModal === modalType;
}

export default ModalContext;
