# GenicsAdmin - EC2 Instance Management Portal

GenicsAdmin is a web-based admin portal that allows authorized users to monitor and control EC2 instances in your AWS account. The application provides a secure, user-friendly interface to list, start, and stop EC2 instances without needing direct access to the AWS Management Console.

## Architecture Overview

The application is built with a modern serverless architecture using AWS services:

- **Frontend**: React single-page application hosted on S3 and distributed through CloudFront
- **Authentication**: Amazon Cognito with Google OAuth integration for secure user login
- **Backend API**: AWS API Gateway with Lambda functions
- **Infrastructure**: Defined using AWS CDK (Cloud Development Kit) with TypeScript

### Key Components

1. **Backend Stack**:
   - Cognito User Pool with Google OAuth authentication
   - API Gateway with protected endpoints
   - Lambda functions for EC2 instance management
   - S3 bucket for frontend hosting
   - CloudFront distribution for content delivery

2. **Frontend Stack**:
   - React application with TypeScript
   - Integration with Cognito for authentication
   - EC2 instance management UI

3. **Security Features**:
   - Authentication via Google accounts
   - Email-based access control (whitelist)
   - Secure API endpoints with Cognito authorizers

## Prerequisites

Before deploying this application, you need:

1. **AWS Account** with permissions to create the required resources
2. **AWS CLI** installed and configured
3. **Node.js** (version 16.x or later)
4. **Google OAuth Credentials**:
   - A Google Cloud project with OAuth 2.0 credentials
   - Client ID and Client Secret for the Google OAuth provider

## Setup and Installation

### 1. Clone and Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd GenicsAdmin

# Run the setup script
chmod +x setup.sh
./setup.sh
```

The setup script will install dependencies and build both the Lambda functions and the frontend application.

### 2. Configure Google OAuth

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Navigate to "APIs & Services" > "Credentials"
4. Create an OAuth 2.0 Client ID
5. Configure the authorized Javascript origin. This will be an `amazoncognito.com` domain since that's where the OAuth reuqest is coming from.
6. Configure the authorized redirect URIs (you'll need to use your CloudFront domain and localhost for development)
   - `https://<your-prefix>.auth.<aws-region>.amazoncognito.com/oauth2/idpresponse`
   - `http://localhost:3000/`
7. Note your Client ID and Client Secret

### 3. Update Configuration

Edit the `bin/genics-admin.ts` file to configure:

- Allowed email addresses for access control
- Google OAuth credentials (or use environment variables)

```typescript
// Configure allowed users
const backendStack = new BackendStack(app, 'GenicsAdminBackendStack', {
  allowedEmails: ['your-email@example.com'],  // Add emails that can access the app
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
});
```

## Deployment

### 1. Set Environment Variables

```bash
# Set your Google OAuth credentials
export GOOGLE_CLIENT_ID=your-google-client-id
export GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2. Bootstrap AWS CDK (First time only)

```bash
npm run bootstrap
```

### 3. Deploy the Application

```bash
npm run deploy
```

This will:

1. Build the Lambda functions
2. Build the React frontend
3. Deploy both stacks to your AWS account
4. Output the CloudFront domain where your application is available

## Usage

Once deployed, you can access the application using the CloudFront URL provided in the deployment output.

### Authentication Flow

1. Visit the application URL
2. Click "Sign in with Google"
3. Authenticate with your Google account
4. If your email is in the allowed list, you'll be redirected to the main dashboard

### EC2 Management

The main dashboard displays all EC2 instances in your account with the following information:

- Instance ID
- Name (from tags)
- Instance type
- Current state
- IP address

You can:

- Refresh the instance list
- Start stopped instances
- Stop running instances
