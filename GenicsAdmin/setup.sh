#!/bin/bash
set -e

echo "Starting Genics Admin deployment..."

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Install and build Lambda functions
echo "Building Lambda functions..."
cd lambda
npm install
npm run build
cd ..

# Build frontend
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Setup complete! You can now run:"
echo "npm run deploy    - to deploy to AWS"
