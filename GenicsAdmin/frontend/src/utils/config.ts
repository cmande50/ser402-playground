// Define the structure of our configuration
export interface AppConfig {
    Region: string;
    UserPoolId: string;
    UserPoolClientId: string;
    UserPoolDomain: string;
    ApiEndpoint: string;
    RedirectSignIn: string;
    RedirectSignOut: string;
  }
  
  // Declare the global window property that will hold our config
  declare global {
    interface Window {
      appConfig?: AppConfig;
    }
  }
  
  // Default config for local development
  const defaultConfig: AppConfig = {
    Region: 'us-east-1',
    UserPoolId: 'local-user-pool-id',
    UserPoolClientId: 'local-client-id',
    UserPoolDomain: 'local-domain',
    ApiEndpoint: 'http://localhost:3001/',
    RedirectSignIn: 'http://localhost:3000/',
    RedirectSignOut: 'http://localhost:3000/',
  };
  
  // Get the runtime configuration
  export const getConfig = (): AppConfig => {
    if (window.appConfig) {
      return window.appConfig;
    }
    
    console.warn('Application config not found, using default development values');
    return defaultConfig;
  };
  
  // Get the auth config for react-oidc-context
  export const getAuthConfig = () => {
    const config = getConfig();
    
    // Construct the authority URL
    const authority = `https://${config.UserPoolDomain}.auth.${config.Region}.amazoncognito.com`;
      
    return {
      authority,
      client_id: config.UserPoolClientId,
      redirect_uri: config.RedirectSignIn,
      post_logout_redirect_uri: config.RedirectSignOut,
      response_type: 'code',
      scope: 'email openid profile',
      
      // Define all metadata endpoints
      metadata: {
        issuer: authority,
        authorization_endpoint: `${authority}/oauth2/authorize`,
        token_endpoint: `${authority}/oauth2/token`,
        userinfo_endpoint: `${authority}/oauth2/userInfo`,
        end_session_endpoint: `${authority}/logout`,
        jwks_uri: `${authority}/.well-known/jwks.json`
      },
      
      // Additional settings
      loadUserInfo: true,
      automaticSilentRenew: true,
    };
  };
  
  // Get Cognito logout URL
  export const getCognitoLogoutUrl = () => {
    const config = getConfig();
    const domain = `https://${config.UserPoolDomain}.auth.${config.Region}.amazoncognito.com`;
    
    const encodedRedirect = encodeURIComponent(config.RedirectSignOut);
    
    return `${domain}/logout?client_id=${config.UserPoolClientId}&logout_uri=${encodedRedirect}`;
  };
  