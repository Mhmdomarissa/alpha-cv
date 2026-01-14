#!/bin/bash

# ============================================================================
# AlphaCV Deployment Script
# ============================================================================
# This script rebuilds and deploys frontend and/or backend changes
# Usage: 
#   ./deploy.sh              # Deploy both frontend and backend
#   ./deploy.sh frontend     # Deploy only frontend
#   ./deploy.sh backend      # Deploy only backend
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NETWORK_NAME="ubuntu_cv-network"
FRONTEND_IMAGE="ubuntu_frontend:latest"
BACKEND_IMAGE="ubuntu_backend:latest"

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Function to check if container exists
container_exists() {
    docker ps -a --format '{{.Names}}' | grep -q "^$1$"
}

# Function to deploy frontend
# SAFETY: Uses docker-compose which preserves volumes and data.
# Only rebuilds frontend image and recreates frontend container.
# No data will be lost.
deploy_frontend() {
    print_header "DEPLOYING FRONTEND"
    
    cd /home/ubuntu
    
    print_info "Building frontend Docker image (no cache to ensure latest changes)..."
    docker-compose build --no-cache frontend 2>&1 | grep -E "(Step|Successfully)" || true
    print_success "Frontend image built with latest changes"
    
    print_info "Recreating frontend container with new image..."
    docker-compose up -d --no-deps frontend 2>&1 | grep -v "WARNING" || true
    
    sleep 3
    
    if docker ps | grep -qE "ubuntu.*frontend.*Up"; then
        print_success "Frontend container started successfully"
        docker-compose logs --tail 3 frontend
    else
        print_error "Frontend container failed to start"
        docker-compose logs --tail 20 frontend
        exit 1
    fi
}

# Function to deploy backend
# SAFETY: Uses docker-compose which preserves volumes and data.
# Only rebuilds backend image and recreates backend container.
# Database connections are preserved. No data will be lost.
deploy_backend() {
    print_header "DEPLOYING BACKEND"
    
    cd /home/ubuntu
    
    print_info "Building backend Docker image..."
    docker-compose build backend 2>&1 | grep -E "(Step|Successfully)" || true
    print_success "Backend image built"
    
    print_info "Recreating backend container with new image..."
    docker-compose up -d --no-deps backend 2>&1 | grep -v "WARNING" || true
    
    sleep 5
    
    if docker ps | grep -qE "ubuntu.*backend.*Up"; then
        print_success "Backend container started successfully"
        
        # Wait for backend to be healthy
        print_info "Waiting for backend to be healthy..."
        for i in {1..30}; do
            if docker-compose exec -T backend curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
                print_success "Backend is healthy"
                break
            fi
            if [ $i -eq 30 ]; then
                print_error "Backend health check timeout"
                docker-compose logs --tail 20 backend
                exit 1
            fi
            sleep 1
        done
    else
        print_error "Backend container failed to start"
        docker-compose logs --tail 20 backend
        exit 1
    fi
}

# Function to restart nginx
restart_nginx() {
    print_header "RESTARTING NGINX"
    
    print_info "Restarting nginx to refresh connections..."
    docker restart ubuntu_nginx_1 >/dev/null
    sleep 3
    
    if docker ps | grep -q "ubuntu_nginx_1"; then
        print_success "Nginx restarted successfully"
    else
        print_error "Nginx failed to restart"
        docker logs ubuntu_nginx_1 --tail 20
        exit 1
    fi
}

# Function to verify deployment
verify_deployment() {
    print_header "VERIFYING DEPLOYMENT"
    
    print_info "Checking website status..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://alphacv.alphadatarecruitment.ae/ -k)
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Website is accessible (HTTP $HTTP_CODE)"
    else
        print_error "Website returned HTTP $HTTP_CODE"
        exit 1
    fi
    
    print_info "Checking backend health..."
    HEALTH=$(curl -s https://alphacv.alphadatarecruitment.ae/api/health -k | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$HEALTH" = "healthy" ]; then
        print_success "Backend is healthy"
    else
        print_error "Backend health check failed"
        exit 1
    fi
    
    print_info "Checking running containers..."
    echo ""
    docker-compose ps | grep -E "(frontend|backend|nginx|qdrant|postgres|redis)" | grep -v exporter || docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(frontend|backend|nginx|qdrant|postgres|redis)" | grep -v exporter
    echo ""
}

# Function to show final summary
show_summary() {
    print_header "DEPLOYMENT COMPLETE"
    
    echo -e "${GREEN}✓${NC} All services deployed successfully!"
    echo ""
    echo "Service URLs:"
    echo "  • Website:  https://alphacv.alphadatarecruitment.ae/"
    echo "  • API:      https://alphacv.alphadatarecruitment.ae/api/health"
    echo ""
    echo "Useful commands:"
    echo "  • View logs:     docker logs ubuntu_frontend_1 -f"
    echo "  • View logs:     docker logs ubuntu_backend_1 -f"
    echo "  • Check status:  docker ps"
    echo ""
}

# Function to ensure databases are running
# SAFETY: This function uses 'docker-compose up -d' which ONLY starts containers.
# It does NOT recreate containers, delete volumes, or affect any data.
# All volumes (qdrant_data, postgres_data, redis_data) are preserved.
ensure_databases() {
    print_info "Ensuring database containers are running..."
    
    # Check and start Qdrant (preserves qdrant_data volume)
    if ! docker ps | grep -q "ubuntu_qdrant_1\|qdrant"; then
        print_warning "Qdrant is not running, starting it..."
        cd /home/ubuntu
        docker-compose up -d qdrant 2>&1 | grep -v "WARNING" || true
        sleep 2
    fi
    
    # Check and start Postgres
    if ! docker ps | grep -q "ubuntu_postgres_1\|postgres"; then
        print_warning "Postgres is not running, starting it..."
        cd /home/ubuntu
        docker-compose up -d postgres 2>&1 | grep -v "WARNING" || true
        sleep 2
    fi
    
    # Check and start Redis
    if ! docker ps | grep -q "ubuntu_redis_1\|redis"; then
        print_warning "Redis is not running, starting it..."
        cd /home/ubuntu
        docker-compose up -d redis 2>&1 | grep -v "WARNING" || true
        sleep 2
    fi
    
    # Verify all databases are running
    if docker ps | grep -qE "(qdrant|postgres|redis)" && ! docker ps | grep -qE "(qdrant|postgres|redis).*Exited"; then
        print_success "All database containers are running"
    else
        print_error "Some database containers failed to start"
        docker ps -a | grep -E "(qdrant|postgres|redis)"
        exit 1
    fi
}

# Main deployment logic
main() {
    cd /home/ubuntu
    
    print_header "AlphaCV Deployment Script"
    
    # Ensure databases are running before deployment
    ensure_databases
    
    DEPLOY_TARGET="${1:-all}"
    
    case $DEPLOY_TARGET in
        frontend)
            print_info "Deploying FRONTEND only..."
            deploy_frontend
            restart_nginx
            ;;
        backend)
            print_info "Deploying BACKEND only..."
            deploy_backend
            restart_nginx
            ;;
        all|*)
            print_info "Deploying BOTH frontend and backend..."
            deploy_backend
            deploy_frontend
            restart_nginx
            ;;
    esac
    
    verify_deployment
    
    # Final check: Ensure databases are still running
    print_info "Final check: Verifying databases are still running..."
    if docker ps | grep -qE "(qdrant|postgres|redis)" && ! docker ps | grep -qE "(qdrant|postgres|redis).*Exited"; then
        print_success "All databases are still running"
    else
        print_warning "Some databases may have stopped - attempting to restart..."
        ensure_databases
    fi
    
    show_summary
}

# Run main function
main "$@"

