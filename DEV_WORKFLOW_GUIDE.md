# Development & Production Workflow Guide

## Problem Statement
Working directly on production files causes downtime every time you restart containers. Users are affected by every change and test.

## Solution Overview
We've created a **separate development environment** that runs on different ports alongside production. This allows you to:
- Test changes without affecting production users
- Develop and iterate rapidly
- Only deploy to production when features are complete and tested

---

## Architecture

### Production Environment (Port Setup)
- **Frontend**: Port 3000 (or 80/443 via nginx)
- **Backend**: Port 8000
- **PostgreSQL**: Port 5432
- **Qdrant**: Port 6333

### Development Environment (Port Setup)
- **Frontend**: Port 3001
- **Backend**: Port 8001
- **PostgreSQL**: Port 5433
- **Qdrant**: Port 6334

**Both environments run simultaneously on the same server!**

---

## Daily Workflow

### 1. Start Development Environment

```bash
# Start dev environment (production keeps running)
./dev-start.sh
```

Access your development environment:
- Frontend: http://YOUR_SERVER_IP:3001
- Backend: http://YOUR_SERVER_IP:8001

### 2. Make Changes

Edit files in your workspace as normal:
- `/home/ubuntu/alpha-backend/` - Backend code
- `/home/ubuntu/cv-analyzer-frontend/` - Frontend code

### 3. Test in Development

Development containers automatically reload when you save files (if you configure hot reload).

To restart dev containers after changes:
```bash
docker-compose -f docker-compose.dev.yml restart
```

Or restart specific services:
```bash
docker-compose -f docker-compose.dev.yml restart backend-dev
docker-compose -f docker-compose.dev.yml restart frontend-dev
```

### 4. View Development Logs

```bash
docker-compose -f docker-compose.dev.yml logs -f
```

Or specific service:
```bash
docker-compose -f docker-compose.dev.yml logs -f backend-dev
```

### 5. Test Thoroughly

- Test all features in development
- Test with multiple users
- Verify everything works perfectly

### 6. Commit Changes

```bash
git add .
git commit -m "Your descriptive commit message"
git push origin main
```

### 7. Deploy to Production

When you're ready to deploy tested changes:

```bash
./deploy-to-production.sh
```

This script will:
- Pull latest code from git
- Build new images
- Deploy with minimal downtime (old containers stay up until new ones are ready)
- Clean up old images

### 8. Stop Development Environment

When done testing:
```bash
./dev-stop.sh
```

---

## Important Commands

### Check What's Running

```bash
# Production services
docker-compose ps

# Development services
docker-compose -f docker-compose.dev.yml ps

# All containers
docker ps
```

### View Logs

```bash
# Production logs
docker-compose logs -f

# Development logs
docker-compose -f docker-compose.dev.yml logs -f
```

### Restart Services

```bash
# Restart production (causes downtime - avoid!)
docker-compose restart

# Restart development (no production impact)
docker-compose -f docker-compose.dev.yml restart
```

### Stop Everything

```bash
# Stop only development
./dev-stop.sh

# Stop only production (users will be affected!)
docker-compose down

# Stop both
docker-compose down && docker-compose -f docker-compose.dev.yml down
```

---

## Best Practices

### ✅ DO:
- Always test in development first
- Keep development running while you work
- Only deploy to production when features are complete
- Commit and push changes before deploying
- Use descriptive commit messages
- Test with real user scenarios in dev

### ❌ DON'T:
- Don't edit production code directly without testing in dev first
- Don't restart production containers during peak hours
- Don't skip testing in development
- Don't deploy untested code
- Don't work directly on main branch for large features

---

## Advanced: Git Branch Workflow (Optional)

For even better organization:

### Create Feature Branch
```bash
git checkout -b feature/new-feature-name
```

### Work on Feature
```bash
# Make changes, test in dev
git add .
git commit -m "Add new feature"
```

### Merge to Main When Ready
```bash
git checkout main
git merge feature/new-feature-name
git push origin main
```

### Deploy to Production
```bash
./deploy-to-production.sh
```

---

## Troubleshooting

### Port Already in Use
If dev ports are already in use, edit `docker-compose.dev.yml` and change the ports:
```yaml
ports:
  - "3001:3000"  # Change 3001 to another port like 3002
```

### Development Not Reflecting Changes
Rebuild dev containers:
```bash
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d --build
```

### Production Issues After Deployment
Rollback to previous version:
```bash
cd backups/
ls  # Find your backup
cp LATEST_BACKUP/* ..
docker-compose up -d --build
```

### Check Resource Usage
```bash
docker stats
```

---

## Summary

**The Golden Rule**: 
> **Always test in development, never restart production unless deploying tested changes.**

**Typical Day:**
1. Morning: `./dev-start.sh`
2. Code and test all day in dev (port 3001, 8001)
3. Users use production happily (port 3000, 8000)
4. Evening: Deploy when ready with `./deploy-to-production.sh`
5. `./dev-stop.sh` when done

**No more downtime! No more user interruptions!** 🎉
