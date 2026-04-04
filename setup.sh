#!/bin/bash

# SRP One-Command Setup
set -e

echo "🚀 Setting up SRP Security Reasoning Protocol..."

# 1. Check dependencies
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install it first: https://pnpm.io/installation"
    exit 1
fi

# 2. Install dependencies
echo "📦 Installing workspace dependencies..."
pnpm install

# 3. Build all packages and apps
echo "🔨 Building SRP monorepo..."
npm run build

# 4. Run foundation tests
echo "🧪 Running smoke tests..."
npm test

echo "✅ SRP setup complete! You can now run 'srp audit' or 'srp dev' from the CLI."
