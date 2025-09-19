# AWS Deployment Guide for Alpha CV System

## Prerequisites

1. AWS CLI configured with appropriate permissions
2. Docker installed on your local machine
3. Git repository access
4. Domain name configured (optional)

## Step 1: Create IAM Roles and Policies

### 1.1 Create EC2 Instance Profile
```bash
# Create IAM role for EC2 instances
aws iam create-role \
    --role-name AlphaCV-EC2-Role \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "ec2.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }'

# Attach policies
aws iam attach-role-policy \
    --role-name AlphaCV-EC2-Role \
    --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

aws iam attach-role-policy \
    --role-name AlphaCV-EC2-Role \
    --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

# Create instance profile
aws iam create-instance-profile \
    --instance-profile-name AlphaCV-EC2-InstanceProfile

aws iam add-role-to-instance-profile \
    --instance-profile-name AlphaCV-EC2-InstanceProfile \
    --role-name AlphaCV-EC2-Role
```

## Step 2: Create Security Groups

### 2.1 Load Balancer Security Group
```bash
# Create security group for ALB
aws ec2 create-security-group \
    --group-name alpha-cv-alb-sg \
    --description "Security group for Alpha CV Application Load Balancer"

# Allow HTTP and HTTPS traffic
aws ec2 authorize-security-group-ingress \
    --group-name alpha-cv-alb-sg \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-name alpha-cv-alb-sg \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0
```

### 2.2 Backend Security Group
```bash
# Create security group for backend instances
aws ec2 create-security-group \
    --group-name alpha-cv-backend-sg \
    --description "Security group for Alpha CV backend instances"

# Allow traffic from ALB
aws ec2 authorize-security-group-ingress \
    --group-name alpha-cv-backend-sg \
    --protocol tcp \
    --port 8000 \
    --source-group alpha-cv-alb-sg

# Allow SSH access (replace with your IP)
aws ec2 authorize-security-group-ingress \
    --group-name alpha-cv-backend-sg \
    --protocol tcp \
    --port 22 \
    --cidr YOUR_IP_ADDRESS/32
```

## Step 3: Create Launch Template

### 3.1 Create User Data Script
```bash
#!/bin/bash
# Save as user-data.sh

# Update system
sudo yum update -y

# Install Docker
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo yum install -y git

# Clone repository
cd /home/ec2-user
git clone https://github.com/your-repo/alpha-cv.git
cd alpha-cv

# Copy production environment
cp env.production.example .env
# Edit .env with your actual values

# Start services
docker-compose up -d

# Install CloudWatch agent
sudo yum install -y amazon-cloudwatch-agent
```

### 3.2 Create Launch Template
```bash
# Create launch template
aws ec2 create-launch-template \
    --launch-template-name alpha-cv-production \
    --version-description "Production Alpha CV system" \
    --launch-template-data '{
        "ImageId": "ami-0c02fb55956c7d316",
        "InstanceType": "c5.2xlarge",
        "KeyName": "your-key-pair-name",
        "SecurityGroupIds": ["sg-xxxxxxxxx"],
        "UserData": "'$(base64 -w 0 user-data.sh)'",
        "IamInstanceProfile": {
            "Name": "AlphaCV-EC2-InstanceProfile"
        },
        "BlockDeviceMappings": [
            {
                "DeviceName": "/dev/xvda",
                "Ebs": {
                    "VolumeSize": 100,
                    "VolumeType": "gp3",
                    "DeleteOnTermination": true,
                    "Encrypted": true
                }
            }
        ],
        "TagSpecifications": [
            {
                "ResourceType": "instance",
                "Tags": [
                    {
                        "Key": "Name",
                        "Value": "AlphaCV-Production"
                    },
                    {
                        "Key": "Environment",
                        "Value": "production"
                    }
                ]
            }
        ]
    }'
```

## Step 4: Create Application Load Balancer

### 4.1 Create Target Group
```bash
# Create target group
aws elbv2 create-target-group \
    --name alpha-cv-tg \
    --protocol HTTP \
    --port 8000 \
    --vpc-id vpc-xxxxxxxxx \
    --target-type instance \
    --health-check-path /health \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3
```

### 4.2 Create Load Balancer
```bash
# Create application load balancer
aws elbv2 create-load-balancer \
    --name alpha-cv-alb \
    --subnets subnet-xxxxxxxxx subnet-yyyyyyyyy \
    --security-groups sg-xxxxxxxxx \
    --scheme internet-facing \
    --type application \
    --ip-address-type ipv4
```

### 4.3 Create Listener
```bash
# Create listener
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:region:account:loadbalancer/app/alpha-cv-alb/xxxxxxxxx \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:region:account:targetgroup/alpha-cv-tg/xxxxxxxxx
```

## Step 5: Create Auto Scaling Group

### 5.1 Create Auto Scaling Group
```bash
# Create auto scaling group
aws autoscaling create-auto-scaling-group \
    --auto-scaling-group-name alpha-cv-asg \
    --launch-template LaunchTemplateName=alpha-cv-production,Version='$Latest' \
    --min-size 2 \
    --max-size 10 \
    --desired-capacity 2 \
    --vpc-zone-identifier "subnet-xxxxxxxxx,subnet-yyyyyyyyy" \
    --target-group-arns arn:aws:elasticloadbalancing:region:account:targetgroup/alpha-cv-tg/xxxxxxxxx \
    --health-check-type ELB \
    --health-check-grace-period 300
```

### 5.2 Create Scaling Policies
```bash
# Create CPU-based scaling policy
aws autoscaling put-scaling-policy \
    --auto-scaling-group-name alpha-cv-asg \
    --policy-name ScaleUp-CPU \
    --policy-type TargetTrackingScaling \
    --target-tracking-configuration '{
        "TargetValue": 70.0,
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "ASGAverageCPUUtilization"
        },
        "ScaleOutCooldown": 300,
        "ScaleInCooldown": 300
    }'
```

## Step 6: Set up CloudWatch Monitoring

### 6.1 Create CloudWatch Alarms
```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
    --alarm-name AlphaCV-High-CPU \
    --alarm-description "High CPU utilization for Alpha CV" \
    --metric-name CPUUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --alarm-actions arn:aws:sns:region:account:alpha-cv-alerts

# High memory alarm
aws cloudwatch put-metric-alarm \
    --alarm-name AlphaCV-High-Memory \
    --alarm-description "High memory utilization for Alpha CV" \
    --metric-name MemoryUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 85 \
    --comparison-operator GreaterThanThreshold \
    --alarm-actions arn:aws:sns:region:account:alpha-cv-alerts
```

## Step 7: Database Setup (Optional)

### 7.1 Create RDS Instance
```bash
# Create RDS subnet group
aws rds create-db-subnet-group \
    --db-subnet-group-name alpha-cv-db-subnet-group \
    --db-subnet-group-description "Subnet group for Alpha CV database" \
    --subnet-ids subnet-xxxxxxxxx subnet-yyyyyyyyy

# Create RDS instance
aws rds create-db-instance \
    --db-instance-identifier alpha-cv-db \
    --db-instance-class db.t3.medium \
    --engine postgres \
    --master-username cv_user \
    --master-user-password your-secure-password \
    --allocated-storage 100 \
    --storage-type gp2 \
    --vpc-security-group-ids sg-xxxxxxxxx \
    --db-subnet-group-name alpha-cv-db-subnet-group \
    --backup-retention-period 7 \
    --multi-az \
    --storage-encrypted
```

## Step 8: SSL Certificate (Optional)

### 8.1 Request SSL Certificate
```bash
# Request certificate
aws acm request-certificate \
    --domain-name alphacv.alphadatarecruitment.ae \
    --validation-method DNS \
    --subject-alternative-names www.alphacv.alphadatarecruitment.ae
```

## Step 9: Deployment Commands

### 9.1 Deploy to Production
```bash
# Update launch template with new version
aws ec2 create-launch-template-version \
    --launch-template-name alpha-cv-production \
    --version-description "Updated version" \
    --source-version 1 \
    --launch-template-data '{
        "ImageId": "ami-0c02fb55956c7d316",
        "InstanceType": "c5.2xlarge",
        "KeyName": "your-key-pair-name",
        "SecurityGroupIds": ["sg-xxxxxxxxx"],
        "UserData": "'$(base64 -w 0 user-data.sh)'",
        "IamInstanceProfile": {
            "Name": "AlphaCV-EC2-InstanceProfile"
        }
    }'

# Update auto scaling group to use new version
aws autoscaling update-auto-scaling-group \
    --auto-scaling-group-name alpha-cv-asg \
    --launch-template LaunchTemplateName=alpha-cv-production,Version='$Latest'
```

## Step 10: Monitoring and Maintenance

### 10.1 Check System Status
```bash
# Check auto scaling group
aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names alpha-cv-asg

# Check load balancer
aws elbv2 describe-load-balancers \
    --names alpha-cv-alb

# Check target group health
aws elbv2 describe-target-health \
    --target-group-arn arn:aws:elasticloadbalancing:region:account:targetgroup/alpha-cv-tg/xxxxxxxxx
```

### 10.2 Scale Manually (if needed)
```bash
# Scale up
aws autoscaling set-desired-capacity \
    --auto-scaling-group-name alpha-cv-asg \
    --desired-capacity 5

# Scale down
aws autoscaling set-desired-capacity \
    --auto-scaling-group-name alpha-cv-asg \
    --desired-capacity 2
```

## Cost Optimization

### Expected Monthly Costs:
- **c5.2xlarge instances (2-10)**: $300-1500
- **Application Load Balancer**: $20
- **Data Transfer**: $50-100
- **CloudWatch**: $30-50
- **RDS (optional)**: $200-400

**Total**: $600-2070/month (scales with usage)

## Security Best Practices

1. **Use IAM roles** instead of access keys
2. **Enable VPC Flow Logs** for network monitoring
3. **Use AWS Secrets Manager** for sensitive data
4. **Enable AWS Config** for compliance monitoring
5. **Regular security updates** and patching
6. **Backup strategy** for databases and application data

## Troubleshooting

### Common Issues:
1. **Health check failures**: Check application logs and security groups
2. **Scaling issues**: Verify CloudWatch metrics and scaling policies
3. **Performance issues**: Monitor CPU, memory, and database connections
4. **SSL issues**: Verify certificate validation and listener configuration

### Useful Commands:
```bash
# View application logs
docker-compose logs -f backend

# Check system resources
htop
df -h
free -h

# Test load balancer
curl -I http://your-alb-dns-name
```
