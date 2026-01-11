// src/lib/authHelpers.js
// Utility functions for handling Firebase Auth state

import { auth } from '../config/firebase';
import { 
    AUTH_READY_TIMEOUT_MS, 
    AUTH_STATE_DELAY_MS,
    RETRY_INITIAL_DELAY_MS,
    RETRY_MAX_DELAY_MS,
    MAX_RETRY_ATTEMPTS
} from '../config/constants';
import { debug } from './debug';
/**
 * Waits for Firebase Auth to be fully ready after login/signup
 * This ensures the auth token is propagated to Firestore
 * 
 * The problem: When a new user signs up, Firebase Auth issues a token,
 * but Firestore may not immediately recognize it. This causes
 * "Missing or insufficient permissions" errors.
 * 
 * The solution: Force a token refresh and wait for auth state to settle.
 * 
 * @param {number} timeoutMs - Maximum time to wait (default 5000ms)
 * @returns {Promise<User>} - The authenticated user
 */
export const waitForAuthReady = (timeoutMs = AUTH_READY_TIMEOUT_MS) => {
    return new Promise((resolve, reject) => {
        // If already authenticated, force token refresh and resolve
        if (auth.currentUser) {
            debug.log('[authHelpers] User already authenticated, refreshing token...');
            auth.currentUser.getIdToken(true)
                .then(() => {
                    debug.log('[authHelpers] Token refreshed successfully');
                    resolve(auth.currentUser);
                })
                .catch((err) => {
                    console.error('[authHelpers] Token refresh failed:', err);
                    reject(err);
                });
            return;
        }
        
        debug.log('[authHelpers] Waiting for auth state...');
        
        const timeout = setTimeout(() => {
            debug.warn('[authHelpers] Auth timeout reached');
            unsubscribe();
            reject(new Error('Authentication timeout - please try again'));
        }, timeoutMs);
        
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                clearTimeout(timeout);
                unsubscribe();
                
                debug.log('[authHelpers] Auth state changed, user:', user.uid);
                
                // Force token refresh to ensure Firestore has latest auth context
                try {
                    await user.getIdToken(true);
                    debug.log('[authHelpers] Token refreshed after auth state change');
                    
                    // Small additional delay to ensure propagation
                    // Small additional delay to ensure propagation
await new Promise(r => setTimeout(r, AUTH_STATE_DELAY_MS));
                    
                    resolve(user);
                } catch (err) {
                    console.error('[authHelpers] Token refresh failed after auth:', err);
                    reject(err);
                }
            }
        });
    });
};

/**
 * Retry a Firestore operation with exponential backoff
 * Useful for handling temporary permission errors during auth propagation
 * 
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Configuration options
 * @returns {Promise} - Result of the operation
 */
export const retryWithBackoff = async (operation, options = {}) => {
    const {
    maxRetries = MAX_RETRY_ATTEMPTS,
    initialDelayMs = RETRY_INITIAL_DELAY_MS,
    maxDelayMs = RETRY_MAX_DELAY_MS,
        onRetry = null,
        shouldRetry = (err) => err.code === 'permission-denied' || err.message?.includes('permission')
    } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (err) {
            lastError = err;
            console.error(`[retryWithBackoff] Attempt ${attempt}/${maxRetries} failed:`, err.message);
            
            // Check if we should retry this error
            if (!shouldRetry(err)) {
                debug.log('[retryWithBackoff] Error not retryable, throwing');
                throw err;
            }
            
            if (attempt < maxRetries) {
                // Calculate delay with exponential backoff
                const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
                debug.log(`[retryWithBackoff] Waiting ${delay}ms before retry...`);
                
                // Call onRetry callback if provided
                if (onRetry) {
                    onRetry(attempt, delay);
                }
                
                await new Promise(r => setTimeout(r, delay));
                
                // Try to refresh the auth token before retry
                if (auth.currentUser) {
                    try {
                        await auth.currentUser.getIdToken(true);
                        debug.log('[retryWithBackoff] Token refreshed before retry');
                    } catch (tokenErr) {
                        debug.warn('[retryWithBackoff] Token refresh failed:', tokenErr.message);
                    }
                }
            }
        }
    }
    
    console.error('[retryWithBackoff] All retries exhausted');
    throw lastError;
};

/**
 * Check if the current user's auth state is fully ready for Firestore operations
 * @returns {boolean}
 */
export const isAuthReady = () => {
    return auth.currentUser !== null && auth.currentUser.uid !== undefined;
};
