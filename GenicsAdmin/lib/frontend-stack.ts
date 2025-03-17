import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeJsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

import * as path from 'path';

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Import resources from the backend stack
    const apiEndpoint = cdk.Fn.importValue('GenicsAdmin-ApiEndpoint');
    const userPoolId = cdk.Fn.importValue('GenicsAdmin-UserPoolId');
    const userPoolClientId = cdk.Fn.importValue('GenicsAdmin-UserPoolClientId');
    const userPoolDomain = cdk.Fn.importValue('GenicsAdmin-UserPoolDomain');
    const bucketName = cdk.Fn.importValue('GenicsAdmin-WebsiteBucketName');
    const distributionId = cdk.Fn.importValue('GenicsAdmin-CloudFrontDistributionId');
    const distributionDomainName = cdk.Fn.importValue('GenicsAdmin-CloudFrontDomain');

    // Get reference to the existing S3 bucket
    const websiteBucket = s3.Bucket.fromBucketName(this, 'ImportedWebsiteBucket', bucketName);

    // Get reference to the existing CloudFront distribution
    const distribution = cloudfront.Distribution.fromDistributionAttributes(this, 'ImportedDistribution', {
      distributionId: distributionId,
      domainName: distributionDomainName,
    });

    // Create Lambda to generate runtime config
    const configGeneratorFunction = new nodeJsLambda.NodejsFunction(this, 'ConfigGeneratorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda/src/config-generator/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUCKET_NAME: websiteBucket.bucketName,
      },
    });

    // Grant Lambda permission to write to S3 bucket
    configGeneratorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [websiteBucket.arnForObjects('*')],
      })
    );

    // Create custom resource to generate config
    const configProvider = new cr.Provider(this, 'ConfigProvider', {
      onEventHandler: configGeneratorFunction,
    });

    // Create custom resource to generate runtime config
    const configGenerator = new cdk.CustomResource(this, 'GenerateConfig', {
      serviceToken: configProvider.serviceToken,
      properties: {
        region: this.region,
        userPoolId,
        userPoolClientId,
        userPoolDomain,
        apiEndpoint,
        cloudFrontDomain: distribution.distributionDomainName,
        timestamp: Date.now().toString(),
      },
    });

    // Deploy React app to S3 bucket
    const deployment = new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../frontend/build'))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // Make sure config is generated after app is deployed
    configGenerator.node.addDependency(deployment);

    // Output the CloudFront URL
    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${distributionDomainName}`,
      description: 'Website URL',
    });
  }
}
