# EC2 Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Launch EC2 Instance
- **Type**: g4dn.xlarge
- **Storage**: 100 GB gp3 EBS
- **AMI**: Ubuntu 22.04 LTS
- **Security Group**: SSH (22), HTTP (80), HTTPS (443)

### Step 2: Connect & Setup
```bash
# Connect
ssh -i your-key.pem ubuntu@your-ec2-ip

# Clone and setup
cd /home/ubuntu
git clone <YOUR_REPO_URL> alpha-cv
cd alpha-cv
chmod +x scripts/setup-ec2.sh
./scripts/setup-ec2.sh prod  # or 'dev'
```

### Step 3: Configure & Start
```bash
# Configure environment
nano .env

# Start application
./scripts/start.sh
```

**Done!** Your application is running.

---

## 📊 EBS Storage Recommendation

### Recommended: **100 GB**

**Breakdown**:
- System + Docker: ~35 GB
- Databases (empty): ~5 GB
- **Growth for 20 users**: ~50-60 GB over 6 months
- **Buffer**: ~10 GB

**Minimum**: 50 GB (tight)  
**Optimal**: 100 GB (comfortable)

---

## 🔄 Workflow

### Development Server
```bash
# 1. Make changes
cd /home/ubuntu/alpha-cv
# ... edit code ...

# 2. Test
./scripts/start.sh  # Restart if needed

# 3. Commit & push
git add .
git commit -m "Feature"
git push origin syed-dev
```

### Production Server
```bash
# After merging syed-dev → main on GitHub:

cd /home/ubuntu/alpha-cv
./scripts/deploy.sh
```

---

## 📝 Commands Reference

```bash
# Start system
./scripts/start.sh

# Stop system
./scripts/stop.sh

# Deploy latest code
./scripts/deploy.sh

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

---

## ✅ Checklist

- [ ] Launch EC2 g4dn.xlarge (100 GB EBS)
- [ ] Run `./scripts/setup-ec2.sh`
- [ ] Configure `.env` file
- [ ] Run `./scripts/start.sh`
- [ ] Verify: `curl http://localhost/api/health`
- [ ] Set up SSL (production)
- [ ] Configure firewall

---

**Full guide**: See `docs/deployment/EC2_SETUP_GUIDE.md`
