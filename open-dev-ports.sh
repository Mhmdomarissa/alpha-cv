#!/bin/bash

# Script to open development ports in EC2 Security Group
# This requires AWS CLI to be configured

set -e

echo "=========================================="
echo "Opening Development Ports in EC2"
echo "=========================================="
echo ""

# Get instance metadata
INSTANCE_ID=$(ec2-metadata --instance-id | cut -d " " -f 2)
REGION=$(ec2-metadata --availability-zone | cut -d " " -f 2 | sed 's/[a-z]$//')

echo "Instance ID: $INSTANCE_ID"
echo "Region: $REGION"
echo ""

# Get security group ID
SECURITY_GROUP_ID=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --region $REGION \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' \
  --output text)

echo "Security Group ID: $SECURITY_GROUP_ID"
echo ""

# Add port 3001 (Dev Frontend)
echo "Opening port 3001 (Dev Frontend)..."
aws ec2 authorize-security-group-ingress \
  --group-id $SECURITY_GROUP_ID \
  --protocol tcp \
  --port 3001 \
  --cidr 0.0.0.0/0 \
  --region $REGION \
  --description "Dev Frontend" 2>/dev/null && echo "✓ Port 3001 opened" || echo "⚠ Port 3001 already open or error occurred"

# Add port 8001 (Dev Backend)
echo "Opening port 8001 (Dev Backend)..."
aws ec2 authorize-security-group-ingress \
  --group-id $SECURITY_GROUP_ID \
  --protocol tcp \
  --port 8001 \
  --cidr 0.0.0.0/0 \
  --region $REGION \
  --description "Dev Backend" 2>/dev/null && echo "✓ Port 8001 opened" || echo "⚠ Port 8001 already open or error occurred"

echo ""
echo "=========================================="
echo "Ports Configuration Complete!"
echo "=========================================="
echo ""
echo "You can now access:"
echo "  Dev Frontend: http://$(ec2-metadata --public-ipv4 | cut -d ' ' -f 2):3001"
echo "  Dev Backend:  http://$(ec2-metadata --public-ipv4 | cut -d ' ' -f 2):8001"
echo ""
echo "Note: If you see errors about ports already being open, that's fine!"
echo ""
