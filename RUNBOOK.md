# CV-JD Analysis System - Operations Runbook

## Quick Start Guide

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend development)
- Python 3.9+ (for backend development)
- OpenAI API Key

### Environment Setup
```bash
# 1. Set required environment variables
export OPENAI_API_KEY="your-openai-api-key-here"
export NEXT_PUBLIC_API_URL="http://localhost:8000"  # Optional

# 2. Start all services
cd /home/ubuntu
./start-services.sh

# 3. Verify system health
curl http://localhost:8000/health
curl http://localhost:3000/api/debug
```

---

## Service Management

### Starting Services
```bash
# Start all services (recommended)
./start-services.sh

# Or start individually:
# Backend only
cd alpha-backend && docker-compose up -d

# Frontend only
cd cv-analyzer-frontend && npm run dev &
```

### Stopping Services
```bash
# Stop all services
./stop-services.sh

# Or stop individually:
cd alpha-backend && docker-compose down
pkill -f "next"
```

### Service Status Check
```bash
# Check Docker services
docker-compose -f alpha-backend/docker-compose.yml ps

# Check frontend process
ps aux | grep next

# Health checks
curl -s http://localhost:8000/health | jq .
curl -s http://localhost:3000/api/debug | jq .
```

---

## Monitoring & Health Checks

### Health Endpoints
- **Backend Health**: `GET http://localhost:8000/health`
- **Frontend Debug**: `GET http://localhost:3000/api/debug`
- **System Status**: `GET http://localhost:8000/api/upload/system-status`

### Key Metrics to Monitor
```bash
# Backend response times
curl -w "%{time_total}" -s http://localhost:8000/health

# Database connections
curl -s http://localhost:8000/health | jq .qdrant

# Cache statistics (if implemented)
curl -s http://localhost:8000/api/cache/stats | jq .
```

### Log Files
```bash
# Backend logs
docker logs alpha-backend --tail=100

# Frontend logs (if running as service)
journalctl -u frontend-service --tail=100

# System logs
tail -f /var/log/syslog | grep -E "(docker|cv-analyzer)"
```

---

## Troubleshooting Guide

### Common Issues

#### 1. Backend Won't Start
```bash
# Check Docker status
docker ps -a

# Check logs
docker logs alpha-backend

# Common fixes:
docker-compose -f alpha-backend/docker-compose.yml down
docker-compose -f alpha-backend/docker-compose.yml up -d --force-recreate
```

#### 2. Frontend Build Errors
```bash
# Clear Next.js cache
cd cv-analyzer-frontend
rm -rf .next node_modules
npm install
npm run dev
```

#### 3. OpenAI API Errors
```bash
# Check API key
echo $OPENAI_API_KEY

# Test API connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models | jq .
```

#### 4. Database Connection Issues
```bash
# Check PostgreSQL
docker exec alpha-backend-postgres pg_isready

# Check Qdrant
curl http://localhost:6333/collections

# Restart database services
docker-compose -f alpha-backend/docker-compose.yml restart postgres qdrant
```

#### 5. High Memory Usage
```bash
# Check container resources
docker stats

# Clear caches
curl -X POST http://localhost:8000/api/cache/clear

# Restart services if needed
./stop-services.sh && sleep 5 && ./start-services.sh
```

---

## Performance Optimization

### Cache Management
```bash
# View cache statistics
curl http://localhost:8000/api/cache/stats

# Clear all caches
curl -X POST http://localhost:8000/api/cache/clear

# Clear expired entries only
curl -X POST http://localhost:8000/api/cache/cleanup
```

### Rate Limiting
- API calls: 30 requests/minute per client
- Processing: 5 heavy operations/minute per client
- Concurrent: Maximum 3 simultaneous processing operations

### Performance Tuning
```bash
# Run performance benchmark
python3 performance_benchmark.py

# Run comprehensive tests
python3 test_suite.py

# Monitor resource usage
docker stats alpha-backend alpha-backend-postgres alpha-backend-qdrant
```

---

## Backup & Recovery

### Database Backup
```bash
# PostgreSQL backup
docker exec alpha-backend-postgres pg_dump -U alphauser alphadb > backup_$(date +%Y%m%d).sql

# Qdrant backup (copy data directory)
docker exec alpha-backend-qdrant tar -czf /tmp/qdrant_backup_$(date +%Y%m%d).tar.gz /qdrant/storage
docker cp alpha-backend-qdrant:/tmp/qdrant_backup_$(date +%Y%m%d).tar.gz .
```

### System Backup
```bash
# Full system backup
tar -czf cv-analyzer-backup-$(date +%Y%m%d).tar.gz \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='__pycache__' \
    alpha-backend cv-analyzer-frontend *.sh *.py *.md
```

### Recovery
```bash
# PostgreSQL restore
docker exec -i alpha-backend-postgres psql -U alphauser alphadb < backup_YYYYMMDD.sql

# Qdrant restore
docker cp qdrant_backup_YYYYMMDD.tar.gz alpha-backend-qdrant:/tmp/
docker exec alpha-backend-qdrant tar -xzf /tmp/qdrant_backup_YYYYMMDD.tar.gz
```

---

## Security

### Access Control
- Rate limiting is enforced automatically
- No authentication required for development
- API keys are environment-variable based

### Security Monitoring
```bash
# Check for failed requests
docker logs alpha-backend | grep -E "(4[0-9][0-9]|5[0-9][0-9])"

# Monitor rate limiting
docker logs alpha-backend | grep "Rate limit"

# Check resource usage
docker stats --no-stream
```

### Security Hardening Checklist
- [x] Rate limiting implemented
- [x] Input validation on all endpoints  
- [x] File size limits enforced
- [x] Error messages don't expose sensitive data
- [x] Timeout controls implemented
- [ ] SSL/TLS certificates (for production)
- [ ] Authentication system (for production)
- [ ] API key rotation (for production)

---

## Development Workflow

### Local Development
```bash
# Backend development
cd alpha-backend
# Make changes to Python files
# Docker will auto-reload (volume mounted)

# Frontend development  
cd cv-analyzer-frontend
npm run dev
# Next.js will auto-reload on changes
```

### Testing
```bash
# Run full test suite
python3 test_suite.py

# Run performance benchmarks
python3 performance_benchmark.py

# Test specific endpoint
curl -X POST http://localhost:8000/api/jobs/standardize-cv \
     -F "file=@test_cv.pdf"
```

### Code Quality
```bash
# Frontend linting
cd cv-analyzer-frontend && npm run lint

# Check for Python syntax errors
cd alpha-backend && python3 -m py_compile app/utils/gpt_extractor.py
```

---

## Production Deployment

### Pre-Deployment Checklist
- [ ] All tests passing (`python3 test_suite.py`)
- [ ] Performance benchmarks acceptable
- [ ] Environment variables configured
- [ ] SSL certificates ready
- [ ] Database backups created
- [ ] Monitoring systems configured

### Environment Variables (Production)
```bash
# Required
export OPENAI_API_KEY="prod-api-key"
export POSTGRES_URI="postgresql://user:pass@prod-db:5432/dbname"
export QDRANT_HOST="prod-qdrant-host"

# Optional
export NEXT_PUBLIC_API_URL="https://api.yourapp.com"
export LOG_LEVEL="INFO"
export MAX_CONCURRENT_REQUESTS="5"
```

### Scaling Considerations
- Use Redis for distributed caching
- Load balancer for multiple backend instances
- CDN for frontend static assets
- Database read replicas for high load

---

## Maintenance Schedule

### Daily
- Monitor logs for errors
- Check system health endpoints
- Verify backup completion

### Weekly  
- Review performance metrics
- Clear old logs and temporary files
- Update dependencies (if needed)

### Monthly
- Security audit
- Performance optimization review
- Backup strategy validation

---

## Emergency Procedures

### System Down
1. Check service status: `docker-compose ps`
2. Review logs: `docker logs alpha-backend`
3. Restart services: `./stop-services.sh && ./start-services.sh`
4. Verify health: `curl http://localhost:8000/health`

### High Load
1. Check resource usage: `docker stats`
2. Scale backend if possible
3. Enable cache warming
4. Implement request queuing

### Data Corruption
1. Stop all services immediately
2. Restore from latest backup
3. Verify data integrity
4. Resume operations

---

## Contact & Support

### System Owners
- **Backend**: Python/FastAPI team
- **Frontend**: Next.js team  
- **Infrastructure**: DevOps team
- **AI/ML**: Data Science team

### Escalation Path
1. Check this runbook first
2. Search logs and monitoring
3. Contact system owners
4. Create incident ticket
5. Escalate to management if critical

---

*Last updated: $(date)*
*Version: 1.0*
*Document owner: System Architecture Team*
