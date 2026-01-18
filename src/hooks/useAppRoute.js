/**
 * useAppRoute Hook
 *
 * Centralizes all URL parameter parsing and route determination for the app.
 * This hook extracts routing logic from App.jsx to provide a clean, reusable
 * way to determine which "mode" the app should be in based on URL parameters.
 *
 * @example
 * const { routeType, params, payment, cleanupUrl } = useAppRoute();
 *
 * // Route to different components based on routeType
 * if (routeType === 'public-quote') {
 *   return <PublicQuoteView shareToken={params.quoteToken} />;
 * }
 *
 * // Handle payment success
 * useEffect(() => {
 *   if (payment.success) {
 *     toast.success('Payment successful!');
 *     cleanupUrl();
 *   }
 * }, [payment.success]);
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * Route type constants for type safety and autocomplete
 */
export const ROUTE_TYPES = {
  CONTRACTOR_SUBMISSION: 'contractor-submission',
  INVITATION_CLAIM: 'invitation-claim',
  CONTRACTOR_INVITE_CREATOR: 'contractor-invite-creator',
  CONTRACTOR_DASHBOARD: 'contractor-dashboard',
  CONTRACTOR_COMPARE: 'contractor-compare',
  CONTRACTOR_LANDING: 'contractor-landing',
  PUBLIC_QUOTE: 'public-quote',
  EVALUATION: 'evaluation',
  HOMEOWNER_APP: 'homeowner-app',
};

/**
 * Parses URL search parameters from the current window location
 * @returns {URLSearchParams} Parsed URL parameters
 */
const getUrlParams = () => new URLSearchParams(window.location.search);

/**
 * Determines the route type based on URL parameters
 *
 * Priority order (matches App.jsx early return order):
 * 1. public-quote (quote token present AND NOT payment success)
 * 2. contractor-dashboard (pro=dashboard)
 * 3. contractor-compare (pro=compare)
 * 4. contractor-landing (pro present, not 'invite')
 * 5. contractor-invite-creator (pro=invite)
 * 6. evaluation (evaluate param present)
 * 7. invitation-claim (invite token present)
 * 8. contractor-submission (requestId present)
 * 9. homeowner-app (default)
 *
 * @param {URLSearchParams} urlParams - The URL parameters
 * @param {boolean} paymentSuccess - Whether payment was successful (affects quote route)
 * @returns {string} The determined route type
 */
const determineRouteType = (urlParams, paymentSuccess) => {
  const requestId = urlParams.get('requestId');
  const inviteToken = urlParams.get('invite');
  const proParam = urlParams.get('pro');
  const quoteToken = urlParams.get('quote');
  const evaluateParam = urlParams.get('evaluate');

  // 1. Public quote view (but skip if payment just completed - quote is now a job)
  if (quoteToken && !paymentSuccess) {
    return ROUTE_TYPES.PUBLIC_QUOTE;
  }

  // 2-4. Contractor Pro routes (check pro param variations)
  if (proParam !== null && proParam !== 'invite') {
    if (proParam === 'dashboard') {
      return ROUTE_TYPES.CONTRACTOR_DASHBOARD;
    }
    if (proParam === 'compare') {
      return ROUTE_TYPES.CONTRACTOR_COMPARE;
    }
    // Any other value (including empty string from ?pro) shows landing
    return ROUTE_TYPES.CONTRACTOR_LANDING;
  }

  // 5. Contractor invite creator
  if (proParam === 'invite') {
    return ROUTE_TYPES.CONTRACTOR_INVITE_CREATOR;
  }

  // 6. Evaluation page (public homeowner access)
  if (evaluateParam) {
    return ROUTE_TYPES.EVALUATION;
  }

  // 7. Invitation claim flow
  if (inviteToken) {
    return ROUTE_TYPES.INVITATION_CLAIM;
  }

  // 8. Contractor submission flow
  if (requestId) {
    return ROUTE_TYPES.CONTRACTOR_SUBMISSION;
  }

  // 9. Default: main homeowner app
  return ROUTE_TYPES.HOMEOWNER_APP;
};

/**
 * useAppRoute Hook
 *
 * Centralizes URL parameter parsing and route determination.
 * Extracts routing logic from App.jsx for better separation of concerns.
 *
 * @returns {Object} Route information and utilities
 * @returns {string} return.routeType - The determined route type (one of ROUTE_TYPES)
 * @returns {Object} return.params - URL parameters for passing to components
 * @returns {Object} return.payment - Payment flow state
 * @returns {Function} return.cleanupUrl - Function to remove cosmetic URL params
 */
export function useAppRoute() {
  // Initialize state from URL parameters (persists even after URL cleanup)
  // Using lazy initialization to only read URL once on mount
  const [paymentState] = useState(() => {
    const params = getUrlParams();
    return {
      success: params.get('payment') === 'success',
      type: params.get('type') || null,
      comingFromQuote: params.get('from') === 'quote',
    };
  });

  // Parse current URL parameters (these are read fresh each render for route determination)
  const urlParams = useMemo(() => getUrlParams(), []);

  // Determine route type based on URL params and payment state
  const routeType = useMemo(
    () => determineRouteType(urlParams, paymentState.success),
    [urlParams, paymentState.success]
  );

  // Extract URL parameters for component props
  const params = useMemo(() => ({
    requestId: urlParams.get('requestId'),
    inviteToken: urlParams.get('invite'),
    quoteToken: urlParams.get('quote'),
    evaluateId: urlParams.get('evaluate'),
    contractorId: urlParams.get('contractor'),
    jobId: urlParams.get('job'),
  }), [urlParams]);

  /**
   * Cleans up cosmetic URL parameters after they've been processed.
   * Removes: from, payment, type, job, quote (after payment)
   *
   * Call this after handling payment success or other one-time URL states.
   * Uses replaceState to update URL without triggering navigation.
   */
  const cleanupUrl = useCallback(() => {
    const newUrl = new URL(window.location.href);
    let needsUpdate = false;

    // Remove 'from' param (e.g., from=quote)
    if (newUrl.searchParams.has('from')) {
      newUrl.searchParams.delete('from');
      needsUpdate = true;
    }

    // Remove payment-related params after payment success
    if (paymentState.success) {
      newUrl.searchParams.delete('payment');
      newUrl.searchParams.delete('type');
      newUrl.searchParams.delete('job');
      newUrl.searchParams.delete('quote');
      needsUpdate = true;
    }

    // Only update if we actually removed something
    if (needsUpdate) {
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [paymentState.success]);

  /**
   * Removes the invite token from URL (call after claim flow completes/cancels)
   */
  const clearInviteToken = useCallback(() => {
    const newUrl = new URL(window.location.href);
    if (newUrl.searchParams.has('invite')) {
      newUrl.searchParams.delete('invite');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  /**
   * Navigates to a specific route by updating URL parameters
   * @param {string} route - The route type to navigate to
   * @param {Object} routeParams - Additional URL parameters
   */
  const navigateTo = useCallback((route, routeParams = {}) => {
    const newUrl = new URL(window.location.href);

    // Clear existing route params
    newUrl.searchParams.delete('pro');
    newUrl.searchParams.delete('quote');
    newUrl.searchParams.delete('evaluate');
    newUrl.searchParams.delete('invite');
    newUrl.searchParams.delete('requestId');

    // Set new route params based on route type
    switch (route) {
      case ROUTE_TYPES.CONTRACTOR_DASHBOARD:
        newUrl.searchParams.set('pro', 'dashboard');
        break;
      case ROUTE_TYPES.CONTRACTOR_COMPARE:
        newUrl.searchParams.set('pro', 'compare');
        break;
      case ROUTE_TYPES.CONTRACTOR_LANDING:
        newUrl.searchParams.set('pro', '');
        break;
      case ROUTE_TYPES.CONTRACTOR_INVITE_CREATOR:
        newUrl.searchParams.set('pro', 'invite');
        break;
      case ROUTE_TYPES.PUBLIC_QUOTE:
        if (routeParams.quoteToken) {
          newUrl.searchParams.set('quote', routeParams.quoteToken);
        }
        break;
      case ROUTE_TYPES.EVALUATION:
        if (routeParams.evaluateId) {
          newUrl.searchParams.set('evaluate', routeParams.evaluateId);
        }
        break;
      case ROUTE_TYPES.INVITATION_CLAIM:
        if (routeParams.inviteToken) {
          newUrl.searchParams.set('invite', routeParams.inviteToken);
        }
        break;
      case ROUTE_TYPES.CONTRACTOR_SUBMISSION:
        if (routeParams.requestId) {
          newUrl.searchParams.set('requestId', routeParams.requestId);
        }
        break;
      case ROUTE_TYPES.HOMEOWNER_APP:
      default:
        // No special params needed for homeowner app
        break;
    }

    // Add any additional params
    Object.entries(routeParams).forEach(([key, value]) => {
      if (value && !['quoteToken', 'evaluateId', 'inviteToken', 'requestId'].includes(key)) {
        newUrl.searchParams.set(key, value);
      }
    });

    window.history.pushState({}, '', newUrl.toString());
    // Force a re-render by reloading (since we're not using React Router)
    window.location.reload();
  }, []);

  return {
    // Route determination
    routeType,

    // URL parameters (for passing to components)
    params,

    // Payment flow state (persisted from initial URL)
    payment: {
      success: paymentState.success,
      type: paymentState.type,
      comingFromQuote: paymentState.comingFromQuote,
    },

    // Utility functions
    cleanupUrl,
    clearInviteToken,
    navigateTo,

    // Convenience boolean checks for common routes
    isPublicRoute: [
      ROUTE_TYPES.PUBLIC_QUOTE,
      ROUTE_TYPES.EVALUATION,
      ROUTE_TYPES.CONTRACTOR_LANDING,
      ROUTE_TYPES.CONTRACTOR_COMPARE,
      ROUTE_TYPES.CONTRACTOR_DASHBOARD,
      ROUTE_TYPES.CONTRACTOR_INVITE_CREATOR,
      ROUTE_TYPES.CONTRACTOR_SUBMISSION,
      ROUTE_TYPES.INVITATION_CLAIM,
    ].includes(routeType),

    isContractorRoute: [
      ROUTE_TYPES.CONTRACTOR_DASHBOARD,
      ROUTE_TYPES.CONTRACTOR_COMPARE,
      ROUTE_TYPES.CONTRACTOR_LANDING,
      ROUTE_TYPES.CONTRACTOR_INVITE_CREATOR,
      ROUTE_TYPES.CONTRACTOR_SUBMISSION,
    ].includes(routeType),
  };
}

export default useAppRoute;
