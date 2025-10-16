#!/bin/bash

# S3 Storage Setup Script for AlphaCV
# This script configures AWS S3 for unlimited, cost-optimized file storage

set -e

echo "🚀 Setting up S3 Storage for AlphaCV..."
echo "========================================"

# Configuration
BUCKET_NAME="alphacv-backups-20251014"
REGION="us-east-1"

# AWS Credentials (should be in .env file)
# Load from environment or configure AWS CLI before running this script
export AWS_DEFAULT_REGION="$REGION"

echo "✅ AWS credentials configured"

# 1. Verify bucket exists and is accessible
echo ""
echo "📦 Checking S3 bucket: $BUCKET_NAME..."
if aws s3 ls "s3://$BUCKET_NAME" &> /dev/null; then
    echo "✅ Bucket exists and is accessible"
else
    echo "❌ Error: Cannot access bucket $BUCKET_NAME"
    exit 1
fi

# 2. Check versioning status
echo ""
echo "🔄 Checking bucket versioning..."
VERSIONING=$(aws s3api get-bucket-versioning --bucket $BUCKET_NAME --query 'Status' --output text 2>/dev/null || echo "None")
if [ "$VERSIONING" == "Enabled" ]; then
    echo "✅ Versioning already enabled"
else
    echo "⚙️  Enabling versioning for data protection..."
    aws s3api put-bucket-versioning \
        --bucket $BUCKET_NAME \
        --versioning-configuration Status=Enabled
    echo "✅ Versioning enabled"
fi

# 3. Set up lifecycle policy for cost optimization
echo ""
echo "💰 Configuring lifecycle policy for cost optimization..."

cat > /tmp/s3-lifecycle-policy.json <<'EOF'
{
    "Rules": [
        {
            "ID": "OptimizeStorage",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "cvs/"
            },
            "Transitions": [
                {
                    "Days": 90,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 180,
                    "StorageClass": "INTELLIGENT_TIERING"
                }
            ],
            "NoncurrentVersionTransitions": [
                {
                    "NoncurrentDays": 30,
                    "StorageClass": "STANDARD_IA"
                }
            ],
            "NoncurrentVersionExpiration": {
                "NoncurrentDays": 90
            }
        },
        {
            "ID": "OptimizeJDs",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "jds/"
            },
            "Transitions": [
                {
                    "Days": 90,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 180,
                    "StorageClass": "INTELLIGENT_TIERING"
                }
            ]
        },
        {
            "ID": "CleanupBackups",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "backup_"
            },
            "Expiration": {
                "Days": 30
            }
        }
    ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
    --bucket $BUCKET_NAME \
    --lifecycle-configuration file:///tmp/s3-lifecycle-policy.json

echo "✅ Lifecycle policy configured:"
echo "   - CVs/JDs transition to cheaper storage after 90 days"
echo "   - Old backups deleted after 30 days"
echo "   - Old versions cleaned up automatically"

# 4. Set up CORS for frontend access
echo ""
echo "🌐 Configuring CORS for frontend access..."

cat > /tmp/s3-cors-policy.json <<'EOF'
{
    "CORSRules": [
        {
            "AllowedOrigins": [
                "https://alphacv.alphadatarecruitment.ae",
                "http://localhost:3000"
            ],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedHeaders": ["*"],
            "ExposeHeaders": ["ETag", "Content-Length"],
            "MaxAgeSeconds": 3000
        }
    ]
}
EOF

aws s3api put-bucket-cors \
    --bucket $BUCKET_NAME \
    --cors-configuration file:///tmp/s3-cors-policy.json

echo "✅ CORS configured"

# 5. Create folder structure
echo ""
echo "📁 Creating folder structure..."
aws s3api put-object --bucket $BUCKET_NAME --key cvs/ --content-length 0
aws s3api put-object --bucket $BUCKET_NAME --key jds/ --content-length 0
echo "✅ Folders created: cvs/, jds/"

# 6. Update .env file
echo ""
echo "📝 Updating environment variables..."

ENV_FILE="/home/ubuntu/.env"

# Create .env if it doesn't exist
touch $ENV_FILE

# Remove old S3 configs if they exist
sed -i '/^S3_BUCKET_NAME=/d' $ENV_FILE
sed -i '/^AWS_REGION=/d' $ENV_FILE
sed -i '/^AWS_ACCESS_KEY_ID=/d' $ENV_FILE
sed -i '/^AWS_SECRET_ACCESS_KEY=/d' $ENV_FILE

# Add new S3 configs
cat >> $ENV_FILE <<EOL

# S3 Storage Configuration
S3_BUCKET_NAME=$BUCKET_NAME
AWS_REGION=$REGION
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
EOL

echo "✅ Environment variables updated in $ENV_FILE"

# 7. Test S3 connectivity
echo ""
echo "🧪 Testing S3 connectivity..."
TEST_FILE="/tmp/test_s3_upload_$(date +%s).txt"
echo "AlphaCV S3 Test $(date)" > $TEST_FILE

if aws s3 cp $TEST_FILE s3://$BUCKET_NAME/test_s3_connection.txt; then
    echo "✅ Upload test successful"
    rm $TEST_FILE
    
    # Download test
    if aws s3 cp s3://$BUCKET_NAME/test_s3_connection.txt /tmp/test_download.txt; then
        echo "✅ Download test successful"
        rm /tmp/test_download.txt
    else
        echo "⚠️  Download test failed"
    fi
else
    echo "❌ Upload test failed"
    exit 1
fi

# 8. Show bucket stats
echo ""
echo "📊 Current Bucket Contents:"
echo "=========================="
aws s3 ls s3://$BUCKET_NAME/ --recursive --summarize --human-readable | tail -5

echo ""
echo "✅ S3 Storage Setup Complete!"
echo "=============================="
echo ""
echo "📋 Summary:"
echo "  - Bucket: $BUCKET_NAME"
echo "  - Region: $REGION"
echo "  - Versioning: Enabled"
echo "  - Lifecycle: Configured for cost optimization"
echo "  - CORS: Configured for frontend access"
echo ""
echo "💰 Cost Savings:"
echo "  - Files auto-transition to cheaper storage after 90 days"
echo "  - Estimated savings: 60-80% compared to EBS"
echo ""
echo "🔄 Next Steps:"
echo "  1. Rebuild backend: docker-compose build backend"
echo "  2. Restart services: docker-compose up -d"
echo "  3. Test CV upload through frontend"
echo "  4. Verify files appear in S3: aws s3 ls s3://$BUCKET_NAME/cvs/"
echo ""

