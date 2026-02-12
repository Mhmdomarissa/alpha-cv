# Unified Deployment Scripts

## Overview

All deployment scripts have been unified to use **production configuration** (`docker-compose.yml`) for both DEV and PROD servers.

---

## Available Scripts

### 1. Start System
**Location**: `scripts/start.sh`

**Usage**:
```bash
cd /home/ubuntu/alpha-cv
./scripts/start.sh
```

**Optional**: Rebuild images before starting
```bash
./scripts/start.sh rebuild
```

**What it does**:
- Stops existing containers (if any)
- Starts all services using `docker-compose.yml`
- Waits for services to be healthy
- Shows container status

---

### 2. Stop System
**Location**: `scripts/stop.sh`

**Usage**:
```bash
cd /home/ubuntu/alpha-cv
./scripts/stop.sh
```

**What it does**:
- Stops all services gracefully
- Removes containers (but **NOT volumes**)
- Verifies data volumes are preserved
- **Data is 100% safe**

---

### 3. Deploy Latest Code
**Location**: `scripts/deploy.sh`

**Usage**:
```bash
cd /home/ubuntu/alpha-cv
./scripts/deploy.sh
```

**What it does**:
1. Pulls latest code from `main` branch
2. Rebuilds Docker images (backend + frontend)
3. Gracefully restarts services
4. Verifies deployment
5. **NEVER touches data volumes**

**Safety Guarantees**:
- ✅ Docker volumes preserved
- ✅ Database data safe
- ✅ Uploaded files safe
- ✅ Embeddings safe

---

## Workflow

### Development Server (EC2)
```bash
# 1. Initial setup (run once)
cd /home/ubuntu
git clone <YOUR_REPO_URL> alpha-cv
cd alpha-cv
./scripts/setup-ec2.sh dev
nano .env  # Configure
./scripts/start.sh

# 2. Make changes
cd /home/ubuntu/alpha-cv
# ... edit code ...

# 3. Test locally
./scripts/start.sh  # Restart if needed

# 4. Commit and push
git add .
git commit -m "Your feature"
git push origin syed-dev
```

### Merge to Production
1. Create Pull Request: `syed-dev` → `main`
2. Review and merge on GitHub

### Production Server (EC2)
```bash
# Initial setup (run once)
cd /home/ubuntu
git clone <YOUR_REPO_URL> alpha-cv
cd alpha-cv
./scripts/setup-ec2.sh prod
nano .env  # Configure with production values
./scripts/start.sh

# Deploy latest code from main (after merge)
cd /home/ubuntu/alpha-cv
./scripts/deploy.sh
```

---

## Configuration

Both servers use the **same configuration**:
- **File**: `docker-compose.yml` (production config)
- **Environment**: `.env` file
- **No dev-specific configs needed**

---

## Removed Scripts

The following scripts have been **removed**:
- ❌ `start-system.sh` (root level)
- ❌ `stop-system.sh` (root level)
- ❌ `deploy.sh` (root level)
- ❌ `dev-start.sh`
- ❌ `dev-stop.sh`
- ❌ `scripts/system/start-system.sh`
- ❌ `scripts/system/stop-system.sh`
- ❌ `scripts/system/deploy.sh`
- ❌ `scripts/dev/dev-start.sh`
- ❌ `scripts/dev/dev-stop.sh`

**Replaced by**: Unified scripts in `scripts/` folder

---

## Benefits

1. ✅ **Simpler**: One set of scripts for both servers
2. ✅ **Consistent**: Same configuration everywhere
3. ✅ **Safe**: Data preservation guaranteed
4. ✅ **Clear**: Easy to understand workflow

---

## Quick Reference

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

## Troubleshooting

### Scripts not executable?
```bash
chmod +x scripts/*.sh
```

### Docker Compose not found?
```bash
# Install Docker Compose v2
sudo apt-get install docker-compose-plugin

# Or legacy version
sudo apt-get install docker-compose
```

### Services won't start?
```bash
# Check logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Check containers
docker-compose ps
```

---

## Data Safety

All scripts are designed to **preserve data**:

- ✅ Docker volumes are **never** deleted
- ✅ Uploaded files are **never** removed
- ✅ Database data is **always** preserved
- ✅ Only application containers are restarted

**Your data is safe!** 🛡️
