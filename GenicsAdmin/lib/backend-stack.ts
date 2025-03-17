import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeJsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as path from 'path';

export interface BackendStackProps extends cdk.StackProps {
  // Allow passing which email addresses can access the app
  allowedEmails?: string[];
  // Google OAuth credentials
  googleClientId?: string;
  googleClientSecret?: string;
}

export class BackendStack extends cdk.Stack {
  // Expose these resources so they can be referenced by the frontend stack
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: string;
  public readonly api: apigateway.RestApi;
  public readonly websiteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: BackendStackProps) {
    super(scope, id, props);
    
    // --------------------------------------------------
    // 1. Create S3 bucket for website hosting
    // --------------------------------------------------
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create CloudFront origin access identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI');
    
    // Grant CloudFront access to the S3 bucket
    this.websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [this.websiteBucket.arnForObjects('*')],
        principals: [
          new iam.CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.websiteBucket, { originAccessIdentity }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          // Return index.html for any 404 errors to support SPA routing
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });
    
    // --------------------------------------------------
    // 2. Create Cognito User Pool for authentication
    // --------------------------------------------------
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false, // Disable direct sign-up since we'll use Google
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
    });

    // Add Google as an identity provider
    // Note: You'll need to create a project in the Google Developer Console
    // and obtain a client ID and secret
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool: this.userPool,
      clientId: props?.googleClientId || 'GOOGLE_CLIENT_ID_PLACEHOLDER',
      clientSecret: props?.googleClientSecret || 'GOOGLE_CLIENT_SECRET_PLACEHOLDER',
      scopes: ['profile', 'email', 'openid'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
        profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
      },
    });

    // Add domain to the user pool
    const userPoolDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: `genics-admin`,
      },
    });
    this.userPoolDomain = userPoolDomain.domainName;

    // CloudFront URL for Cognito callbacks
    const cloudFrontUrl = `https://${this.distribution.distributionDomainName}/`;

    // Create User Pool Client with CloudFront URL directly
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      authFlows: {
        userPassword: false,
        userSrp: false,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE
      ],
      oAuth: {
        callbackUrls: [
          'http://localhost:3000/',
          cloudFrontUrl,
        ],
        logoutUrls: [
          'http://localhost:3000/',
          cloudFrontUrl,
        ],
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
    });
    
    // The Google provider needs to be created before the client can be generated
    this.userPoolClient.node.addDependency(googleProvider);

    // --------------------------------------------------
    // 3. Create Lambda function for EC2 operations
    // --------------------------------------------------
    const ec2ManagerLambda = new nodeJsLambda.NodejsFunction(this, 'EC2ManagerLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda/src/ec2-manager/index.ts'),
      handler: 'handler',
      environment: {
        // Default to empty string if no emails provided
        ALLOWED_USERS: props?.allowedEmails?.join(',') || '',
        // Pass the CloudFront domain for CORS
        CLOUDFRONT_DOMAIN: this.distribution.distributionDomainName,
      },
    });

    // Grant EC2 permissions to the Lambda function
    ec2ManagerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ec2:DescribeInstances',
          'ec2:StartInstances',
          'ec2:StopInstances',
        ],
        resources: ['*'], // Scope down in production
      })
    );

    // --------------------------------------------------
    // 4. Create API Gateway
    // --------------------------------------------------
    this.api = new apigateway.RestApi(this, 'API', {
      restApiName: 'Genics Admin API',
      description: 'API for Genics Admin application',
      defaultCorsPreflightOptions: {
        allowOrigins: [cloudFrontUrl, 'http://localhost:3000'],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
        allowCredentials: true,
      },
    });

    // Create Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [this.userPool],
    });

    // Create API resources and methods
    const instanceResource = this.api.root.addResource('instances');
    
    // GET /instances - Get all instances
    instanceResource.addMethod('GET', new apigateway.LambdaIntegration(ec2ManagerLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    
    // POST /instances - Start or stop instance
    instanceResource.addMethod('POST', new apigateway.LambdaIntegration(ec2ManagerLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // --------------------------------------------------
    // 5. Outputs
    // --------------------------------------------------
    // Export values for the frontend stack
    new cdk.CfnOutput(this, 'ApiEndpointOutput', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'GenicsAdmin-ApiEndpoint',
    });

    new cdk.CfnOutput(this, 'UserPoolIdOutput', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'GenicsAdmin-UserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientIdOutput', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'GenicsAdmin-UserPoolClientId',
    });

    new cdk.CfnOutput(this, 'UserPoolDomainOutput', {
      value: this.userPoolDomain,
      description: 'Cognito User Pool Domain',
      exportName: 'GenicsAdmin-UserPoolDomain',
    });

    new cdk.CfnOutput(this, 'WebsiteBucketNameOutput', {
      value: this.websiteBucket.bucketName,
      description: 'Website S3 bucket name',
      exportName: 'GenicsAdmin-WebsiteBucketName',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionOutput', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: 'GenicsAdmin-CloudFrontDomain',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionIdOutput', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: 'GenicsAdmin-CloudFrontDistributionId',
    });
  }
}
