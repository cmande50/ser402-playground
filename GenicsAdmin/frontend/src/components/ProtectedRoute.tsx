import React from 'react';
import { useAuth } from 'react-oidc-context';
import { Navigate, Outlet } from 'react-router-dom';

// Component to protect routes that require authentication
const ProtectedRoute: React.FC = () => {
  const auth = useAuth();

  // Show loading while checking authentication
  if (auth.isLoading) {
    return <div>Verifying authentication...</div>;
  }

  // If not authenticated, redirect to login
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the child routes
  return <Outlet />;
};

export default ProtectedRoute;