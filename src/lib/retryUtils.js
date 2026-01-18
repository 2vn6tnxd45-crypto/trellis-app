// src/lib/retryUtils.js
// ============================================
// RETRY UTILITIES
// ============================================
// Exponential backoff and retry logic for network operations

/**
 * Executes a function with exponential backoff retry
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 3)
 * @param {number} options.initialDelayMs - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelayMs - Maximum delay in ms (default: 10000)
 * @param {number} options.backoffMultiplier - Multiplier for each retry (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if error is retryable
 * @param {Function} options.onRetry - Callback called before each retry
 * @returns {Promise<any>} - Result of the function
 */
export const withRetry = async (fn, options = {}) => {
    const {
        maxAttempts = 3,
        initialDelayMs = 1000,
        maxDelayMs = 10000,
        backoffMultiplier = 2,
        shouldRetry = isRetryableError,
        onRetry = null
    } = options;

    let lastError;
    let delay = initialDelayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if we should retry
            if (attempt === maxAttempts || !shouldRetry(error)) {
                throw error;
            }

            // Call onRetry callback if provided
            if (onRetry) {
                onRetry({ attempt, maxAttempts, error, nextDelayMs: delay });
            }

            // Wait before retrying
            await sleep(delay);

            // Increase delay for next attempt (with cap)
            delay = Math.min(delay * backoffMultiplier, maxDelayMs);
        }
    }

    throw lastError;
};

/**
 * Determines if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} - True if the error is retryable
 */
export const isRetryableError = (error) => {
    // Network errors are retryable
    if (error.name === 'NetworkError' || error.message?.includes('network')) {
        return true;
    }

    // Timeout errors are retryable
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
        return true;
    }

    // Firebase errors that are retryable
    const retryableCodes = [
        'unavailable',
        'resource-exhausted',
        'deadline-exceeded',
        'aborted',
        'internal'
    ];
    if (error.code && retryableCodes.includes(error.code)) {
        return true;
    }

    // HTTP status codes that are retryable
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    if (error.status && retryableStatuses.includes(error.status)) {
        return true;
    }

    // Storage errors that are retryable
    if (error.code === 'storage/retry-limit-exceeded' ||
        error.code === 'storage/server-file-wrong-size') {
        return true;
    }

    return false;
};

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wraps an async function with timeout
 * @param {Function} fn - Async function to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMessage - Error message on timeout
 * @returns {Promise<any>}
 */
export const withTimeout = (fn, timeoutMs, errorMessage = 'Operation timed out') => {
    return Promise.race([
        fn(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
};

/**
 * Combined retry with timeout
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Options
 * @param {number} options.timeoutMs - Timeout per attempt in ms
 * @param {number} options.maxAttempts - Max retry attempts
 * @returns {Promise<any>}
 */
export const withRetryAndTimeout = async (fn, options = {}) => {
    const { timeoutMs = 30000, ...retryOptions } = options;

    return withRetry(
        () => withTimeout(fn, timeoutMs, 'Request timed out'),
        retryOptions
    );
};
