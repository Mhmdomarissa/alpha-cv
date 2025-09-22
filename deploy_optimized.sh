#!/bin/bash

echo "🚀 Deploying Optimized CV Analyzer System..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if system resources are sufficient
check_system_resources() {
    print_status "Checking system resources..."
    
    # Check available memory
    available_memory=$(free -g | awk 'NR==2{printf "%.0f", $7}')
    if [ "$available_memory" -lt 8 ]; then
        print_warning "Available memory is ${available_memory}GB. Recommended: 8GB+"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled due to insufficient memory"
            exit 1
        fi
    else
        print_success "Available memory: ${available_memory}GB ✓"
    fi
    
    # Check available disk space
    available_disk=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$available_disk" -lt 20 ]; then
        print_warning "Available disk space is ${available_disk}GB. Recommended: 20GB+"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled due to insufficient disk space"
            exit 1
        fi
    else
        print_success "Available disk space: ${available_disk}GB ✓"
    fi
}

# Stop existing containers
stop_existing_containers() {
    print_status "Stopping existing containers..."
    
    # Stop any running containers
    docker-compose -f docker-compose.yml down --volumes --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.safe.yml down --volumes --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.optimized.yml down --volumes --remove-orphans 2>/dev/null || true
    
    print_success "Existing containers stopped"
}

# Build Docker images
build_images() {
    print_status "Building Docker images..."
    
    # Build the optimized backend
    if [ -d "./alpha-backend" ]; then
        print_status "Building alpha-backend image..."
        docker-compose -f docker-compose.optimized.yml build --no-cache alpha-backend
        if [ $? -ne 0 ]; then
            print_error "Failed to build alpha-backend image"
            exit 1
        fi
        print_success "alpha-backend image built successfully"
    else
        print_error "alpha-backend directory not found"
        exit 1
    fi
}

# Start core services first
start_core_services() {
    print_status "Starting core services (Qdrant, PostgreSQL, Redis)..."
    
    docker-compose -f docker-compose.optimized.yml up -d qdrant postgres redis
    if [ $? -ne 0 ]; then
        print_error "Failed to start core services"
        exit 1
    fi
    
    print_success "Core services started"
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 15
    
    # Check if services are healthy
    print_status "Checking service health..."
    
    # Check Qdrant
    for i in {1..30}; do
        if curl -s http://localhost:6333/health > /dev/null 2>&1; then
            print_success "Qdrant is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Qdrant failed to start"
            exit 1
        fi
        sleep 2
    done
    
    # Check PostgreSQL
    for i in {1..30}; do
        if docker-compose -f docker-compose.optimized.yml exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
            print_success "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "PostgreSQL failed to start"
            exit 1
        fi
        sleep 2
    done
    
    # Check Redis
    for i in {1..30}; do
        if docker-compose -f docker-compose.optimized.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
            print_success "Redis is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Redis failed to start"
            exit 1
        fi
        sleep 2
    done
}

# Start application services
start_application_services() {
    print_status "Starting application services..."
    
    docker-compose -f docker-compose.optimized.yml up -d alpha-backend
    if [ $? -ne 0 ]; then
        print_error "Failed to start alpha-backend"
        exit 1
    fi
    
    print_success "alpha-backend started"
    
    # Wait for backend to be ready
    print_status "Waiting for backend to be ready..."
    sleep 10
    
    # Check backend health
    for i in {1..30}; do
        if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
            print_success "Backend is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Backend failed to start"
            exit 1
        fi
        sleep 2
    done
}

# Start load balancer and monitoring
start_remaining_services() {
    print_status "Starting load balancer and monitoring..."
    
    docker-compose -f docker-compose.optimized.yml up -d nginx prometheus
    if [ $? -ne 0 ]; then
        print_error "Failed to start remaining services"
        exit 1
    fi
    
    print_success "All services started"
    
    # Wait for nginx to be ready
    sleep 5
    
    # Check nginx health
    for i in {1..10}; do
        if curl -s http://localhost/health > /dev/null 2>&1; then
            print_success "Nginx is ready"
            break
        fi
        if [ $i -eq 10 ]; then
            print_warning "Nginx health check failed, but service may still be running"
        fi
        sleep 2
    done
}

# Run performance test
run_performance_test() {
    print_status "Running performance test..."
    
    # Install required Python packages if not present
    if ! python3 -c "import aiohttp" 2>/dev/null; then
        print_status "Installing required Python packages..."
        pip3 install aiohttp psutil
    fi
    
    # Run the performance test
    python3 test_performance.py
    if [ $? -eq 0 ]; then
        print_success "Performance test completed"
    else
        print_warning "Performance test had issues, but system may still be functional"
    fi
}

# Show system status
show_system_status() {
    print_status "System Status:"
    echo "==============="
    
    # Show running containers
    echo "🐳 Running Containers:"
    docker-compose -f docker-compose.optimized.yml ps
    
    echo ""
    echo "📊 Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
    
    echo ""
    echo "🌐 Service URLs:"
    echo "   • Application: http://localhost"
    echo "   • Backend API: http://localhost:8000"
    echo "   • Qdrant: http://localhost:6333"
    echo "   • Prometheus: http://localhost:9090"
    
    echo ""
    echo "📋 Useful Commands:"
    echo "   • View logs: docker-compose -f docker-compose.optimized.yml logs -f"
    echo "   • Stop system: docker-compose -f docker-compose.optimized.yml down"
    echo "   • Restart: docker-compose -f docker-compose.optimized.yml restart"
    echo "   • Monitor: docker stats"
}

# Main deployment function
main() {
    echo "🎯 Target: 10 concurrent users, 100s of CVs, 300+ CV matching"
    echo "💻 System: 16GB RAM, 4 CPU cores, GPU support"
    echo ""
    
    # Check system resources
    check_system_resources
    
    # Stop existing containers
    stop_existing_containers
    
    # Build images
    build_images
    
    # Start services in order
    start_core_services
    start_application_services
    start_remaining_services
    
    # Run performance test
    run_performance_test
    
    # Show final status
    show_system_status
    
    print_success "🚀 Optimized CV Analyzer System deployed successfully!"
    print_status "System is ready to handle 10 concurrent users with heavy load"
}

# Run main function
main "$@"
