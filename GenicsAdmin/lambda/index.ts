import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Main handler that routes to the appropriate function
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // Check if we have a handlerType in the request
  let handlerType = '';

  try {
    // Try to extract from event body if it's a custom template
    const body = JSON.parse(event.body || '{}');
    if (body.handlerType) {
      handlerType = body.handlerType;
    }
  } catch (error) {
    // If parsing fails, continue
  }

  // If no handlerType in body, determine based on HTTP method
  if (!handlerType) {
    if (event.httpMethod === 'GET') {
      handlerType = 'getState';
    } else if (event.httpMethod === 'POST') {
      handlerType = 'setState';
    }
  }

  console.log(`Handler type: ${handlerType}`);

  // Route to the appropriate handler
  if (handlerType === 'getState') {
    return await getStateHandler(event);
  } else if (handlerType === 'setState') {
    return await setStateHandler(event);
  } else {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Invalid handler type',
      }),
    };
  }
};

// Get state handler
export const getStateHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('GetState handler triggered');

  // Get user from Cognito JWT claims
  const claims = event.requestContext.authorizer?.claims;
  const userEmail = claims?.email || 'unknown';

  console.log(`User email: ${userEmail}`);

  // Check if user is allowed to access
  const allowedUsers = process.env.ALLOWED_USERS?.split(',') || [];
  if (allowedUsers.length > 0 && !allowedUsers.includes(userEmail)) {
    console.log(`User ${userEmail} is not authorized to access this resource`);
    return {
      statusCode: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'You are not authorized to access this resource',
      }),
    };
  }

  // In a real application, you would fetch state from a database
  // For this demo, we'll return a placeholder state
  const state = {
    isEnabled: true,
    lastUpdated: new Date().toISOString(),
  };

  console.log('Returning state:', state);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(state),
  };
};

// Set state handler
export const setStateHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('SetState handler triggered');

  // Get user from Cognito JWT claims
  const claims = event.requestContext.authorizer?.claims;
  const userEmail = claims?.email || 'unknown';

  console.log(`User email: ${userEmail}`);

  // Check if user is allowed to access
  const allowedUsers = process.env.ALLOWED_USERS?.split(',') || [];
  if (allowedUsers.length > 0 && !allowedUsers.includes(userEmail)) {
    console.log(`User ${userEmail} is not authorized to access this resource`);
    return {
      statusCode: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'You are not authorized to access this resource',
      }),
    };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    console.error('Error parsing body:', error);
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Invalid request body',
      }),
    };
  }

  console.log('Received state update:', body);

  // In a real application, you would update state in a database
  // For this demo, we'll just log the received state
  console.log(`State update received: ${JSON.stringify(body)}`);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      message: 'State updated successfully',
      updatedAt: new Date().toISOString(),
    }),
  };
};
