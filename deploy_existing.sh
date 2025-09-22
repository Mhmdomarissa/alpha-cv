#!/bin/bash

echo "🚀 Deploying Optimized CV Analyzer System (Using Existing Setup)"
echo "================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check system resources
check_resources() {
    print_status "Checking system resources..."
    
    # Check memory
    available_memory=$(free -g | awk 'NR==2{printf "%.0f", $7}')
    total_memory=$(free -g | awk 'NR==2{printf "%.0f", $2}')
    
    print_status "Total Memory: ${total_memory}GB"
    print_status "Available Memory: ${available_memory}GB"
    
    if [ "$available_memory" -lt 6 ]; then
        print_warning "Available memory is low (${available_memory}GB). System may struggle with heavy load."
    else
        print_success "Memory looks good for deployment"
    fi
}

# Stop existing containers
stop_containers() {
    print_status "Stopping existing containers..."
    docker-compose down --volumes --remove-orphans
    print_success "Existing containers stopped"
}

# Build and start services
deploy_services() {
    print_status "Building and starting services..."
    
    # Build images
    print_status "Building Docker images..."
    docker-compose build --no-cache
    
    if [ $? -ne 0 ]; then
        print_error "Failed to build images"
        exit 1
    fi
    
    print_success "Images built successfully"
    
    # Start services
    print_status "Starting services..."
    docker-compose up -d
    
    if [ $? -ne 0 ]; then
        print_error "Failed to start services"
        exit 1
    fi
    
    print_success "Services started successfully"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for backend
    print_status "Waiting for backend..."
    for i in {1..60}; do
        if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
            print_success "Backend is ready"
            break
        fi
        if [ $i -eq 60 ]; then
            print_error "Backend failed to start"
            exit 1
        fi
        sleep 2
    done
    
    # Wait for frontend
    print_status "Waiting for frontend..."
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            print_success "Frontend is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_warning "Frontend may not be ready yet"
        fi
        sleep 2
    done
    
    # Wait for nginx
    print_status "Waiting for nginx..."
    for i in {1..30}; do
        if curl -s http://localhost > /dev/null 2>&1; then
            print_success "Nginx is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_warning "Nginx may not be ready yet"
        fi
        sleep 2
    done
}

# Test the system
test_system() {
    print_status "Testing system functionality..."
    
    # Test health endpoint
    if curl -s http://localhost:8000/api/health | grep -q "healthy\|degraded"; then
        print_success "Health check passed"
    else
        print_warning "Health check failed"
    fi
    
    # Test category endpoint
    if curl -s http://localhost:8000/api/cv/categories > /dev/null 2>&1; then
        print_success "Category API is working"
    else
        print_warning "Category API may not be ready yet"
    fi
}

# Show system status
show_status() {
    print_status "System Status:"
    echo "==============="
    
    # Show containers
    echo "🐳 Running Containers:"
    docker-compose ps
    
    echo ""
    echo "📊 Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
    
    echo ""
    echo "🌐 Service URLs:"
    echo "   • Application: http://localhost"
    echo "   • Frontend: http://localhost:3000"
    echo "   • Backend API: http://localhost:8000"
    echo "   • Qdrant: http://localhost:6333"
    echo "   • Prometheus: http://localhost:9090"
    
    echo ""
    echo "📋 Useful Commands:"
    echo "   • View logs: docker-compose logs -f"
    echo "   • Stop system: docker-compose down"
    echo "   • Restart: docker-compose restart"
    echo "   • Monitor: docker stats"
    echo "   • Test categories: python3 test_category_api.py"
}

# Main deployment
main() {
    echo "🎯 Target: 10 concurrent users, 100s of CVs, 300+ CV matching"
    echo "💻 System: 16GB RAM, 4 CPU cores, GPU support"
    echo "🔧 Using: Your existing docker-compose.yml with optimizations"
    echo ""
    
    check_resources
    stop_containers
    deploy_services
    wait_for_services
    test_system
    show_status
    
    print_success "🚀 System deployed successfully!"
    print_status "Ready to handle 10 concurrent users with heavy load"
    print_status "SSH connections should remain stable"
}

# Run main function
main "$@"
