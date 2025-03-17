import React from 'react';
import { useAuth } from 'react-oidc-context';
import { Navigate } from 'react-router-dom';
import { getCognitoLogoutUrl } from '../utils/config';
import EC2InstanceManager from '../components/EC2InstanceManager';

const HomePage: React.FC = () => {
  const auth = useAuth();

  // Sign out using Cognito's logout URL
  const handleSignOut = () => {
    window.location.href = getCognitoLogoutUrl();
  };

  // If not authenticated, redirect to login
  if (!auth.isLoading && !auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Show loading state
  if (auth.isLoading) {
    return <div>Loading user information...</div>;
  }

  return (
    <div className="home-page">
      <header className="app-header">
        <h1>Genics Admin Manager</h1>
        <div className="user-info">
          <span>Signed in as: {auth.user?.profile.email}</span>
          <button onClick={handleSignOut} className="logout-button">
            Sign Out
          </button>
        </div>
      </header>

      <main className="app-content">
        <EC2InstanceManager />
      </main>
    </div>
  );
};

export default HomePage;
