#!/bin/bash

echo "🚀 Starting CV Analyzer System..."

# Stop any existing containers first
echo "🛑 Stopping existing containers..."
docker-compose down

# Start all services
echo "✅ Starting all services..."
docker-compose up -d

# Wait a moment for services to initialize
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Checking service status..."
docker-compose ps

echo ""
echo "🎉 System started! Access your application at:"
echo "   🌐 Frontend: http://localhost:3000"
echo "   🔧 Backend: http://localhost:8000"
echo "   📚 API Docs: http://localhost:8000/docs"
echo "   🗄️  Database: localhost:5433"
echo "   🔍 Vector DB: localhost:6333"
echo ""
echo "📋 To stop the system, run: ./stop-system.sh"
echo "📋 To view logs, run: docker-compose logs -f"
