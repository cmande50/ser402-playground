import { useState, useEffect } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

interface User {
  name: string;
  email: string;
  picture: string;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
  });

  // This would typically be implemented with a real OAuth flow
  const loginWithGoogle = () => {
    // Simulate successful login
    const mockUser = {
      name: 'Test User',
      email: 'test@example.com',
      picture: 'https://via.placeholder.com/150',
    };
    
    setAuthState({
      isAuthenticated: true,
      user: mockUser,
    });
    
    // Save to localStorage for persistence
    localStorage.setItem('auth', JSON.stringify({
      isAuthenticated: true,
      user: mockUser,
    }));
  };

  const logout = () => {
    setAuthState({
      isAuthenticated: false,
      user: null,
    });
    localStorage.removeItem('auth');
  };

  // Check for existing session on initial load
  useEffect(() => {
    const savedAuth = localStorage.getItem('auth');
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        setAuthState(parsed);
      } catch (error) {
        console.error('Failed to parse auth from localStorage', error);
        localStorage.removeItem('auth');
      }
    }
  }, []);

  return {
    ...authState,
    loginWithGoogle,
    logout,
  };
};
