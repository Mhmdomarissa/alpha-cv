#!/bin/bash
set -e

echo "=== Pushing Latest Changes to Main Branch ==="

cd /home/ubuntu

# Kill any stuck processes
pkill -f less 2>/dev/null || true
pkill -f git 2>/dev/null || true

echo "🔍 Current git status:"
git status

echo "📝 Adding any remaining changes..."
git add . || true

echo "💾 Committing final integration fixes..."
git commit -m "Final integration fixes: API authentication, user attribution, and unified endpoint compatibility" || echo "Nothing to commit"

echo "📤 Pushing to main branch..."
git push origin main

echo "✅ Successfully pushed to main!"

echo "📊 Current branch and recent commits:"
git branch
echo ""
git log --oneline -5

echo "🎉 All changes pushed to GitHub main branch!"
