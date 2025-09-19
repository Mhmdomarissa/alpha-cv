# Production Server Configuration Guide

## 🖥️ Current Server Specifications
- **CPU**: 4 cores (Intel Xeon Platinum 8259CL @ 2.50GHz)
- **RAM**: 15GB total, 12GB available
- **Storage**: 193GB (40GB used, 154GB available)
- **OS**: Linux (Ubuntu)

## ✅ Production Configuration Applied

### 1. Environment Variables (.env)
Your `.env` file has been updated with production-optimized settings:

```bash
# Application Environment
NODE_ENV=production
ENVIRONMENT=production

# Database Configuration
POSTGRES_PASSWORD=AlphaCV2024!SecureDB
POSTGRES_DB=cv_database
POSTGRES_USER=cv_user

# Qdrant Configuration - Optimized for 4 CPU cores
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_MAX_CONNECTIONS=20

# Job Queue Configuration - Optimized for 4 CPU cores, 15GB RAM
MIN_QUEUE_WORKERS=4
MAX_QUEUE_WORKERS=16
MEMORY_THRESHOLD_MB=12288
CPU_THRESHOLD_PERCENT=80
QUEUE_SIZE_THRESHOLD=2000

# Performance Monitoring
ENABLE_PERFORMANCE_MONITORING=true
LOG_LEVEL=INFO
ENABLE_REQUEST_LOGGING=true

# Security
CORS_ORIGINS=https://alphacv.alphadatarecruitment.ae
SECURE_COOKIES=true
TRUSTED_PROXY=true

# Redis Configuration - Redis Cloud
REDIS_HOST=redis-15660.c322.us-east-1-2.ec2.redns.redis-cloud.com
REDIS_PORT=15660
REDIS_PASSWORD=Qcz5z02ZjhPmPy3bSimeJoqB3WoJhr7S
REDIS_USERNAME=default
REDIS_DB=0
REDIS_MAXMEMORY=30mb
REDIS_MAXMEMORY_POLICY=allkeys-lru
```

### 2. Docker Configuration
- **Production Docker Compose**: `docker-compose.production.yml`
- **Resource Limits**: Configured for your 4-core, 15GB system
- **Health Checks**: All services have health monitoring
- **Restart Policies**: `unless-stopped` for all services

### 3. Service Resource Allocation
```
Backend:     4 workers, 8GB memory limit, 4 CPU cores
Frontend:    2GB memory limit, 2 CPU cores  
Postgres:    4GB memory limit, 2 CPU cores
Qdrant:      8GB memory limit, 4 CPU cores
Redis:       External (Redis Cloud)
Nginx:       512MB memory limit, 1 CPU core
```

## 🔧 Server Optimizations Needed

### 1. System-Level Optimizations

#### Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
```

#### Install Required Tools
```bash
sudo apt install -y htop iotop nethogs jq curl wget
```

#### Configure Swap (if needed)
```bash
# Check current swap
free -h

# If no swap and you want to add some (optional)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. Docker Optimizations

#### Increase Docker Log Limits
```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

sudo systemctl restart docker
```

#### Configure Docker Compose for Production
```bash
# Use production compose file
docker-compose -f docker-compose.production.yml up -d
```

### 3. Nginx Configuration

#### Check Current Nginx Config
```bash
# Check if production nginx config exists
ls -la /home/ubuntu/nginx.production.conf

# If not, copy from example
cp /home/ubuntu/nginx.production.conf /home/ubuntu/nginx.conf
```

#### SSL Certificate Setup
```bash
# Check current SSL certificates
ls -la /home/ubuntu/certbot/conf/live/

# If no certificates, set up SSL
sudo ./setup-ssl.sh
```

### 4. Database Optimizations

#### PostgreSQL Configuration
```bash
# Check current postgres config
docker-compose exec postgres psql -U cv_user -d cv_database -c "SHOW config_file;"

# Optimize postgres for your system
docker-compose exec postgres psql -U cv_user -d cv_database -c "
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
SELECT pg_reload_conf();
"
```

### 5. Monitoring Setup

#### Install Monitoring Tools
```bash
# Install htop for process monitoring
sudo apt install -y htop

# Install iotop for I/O monitoring
sudo apt install -y iotop

# Install nethogs for network monitoring
sudo apt install -y nethogs
```

#### Set up Log Rotation
```bash
sudo tee /etc/logrotate.d/docker-containers > /dev/null <<EOF
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=1M
    missingok
    delaycompress
    copytruncate
}
EOF
```

## 🚀 Deployment Commands

### Start Production System
```bash
# Stop current system
docker-compose down

# Start with production configuration
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps
```

### Monitor System
```bash
# Check all services
docker-compose -f docker-compose.production.yml ps

# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Check specific service logs
docker-compose -f docker-compose.production.yml logs -f backend
docker-compose -f docker-compose.production.yml logs -f frontend
```

### Health Checks
```bash
# API health
curl http://localhost:8000/api/health | jq

# Frontend health
curl http://localhost:3000

# Database health
docker-compose -f docker-compose.production.yml exec postgres pg_isready -U cv_user
```

## 🔒 Security Configurations

### 1. Firewall Setup
```bash
# Install ufw
sudo apt install -y ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. SSL/TLS Configuration
```bash
# Check SSL certificates
sudo certbot certificates

# Renew certificates (if needed)
sudo certbot renew --dry-run
```

### 3. Environment Security
```bash
# Secure .env file
chmod 600 /home/ubuntu/.env

# Backup .env securely
cp /home/ubuntu/.env /home/ubuntu/.env.backup.$(date +%Y%m%d)
chmod 600 /home/ubuntu/.env.backup.*
```

## 📊 Performance Monitoring

### 1. System Resources
```bash
# CPU usage
htop

# Memory usage
free -h

# Disk usage
df -h

# I/O usage
sudo iotop
```

### 2. Application Metrics
```bash
# API health with detailed metrics
curl http://localhost:8000/api/health | jq

# Docker stats
docker stats

# Service-specific logs
docker-compose -f docker-compose.production.yml logs --tail=100 backend
```

## 🚨 Troubleshooting

### Common Issues

1. **Out of Memory**
   ```bash
   # Check memory usage
   free -h
   docker stats
   
   # Restart services if needed
   docker-compose -f docker-compose.production.yml restart
   ```

2. **High CPU Usage**
   ```bash
   # Check CPU usage
   htop
   
   # Check specific container
   docker stats <container_name>
   ```

3. **Database Connection Issues**
   ```bash
   # Check postgres logs
   docker-compose -f docker-compose.production.yml logs postgres
   
   # Test connection
   docker-compose -f docker-compose.production.yml exec postgres psql -U cv_user -d cv_database
   ```

4. **Redis Connection Issues**
   ```bash
   # Check redis logs
   docker-compose -f docker-compose.production.yml logs redis
   
   # Test redis connection
   docker-compose -f docker-compose.production.yml exec redis redis-cli ping
   ```

## ✅ Verification Checklist

- [ ] System resources meet requirements (4 cores, 15GB RAM)
- [ ] Production .env file configured
- [ ] Docker containers running with production config
- [ ] SSL certificates configured
- [ ] Nginx serving HTTPS
- [ ] Database optimized
- [ ] Redis caching working
- [ ] Health checks passing
- [ ] Monitoring tools installed
- [ ] Firewall configured
- [ ] Log rotation set up

## 🎯 Next Steps

1. **Run the production configuration script**:
   ```bash
   ./apply-production-config.sh
   ```

2. **Set your OpenAI API key**:
   ```bash
   nano /home/ubuntu/.env
   # Replace 'your_openai_api_key_here' with your actual key
   ```

3. **Configure your domain**:
   ```bash
   nano /home/ubuntu/.env
   # Update NEXT_PUBLIC_API_URL and CORS_ORIGINS
   ```

4. **Set up SSL certificates**:
   ```bash
   sudo ./setup-ssl.sh
   ```

5. **Monitor the system**:
   ```bash
   docker-compose -f docker-compose.production.yml logs -f
   ```

Your system is now optimized for production with 4 CPU cores and 15GB RAM! 🚀
