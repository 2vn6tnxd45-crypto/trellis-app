// src/components/routing/AuthGuard.jsx
// ============================================
// AUTH GUARD
// ============================================
// Wraps routes that require authentication.
// Shows loading spinner while auth is initializing.
// Redirects to /login if not authenticated.

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppShellSkeleton } from '../common/Skeletons';

export const AuthGuard = ({ user, loading, children }) => {
  const location = useLocation();

  if (loading) {
    return <AppShellSkeleton />;
  }

  if (!user) {
    // Save the attempted URL so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
