#!/bin/bash

# Alpha CV Deployment Script - AWS Optimized
# ==========================================
# Optimized for: 4 CPU cores, 15GB RAM, 40 concurrent users
# Automatically detects environment and deploys accordingly

set -e

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to detect environment
detect_environment() {
    if [ -f ".env" ]; then
        if grep -q "ENVIRONMENT=production" .env; then
            echo "production"
        else
            echo "development"
        fi
    else
        echo "development"
    fi
}

# Function to setup environment file
setup_environment() {
    local env=$1
    
    if [ "$env" = "production" ]; then
        if [ ! -f ".env" ]; then
            print_status "Setting up AWS-optimized production environment..."
            print_status "Configuration: 4 CPU cores, 15GB RAM, 40 concurrent users"
            cp env.production.example .env
            print_warning "Please edit .env file with your production values before continuing!"
            print_warning "Required: POSTGRES_PASSWORD, JWT_SECRET_KEY, OPENAI_API_KEY"
            print_success "AWS-optimized settings: 4-16 workers, 12GB memory threshold, 20 DB connections"
            print_success "Redis Cloud: External Redis server configured"
            read -p "Press Enter when you've updated the .env file..."
        fi
    else
        if [ ! -f ".env" ]; then
            print_status "Setting up development environment..."
            cp env.development.example .env
            print_success "Development environment configured!"
            print_success "Redis Cloud: External Redis server configured for development"
        fi
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Prerequisites check passed!"
}

# Function to build and start services
deploy_services() {
    local env=$1
    
    print_status "Building and starting services for $env environment..."
    
    # Stop existing services
    print_status "Stopping existing services..."
    docker-compose down --remove-orphans
    
    # Build and start services
    print_status "Building Docker images..."
    docker-compose build --no-cache
    
    print_status "Starting services..."
    docker-compose up -d
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    if docker-compose ps | grep -q "unhealthy"; then
        print_warning "Some services are unhealthy. Checking logs..."
        docker-compose logs backend
        print_error "Deployment failed. Please check the logs above."
        exit 1
    fi
    
    print_success "All services are healthy!"
}

# Function to show deployment status
show_status() {
    local env=$1
    
    print_status "Deployment Status for $env environment:"
    echo "=================================="
    
    # Show running containers
    docker-compose ps
    
    echo ""
    print_status "Service URLs:"
    echo "- Frontend: http://localhost:3000"
    echo "- Backend API: http://localhost:8000"
    echo "- Health Check: http://localhost:8000/health"
    
    if [ "$env" = "production" ]; then
        echo ""
        print_warning "Production Deployment Notes:"
        echo "- Ensure your domain is configured"
        echo "- Set up SSL certificates"
        echo "- Configure firewall rules"
        echo "- Set up monitoring and alerts"
    fi
}

# Function to show logs
show_logs() {
    local service=$1
    
    if [ -z "$service" ]; then
        print_status "Showing logs for all services..."
        docker-compose logs -f
    else
        print_status "Showing logs for $service..."
        docker-compose logs -f "$service"
    fi
}

# Function to scale services
scale_services() {
    local env=$1
    
    if [ "$env" = "production" ]; then
        print_status "Scaling services for production..."
        # In production, you might want to scale backend instances
        # docker-compose up -d --scale backend=3
        print_warning "Auto-scaling is configured in AWS. Manual scaling not needed."
    else
        print_status "Development environment - no scaling needed."
    fi
}

# Function to backup data
backup_data() {
    local env=$1
    
    print_status "Creating backup for $env environment..."
    
    # Create backup directory
    mkdir -p backups/$(date +%Y%m%d_%H%M%S)
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    
    # Backup PostgreSQL data
    print_status "Backing up PostgreSQL data..."
    docker-compose exec -T postgres pg_dump -U cv_user cv_database > "$backup_dir/postgres_backup.sql"
    
    # Backup Qdrant data
    print_status "Backing up Qdrant data..."
    docker-compose exec -T qdrant tar -czf - /qdrant/storage > "$backup_dir/qdrant_backup.tar.gz"
    
    print_success "Backup created in $backup_dir"
}

# Function to restore data
restore_data() {
    local backup_dir=$1
    
    if [ -z "$backup_dir" ]; then
        print_error "Please specify backup directory"
        exit 1
    fi
    
    if [ ! -d "$backup_dir" ]; then
        print_error "Backup directory $backup_dir does not exist"
        exit 1
    fi
    
    print_warning "This will restore data from $backup_dir. Are you sure? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_status "Restore cancelled."
        exit 0
    fi
    
    print_status "Restoring data from $backup_dir..."
    
    # Restore PostgreSQL data
    if [ -f "$backup_dir/postgres_backup.sql" ]; then
        print_status "Restoring PostgreSQL data..."
        docker-compose exec -T postgres psql -U cv_user -d cv_database < "$backup_dir/postgres_backup.sql"
    fi
    
    # Restore Qdrant data
    if [ -f "$backup_dir/qdrant_backup.tar.gz" ]; then
        print_status "Restoring Qdrant data..."
        docker-compose exec -T qdrant tar -xzf - < "$backup_dir/qdrant_backup.tar.gz"
    fi
    
    print_success "Data restored successfully!"
}

# Main function
main() {
    local command=$1
    local env=$(detect_environment)
    
    print_status "Alpha CV Deployment Script"
    print_status "Detected environment: $env"
    echo ""
    
    case $command in
        "deploy")
            check_prerequisites
            setup_environment "$env"
            deploy_services "$env"
            scale_services "$env"
            show_status "$env"
            ;;
        "status")
            show_status "$env"
            ;;
        "logs")
            show_logs "$2"
            ;;
        "backup")
            backup_data "$env"
            ;;
        "restore")
            restore_data "$2"
            ;;
        "stop")
            print_status "Stopping all services..."
            docker-compose down
            print_success "Services stopped!"
            ;;
        "restart")
            print_status "Restarting services..."
            docker-compose restart
            print_success "Services restarted!"
            ;;
        "clean")
            print_warning "This will remove all containers, volumes, and images. Are you sure? (y/N)"
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                print_status "Cleaning up..."
                docker-compose down -v --rmi all
                docker system prune -f
                print_success "Cleanup completed!"
            else
                print_status "Cleanup cancelled."
            fi
            ;;
        *)
            echo "Usage: $0 {deploy|status|logs|backup|restore|stop|restart|clean}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Deploy the application (auto-detects environment)"
            echo "  status   - Show deployment status"
            echo "  logs     - Show logs (optionally specify service name)"
            echo "  backup   - Create backup of data"
            echo "  restore  - Restore data from backup"
            echo "  stop     - Stop all services"
            echo "  restart  - Restart all services"
            echo "  clean    - Remove all containers, volumes, and images"
            echo ""
            echo "Examples:"
            echo "  $0 deploy"
            echo "  $0 logs backend"
            echo "  $0 restore backups/20240101_120000"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
