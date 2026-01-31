// src/components/routing/LegacyRedirects.jsx
// ============================================
// LEGACY URL REDIRECTS
// ============================================
// Catches old ?param=value URLs and redirects to new path-based routes.
// This ensures backwards compatibility with:
//   - Stripe payment callback URLs
//   - Email/SMS share links
//   - PWA notification deep links
//   - Bookmarked URLs

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const LegacyRedirects = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    // Only process if we're at root, /app, or /home with query params
    const rootPaths = ['/', '/app', '/app/', '/home', '/home/'];
    if (!rootPaths.includes(location.pathname)) {
      return; // Already on a new-style route, do nothing
    }

    // No query params? Nothing to redirect
    if (!location.search) return;

    // ---- PAYMENT CALLBACKS (highest priority) ----
    if (params.get('payment') === 'success') {
      const type = params.get('type') || '';
      const job = params.get('job') || '';
      const quote = params.get('quote') || '';
      const from = params.get('from') || '';
      navigate(`/payment/success?type=${type}&job=${job}&quote=${quote}&from=${from}`, { replace: true });
      return;
    }
    if (params.get('payment') === 'cancelled') {
      const type = params.get('type') || '';
      const job = params.get('job') || '';
      const quote = params.get('quote') || '';
      navigate(`/payment/cancelled?type=${type}&job=${job}&quote=${quote}`, { replace: true });
      return;
    }

    // ---- PUBLIC SHARE LINKS ----
    const quoteToken = params.get('quote');
    if (quoteToken) {
      navigate(`/quote/${encodeURIComponent(quoteToken)}`, { replace: true });
      return;
    }

    const evaluateId = params.get('evaluate');
    if (evaluateId) {
      navigate(`/evaluate/${encodeURIComponent(evaluateId)}`, { replace: true });
      return;
    }

    const inviteToken = params.get('invite');
    if (inviteToken) {
      navigate(`/invite/${encodeURIComponent(inviteToken)}`, { replace: true });
      return;
    }

    const requestId = params.get('requestId');
    if (requestId) {
      navigate(`/submit/${encodeURIComponent(requestId)}`, { replace: true });
      return;
    }

    // ---- CONTRACTOR ROUTES ----
    const proParam = params.get('pro');
    if (proParam !== null) {
      if (proParam === 'dashboard') {
        navigate('/pro/app', { replace: true });
        return;
      }
      if (proParam === 'compare') {
        navigate('/pro/compare', { replace: true });
        return;
      }
      if (proParam === 'invite') {
        navigate('/pro/invite', { replace: true });
        return;
      }
      // ?pro or ?pro= (empty) -> landing
      navigate('/pro', { replace: true });
      return;
    }

    // ---- PWA NOTIFICATION DEEP LINKS ----
    const view = params.get('view');
    if (view === 'maintenance') {
      navigate('/maintenance', { replace: true });
      return;
    }
    if (view) {
      // Generic view param -> try to map to a route
      const viewMap = {
        'dashboard': '/dashboard',
        'items': '/inventory',
        'contractors': '/contractors',
        'reports': '/reports',
        'settings': '/settings',
      };
      if (viewMap[view]) {
        navigate(viewMap[view], { replace: true });
        return;
      }
    }

    const messagesChannel = params.get('messages');
    if (messagesChannel) {
      navigate(`/contractors?messages=${messagesChannel}`, { replace: true });
      return;
    }

    const taskId = params.get('task');
    if (taskId) {
      navigate(`/maintenance?task=${taskId}&action=${params.get('action') || ''}`, { replace: true });
      return;
    }

    const jobId = params.get('job') || params.get('jobId');
    if (jobId) {
      navigate(`/dashboard?job=${jobId}`, { replace: true });
      return;
    }

    // ---- FROM=QUOTE (after claiming a quote, redirect to dashboard) ----
    const from = params.get('from');
    if (from === 'quote') {
      navigate('/dashboard?from=quote', { replace: true });
      return;
    }

    // ---- No recognized params -> go to dashboard ----
    navigate('/dashboard', { replace: true });

  }, [location.search, location.pathname, navigate]);

  return null; // This component renders nothing - it just redirects
};
