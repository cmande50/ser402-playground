import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface CdkCustomResourceEvent {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  ResourceProperties: {
    ServiceToken: string;
    region: string;
    userPoolId: string;
    userPoolClientId: string;
    userPoolDomain: string;
    apiEndpoint: string;
    cloudFrontDomain: string;
    timestamp?: string;
  };
  PhysicalResourceId?: string;
}

export const handler = async (event: CdkCustomResourceEvent) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Skip processing for Delete events
  if (event.RequestType === 'Delete') {
    return {
      PhysicalResourceId: event.PhysicalResourceId || 'config-generator',
      Status: 'SUCCESS'
    };
  }
  
  const { region, userPoolId, userPoolClientId, userPoolDomain, apiEndpoint, cloudFrontDomain } = event.ResourceProperties;
  
  try {
    // Get bucket name from environment variable
    const bucketName = process.env.BUCKET_NAME;
    
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable not set');
    }

    // Extract just the domain prefix if needed
    let domainPrefix = userPoolDomain;
    if (domainPrefix.includes('.auth.')) {
      domainPrefix = domainPrefix.split('.auth.')[0];
    }

    // Create configuration object
    const config = {
      Region: region,
      UserPoolId: userPoolId,
      UserPoolClientId: userPoolClientId,
      UserPoolDomain: domainPrefix,
      ApiEndpoint: apiEndpoint,
      RedirectSignIn: `https://${cloudFrontDomain}/`,
      RedirectSignOut: `https://${cloudFrontDomain}/`,
    };

    console.log('Generated config:', JSON.stringify(config, null, 2));

    // Create the config.js file content
    const configContent = `window.appConfig = ${JSON.stringify(config, null, 2)};`;

    // Initialize S3 client
    const s3Client = new S3Client({ region });

    // Upload the config.js file to S3
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: 'config/config.js',
      Body: configContent,
      ContentType: 'application/javascript',
      CacheControl: 'no-cache'
    });

    await s3Client.send(putCommand);
    console.log('Config file uploaded successfully');

    return {
      PhysicalResourceId: `${bucketName}-config-file`,
      Status: 'SUCCESS',
      Data: {
        ConfigFile: 'config/config.js'
      }
    };
  } catch (error: any) {
    console.error('Error generating or uploading config file:', error);
    
    return {
      PhysicalResourceId: event.PhysicalResourceId || 'config-generator-failed',
      Status: 'FAILED',
      Reason: `Error: ${error.message}`
    };
  }
};
