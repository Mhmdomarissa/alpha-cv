# EC2 Deployment Summary

## ✅ Answers to Your Questions

### 1. EBS Storage Size
**Answer: 100 GB recommended**

**Why**:
- System + Docker: ~35 GB
- Empty databases: ~5 GB
- Growth for 20 users (6 months): ~50-60 GB
- Buffer: ~10 GB
- **Total: ~100 GB**

**Minimum**: 50 GB (tight, may need expansion)  
**Recommended**: 100 GB (comfortable)  
**Optimal**: 150 GB (room for growth)

---

### 2. Which Script to Run on EC2?
**Answer: `./scripts/setup-ec2.sh` (run once), then `./scripts/start.sh`**

**First Time Setup**:
```bash
cd /home/ubuntu
git clone <YOUR_REPO_URL> alpha-cv
cd alpha-cv
chmod +x scripts/setup-ec2.sh
./scripts/setup-ec2.sh prod  # or 'dev'
nano .env  # Configure
./scripts/start.sh
```

**What `setup-ec2.sh` does**:
- ✅ Installs Docker
- ✅ Installs Docker Compose
- ✅ Installs NVIDIA Docker (for GPU)
- ✅ Clones repository
- ✅ Creates directories
- ✅ Sets up environment
- ✅ Optionally starts application

**After setup, use**:
- `./scripts/start.sh` - Start system
- `./scripts/stop.sh` - Stop system
- `./scripts/deploy.sh` - Deploy latest code

---

### 3. Both Servers Use Same Config?
**Answer: YES - Both use `docker-compose.yml` (production config)**

- **DEV Server**: Uses `docker-compose.yml`
- **PROD Server**: Uses `docker-compose.yml`
- **Only difference**: `.env` file values (API keys, passwords, etc.)

---

### 4. Complete Workflow

#### Step 1: Push Code to syed-dev Branch
```bash
# On your local machine or DEV server
git add .
git commit -m "Your changes"
git push origin syed-dev
```

#### Step 2: Merge to main (GitHub)
- Create Pull Request: `syed-dev` → `main`
- Review and merge

#### Step 3: Setup DEV Server (EC2)
```bash
# Connect to DEV EC2
ssh -i key.pem ubuntu@dev-ec2-ip

# Setup (run once)
cd /home/ubuntu
git clone <YOUR_REPO_URL> alpha-cv
cd alpha-cv
./scripts/setup-ec2.sh dev
nano .env  # Configure
./scripts/start.sh
```

**DEV Server Workflow**:
```bash
# Make changes
cd /home/ubuntu/alpha-cv
# ... edit code ...

# Test
./scripts/start.sh  # Restart if needed

# Commit and push
git add .
git commit -m "Feature"
git push origin syed-dev
```

#### Step 4: Setup PROD Server (EC2)
```bash
# Connect to PROD EC2
ssh -i key.pem ubuntu@prod-ec2-ip

# Setup (run once)
cd /home/ubuntu
git clone <YOUR_REPO_URL> alpha-cv
cd alpha-cv
./scripts/setup-ec2.sh prod
nano .env  # Configure with production values
./scripts/start.sh
```

**PROD Server Workflow**:
```bash
# After merging syed-dev → main on GitHub:

cd /home/ubuntu/alpha-cv
./scripts/deploy.sh
```

**What `deploy.sh` does**:
1. Pulls latest code from `main` branch
2. Rebuilds Docker images
3. Gracefully restarts services
4. **NEVER touches data volumes**

---

## 📋 Complete Setup Checklist

### DEV Server
- [ ] Launch EC2 g4dn.xlarge (100 GB EBS)
- [ ] Configure security group (SSH, HTTP, HTTPS)
- [ ] Connect via SSH
- [ ] Run `./scripts/setup-ec2.sh dev`
- [ ] Configure `.env` file
- [ ] Run `./scripts/start.sh`
- [ ] Verify: `curl http://localhost/api/health`

### PROD Server
- [ ] Launch EC2 g4dn.xlarge (100 GB EBS)
- [ ] Configure security group (SSH, HTTP, HTTPS)
- [ ] Connect via SSH
- [ ] Run `./scripts/setup-ec2.sh prod`
- [ ] Configure `.env` file (production values)
- [ ] Run `./scripts/start.sh`
- [ ] Verify: `curl http://localhost/api/health`
- [ ] Set up SSL certificate
- [ ] Configure firewall

---

## 🔄 Daily Workflow

### On DEV Server
```bash
# 1. Make changes
cd /home/ubuntu/alpha-cv
# ... edit code ...

# 2. Test
./scripts/start.sh  # Restart if needed

# 3. Commit and push
git add .
git commit -m "Your feature"
git push origin syed-dev
```

### Merge to Production
1. GitHub: Create PR `syed-dev` → `main`
2. Review and merge

### On PROD Server
```bash
# Deploy latest code
cd /home/ubuntu/alpha-cv
./scripts/deploy.sh
```

---

## 📊 Storage Breakdown

### Initial Setup
- System: ~20 GB
- Docker Images: ~15 GB
- Empty Databases: ~5 GB
- **Total: ~40 GB**

### After 6 Months (20 users)
- System: ~20 GB
- Docker Images: ~15 GB
- Databases: ~25 GB
- Qdrant (embeddings): ~20 GB
- Uploads: ~5 GB
- Logs: ~5 GB
- **Total: ~90 GB**

**Recommendation: 100 GB EBS volume**

---

## 🛠️ Scripts Reference

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `setup-ec2.sh` | Initial EC2 setup | **Once** on new server |
| `start.sh` | Start all services | Daily operations |
| `stop.sh` | Stop all services | Daily operations |
| `deploy.sh` | Deploy latest code | After merging to main |

---

## 🔐 Environment Configuration

### DEV Server `.env`
```bash
ENVIRONMENT=development
ADMIN_USERNAME=admin
ADMIN_PASSWORD=dev_password
# ... other dev values
```

### PROD Server `.env`
```bash
ENVIRONMENT=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=strong_prod_password
# ... other production values
```

**Important**: Never commit `.env` files!

---

## ✅ Summary

1. **EBS Storage**: 100 GB recommended
2. **Setup Script**: `./scripts/setup-ec2.sh` (run once)
3. **Start Script**: `./scripts/start.sh` (daily)
4. **Deploy Script**: `./scripts/deploy.sh` (after merge)
5. **Same Config**: Both servers use `docker-compose.yml`
6. **Workflow**: DEV → syed-dev → main → PROD

**Your application is ready for deployment!** 🚀

---

## 📚 Documentation

- **Quick Start**: `docs/deployment/EC2_QUICK_START.md`
- **Complete Guide**: `docs/deployment/EC2_SETUP_GUIDE.md`
- **Unified Scripts**: `docs/deployment/UNIFIED_SCRIPTS.md`
