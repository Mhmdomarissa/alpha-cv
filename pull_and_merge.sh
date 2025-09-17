#!/bin/bash
set -e

echo "=== Pulling and Merging Syed-dev Changes ==="

# Force kill any stuck processes
pkill -f less 2>/dev/null || true
pkill -f git 2>/dev/null || true

# Navigate to project directory
cd /home/ubuntu

echo "Current branch status:"
git branch

echo "Fetching latest changes from remote..."
git fetch origin

echo "Checking out main branch..."
git checkout main

echo "Pulling latest commit from Syed-dev branch..."
git pull origin Syed-dev

echo "Merge completed successfully!"

echo "Current status:"
git status

echo "Recent commits:"
git log --oneline -5

echo "=== Ready for rebuild ==="
