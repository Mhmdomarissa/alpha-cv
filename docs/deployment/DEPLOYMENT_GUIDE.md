# AlphaCV Deployment Guide

## 🚀 Quick Deployment

### Deploy Latest Code (Pulls from main branch)
```bash
cd /home/ubuntu/alpha-cv
./scripts/deploy.sh
```

**What it does**:
1. Pulls latest code from `main` branch
2. Rebuilds Docker images
3. Gracefully restarts services
4. Verifies deployment
5. **NEVER touches data volumes**

---

## ✅ DATA SAFETY GUARANTEE

### What the script DOES:
1. ✅ Rebuilds Docker images (frontend/backend)
2. ✅ Stops old containers
3. ✅ Removes old containers
4. ✅ Starts new containers
5. ✅ Restarts nginx
6. ✅ Verifies deployment

### What the script DOES NOT do:
- ❌ **NEVER** touches volumes
- ❌ **NEVER** deletes data
- ❌ **NEVER** removes databases (Qdrant, Postgres, Redis)
- ❌ **NEVER** runs `docker-compose down`
- ❌ **NEVER** runs `docker volume rm`
- ❌ **NEVER** clears database data

### Your Data is Safe:
All your data is stored in Docker volumes that are **NEVER touched** by the deployment script:

```bash
# Your data volumes (SAFE - never modified):
ubuntu_qdrant-data          # All CVs, JDs, embeddings, vectors
ubuntu_postgres-data        # User accounts, metadata
ubuntu_redis-data           # Cache data
```

The script only replaces the **application code** (frontend/backend containers), not the **data** (volumes).

---

## 📊 What Happens During Deployment

### Step-by-Step Process:

#### 1. **Build New Images**
```
Building frontend Docker image...
Building backend Docker image...
```
- Creates new images with your latest code changes
- Does NOT affect running containers or data

#### 2. **Stop Old Containers**
```
Stopping old frontend container...
Stopping old backend container...
```
- Gracefully stops the old application containers
- Data volumes remain untouched and mounted

#### 3. **Remove Old Containers**
```
Old container removed
```
- Removes the stopped container (just the application layer)
- Volumes are still there, just disconnected temporarily

#### 4. **Start New Containers**
```
Starting new frontend container...
Starting new backend container...
```
- Starts new containers with updated code
- **Reconnects to the SAME data volumes**
- All your CVs, JDs, users, etc. are still there

#### 5. **Restart Nginx**
```
Restarting nginx to refresh connections...
```
- Refreshes nginx connections to new containers
- No data loss

#### 6. **Verify Deployment**
```
Checking website status...
Checking backend health...
```
- Ensures everything is working
- Confirms data is accessible

---

## 🔒 Container vs Volume Explained

### Containers (Replaced by Script)
- **Frontend Container**: Just the Next.js application code
- **Backend Container**: Just the Python/FastAPI application code
- Think of these as the "program" - replaceable

### Volumes (NEVER Touched)
- **Qdrant Volume**: Your CV/JD data, embeddings, vectors
- **Postgres Volume**: User accounts, authentication, metadata
- **Redis Volume**: Cache data
- Think of these as the "hard drive" - permanent storage

**Analogy**: 
- Deploying = Updating your phone app (new features, bug fixes)
- Your photos/contacts/data = Still there after update

---

## 📝 Example Deployment Output

```bash
$ ./scripts/deploy.sh

╔════════════════════════════════════════════════════════════╗
║  AlphaCV Deployment Script
╚════════════════════════════════════════════════════════════╝

ℹ Deploying BOTH frontend and backend...

╔════════════════════════════════════════════════════════════╗
║  DEPLOYING BACKEND
╚════════════════════════════════════════════════════════════╝

ℹ Building backend Docker image...
✓ Backend image built
ℹ Stopping old backend container...
✓ Old container removed
ℹ Starting new backend container...
✓ Backend container started successfully
ℹ Waiting for backend to be healthy...
✓ Backend is healthy

╔════════════════════════════════════════════════════════════╗
║  DEPLOYING FRONTEND
╚════════════════════════════════════════════════════════════╝

ℹ Building frontend Docker image...
✓ Frontend image built
ℹ Stopping old frontend container...
✓ Old container removed
ℹ Starting new frontend container...
✓ Frontend container started successfully

╔════════════════════════════════════════════════════════════╗
║  RESTARTING NGINX
╚════════════════════════════════════════════════════════════╝

ℹ Restarting nginx to refresh connections...
✓ Nginx restarted successfully

╔════════════════════════════════════════════════════════════╗
║  VERIFYING DEPLOYMENT
╚════════════════════════════════════════════════════════════╝

ℹ Checking website status...
✓ Website is accessible (HTTP 200)
ℹ Checking backend health...
✓ Backend is healthy

╔════════════════════════════════════════════════════════════╗
║  DEPLOYMENT COMPLETE
╚════════════════════════════════════════════════════════════╝

✓ All services deployed successfully!

Service URLs:
  • Website:  https://alphacv.alphadatarecruitment.ae/
  • API:      https://alphacv.alphadatarecruitment.ae/api/health
```

---

## 🛠️ Troubleshooting

### If deployment fails:

1. **Check logs**:
   ```bash
   docker logs ubuntu_frontend_1 --tail 50
   docker logs ubuntu_backend_1 --tail 50
   ```

2. **Check container status**:
   ```bash
   docker ps -a | grep -E "(frontend|backend)"
   ```

3. **Verify data volumes are still there**:
   ```bash
   docker volume ls | grep ubuntu
   ```
   You should see:
   - ubuntu_qdrant-data
   - ubuntu_postgres-data
   - ubuntu_redis-data

4. **Restart databases if needed** (safe - just reconnects):
   ```bash
   docker start 6a6655f9a588_ubuntu_qdrant_1
   docker start 0cc6d77a26fe_ubuntu_postgres_1
   docker start bedf09da9778_ubuntu_redis_1
   ```

---

## 🎯 Common Use Cases

### After Making Changes
```bash
# 1. Make your changes in the codebase
# 2. Commit and push to your branch
git add .
git commit -m "Your changes"
git push origin your-branch

# 3. Merge to main branch (via GitHub PR)

# 4. On server, deploy latest code from main:
cd /home/ubuntu/alpha-cv
./scripts/deploy.sh
```

**Note**: The deploy script always deploys both frontend and backend from the latest code in `main` branch.

---

## ⚠️ What to NEVER Run (Data Destructive)

These commands will DELETE your data - **NEVER run them**:

```bash
# ❌ NEVER RUN THESE:
docker-compose down -v              # Deletes volumes
docker volume rm ubuntu_qdrant-data # Deletes CV/JD data
docker volume prune                 # Deletes unused volumes
docker system prune -a --volumes    # Deletes everything
```

---

## 📦 Your Current Data Volumes

Check your data volumes anytime:
```bash
docker volume ls | grep ubuntu
```

Check volume size:
```bash
docker system df -v | grep ubuntu
```

Backup your data (recommended before major changes):
```bash
./backup_system.sh
```

---

## 🔄 Rollback (If Needed)

If the new deployment has issues, you can rollback:

1. The old Docker images are still there (tagged as `<none>`)
2. Find the old image:
   ```bash
   docker images | grep frontend
   docker images | grep backend
   ```

3. Checkout previous commit and redeploy:
   ```bash
   git checkout <previous-commit-hash>
   ./scripts/deploy.sh
   ```

---

## ✅ Summary

- ✅ **Safe to run anytime** - your data is never touched
- ✅ **Fast** - typically completes in 1-2 minutes
- ✅ **Automatic** - handles all deployment steps
- ✅ **Verified** - checks that everything works after deployment
- ✅ **No downtime** - old container runs until new one is ready

**Your CVs, JDs, applications, and all data remain safe in Docker volumes!**

