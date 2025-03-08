import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';
import '../styles/global.css';

const LoginPage = () => {
  const { loginWithGoogle, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Use useEffect for navigation to avoid render-time navigation
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/toggle');
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleLogin = () => {
    loginWithGoogle();
    // Navigation will happen in the useEffect when isAuthenticated changes
  };

  return (
    <div className="page login-page">
      <div className="login-container">
        <h1>Welcome</h1>
        <p>Please log in to continue</p>
        <button 
          className="google-login-button" 
          onClick={handleGoogleLogin}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1, 0, 0, 1, 0, 0)">
              <path d="M21.35,11.1H12v3.2h5.59c-0.8,2.4-3.06,4.1-5.59,4.1c-3.31,0-6-2.69-6-6s2.69-6,6-6c1.39,0,2.67,0.47,3.68,1.28l2.38-2.38 C16.46,3.72,14.34,3,12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9c5.25,0,8.87-3.88,8.87-9.33C20.87,11.57,20.54,11.1,21.35,11.1z" fill="#4285F4"></path>
            </g>
          </svg>
          Login with Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
