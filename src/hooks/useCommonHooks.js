// src/hooks/useCommonHooks.js
// ============================================
// COMMON REUSABLE HOOKS
// ============================================
// Shared hooks for common UI patterns like modals,
// async operations, confirmations, and forms.

import { useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';

// ============================================
// HOOK 1: useModal
// ============================================
/**
 * Manage modal/dialog open state with common actions.
 *
 * @param {boolean} initialOpen - Initial open state (default: false)
 * @returns {Object} Modal state and controls
 * @returns {boolean} returns.isOpen - Whether modal is open
 * @returns {Function} returns.open - Open the modal
 * @returns {Function} returns.close - Close the modal and clear data
 * @returns {Function} returns.toggle - Toggle modal state
 * @returns {Function} returns.openWith - Open modal with associated data
 * @returns {*} returns.data - Data passed via openWith (null when closed)
 *
 * @example
 * const deleteModal = useModal();
 *
 * <button onClick={() => deleteModal.openWith(item)}>Delete</button>
 *
 * {deleteModal.isOpen && (
 *   <DeleteConfirm
 *     item={deleteModal.data}
 *     onClose={deleteModal.close}
 *   />
 * )}
 */
export function useModal(initialOpen = false) {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const [data, setData] = useState(null);

    const open = useCallback(() => {
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setData(null);
    }, []);

    const toggle = useCallback(() => {
        setIsOpen(prev => {
            if (prev) {
                // Closing - also clear data
                setData(null);
            }
            return !prev;
        });
    }, []);

    const openWith = useCallback((newData) => {
        setData(newData);
        setIsOpen(true);
    }, []);

    return {
        isOpen,
        data,
        open,
        close,
        toggle,
        openWith
    };
}

// ============================================
// HOOK 2: useAsyncAction
// ============================================
/**
 * Handle async operations with loading/error/success states.
 * Wraps an async function with automatic state management and optional toast notifications.
 *
 * @param {Function} asyncFunction - The async function to wrap
 * @param {Object} options - Configuration options
 * @param {Function} [options.onSuccess] - Callback on success, receives result
 * @param {Function} [options.onError] - Callback on error, receives error
 * @param {string} [options.successMessage] - Toast message on success
 * @param {string} [options.errorMessage] - Toast message on error (defaults to error.message)
 * @returns {Object} Async action state and controls
 * @returns {Function} returns.execute - Run the async operation with any arguments
 * @returns {boolean} returns.loading - Whether operation is in progress
 * @returns {Error|null} returns.error - Error if operation failed
 * @returns {Function} returns.reset - Clear error state
 *
 * @example
 * const saveItem = useAsyncAction(
 *   async (itemData) => {
 *     const result = await saveToFirebase(itemData);
 *     return result;
 *   },
 *   {
 *     successMessage: 'Item saved!',
 *     onSuccess: (result) => closeModal()
 *   }
 * );
 *
 * <button onClick={() => saveItem.execute(formData)} disabled={saveItem.loading}>
 *   {saveItem.loading ? 'Saving...' : 'Save'}
 * </button>
 */
export function useAsyncAction(asyncFunction, options = {}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const {
        onSuccess,
        onError,
        successMessage,
        errorMessage
    } = options;

    const execute = useCallback(async (...args) => {
        setLoading(true);
        setError(null);

        try {
            const result = await asyncFunction(...args);

            // Show success toast if message provided
            if (successMessage) {
                toast.success(successMessage);
            }

            // Call success callback if provided
            if (onSuccess) {
                onSuccess(result);
            }

            return result;
        } catch (err) {
            setError(err);

            // Show error toast
            const message = errorMessage || err.message || 'An error occurred';
            toast.error(message);

            // Call error callback if provided
            if (onError) {
                onError(err);
            }

            throw err;
        } finally {
            setLoading(false);
        }
    }, [asyncFunction, onSuccess, onError, successMessage, errorMessage]);

    const reset = useCallback(() => {
        setError(null);
    }, []);

    return {
        execute,
        loading,
        error,
        reset
    };
}

// ============================================
// HOOK 3: useConfirmAction
// ============================================
/**
 * Wrap destructive actions with a confirmation step.
 * Manages state for a confirmation dialog without rendering it.
 *
 * @param {Function} action - Async function to run if confirmed
 * @param {Object} options - Configuration options
 * @param {string} [options.title='Are you sure?'] - Dialog title
 * @param {string} [options.message='This action cannot be undone.'] - Dialog message
 * @param {string} [options.confirmText='Confirm'] - Confirm button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @param {'danger'|'warning'|'info'} [options.variant='danger'] - Dialog variant
 * @param {Function} [options.onSuccess] - Callback on successful action
 * @param {Function} [options.onCancel] - Callback when cancelled
 * @returns {Object} Confirmation state and controls
 * @returns {Function} returns.trigger - Initiate confirmation (stores data)
 * @returns {Function} returns.confirm - Execute the action
 * @returns {Function} returns.cancel - Cancel and close
 * @returns {boolean} returns.isConfirming - Whether dialog should show
 * @returns {*} returns.pendingData - Data passed to trigger
 * @returns {boolean} returns.loading - Whether action is in progress
 * @returns {Object} returns.config - The title, message, confirmText, cancelText, variant
 *
 * @example
 * const deleteAction = useConfirmAction(
 *   async (item) => {
 *     await deleteFromFirebase(item.id);
 *   },
 *   {
 *     title: 'Delete Item?',
 *     message: 'This will permanently delete the item.',
 *     confirmText: 'Delete',
 *     variant: 'danger'
 *   }
 * );
 *
 * <button onClick={() => deleteAction.trigger(item)}>Delete</button>
 *
 * {deleteAction.isConfirming && (
 *   <ConfirmDialog
 *     title={deleteAction.config.title}
 *     message={deleteAction.config.message}
 *     onConfirm={deleteAction.confirm}
 *     onCancel={deleteAction.cancel}
 *     loading={deleteAction.loading}
 *     variant={deleteAction.config.variant}
 *   />
 * )}
 */
export function useConfirmAction(action, options = {}) {
    const [isConfirming, setIsConfirming] = useState(false);
    const [pendingData, setPendingData] = useState(null);
    const [loading, setLoading] = useState(false);

    const config = useMemo(() => ({
        title: options.title || 'Are you sure?',
        message: options.message || 'This action cannot be undone.',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'danger'
    }), [options.title, options.message, options.confirmText, options.cancelText, options.variant]);

    const trigger = useCallback((data = null) => {
        setPendingData(data);
        setIsConfirming(true);
    }, []);

    const cancel = useCallback(() => {
        setIsConfirming(false);
        setPendingData(null);
        if (options.onCancel) {
            options.onCancel();
        }
    }, [options.onCancel]);

    const confirm = useCallback(async () => {
        setLoading(true);

        try {
            await action(pendingData);

            if (options.onSuccess) {
                options.onSuccess(pendingData);
            }
        } catch (err) {
            console.error('Confirm action failed:', err);
            throw err;
        } finally {
            setLoading(false);
            setIsConfirming(false);
            setPendingData(null);
        }
    }, [action, pendingData, options.onSuccess]);

    return {
        trigger,
        confirm,
        cancel,
        isConfirming,
        pendingData,
        loading,
        config
    };
}

// ============================================
// HOOK 4: useFormState
// ============================================
/**
 * Simple form state management with validation.
 * Tracks values, errors, touched fields, and provides common form handlers.
 *
 * @param {Object} initialValues - Initial form values
 * @param {Function} [validate] - Validation function, receives values, returns errors object
 * @returns {Object} Form state and controls
 * @returns {Object} returns.values - Current form values
 * @returns {Object} returns.errors - Validation errors object
 * @returns {Object} returns.touched - Object tracking touched fields
 * @returns {Function} returns.setValue - Update a single field: setValue(field, value)
 * @returns {Function} returns.setValues - Update multiple fields: setValues({ field: value })
 * @returns {Function} returns.setError - Manually set an error: setError(field, message)
 * @returns {Function} returns.clearError - Clear a specific error: clearError(field)
 * @returns {Function} returns.handleChange - Standard onChange handler (reads e.target.name/value)
 * @returns {Function} returns.handleBlur - Marks field as touched, runs validation
 * @returns {Function} returns.reset - Reset to initial values, or reset(newValues)
 * @returns {Function} returns.validate - Manually run validation, returns boolean
 * @returns {boolean} returns.isValid - True if no errors
 * @returns {boolean} returns.isDirty - True if values differ from initial
 *
 * @example
 * const form = useFormState(
 *   { name: '', email: '' },
 *   (values) => {
 *     const errors = {};
 *     if (!values.name) errors.name = 'Name is required';
 *     if (!values.email) errors.email = 'Email is required';
 *     return errors;
 *   }
 * );
 *
 * <input
 *   name="name"
 *   value={form.values.name}
 *   onChange={form.handleChange}
 *   onBlur={form.handleBlur}
 * />
 * {form.touched.name && form.errors.name && (
 *   <span className="error">{form.errors.name}</span>
 * )}
 */
export function useFormState(initialValues = {}, validate = null) {
    const [values, setValuesState] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [initialState] = useState(initialValues);

    // Run validation and return errors object
    const runValidation = useCallback((valuesToValidate) => {
        if (!validate) return {};
        const validationErrors = validate(valuesToValidate);
        return validationErrors || {};
    }, [validate]);

    // Set a single field value
    const setValue = useCallback((field, value) => {
        setValuesState(prev => ({ ...prev, [field]: value }));
    }, []);

    // Set multiple field values
    const setValues = useCallback((newValues) => {
        setValuesState(prev => ({ ...prev, ...newValues }));
    }, []);

    // Manually set an error
    const setError = useCallback((field, message) => {
        setErrors(prev => ({ ...prev, [field]: message }));
    }, []);

    // Clear a specific error
    const clearError = useCallback((field) => {
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
        });
    }, []);

    // Standard onChange handler
    const handleChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        const fieldValue = type === 'checkbox' ? checked : value;
        setValuesState(prev => ({ ...prev, [name]: fieldValue }));
    }, []);

    // Handle blur - mark as touched and validate
    const handleBlur = useCallback((e) => {
        const { name } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));

        // Run validation on blur
        const validationErrors = runValidation(values);
        setErrors(validationErrors);
    }, [values, runValidation]);

    // Reset form to initial values or new values
    const reset = useCallback((newInitialValues = null) => {
        const resetValues = newInitialValues || initialState;
        setValuesState(resetValues);
        setErrors({});
        setTouched({});
    }, [initialState]);

    // Manually trigger validation
    const validateForm = useCallback(() => {
        const validationErrors = runValidation(values);
        setErrors(validationErrors);
        // Mark all fields as touched
        const allTouched = Object.keys(values).reduce((acc, key) => {
            acc[key] = true;
            return acc;
        }, {});
        setTouched(allTouched);
        return Object.keys(validationErrors).length === 0;
    }, [values, runValidation]);

    // Computed: isValid
    const isValid = useMemo(() => {
        return Object.keys(errors).length === 0;
    }, [errors]);

    // Computed: isDirty
    const isDirty = useMemo(() => {
        return JSON.stringify(values) !== JSON.stringify(initialState);
    }, [values, initialState]);

    return {
        values,
        errors,
        touched,
        setValue,
        setValues,
        setError,
        clearError,
        handleChange,
        handleBlur,
        reset,
        validate: validateForm,
        isValid,
        isDirty
    };
}
