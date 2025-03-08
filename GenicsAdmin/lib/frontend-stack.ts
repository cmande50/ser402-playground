import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as path from 'path';

export interface FrontendStackProps extends cdk.StackProps {
  apiEndpoint: string;
  userPoolId: string;
  userPoolClientId: string;
  userPoolDomain: string;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // Create S3 bucket for website hosting
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity');
    websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [websiteBucket.arnForObjects('*')],
        principals: [
          new iam.CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Custom resource to update UserPoolClient with CloudFront URL
    const updateAuthURLsFunction = new lambda.Function(this, 'UpdateAuthURLsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        
        exports.handler = async (event, context) => {
          const { userPoolId, userPoolClientId, cloudFrontDomain } = event.ResourceProperties;
          const cognitoIdp = new AWS.CognitoIdentityServiceProvider();
          
          // Get current client settings
          const listResponse = await cognitoIdp.describeUserPoolClient({
            UserPoolId: userPoolId,
            ClientId: userPoolClientId
          }).promise();
          
          const client = listResponse.UserPoolClient;
          
          // Update callback and logout URLs
          const callbackURLs = [
            'http://localhost:3000/',
            \`https://\${cloudFrontDomain}/\`
          ];
          
          const logoutURLs = [
            'http://localhost:3000/',
            \`https://\${cloudFrontDomain}/\`
          ];
          
          // Update client
          await cognitoIdp.updateUserPoolClient({
            UserPoolId: userPoolId,
            ClientId: userPoolClientId,
            AllowedOAuthFlows: client.AllowedOAuthFlows,
            AllowedOAuthFlowsUserPoolClient: client.AllowedOAuthFlowsUserPoolClient,
            AllowedOAuthScopes: client.AllowedOAuthScopes,
            CallbackURLs: callbackURLs,
            LogoutURLs: logoutURLs,
            SupportedIdentityProviders: client.SupportedIdentityProviders,
          }).promise();
          
          return {
            PhysicalResourceId: \`\${userPoolId}-\${userPoolClientId}-updated\`,
            Data: {
              message: 'Auth URLs updated successfully',
            },
          };
        }
      `),
      timeout: cdk.Duration.seconds(30),
    });

    updateAuthURLsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:DescribeUserPoolClient', 'cognito-idp:UpdateUserPoolClient'],
        resources: [
          `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${props.userPoolId}`,
        ],
      })
    );

    const provider = new cr.Provider(this, 'UpdateAuthURLsProvider', {
      onEventHandler: updateAuthURLsFunction,
    });

    const updateAuthURLs = new cdk.CustomResource(this, 'UpdateAuthURLs', {
      serviceToken: provider.serviceToken,
      properties: {
        userPoolId: props.userPoolId,
        userPoolClientId: props.userPoolClientId,
        cloudFrontDomain: distribution.distributionDomainName,
      },
    });

    // Generate config file for the React app
    const configFunction = new lambda.Function(this, 'ConfigFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const fs = require('fs');
        const path = require('path');
        
        exports.handler = async (event) => {
          const { userPoolId, userPoolClientId, userPoolDomain, apiEndpoint, region, cloudFrontDomain } = event.ResourceProperties;
          
          const config = {
            Region: region,
            UserPoolId: userPoolId,
            UserPoolClientId: userPoolClientId,
            UserPoolDomain: userPoolDomain,
            ApiEndpoint: apiEndpoint,
            RedirectSignIn: \`https://\${cloudFrontDomain}/\`,
            RedirectSignOut: \`https://\${cloudFrontDomain}/\`,
          };
          
          const configContent = \`window.appConfig = \${JSON.stringify(config, null, 2)};\`;
          
          fs.writeFileSync('/tmp/config.js', configContent);
          
          return {
            statusCode: 200,
            body: configContent,
          };
        }
      `),
    });

    // Create config file deployment
    const configDeployment = new s3deploy.BucketDeployment(this, 'ConfigDeployment', {
      sources: [s3deploy.Source.asset('/asset-output')], // This is just a placeholder
      destinationBucket: websiteBucket,
      destinationKeyPrefix: '/',
      prune: false,
    });

    // Set physical resource ID dependency on the config function
    // This is a trick to make the CDK think the config function is being used
    // even though we're not actually calling it directly yet
    configDeployment.node.addDependency(configFunction);

    // Deploy the React app to S3
    const reactDeployment = new s3deploy.BucketDeployment(this, 'ReactDeployment', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../frontend/build'))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // Outputs
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Website URL',
    });
  }
}
