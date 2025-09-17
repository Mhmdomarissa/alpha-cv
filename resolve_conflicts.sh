#!/bin/bash
set -e

echo "=== Resolving Git Conflicts ==="

# Check git status
echo "Current git status:"
git status --porcelain

echo "Removing conflict markers from files..."

# Remove conflict markers from api.ts
sed -i '/^<<<<<<< HEAD$/d' cv-analyzer-frontend/src/lib/api.ts
sed -i '/^=======$/d' cv-analyzer-frontend/src/lib/api.ts  
sed -i '/^>>>>>>> 34a00ca37d75abea9c6549d6160122bdba4aadfa$/d' cv-analyzer-frontend/src/lib/api.ts

# Remove conflict markers from CareersPage.tsx  
sed -i '/^<<<<<<< HEAD$/d' cv-analyzer-frontend/src/components/careers/CareersPage.tsx
sed -i '/^=======$/d' cv-analyzer-frontend/src/components/careers/CareersPage.tsx
sed -i '/^>>>>>>> 34a00ca37d75abea9c6549d6160122bdba4aadfa$/d' cv-analyzer-frontend/src/components/careers/CareersPage.tsx

echo "Adding resolved files to git..."
git add alpha-backend/app/routes/careers_routes.py
git add cv-analyzer-frontend/src/lib/api.ts  
git add cv-analyzer-frontend/src/components/careers/CareersPage.tsx

echo "Committing the merge..."
git commit -m "Merge Syed-dev: combine user attribution, delete functionality, and store improvements"

echo "=== Conflicts resolved and merged! ==="
git status

echo "Recent commits:"
git log --oneline -3
