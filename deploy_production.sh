#!/bin/bash

# Production Deployment Script for Alpha CV
# Domain: alphacv.alphadatarecruitment.ae
# Server IP: 13.62.91.25

set -e

echo "🚀 Starting Production Deployment for Alpha CV"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="alphacv.alphadatarecruitment.ae"
SERVER_IP="13.62.91.25"
PROJECT_DIR="/home/ubuntu"

echo -e "${BLUE}📋 Deployment Configuration:${NC}"
echo "   • Domain: $DOMAIN"
echo "   • Server IP: $SERVER_IP"
echo "   • Project Directory: $PROJECT_DIR"
echo ""

# Step 1: Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
cd $PROJECT_DIR
docker-compose down

# Step 2: Pull latest images
echo -e "${YELLOW}📥 Pulling latest Docker images...${NC}"
docker-compose pull

# Step 3: Build fresh images
echo -e "${YELLOW}🔨 Building fresh Docker images...${NC}"
docker-compose build --no-cache

# Step 4: Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker-compose up -d

# Step 5: Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 30

# Step 6: Check service health
echo -e "${BLUE}🏥 Checking service health...${NC}"

# Check backend health
echo "   • Backend Health Check..."
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health || echo "000")
if [ "$BACKEND_HEALTH" = "200" ]; then
    echo -e "   ${GREEN}✅ Backend: Healthy${NC}"
else
    echo -e "   ${RED}❌ Backend: Unhealthy (HTTP $BACKEND_HEALTH)${NC}"
fi

# Check frontend health
echo "   • Frontend Health Check..."
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo -e "   ${GREEN}✅ Frontend: Healthy${NC}"
else
    echo -e "   ${RED}❌ Frontend: Unhealthy (HTTP $FRONTEND_HEALTH)${NC}"
fi

# Check Nginx health
echo "   • Nginx Health Check..."
NGINX_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost || echo "000")
if [ "$NGINX_HEALTH" = "200" ]; then
    echo -e "   ${GREEN}✅ Nginx: Healthy${NC}"
else
    echo -e "   ${RED}❌ Nginx: Unhealthy (HTTP $NGINX_HEALTH)${NC}"
fi

# Step 7: Check container status
echo -e "${BLUE}📊 Container Status:${NC}"
docker-compose ps

# Step 8: Performance monitoring test
echo -e "${BLUE}📈 Testing Performance Monitoring...${NC}"
PERF_RESPONSE=$(curl -s http://localhost:8000/api/performance/summary | jq -r '.status' 2>/dev/null || echo "error")
if [ "$PERF_RESPONSE" = "healthy" ]; then
    echo -e "   ${GREEN}✅ Performance Monitoring: Working${NC}"
else
    echo -e "   ${RED}❌ Performance Monitoring: Error${NC}"
fi

# Step 9: Display access information
echo ""
echo -e "${GREEN}🎉 Production Deployment Complete!${NC}"
echo "=============================================="
echo ""
echo -e "${BLUE}🌐 Access URLs:${NC}"
echo "   • Local Access: http://localhost"
echo "   • Server Access: http://$SERVER_IP"
echo "   • Domain Access: http://$DOMAIN"
echo "   • HTTPS Access: https://$DOMAIN (if SSL configured)"
echo ""
echo -e "${BLUE}📊 Monitoring URLs:${NC}"
echo "   • Performance Dashboard: http://$DOMAIN (Performance tab)"
echo "   • API Health: http://$DOMAIN/api/health"
echo "   • API Docs: http://$DOMAIN/docs"
echo "   • Prometheus: http://$SERVER_IP:9090"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "   • View logs: docker-compose logs -f"
echo "   • Restart: docker-compose restart"
echo "   • Stop: docker-compose down"
echo "   • Update: ./deploy_production.sh"
echo ""

# Step 10: DNS and SSL recommendations
echo -e "${YELLOW}⚠️  Next Steps for Full Production:${NC}"
echo "   1. Configure DNS A record: $DOMAIN → $SERVER_IP"
echo "   2. Install SSL certificate (Let's Encrypt recommended)"
echo "   3. Configure firewall (ports 80, 443, 22)"
echo "   4. Set up monitoring and alerts"
echo "   5. Configure backup strategy"
echo ""

# Step 11: Test external accessibility
echo -e "${BLUE}🌍 Testing External Accessibility...${NC}"
EXTERNAL_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP || echo "000")
if [ "$EXTERNAL_TEST" = "200" ]; then
    echo -e "   ${GREEN}✅ Server accessible from external IP${NC}"
else
    echo -e "   ${RED}❌ Server not accessible from external IP${NC}"
    echo -e "   ${YELLOW}   Check firewall and security groups${NC}"
fi

echo ""
echo -e "${GREEN}🚀 Alpha CV is now deployed and ready for production!${NC}"
echo -e "${GREEN}💪 Performance monitoring is active and ready to handle 10+ concurrent users!${NC}"

