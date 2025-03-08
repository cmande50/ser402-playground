import {
  CognitoIdentityProviderClient,
  DescribeUserPoolClientCommand,
  UpdateUserPoolClientCommand,
  UserPoolClientType,
} from '@aws-sdk/client-cognito-identity-provider';

interface CdkCustomResourceEvent {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  ResourceProperties: {
    ServiceToken: string;
    userPoolId: string;
    userPoolClientId: string;
    cloudFrontDomain: string;
  };
}

export const handler = async (event: CdkCustomResourceEvent) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const { userPoolId, userPoolClientId, cloudFrontDomain } = event.ResourceProperties;

    // Initialize the Cognito Identity Provider client
    const client = new CognitoIdentityProviderClient();

    // Get current client settings
    const describeCommand = new DescribeUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: userPoolClientId,
    });

    const response = await client.send(describeCommand);
    const userPoolClient = response.UserPoolClient;

    if (!userPoolClient) {
      throw new Error(`User pool client ${userPoolClientId} not found`);
    }

    // Update callback and logout URLs
    const callbackURLs = ['http://localhost:3000/', `https://${cloudFrontDomain}/`];

    const logoutURLs = ['http://localhost:3000/', `https://${cloudFrontDomain}/`];

    console.log(`Updating client with new callback URLs: ${callbackURLs.join(', ')}`);
    console.log(`Updating client with new logout URLs: ${logoutURLs.join(', ')}`);

    // Update client
    const updateCommand = new UpdateUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: userPoolClientId,
      ClientName: userPoolClient.ClientName,
      AllowedOAuthFlows: userPoolClient.AllowedOAuthFlows,
      AllowedOAuthFlowsUserPoolClient: userPoolClient.AllowedOAuthFlowsUserPoolClient,
      AllowedOAuthScopes: userPoolClient.AllowedOAuthScopes,
      CallbackURLs: callbackURLs,
      LogoutURLs: logoutURLs,
      SupportedIdentityProviders: userPoolClient.SupportedIdentityProviders,
      RefreshTokenValidity: userPoolClient.RefreshTokenValidity,
      AccessTokenValidity: userPoolClient.AccessTokenValidity,
      IdTokenValidity: userPoolClient.IdTokenValidity,
      TokenValidityUnits: userPoolClient.TokenValidityUnits,
      ExplicitAuthFlows: userPoolClient.ExplicitAuthFlows,
      PreventUserExistenceErrors: userPoolClient.PreventUserExistenceErrors,
      EnableTokenRevocation: userPoolClient.EnableTokenRevocation,
    });

    await client.send(updateCommand);
    console.log('User pool client updated successfully');

    return {
      PhysicalResourceId: `${userPoolId}-${userPoolClientId}-updated`,
      Data: {
        message: 'Auth URLs updated successfully',
      },
    };
  } catch (error) {
    console.error('Error updating user pool client:', error);
    throw error;
  }
};
