#!/bin/bash

# CV-JD Analysis System Service Management Script
# Usage: ./manage_services.sh [start|stop|restart|status|logs]

set -e

BACKEND_DIR="/home/ubuntu/alpha-backend"
FRONTEND_DIR="/home/ubuntu/cv-analyzer-frontend"

print_status() {
    echo "🔍 SERVICE STATUS CHECK"
    echo "========================"
    
    echo "📦 Docker Services:"
    cd "$BACKEND_DIR"
    docker-compose ps
    
    echo -e "\n🌐 Frontend Process:"
    if pgrep -f "next-server" > /dev/null; then
        echo "✅ Frontend running (PID: $(pgrep -f "next-server"))"
        echo "   Port 3000: $(netstat -tulpn 2>/dev/null | grep :3000 | wc -l) listener(s)"
    else
        echo "❌ Frontend not running"
    fi
    
    echo -e "\n🧪 Health Checks:"
    echo -n "Backend (port 8000): "
    if curl -s http://localhost:8000/health | grep -q "healthy"; then
        echo "✅ Healthy"
    else
        echo "❌ Unhealthy"
    fi
    
    echo -n "Frontend (port 3000): "
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
        echo "✅ Accessible"
    else
        echo "❌ Not accessible"
    fi
}

start_services() {
    echo "🚀 STARTING ALL SERVICES"
    echo "========================"
    
    echo "📦 Starting backend services (Docker)..."
    cd "$BACKEND_DIR"
    docker-compose up -d --build
    
    echo "🌐 Starting frontend service (persistent)..."
    cd "$FRONTEND_DIR"
    # Kill any existing frontend processes
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
    sleep 2
    
    # Start frontend in background with nohup
    nohup npm run dev > frontend.log 2>&1 &
    echo "Frontend started with PID: $!"
    
    echo "⏳ Waiting for services to initialize..."
    sleep 10
    
    print_status
}

stop_services() {
    echo "🛑 STOPPING ALL SERVICES"
    echo "========================"
    
    echo "📦 Stopping backend services..."
    cd "$BACKEND_DIR"
    docker-compose down --remove-orphans
    
    echo "🌐 Stopping frontend services..."
    pkill -f "npm run dev" 2>/dev/null || echo "No npm processes found"
    pkill -f "next-server" 2>/dev/null || echo "No Next.js processes found"
    
    echo "✅ All services stopped"
}

restart_services() {
    echo "🔄 RESTARTING ALL SERVICES"
    echo "=========================="
    stop_services
    echo ""
    start_services
}

show_logs() {
    echo "📋 SERVICE LOGS"
    echo "==============="
    
    echo "📦 Backend logs (last 20 lines):"
    cd "$BACKEND_DIR"
    docker-compose logs --tail=20
    
    echo -e "\n🌐 Frontend logs (last 20 lines):"
    if [ -f "$FRONTEND_DIR/frontend.log" ]; then
        tail -20 "$FRONTEND_DIR/frontend.log"
    else
        echo "No frontend log file found"
    fi
}

case "${1:-status}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        print_status
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "Usage: $0 [start|stop|restart|status|logs]"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services in persistent mode"
        echo "  stop    - Stop all services"
        echo "  restart - Stop and start all services"
        echo "  status  - Show current service status"
        echo "  logs    - Show recent service logs"
        echo ""
        echo "Default: status"
        exit 1
        ;;
esac
