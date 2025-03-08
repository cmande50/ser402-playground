import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  getTokens, 
  clearTokens, 
  isTokenValid, 
  getUserFromToken, 
  getGoogleOAuthUrl
} from '../utils/auth-utils';

interface User {
  name: string;
  email: string;
  picture: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  loginWithGoogle: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check for existing auth on initial load
  useEffect(() => {
    const checkAuth = () => {
      try {
        setIsLoading(true);
        const { idToken } = getTokens();
        
        if (idToken && isTokenValid(idToken)) {
          const userInfo = getUserFromToken(idToken);
          if (userInfo) {
            setUser(userInfo);
            setIsAuthenticated(true);
          } else {
            // Clear invalid tokens
            clearTokens();
            setIsAuthenticated(false);
            setUser(null);
          }
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login with Google - redirects to the Google OAuth flow
  const loginWithGoogle = () => {
    const googleOAuthUrl = getGoogleOAuthUrl();
    window.location.href = googleOAuthUrl;
  };

  // Logout - clear tokens and reset state
  const logout = () => {
    clearTokens();
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isLoading,
        loginWithGoogle,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for accessing auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
