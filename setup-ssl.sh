#!/bin/bash

# =============================================================================
# SSL Setup Script for CV Analyzer - Let's Encrypt Certificate Management
# =============================================================================
# This script sets up HTTPS for alphacv.alphadatarecruitment.ae using Let's Encrypt
# 
# Usage:
#   ./setup-ssl.sh init     - Initial certificate setup
#   ./setup-ssl.sh renew    - Renew existing certificates
#   ./setup-ssl.sh status   - Check certificate status
#   ./setup-ssl.sh rollback - Rollback to HTTP configuration
# =============================================================================

set -euo pipefail

# Configuration
DOMAIN="alphacv.alphadatarecruitment.ae"
EMAIL="admin@alphadatarecruitment.ae"
STAGING=0  # Set to 1 for testing, 0 for production certificates
COMPOSE_CMD="docker compose"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker compose is available
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        if ! command -v docker-compose &> /dev/null; then
            log_error "Docker Compose is not installed"
            exit 1
        else
            COMPOSE_CMD="docker-compose"
        fi
    fi
    
    log_success "Dependencies check passed"
}

# Create necessary directories
create_directories() {
    log_info "Creating SSL directories..."
    mkdir -p ./certbot/www
    mkdir -p ./certbot/conf
    log_success "SSL directories created"
}

# Check if domain is reachable
check_domain() {
    log_info "Checking if domain $DOMAIN is reachable..."
    
    if ! ping -c 1 "$DOMAIN" &> /dev/null; then
        log_warning "Domain $DOMAIN might not be properly configured"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "SSL setup cancelled"
            exit 0
        fi
    else
        log_success "Domain $DOMAIN is reachable"
    fi
}

# Initial certificate setup
init_certificates() {
    log_info "Starting initial SSL certificate setup for $DOMAIN..."
    
    check_dependencies
    create_directories
    check_domain
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    $COMPOSE_CMD down || true
    
    # Start nginx with HTTP-only configuration for certificate validation
    log_info "Starting nginx for certificate validation..."
    $COMPOSE_CMD up -d nginx
    
    # Wait for nginx to be ready
    sleep 10
    
    # Request certificate
    log_info "Requesting Let's Encrypt certificate..."
    
    CERTBOT_ARGS="certonly --webroot --webroot-path=/var/www/certbot --email $EMAIL --agree-tos --no-eff-email"
    
    if [ $STAGING -eq 1 ]; then
        log_warning "Using Let's Encrypt staging environment (test certificates)"
        CERTBOT_ARGS="$CERTBOT_ARGS --staging"
    fi
    
    if docker run --rm \
        -v "./certbot/www:/var/www/certbot:rw" \
        -v "./certbot/conf:/etc/letsencrypt:rw" \
        certbot/certbot $CERTBOT_ARGS -d "$DOMAIN"; then
        
        log_success "Certificate obtained successfully!"
        
        # Restart with HTTPS configuration
        log_info "Restarting services with HTTPS configuration..."
        $COMPOSE_CMD down
        $COMPOSE_CMD up -d
        
        # Wait for services to start
        sleep 15
        
        # Test HTTPS
        if curl -I "https://$DOMAIN" &> /dev/null; then
            log_success "HTTPS is working correctly!"
            log_success "✅ SSL setup completed successfully!"
            log_info "Your site is now available at: https://$DOMAIN"
        else
            log_warning "HTTPS setup completed but site may not be immediately accessible"
            log_info "Please wait a few minutes and check: https://$DOMAIN"
        fi
        
    else
        log_error "Failed to obtain certificate"
        log_info "Rolling back to HTTP configuration..."
        rollback_configuration
        exit 1
    fi
}

# Renew certificates
renew_certificates() {
    log_info "Renewing SSL certificates..."
    
    if docker run --rm \
        -v "./certbot/www:/var/www/certbot:rw" \
        -v "./certbot/conf:/etc/letsencrypt:rw" \
        certbot/certbot renew --webroot --webroot-path=/var/www/certbot; then
        
        log_success "Certificates renewed successfully!"
        
        # Reload nginx
        log_info "Reloading nginx configuration..."
        $COMPOSE_CMD exec nginx nginx -s reload
        
        log_success "✅ Certificate renewal completed!"
    else
        log_error "Failed to renew certificates"
        exit 1
    fi
}

# Check certificate status
check_status() {
    log_info "Checking SSL certificate status..."
    
    if [ -f "./certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
        log_success "Certificate file found"
        
        # Check expiration
        EXPIRY=$(docker run --rm \
            -v "./certbot/conf:/etc/letsencrypt:ro" \
            certbot/certbot certificates --domain "$DOMAIN" 2>/dev/null | grep "Expiry Date" | cut -d' ' -f4-6)
        
        if [ ! -z "$EXPIRY" ]; then
            log_info "Certificate expires: $EXPIRY"
        fi
        
        # Test HTTPS connection
        if curl -I "https://$DOMAIN" &> /dev/null; then
            log_success "HTTPS connection successful"
        else
            log_warning "HTTPS connection failed"
        fi
        
    else
        log_warning "No certificate found for $DOMAIN"
        log_info "Run './setup-ssl.sh init' to set up SSL"
    fi
}

# Rollback to HTTP configuration
rollback_configuration() {
    log_warning "Rolling back to HTTP-only configuration..."
    
    # Backup current nginx.conf
    if [ -f "nginx.conf" ]; then
        cp nginx.conf nginx.conf.https.backup
        log_info "HTTPS nginx config backed up to nginx.conf.https.backup"
    fi
    
    # Create HTTP-only nginx configuration
    cat > nginx.conf.http << 'EOF'
events { worker_connections 1024; }

http {
  include       /etc/nginx/mime.types;
  default_type  application/octet-stream;

  sendfile on;
  tcp_nopush on;
  keepalive_timeout 65;
  client_max_body_size 25m;

  map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
  }

  upstream frontend { server frontend:3000; }
  upstream backend  { server backend:8000; }

  server {
    listen 80;
    server_name alphacv.alphadatarecruitment.ae localhost;

    location = /api {
      return 301 /api/;
    }

    location /api/ {
      proxy_pass http://backend;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      proxy_read_timeout 600s;
      proxy_send_timeout 600s;
      proxy_request_buffering off;
      proxy_buffering off;
      client_max_body_size 25m;
      proxy_max_temp_file_size 0;
    }

    location = /health {
      proxy_pass http://backend/api/health;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /docs {
      proxy_pass http://backend/docs;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location = /redoc {
      proxy_pass http://backend/redoc;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
      proxy_pass http://frontend;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
    }
  }
}
EOF
    
    # Replace nginx configuration
    mv nginx.conf.http nginx.conf
    
    # Restart services
    $COMPOSE_CMD down
    $COMPOSE_CMD up -d --remove-orphans
    
    log_success "Rollback completed - site running on HTTP"
    log_info "Site available at: http://$DOMAIN"
}

# Setup cron job for auto-renewal
setup_cron() {
    log_info "Setting up automatic certificate renewal..."
    
    CRON_JOB="0 12 * * * cd $(pwd) && ./setup-ssl.sh renew >> ./ssl-renewal.log 2>&1"
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "setup-ssl.sh renew"; then
        log_info "Cron job already exists"
    else
        # Add cron job
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
        log_success "Cron job added for automatic renewal (daily at 12:00 PM)"
    fi
}

# Display help
show_help() {
    echo "SSL Setup Script for CV Analyzer"
    echo
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  init      Initialize SSL certificates (first time setup)"
    echo "  renew     Renew existing certificates"
    echo "  status    Check certificate status"
    echo "  rollback  Rollback to HTTP configuration"
    echo "  cron      Setup automatic renewal cron job"
    echo "  help      Show this help message"
    echo
    echo "Examples:"
    echo "  $0 init     # First time SSL setup"
    echo "  $0 status   # Check if certificates are working"
    echo "  $0 renew    # Manual certificate renewal"
    echo
}

# Main script logic
main() {
    case "${1:-help}" in
        "init")
            init_certificates
            setup_cron
            ;;
        "renew")
            renew_certificates
            ;;
        "status")
            check_status
            ;;
        "rollback")
            rollback_configuration
            ;;
        "cron")
            setup_cron
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
