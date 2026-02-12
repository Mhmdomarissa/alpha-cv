# Quick Deployment Reference

## Unified Scripts (Use on Both DEV and PROD Servers)

All scripts use `docker-compose.yml` (production config) for both servers.

### Start System
```bash
cd /home/ubuntu/alpha-cv
./scripts/start.sh
```

**Optional**: Rebuild images before starting
```bash
./scripts/start.sh rebuild
```

### Stop System
```bash
cd /home/ubuntu/alpha-cv
./scripts/stop.sh
```

**Note**: This stops containers but **preserves all data** (volumes remain intact)

### Deploy Latest Code
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

## Workflow

### On DEV Server:
```bash
# 1. Make your changes
cd /home/ubuntu/alpha-cv
# ... edit code ...

# 2. Test locally
./scripts/start.sh

# 3. Commit and push
git add .
git commit -m "Your feature"
git push origin your-dev-branch
```

### Merge to Production:
1. Create Pull Request: `your-dev-branch` → `main`
2. Review and merge on GitHub

### On PROD Server:
```bash
# Deploy latest code from main
cd /home/ubuntu/alpha-cv
./scripts/deploy.sh
```

---

## Data Safety

✅ **All data is preserved during deployments**:
- Docker volumes (PostgreSQL, Qdrant, Redis)
- Uploaded files (`alpha-backend/uploads/`)
- Database data
- Embeddings

The deploy script **NEVER**:
- ❌ Deletes volumes
- ❌ Removes databases
- ❌ Clears uploaded files
- ❌ Runs `docker-compose down` (which would stop all services)

---

## Troubleshooting

### Services won't start?
```bash
# Check logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Check containers
docker-compose ps
```

### Deployment fails?
```bash
# Check Git
git status
git pull origin main

# Check Docker
docker ps
docker volume ls
```

### Need to restart?
```bash
./scripts/stop.sh
./scripts/start.sh
```

---

## Useful Commands

```bash
# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Check health
curl http://localhost/api/health

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

---

## File Locations

- **Start Script**: `scripts/start.sh`
- **Stop Script**: `scripts/stop.sh`
- **Deploy Script**: `scripts/deploy.sh`
- **Docker Compose**: `docker-compose.yml` (used for both dev and prod)
- **Environment Config**: `.env` (create from `.env.example`)
