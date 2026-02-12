# Migration to g4dn.xlarge - Cost Optimization Plan

## 💰 Cost Savings
- **Current:** g4dn.2xlarge @ $548.96/month
- **New (On-Demand):** g4dn.xlarge @ $383.98/month → **Save $164.98/month (30%)**
- **New (Reserved 1-year):** g4dn.xlarge @ $249.59/month → **Save $299.37/month (54%)**
- **Annual Savings:** $3,592/year with reserved instance

## 📊 Configuration Changes Applied

### Backend Service
| Setting | g4dn.2xlarge (Old) | g4dn.xlarge (New) |
|---------|-------------------|-------------------|
| UVICORN_WORKERS | 16 | 8 |
| MIN_QUEUE_WORKERS | 16 | 8 |
| MAX_QUEUE_WORKERS | 64 | 16 |
| MEMORY_THRESHOLD_MB | 24576 (24GB) | 12288 (12GB) |
| PYTHON_MEMORY_LIMIT | 24576 | 12288 |
| ASYNC_WORKER_POOL_SIZE | 50 | 24 |
| Docker Memory Limit | 24G | 12G |
| Docker CPU Limit | 7.0 | 3.5 |

### Qdrant Service
| Setting | Old | New |
|---------|-----|-----|
| Memory Limit | 18G | 10G |
| CPU Limit | 5.0 | 2.5 |

### Redis Service
| Setting | Old | New |
|---------|-----|-----|
| Max Memory | 18GB | 8GB |
| Max Clients | 3000 | 1000 |
| Memory Limit | 18G | 10G |
| CPU Limit | 3.0 | 2.0 |

### GPU Settings (UNCHANGED)
- ✅ ENABLE_GPU_BATCH_PROCESSING: true
- ✅ GPU_BATCH_SIZE: 32
- ✅ Same Tesla T4 GPU
- ✅ Same embedding performance

## 🚀 Migration Steps

### Phase 1: Backup (5 minutes)
```bash
# 1. Stop services gracefully
cd /home/ubuntu
docker-compose down

# 2. Backup configuration (already done)
# docker-compose.yml is already optimized for g4dn.xlarge

# 3. Verify S3 data is safe
aws s3 ls s3://alphacv-files-eu-north-1 --recursive --summarize
```

### Phase 2: Change Instance Type (10-15 minutes)
```bash
# In AWS Console:
1. Go to EC2 → Instances
2. Select instance i-03022a821b78c76fe
3. Instance State → Stop Instance
4. Wait for "stopped" status
5. Actions → Instance Settings → Change Instance Type
6. Select: g4dn.xlarge
7. Click "Apply"
8. Instance State → Start Instance
9. Wait for "running" status
```

### Phase 3: Restart Services (5 minutes)
```bash
# SSH back into instance
cd /home/ubuntu

# Start services with new configuration
docker-compose up -d

# Monitor startup
docker-compose logs -f backend
```

### Phase 4: Verification (10 minutes)
```bash
# 1. Check all containers are running
docker ps

# 2. Verify GPU is accessible
nvidia-smi

# 3. Check backend health
curl http://localhost:8000/api/health | jq .

# 4. Verify GPU is being used
docker logs ubuntu_backend_1 2>&1 | grep "GPU\|CUDA"

# 5. Check resource usage
docker stats --no-stream

# 6. Test file upload via frontend
# Navigate to http://your-ip:3000 and test CV upload
```

## 📈 Expected Performance

### Resource Utilization
| Resource | Expected Usage | Capacity | Status |
|----------|---------------|----------|--------|
| CPU | 50-70% under load | 4 vCPUs | ✅ Good |
| RAM | 10-13 GB | 16 GB | ✅ Good |
| GPU Memory | 9-11 GB | 15.3 GB | ✅ Excellent |
| GPU Utilization | 60-80% under load | 100% | ✅ Excellent |

### Workload Capacity
- **Normal Load:** 4-5 CVs/minute → ✅ No problem
- **Peak Load:** 13-14 CVs/minute → ✅ Handles well
- **Worst Case:** 200 CVs queued → ⚠️ Slightly slower (acceptable)
- **Concurrent Users:** 15-20 peak → ✅ Meets requirement (24 HRs)

### Processing Times (No Change)
- Embedding generation: 50-200ms (GPU - same performance)
- PDF parsing: 300ms (CPU)
- LLM extraction: 2000ms (OpenAI API - unchanged)
- Total per CV: ~2.5 seconds

## 🔍 Monitoring After Migration

### Check These Metrics Daily (First Week)
```bash
# CPU Usage
docker stats ubuntu_backend_1 --no-stream | grep backend

# Memory Usage
free -h

# GPU Usage
nvidia-smi

# Queue Performance
docker logs ubuntu_backend_1 2>&1 | grep "queue\|worker" | tail -20

# Response Times
docker logs ubuntu_nginx_1 2>&1 | grep "request_time" | tail -20
```

### Warning Signs to Watch For
- ⚠️ CPU consistently >85% → May need optimization
- ⚠️ Memory consistently >14GB → Check for memory leaks
- ⚠️ Queue processing time >5s per CV → Investigate bottleneck
- 🚨 Out of memory errors → Reduce worker count further

## 💡 Optimization Tips After Migration

If you notice performance issues:

1. **Reduce workers further:**
   ```yaml
   UVICORN_WORKERS: "6"  # Down from 8
   MAX_QUEUE_WORKERS: "12"  # Down from 16
   ```

2. **Increase GPU batch size:**
   ```yaml
   GPU_BATCH_SIZE: "64"  # Up from 32
   ```

3. **Enable more aggressive caching:**
   ```yaml
   CACHE_TTL_EMBEDDINGS: "172800"  # 2 days instead of 1
   ```

4. **Use connection pooling more efficiently:**
   - Current: 400 max Qdrant connections (good)
   - Reduce if memory pressure: 200 max

## 📋 Rollback Plan (If Needed)

If performance is not satisfactory:

```bash
# 1. Stop instance
# 2. Change back to g4dn.2xlarge
# 3. Restore old docker-compose.yml:
cp docker-compose.yml.backup_g4dn2xlarge_20251015_071721 docker-compose.yml

# 4. Start instance
# 5. docker-compose up -d
```

## 🎯 Next Steps After 2 Weeks

If g4dn.xlarge works well:

### Option A: Purchase Reserved Instance (Recommended)
1. Go to EC2 → Reserved Instances → Purchase Reserved Instances
2. Select:
   - Instance Type: g4dn.xlarge
   - Platform: Linux/UNIX
   - Tenancy: Default
   - Term: 1 year
   - Payment Option: No Upfront
3. Cost: $249.59/month (54% savings)
4. **Total Annual Savings: $3,592**

### Option B: Use Savings Plan
- More flexible than reserved instance
- Similar ~35% discount
- Can apply to other instance types

### Option C: Stay On-Demand
- If you need flexibility
- 30% savings vs g4dn.2xlarge
- No commitment

## 📞 Support

If you encounter issues:
- Check logs: `docker-compose logs -f`
- Monitor resources: `htop`, `nvidia-smi`
- Test endpoints: `curl http://localhost:8000/api/health`

---

**Migration Date:** _____________
**Completed By:** _____________
**Verified By:** _____________
**Performance Status:** ⬜ Excellent ⬜ Good ⬜ Needs Optimization
**Next Action:** ⬜ Purchase Reserved ⬜ Continue Testing ⬜ Rollback

