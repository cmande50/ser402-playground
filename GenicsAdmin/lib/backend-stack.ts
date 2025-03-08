import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';

export class BackendStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: string;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
    });

    // Add domain to the user pool
    const userPoolDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: `${this.stackName}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      },
    });
    this.userPoolDomain = userPoolDomain.domainName;

    // Import Google OAuth credentials from SSM parameters or create placeholder parameters
    // Note: You need to manually update these parameters with your real Google OAuth credentials
    const googleClientIdParam = new ssm.StringParameter(this, 'GoogleClientIdParam', {
      parameterName: '/genics-admin/google-oauth/client-id',
      stringValue: 'PLACEHOLDER_CLIENT_ID', // Replace with your actual Google OAuth Client ID
      tier: ssm.ParameterTier.STANDARD,
      description: 'Google OAuth Client ID for Genics Admin',
      simpleName: false,
    });

    const googleClientSecretParam = new ssm.StringParameter(this, 'GoogleClientSecretParam', {
      parameterName: '/genics-admin/google-oauth/client-secret',
      stringValue: 'PLACEHOLDER_CLIENT_SECRET', // Replace with your actual Google OAuth Client Secret
      tier: ssm.ParameterTier.STANDARD,
      description: 'Google OAuth Client Secret for Genics Admin',
      simpleName: false,
    });

    // Create Google Identity Provider
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool: this.userPool,
      clientId: googleClientIdParam.stringValue,
      clientSecretValue: cdk.SecretValue.unsafePlainText(googleClientSecretParam.stringValue),
      scopes: ['profile', 'email', 'openid'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
      },
    });

    // Create User Pool Client for frontend application
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE],
      oAuth: {
        callbackUrls: [
          'http://localhost:3000/callback',
          'https://${CloudFrontDistributionDomain}/callback', // Will be updated with CloudFront URL in frontend-stack.ts
        ],
        logoutUrls: [
          'http://localhost:3000/',
          'https://${CloudFrontDistributionDomain}/', // Will be updated with CloudFront URL by frontend-stack.ts
        ],
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
    });

    // Make sure Google provider is added to the User Pool before the User Pool Client
    this.userPoolClient.node.addDependency(googleProvider);

    // Create log groups for Lambda functions
    const lambdaLogGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: '/aws/lambda/genicsAdmin-functions',
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // Create a single Lambda function for both handlers
    const adminLambda = new lambda.Function(this, 'GenicsAdminLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      logGroup: lambdaLogGroup,
      environment: {
        ALLOWED_USERS: 'cander@candersworld.com', // Prepopulated with the specified email
      },
    });

    // Create REST API
    this.api = new apigateway.RestApi(this, 'GenicsAdminApi', {
      restApiName: 'Genics Admin Service',
      description: 'This service manages Genics Admin functionality',
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(
          new logs.LogGroup(this, 'ApiGatewayAccessLogs', {
            logGroupName: '/aws/apigateway/GenicsAdminApiAccessLogs',
            retention: logs.RetentionDays.ONE_WEEK,
          })
        ),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
        allowCredentials: true,
      },
    });

    // Create Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'GenicsAdminApiAuthorizer', {
      cognitoUserPools: [this.userPool],
    });

    // Define API resources and methods
    const stateResource = this.api.root.addResource('state');

    // GET /state endpoint - getState handler
    stateResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(adminLambda, {
        requestTemplates: {
          'application/json': JSON.stringify({
            handlerType: 'getState',
          }),
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // POST /state endpoint - setState handler
    stateResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(adminLambda, {
        requestTemplates: {
          'application/json': JSON.stringify({
            handlerType: 'setState',
          }),
        },
      }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Create explicit CloudFormation exports that can be used by other stacks
    // Note: These exports have explicit names that can be used in the frontend stack
    new cdk.CfnOutput(this, 'GenicsApiEndpointExport', {
      value: this.api.url,
      description: 'API Gateway Endpoint',
      exportName: 'GenicsAdmin-ApiEndpoint', // This name is used to import the value in other stacks
    });

    new cdk.CfnOutput(this, 'GenicsUserPoolIdExport', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'GenicsAdmin-UserPoolId',
    });

    new cdk.CfnOutput(this, 'GenicsUserPoolClientIdExport', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'GenicsAdmin-UserPoolClientId',
    });

    new cdk.CfnOutput(this, 'GenicsUserPoolDomainExport', {
      value: this.userPoolDomain,
      description: 'Cognito User Pool Domain',
      exportName: 'GenicsAdmin-UserPoolDomain',
    });
  }
}
