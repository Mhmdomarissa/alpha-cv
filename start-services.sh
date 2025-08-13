#!/bin/bash

echo "🚀 Starting CV Analyzer Services..."

# Start Backend (Docker)
echo "📦 Starting backend services with Docker..."
cd /home/ubuntu/alpha-backend
docker-compose up -d

# Wait for backend to be ready
echo "⏳ Waiting for backend to start..."
sleep 10

# Check if backend is healthy
if curl -s -f http://localhost:8000/health > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
fi

# Start Frontend in screen session
echo "🌐 Starting frontend in screen session..."
cd /home/ubuntu/cv-analyzer-frontend

# Kill existing screen session if it exists
screen -S cv-frontend -X quit 2>/dev/null || true

# Start new screen session with frontend
screen -dmS cv-frontend bash -c "npm run dev"

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 15

# Check if frontend is responding
if curl -s -f http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is responding"
else
    echo "❌ Frontend health check failed"
fi

echo ""
echo "🎉 Services Status:"
echo "📦 Backend: http://localhost:8000 (Docker)"
echo "🌐 Frontend: http://localhost:3000 (Screen session: cv-frontend)"
echo ""
echo "📋 Management Commands:"
echo "   View frontend logs: screen -r cv-frontend"
echo "   Detach from screen: Ctrl+A, then D"
echo "   Stop services: ./stop-services.sh"
echo "   Check status: ./check-services.sh" 