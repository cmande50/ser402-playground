#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/backend-stack';
import { FrontendStack } from '../lib/frontend-stack';

// Initialize CDK app
const app = new cdk.App();

// Create backend stack
const backendStack = new BackendStack(app, 'GenicsAdminBackendStack', {
  allowedEmails: ['cander@candersworld.com'],  // Replace with your email for access control
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,  // It would be better for the backend to get this from secrets manager
});

// Deploy the React app
const frontendStack = new FrontendStack(app, 'GenicsAdminFrontendStack');

// Add dependency to ensure backend is deployed first
frontendStack.addDependency(backendStack);