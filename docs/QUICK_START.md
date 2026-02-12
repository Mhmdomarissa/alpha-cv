# 🚀 Quick Start Guide - Dev/Prod Workflow

## The Problem You Had
- Editing production files directly
- Every test requires container restart = downtime for users ❌
- Can't test safely

## The Solution
**Two separate environments on same server:**
- **Production** (ports 3000, 8000) - For your users ✅
- **Development** (ports 3001, 8001) - For your testing ✅

---

## Quick Commands

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
./scripts/stop.sh
```

**Note**: This preserves all data (volumes remain intact)

### Deploy Latest Code
```bash
./scripts/deploy.sh
```

**What it does**:
- Pulls latest code from `main` branch
- Rebuilds and restarts services
- **NEVER touches data volumes**

### View Logs
```bash
docker-compose logs -f
```

---

## Workflow Summary

```
1. ./dev-start.sh              → Start dev environment
2. Edit code                    → Make your changes
3. Test at :3001               → Test thoroughly in dev
4. git add . && git commit     → Save your work
5. git push origin main        → Push to repository
6. ./deploy-to-production.sh   → Deploy when ready
7. ./dev-stop.sh               → Stop dev when done
```

---

## 🎯 Key Benefits

✅ **Production stays up** - Users never interrupted  
✅ **Test safely** - Break things in dev, not prod  
✅ **Fast iteration** - Restart dev as many times as needed  
✅ **Zero downtime deploys** - Smart deployment script  
✅ **Easy workflow** - Simple commands  

---

## Need Help?

Read the full guide: `cat DEV_WORKFLOW_GUIDE.md`

Or just ask me! 😊
