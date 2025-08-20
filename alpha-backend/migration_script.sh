#!/bin/bash

# Migration Script for CV Analyzer Backend Restructure
# This script helps migrate from old structure to new clean structure

set -e  # Exit on any error

echo "🏗️  CV Analyzer Backend Migration Script"
echo "========================================"

# Check if we're in the right directory
if [ ! -d "alpha-backend-new" ]; then
    echo "❌ Error: alpha-backend-new directory not found!"
    echo "Please run this script from the directory containing alpha-backend-new/"
    exit 1
fi

echo "📋 Step 1: Backing up current backend..."
if [ -d "alpha-backend" ]; then
    if [ -d "alpha-backend-backup" ]; then
        echo "⚠️  Backup already exists, removing old backup..."
        rm -rf alpha-backend-backup
    fi
    echo "💾 Creating backup: alpha-backend -> alpha-backend-backup"
    mv alpha-backend alpha-backend-backup
    echo "✅ Backup created successfully"
else
    echo "ℹ️  No existing alpha-backend directory found"
fi

echo ""
echo "📋 Step 2: Moving new structure into place..."
echo "🔄 Moving: alpha-backend-new -> alpha-backend"
mv alpha-backend-new alpha-backend
echo "✅ New structure moved successfully"

echo ""
echo "📋 Step 3: Updating permissions..."
chmod +x alpha-backend/migration_script.sh
echo "✅ Permissions updated"

echo ""
echo "📋 Step 4: Validating structure..."
echo "🔍 Checking required files..."

required_files=(
    "alpha-backend/app/main.py"
    "alpha-backend/app/routes/cv_routes.py"
    "alpha-backend/app/routes/jd_routes.py"
    "alpha-backend/app/routes/special_routes.py"
    "alpha-backend/app/services/parsing_service.py"
    "alpha-backend/app/services/llm_service.py"
    "alpha-backend/app/services/embedding_service.py"
    "alpha-backend/app/services/matching_service.py"
    "alpha-backend/app/utils/qdrant_utils.py"
    "alpha-backend/app/utils/cache.py"
    "alpha-backend/main.py"
    "alpha-backend/requirements.txt"
    "alpha-backend/Dockerfile"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    echo ""
    echo "❌ Missing required files:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    echo "Migration may be incomplete!"
    exit 1
fi

echo ""
echo "📋 Step 5: Testing basic functionality..."
cd alpha-backend

# Check if Python can import the main modules
echo "🐍 Testing Python imports..."
python3 -c "
try:
    from app.services.parsing_service import get_parsing_service
    from app.services.llm_service import get_llm_service
    from app.services.embedding_service import get_embedding_service
    from app.services.matching_service import get_matching_service
    from app.utils.qdrant_utils import get_qdrant_utils
    from app.utils.cache import get_cache_service
    print('✅ All imports successful')
except Exception as e:
    print(f'❌ Import error: {e}')
    exit(1)
"

echo ""
echo "📋 Step 6: Building Docker image..."
echo "🐳 Building new Docker image..."
if docker-compose build backend; then
    echo "✅ Docker build successful"
else
    echo "❌ Docker build failed"
    echo "Please check the build logs above"
    exit 1
fi

echo ""
echo "🎉 Migration Completed Successfully!"
echo "====================================="
echo ""
echo "📋 Next Steps:"
echo "1. Start the system:       docker-compose up -d"
echo "2. Check health:          curl http://localhost:8000/health-check"
echo "3. View API docs:         http://localhost:8000/docs"
echo "4. Test endpoints:        curl http://localhost:8000/api/cv/cvs"
echo ""
echo "📁 Directory structure:"
echo "- alpha-backend/          (NEW clean structure)"
echo "- alpha-backend-backup/   (OLD structure backup)"
echo ""
echo "⚠️  If everything works correctly, you can remove the backup:"
echo "   rm -rf alpha-backend-backup"
echo ""
echo "🚀 The CV Analyzer backend has been successfully restructured!"
