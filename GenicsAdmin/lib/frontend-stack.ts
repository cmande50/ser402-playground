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
import * as fs from 'fs';
import * as nodeJsLambda from 'aws-cdk-lib/aws-lambda-nodejs';

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
    const updateAuthURLsFunction = new nodeJsLambda.NodejsFunction(this, 'UpdateAuthURLsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X, // Use the latest runtime
      entry: path.join(__dirname, '../lambda/update-auth-urls/index.ts'),
      handler: 'handler',
      bundling: {
        externalModules: [], // Bundle everything
        minify: true,
        sourceMap: true,
      },
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      },
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

    // Generate config.js file for frontend
    const configContent = `window.appConfig = ${JSON.stringify(
      {
        Region: this.region,
        UserPoolId: props.userPoolId,
        UserPoolClientId: props.userPoolClientId,
        UserPoolDomain: props.userPoolDomain,
        ApiEndpoint: props.apiEndpoint,
        RedirectSignIn: `https://${distribution.distributionDomainName}/callback`,
        RedirectSignOut: `https://${distribution.distributionDomainName}/`,
      },
      null,
      2
    )};`;

    // Create a temporary directory for the config file
    const configDir = path.join(__dirname, '../frontend/public/config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Write the config file
    fs.writeFileSync(path.join(configDir, 'config.js'), configContent);

    // Path to the frontend build output
    const frontendBuildPath = path.join(__dirname, '../frontend/build');

    // Check if frontend build exists
    if (!fs.existsSync(frontendBuildPath)) {
      throw new Error(
        'Frontend build directory not found. Please run "npm run build:frontend" first.\n' +
          'You can use "npm run synth" or "npm run deploy" which will automatically build the frontend.'
      );
    }

    // Deploy the config file to S3
    new s3deploy.BucketDeployment(this, 'ConfigDeployment', {
      sources: [s3deploy.Source.asset(configDir)],
      destinationBucket: websiteBucket,
      destinationKeyPrefix: 'config',
    });

    // Deploy the React app to S3
    new s3deploy.BucketDeployment(this, 'ReactDeployment', {
      sources: [s3deploy.Source.asset(frontendBuildPath)],
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
