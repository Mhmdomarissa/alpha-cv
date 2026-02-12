# EC2 g4dn.xlarge Setup Guide

## Overview

Complete guide for setting up **2 EC2 g4dn.xlarge instances**:
- **PROD Server**: Production environment
- **DEV Server**: Development environment (same config, different data)

Both use `docker-compose.yml` (production configuration).

---

## EBS Storage Requirements

### Recommended: **100 GB EBS Volume**

**Breakdown**:
- **Operating System**: ~20 GB
- **Docker Images**: ~15 GB (backend, frontend, postgres, qdrant, redis, nginx)
- **PostgreSQL Database**: ~10-20 GB (grows with usage)
- **Qdrant Vector Database**: ~20-30 GB (embeddings, CVs, JDs)
- **Redis Cache**: ~2-5 GB
- **Uploaded Files**: ~5-10 GB (CVs, JDs, PDFs)
- **Logs & Temporary Files**: ~5 GB
- **Buffer for Growth**: ~10-15 GB

**Minimum**: 50 GB (tight, may need expansion)  
**Recommended**: 100 GB (comfortable for 20+ users)  
**Optimal**: 150 GB (room for growth)

### Storage Type Recommendation
- **GP3 SSD** (recommended): Good performance, cost-effective
- **GP2 SSD**: Alternative if GP3 not available
- **IOPS**: 3000 IOPS (default GP3 is fine)

---

## EC2 Instance Configuration

### Instance Type
- **Type**: g4dn.xlarge
- **vCPU**: 4
- **RAM**: 16 GB
- **GPU**: 1x NVIDIA T4 (16 GB)
- **Network**: Up to 25 Gbps

### EBS Configuration
- **Size**: 100 GB (recommended)
- **Type**: gp3 (or gp2)
- **IOPS**: 3000 (default for gp3)
- **Throughput**: 125 MB/s (default for gp3)

---

## Initial Setup (Run Once on Each Server)

### Step 1: Launch EC2 Instance

1. **Launch Instance**:
   - AMI: Ubuntu 22.04 LTS (or 20.04)
   - Instance Type: g4dn.xlarge
   - Storage: 100 GB gp3
   - Security Group: Allow SSH (22), HTTP (80), HTTPS (443)

2. **Connect to Instance**:
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

### Step 2: Run Setup Script

```bash
# Clone repository first (if not using setup script)
cd /home/ubuntu
git clone <YOUR_REPO_URL> alpha-cv
cd alpha-cv

# Run setup script
chmod +x scripts/setup-ec2.sh
./scripts/setup-ec2.sh prod  # or 'dev' for dev server
```

**What the setup script does**:
1. ✅ Updates system packages
2. ✅ Installs Docker
3. ✅ Installs Docker Compose
4. ✅ Installs NVIDIA Docker runtime
5. ✅ Installs Git
6. ✅ Clones repository
7. ✅ Creates necessary directories
8. ✅ Sets up environment file
9. ✅ Makes scripts executable
10. ✅ Optionally starts application

### Step 3: Configure Environment

```bash
cd /home/ubuntu/alpha-cv
nano .env
```

**Required variables** (see `.env.example`):
- `POSTGRES_PASSWORD` - Database password
- `SECRET_KEY` - JWT secret key
- `OPENAI_API_KEY` - OpenAI API key
- `ADMIN_USERNAME` - Admin username
- `ADMIN_PASSWORD` - Admin password
- Azure email credentials (if using email features)

### Step 4: Start Application

```bash
cd /home/ubuntu/alpha-cv
./scripts/start.sh
```

**First start will**:
- Pull all Docker images (~10-15 minutes)
- Initialize PostgreSQL database
- Initialize Qdrant collections
- Start all services

---

## Workflow

### Development Server Setup

```bash
# 1. Run setup
./scripts/setup-ec2.sh dev

# 2. Configure .env
nano .env

# 3. Start application
./scripts/start.sh
```

**Development Workflow**:
```bash
# Make changes
cd /home/ubuntu/alpha-cv
# ... edit code ...

# Test locally
./scripts/start.sh  # Restart if needed

# Commit and push
git add .
git commit -m "Your feature"
git push origin syed-dev
```

### Production Server Setup

```bash
# 1. Run setup
./scripts/setup-ec2.sh prod

# 2. Configure .env (production values)
nano .env

# 3. Start application
./scripts/start.sh
```

**Production Deployment**:
```bash
# After merging syed-dev → main on GitHub:

# On PROD server
cd /home/ubuntu/alpha-cv
./scripts/deploy.sh
```

---

## Complete Setup Checklist

### Initial Setup (Both Servers)
- [ ] Launch EC2 g4dn.xlarge instance
- [ ] Attach 100 GB EBS volume
- [ ] Configure security group (SSH, HTTP, HTTPS)
- [ ] Connect via SSH
- [ ] Run `./scripts/setup-ec2.sh`
- [ ] Configure `.env` file
- [ ] Run `./scripts/start.sh`
- [ ] Verify services: `curl http://localhost/api/health`
- [ ] Set up SSL certificate (production)
- [ ] Configure firewall
- [ ] Set up backups

### After Setup
- [ ] Test application access
- [ ] Verify database connections
- [ ] Test file uploads
- [ ] Monitor disk usage
- [ ] Set up monitoring

---

## Storage Monitoring

### Check Disk Usage
```bash
# Overall disk usage
df -h

# Docker disk usage
docker system df

# Volume sizes
docker volume ls
docker system df -v
```

### Expected Usage After Setup
- **System**: ~20 GB
- **Docker Images**: ~15 GB
- **Volumes**: ~5-10 GB (empty databases)
- **Total**: ~40-45 GB initially

### Growth Over Time
- **Database**: ~1-2 GB per 1000 CVs/JDs
- **Qdrant**: ~2-3 GB per 1000 embeddings
- **Uploads**: ~100-500 MB per 100 files
- **Logs**: ~1-2 GB per month

**With 20 users**: Expect ~50-70 GB total after 6 months

---

## Troubleshooting

### Out of Disk Space
```bash
# Check usage
df -h

# Clean Docker
docker system prune -a  # Removes unused images
docker volume prune     # Removes unused volumes (CAREFUL!)

# Expand EBS volume (AWS Console)
# Then resize filesystem:
sudo growpart /dev/nvme0n1 1
sudo resize2fs /dev/nvme0n1p1
```

### Services Won't Start
```bash
# Check logs
docker-compose logs -f

# Check disk space
df -h

# Check memory
free -h

# Restart Docker
sudo systemctl restart docker
```

### GPU Not Working
```bash
# Check NVIDIA driver
nvidia-smi

# Test GPU in Docker
docker run --rm --gpus all nvidia/cuda:11.0.3-base-ubuntu20.04 nvidia-smi
```

---

## Security Recommendations

### 1. Firewall Setup
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 2. SSL Certificate
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com
```

### 3. Environment Variables
- **NEVER commit `.env` files**
- Use strong passwords
- Rotate keys regularly
- Use AWS Secrets Manager (optional)

---

## Backup Strategy

### Automated Backups
```bash
# Use backup script
./scripts/backup/backup_uncompressed.sh

# Schedule daily backups (crontab)
0 2 * * * /home/ubuntu/alpha-cv/scripts/backup/backup_uncompressed.sh
```

### Manual Backup
```bash
# Backup volumes
docker run --rm -v alpha-cv_postgres_data:/data -v $(pwd):/backup ubuntu tar czf /backup/postgres_backup.tar.gz /data
docker run --rm -v alpha-cv_qdrant_data:/data -v $(pwd):/backup ubuntu tar czf /backup/qdrant_backup.tar.gz /data
```

---

## Cost Estimation (Monthly)

### EC2 g4dn.xlarge
- **Instance**: ~$0.50/hour = ~$360/month
- **EBS 100GB gp3**: ~$8/month
- **Data Transfer**: ~$10-20/month
- **Total**: ~$380-400/month per server

### Two Servers (DEV + PROD)
- **Total**: ~$760-800/month

---

## Quick Start Commands

### First Time Setup
```bash
cd /home/ubuntu
git clone <YOUR_REPO_URL> alpha-cv
cd alpha-cv
chmod +x scripts/setup-ec2.sh
./scripts/setup-ec2.sh prod  # or 'dev'
nano .env  # Configure
./scripts/start.sh
```

### Daily Operations
```bash
# Start
./scripts/start.sh

# Stop
./scripts/stop.sh

# Deploy
./scripts/deploy.sh

# View logs
docker-compose logs -f
```

---

## Summary

✅ **EBS Storage**: 100 GB recommended (50 GB minimum)  
✅ **Setup Script**: `./scripts/setup-ec2.sh`  
✅ **Start Script**: `./scripts/start.sh`  
✅ **Deploy Script**: `./scripts/deploy.sh`  
✅ **Same Config**: Both servers use `docker-compose.yml`  
✅ **Data Safe**: All scripts preserve data volumes

**Your application is ready for production!** 🚀
