#!/bin/bash

echo "🔍 Checking CV Analyzer Services Status..."
echo ""

# Check Backend (Docker)
echo "📦 Backend Status (Docker):"
cd /home/ubuntu/alpha-backend
if docker-compose ps | grep -q "Up"; then
    echo "   ✅ Docker containers are running"
    docker-compose ps
    echo ""
    
    # Check backend health endpoint
    if curl -s -f http://localhost:8000/health > /dev/null; then
        echo "   ✅ Backend API is responding (http://localhost:8000)"
    else
        echo "   ❌ Backend API is not responding"
    fi
else
    echo "   ❌ Docker containers are not running"
fi

echo ""

# Check Frontend (Screen session)
echo "🌐 Frontend Status (Screen):"
if screen -list | grep -q "cv-frontend"; then
    echo "   ✅ Frontend screen session is running"
    
    # Check frontend health
    if curl -s -f http://localhost:3000 > /dev/null; then
        echo "   ✅ Frontend is responding (http://localhost:3000)"
    else
        echo "   ❌ Frontend is not responding"
    fi
else
    echo "   ❌ Frontend screen session not found"
fi

echo ""
echo "📋 Management Commands:"
echo "   Start services: ./start-services.sh"
echo "   Stop services: ./stop-services.sh"
echo "   View frontend logs: screen -r cv-frontend"
echo "   List screen sessions: screen -list" 