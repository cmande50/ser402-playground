import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeCodeForTokens, storeTokens } from '../utils/auth-utils';

const GoogleAuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Get the authorization code from the URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const errorParam = urlParams.get('error');

      if (errorParam) {
        setError(`Authentication failed: ${errorParam}`);
        // Redirect to login page after a delay
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (!code) {
        setError('No authorization code found in URL');
        // Redirect to login page after a delay
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      try {
        // Exchange the code for tokens
        const tokens = await exchangeCodeForTokens(code);
        
        // Store tokens
        storeTokens(
          tokens.id_token,
          tokens.access_token,
          tokens.refresh_token
        );

        // Redirect to toggle page
        navigate('/toggle');
      } catch (error) {
        console.error('Token exchange failed:', error);
        setError('Authentication failed. Please try again.');
        // Redirect to login page after a delay
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  // Show loading or error
  return (
    <div className="page login-page">
      <div className="login-container">
        <h1>{error ? 'Authentication Error' : 'Authenticating...'}</h1>
        {error ? (
          <p>{error}</p>
        ) : (
          <p>Please wait while we complete the authentication process...</p>
        )}
      </div>
    </div>
  );
};

export default GoogleAuthCallback;
