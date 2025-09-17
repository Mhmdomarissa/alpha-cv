#!/bin/bash
cd /home/ubuntu

echo "Adding resolved files..."
git add alpha-backend/app/routes/careers_routes.py
git add cv-analyzer-frontend/src/lib/api.ts  
git add cv-analyzer-frontend/src/components/careers/CareersPage.tsx

echo "Committing the merge..."
git commit -m "Merge Syed-dev: combine user attribution, delete functionality, and enhanced store management"

echo "=== Merge completed successfully! ==="
echo "Recent commits:"
git log --oneline -3
