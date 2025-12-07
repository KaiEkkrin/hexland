#!/bin/bash

echo ""
echo "🔄 Hexland dev container started!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Service Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  React Dev Server:        http://localhost:5000"
echo "  Firebase Emulator UI:    http://localhost:4000"
echo "  Firebase Hosting:        http://localhost:3400"
echo "  Firebase Functions:      http://localhost:5001"
echo "  Mock Storage (WebDAV):   http://localhost:7000"
echo "  Firestore Emulator:      localhost:8080"
echo "  Firebase Auth:           localhost:9099"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Tip: Run 'cd hexland-web && yarn start' to begin"
echo ""

# Verify mock-storage service is reachable
if curl -s --connect-timeout 2 http://mock-storage:80 > /dev/null 2>&1; then
    echo "✅ Mock storage service is ready"
else
    echo "⚠️  Mock storage service not responding (may still be starting up)"
fi

echo ""
