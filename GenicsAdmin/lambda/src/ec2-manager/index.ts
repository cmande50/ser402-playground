import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  EC2Client, 
  DescribeInstancesCommand, 
  StartInstancesCommand, 
  StopInstancesCommand 
} from '@aws-sdk/client-ec2';

// Create EC2 client
const ec2Client = new EC2Client();

// Main Lambda handler
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // Get user email from Cognito claims
  const claims = event.requestContext.authorizer?.claims;
  const userEmail = claims?.email || 'unknown';
  console.log(`User email: ${userEmail}`);

  // Check if user is allowed to access the API
  const allowedUsers = process.env.ALLOWED_USERS?.split(',').filter(email => email.trim()) || [];
  if (allowedUsers.length > 0 && !allowedUsers.includes(userEmail)) {
    console.log(`User ${userEmail} is not authorized`);
    return {
      statusCode: 403,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        message: 'You are not authorized to access this resource',
      }),
    };
  }

  try {
    // Handle GET request - List EC2 instances
    if (event.httpMethod === 'GET') {
      return await getInstances(event);
    }
    
    // Handle POST request - Start/Stop EC2 instance
    if (event.httpMethod === 'POST') {
      const body = parseBody(event);
      return await changeInstanceState(body, event);
    }

    // Handle unsupported methods
    return {
      statusCode: 405,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ message: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        message: 'Internal server error',
        error: (error as Error).message,
      }),
    };
  }
};

// Get all EC2 instances
async function getInstances(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const command = new DescribeInstancesCommand({});
  const response = await ec2Client.send(command);
  
  const instances = [];
  
  if (response.Reservations) {
    for (const reservation of response.Reservations) {
      if (reservation.Instances) {
        for (const instance of reservation.Instances) {
          instances.push({
            instanceId: instance.InstanceId,
            state: instance.State?.Name,
            type: instance.InstanceType,
            launchTime: instance.LaunchTime,
            publicDnsName: instance.PublicDnsName,
            publicIpAddress: instance.PublicIpAddress,
            privateDnsName: instance.PrivateDnsName,
            privateIpAddress: instance.PrivateIpAddress,
            tags: instance.Tags?.reduce((acc, tag) => {
              if (tag.Key && tag.Value) {
                acc[tag.Key] = tag.Value;
              }
              return acc;
            }, {} as Record<string, string>),
          });
        }
      }
    }
  }

  return {
    statusCode: 200,
    headers: getCorsHeaders(event),
    body: JSON.stringify({
      instances,
      timestamp: new Date().toISOString(),
    }),
  };
}

// Start or stop an EC2 instance
async function changeInstanceState(body: any, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { instanceId, action } = body;
  
  if (!instanceId) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ message: 'instanceId is required' }),
    };
  }

  if (!action || (action !== 'start' && action !== 'stop')) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        message: 'action is required and must be either "start" or "stop"',
      }),
    };
  }
  
  let result;
  
  if (action === 'start') {
    result = await ec2Client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        message: 'Instance start request sent',
        instanceId,
        previousState: result.StartingInstances?.[0]?.PreviousState?.Name,
        currentState: result.StartingInstances?.[0]?.CurrentState?.Name,
      }),
    };
  } else {
    result = await ec2Client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        message: 'Instance stop request sent',
        instanceId,
        previousState: result.StoppingInstances?.[0]?.PreviousState?.Name,
        currentState: result.StoppingInstances?.[0]?.CurrentState?.Name,
      }),
    };
  }
}

// Helper function to parse request body
function parseBody(event: APIGatewayProxyEvent): any {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    console.error('Error parsing body:', error);
    return {};
  }
}

// Helper function to get CORS headers
function getCorsHeaders(event: APIGatewayProxyEvent): Record<string, string | boolean> {
  // Get origin from request headers
  const origin = event.headers?.origin || event.headers?.Origin;
  
  // Get allowed origins from environment variable
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;
  
  // If CloudFront domain is set, add it to allowed origins
  if (cloudFrontDomain && !allowedOrigins.includes(`https://${cloudFrontDomain}`)) {
    allowedOrigins.push(`https://${cloudFrontDomain}`);
  }
  
  // Always allow localhost for development
  if (!allowedOrigins.includes('http://localhost:3000')) {
    allowedOrigins.push('http://localhost:3000');
  }
  
  // Determine which origin to return in headers
  let accessControlAllowOrigin: string;
  
  if (origin && allowedOrigins.includes(origin)) {
    // If the request origin is in our allowed list, return it
    accessControlAllowOrigin = origin;
  } else if (cloudFrontDomain) {
    // Default to CloudFront domain if available
    accessControlAllowOrigin = `https://${cloudFrontDomain}`;
  } else {
    // Fallback to localhost for development
    accessControlAllowOrigin = 'http://localhost:3000';
  }
  
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': accessControlAllowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': true,
  };
}