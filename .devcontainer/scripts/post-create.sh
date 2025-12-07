#!/bin/bash
set -e

echo ""
echo "🚀 Setting up Hexland development environment..."
echo ""

# # Check if workspace needs to be initialized from staging
# if [ ! -f "/workspace/.git/config" ]; then
#     echo "📋 First-time setup: Copying project from Windows into container volume..."
#     echo "   This avoids permission issues with bind mounts."
#     echo ""

#     # Copy everything from staging mount to workspace
#     # Exclude .git initially to avoid permission issues, we'll copy it separately
#     rsync -av --exclude='.git' --exclude='node_modules' --exclude='.usercache' /workspace-staging/ /workspace/

#     # Copy .git directory
#     if [ -d "/workspace-staging/.git" ]; then
#         rsync -av /workspace-staging/.git/ /workspace/.git/
#     fi

#     echo "   ✅ Project files copied to container volume"
#     echo ""
# else
#     echo "ℹ️  Workspace already initialized (using existing container volume)"
#     echo ""
# fi

# Check for Firebase admin credentials
CREDS_FILE="/workspace/hexland-web/firebase-admin-credentials.json"
if [ ! -f "$CREDS_FILE" ]; then
    echo "⚠️  WARNING: Firebase admin credentials not found!"
    echo ""
    echo "📝 To enable full Firebase Functions and Firestore emulator functionality:"
    echo "   1. Open Firebase Console: https://console.firebase.google.com/"
    echo "   2. Select or create your Firebase project"
    echo "   3. Go to Project Settings > Service Accounts"
    echo "   4. Click 'Generate new private key'"
    echo "   5. Save the downloaded JSON file as:"
    echo "      hexland-web/firebase-admin-credentials.json"
    echo ""
    echo "   The dev container will work without this file, but some features"
    echo "   will be limited. You can add it later and restart the container."
    echo ""
else
    echo "✅ Firebase admin credentials found"
    echo ""
fi

# Install web app dependencies
echo "📦 Installing web app dependencies..."
cd /workspace/hexland-web
if [ -f "yarn.lock" ]; then
    echo "   Using yarn.lock for deterministic install..."
    yarn install --frozen-lockfile || yarn install
else
    yarn install
fi
echo ""

# Install Firebase Functions dependencies
echo "📦 Installing Firebase Functions dependencies..."
cd /workspace/hexland-web/functions
if [ -f "yarn.lock" ]; then
    echo "   Using yarn.lock for deterministic install..."
    yarn install --frozen-lockfile || yarn install
else
    yarn install
fi
echo ""

# Install Playwright browsers for E2E tests
echo "🎭 Installing Playwright browsers..."
cd /workspace/hexland-web
npx playwright install || echo "   Note: Playwright browser installation failed (non-critical)"
echo ""

# Firebase setup
echo "🔥 Setting up Firebase..."
cd /workspace/hexland-web

# Try to login (may already be logged in)
firebase login --no-localhost || echo "   Firebase login skipped (already logged in or running non-interactively)"

# Check if a Firebase project is configured
CURRENT_PROJECT=$(firebase use 2>/dev/null | grep "Now using" || echo "")
if [ -z "$CURRENT_PROJECT" ]; then
    echo "   No Firebase project configured yet."
    echo "   You can run 'firebase use <project-id>' to select a project"
    echo "   or 'firebase use --add' to add a new project alias."
else
    echo "   $CURRENT_PROJECT"
fi
echo ""

echo "✅ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Quick Start Guide"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Start development server:"
echo "    cd hexland-web && yarn start"
echo ""
echo "  Run unit tests:"
echo "    cd hexland-web && yarn test:unit"
echo ""
echo "  Run E2E tests (requires dev server running):"
echo "    cd hexland-web && yarn test:e2e"
echo ""
echo "  View this guide anytime:"
echo "    cat .devcontainer/README.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
