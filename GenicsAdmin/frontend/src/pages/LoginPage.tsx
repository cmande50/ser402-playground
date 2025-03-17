import React from 'react';
import { useAuth } from 'react-oidc-context';
import { Navigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const auth = useAuth();

  // If already authenticated, redirect to home page
  if (auth.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Show loading state while authentication is initializing
  if (auth.isLoading) {
    return <div>Loading authentication status...</div>;
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Genics Admin</h1>
        <p>Please sign in to access the admin panel</p>
        
        {auth.error && (
          <div className="error-message">
            Authentication error: {auth.error.message}
          </div>
        )}
        
        <button 
          onClick={() => auth.signinRedirect()}
          className="login-button"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage;