import { jwtDecode } from 'jwt-decode';

declare global {
  interface Window {
    appConfig: {
      Region: string;
      UserPoolId: string;
      UserPoolClientId: string;
      UserPoolDomain: string;
      ApiEndpoint: string;
      RedirectSignIn: string;
      RedirectSignOut: string;
    };
  }
}

export interface DecodedToken {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  exp: number;
  [key: string]: any;
}

// Default configuration with fallbacks for local development
export const getConfig = () => {
  return (
    window.appConfig || {
      Region: 'us-east-1',
      UserPoolId: 'local-user-pool-id',
      UserPoolClientId: 'local-client-id',
      UserPoolDomain: 'local-domain',
      ApiEndpoint: 'http://localhost:3000/api',
      RedirectSignIn: 'http://localhost:3000/callback',
      RedirectSignOut: 'http://localhost:3000/',
    }
  );
};

// Storage keys
const ID_TOKEN_KEY = 'genics_id_token';
const ACCESS_TOKEN_KEY = 'genics_access_token';
const REFRESH_TOKEN_KEY = 'genics_refresh_token';

// Store tokens securely in localStorage
export const storeTokens = (idToken: string, accessToken: string, refreshToken?: string) => {
  localStorage.setItem(ID_TOKEN_KEY, idToken);
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
};

// Get tokens from storage
export const getTokens = () => {
  return {
    idToken: localStorage.getItem(ID_TOKEN_KEY),
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
};

// Clear tokens from storage
export const clearTokens = () => {
  localStorage.removeItem(ID_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// Check if the token is valid and not expired
export const isTokenValid = (token: string | null): boolean => {
  if (!token) return false;

  try {
    const decoded = jwtDecode<DecodedToken>(token);
    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp > currentTime;
  } catch (error) {
    console.error('Invalid token', error);
    return false;
  }
};

// Extract user information from ID token
export const getUserFromToken = (
  idToken: string | null
): { name: string; email: string; picture: string } | null => {
  if (!idToken) return null;

  try {
    const decoded = jwtDecode<DecodedToken>(idToken);
    return {
      name: decoded.name || decoded.email || 'User',
      email: decoded.email || '',
      picture: decoded.picture || '',
    };
  } catch (error) {
    console.error('Error decoding ID token', error);
    return null;
  }
};

// Generate the Google OAuth URL
export const getGoogleOAuthUrl = () => {
  const config = getConfig();
  const cognito_domain = `https://${config.UserPoolDomain}.auth.${config.Region}.amazoncognito.com`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.UserPoolClientId,
    redirect_uri: config.RedirectSignIn,
    identity_provider: 'Google',
    scope: 'openid email profile',
    state: generateRandomString(),
  });

  return `${cognito_domain}/oauth2/authorize?${params.toString()}`;
};

// Generate a random string for state parameter
const generateRandomString = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Exchange authorization code for tokens
export const exchangeCodeForTokens = async (
  code: string
): Promise<{
  id_token: string;
  access_token: string;
  refresh_token?: string;
}> => {
  const config = getConfig();
  const cognito_domain = `https://${config.UserPoolDomain}.auth.${config.Region}.amazoncognito.com`;
  const tokenEndpoint = `${cognito_domain}/oauth2/token`;

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.UserPoolClientId,
    redirect_uri: config.RedirectSignIn,
    code: code,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Token exchange failed: ${errorData.error} - ${errorData.error_description}`);
  }

  const tokens = await response.json();
  return {
    id_token: tokens.id_token,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  };
};

// Helper for making authenticated API requests
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const { accessToken } = getTokens();

  if (!accessToken || !isTokenValid(accessToken)) {
    throw new Error('No valid access token available');
  }

  const authOptions = {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  };

  return fetch(url, authOptions);
};
