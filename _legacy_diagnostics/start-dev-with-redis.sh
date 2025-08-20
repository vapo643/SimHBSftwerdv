#!/bin/bash

# Start development environment with Redis and Workers

echo "🚀 Starting development environment with Job Queue architecture..."

# Start Redis in background
echo "🔴 Starting Redis server..."
redis-server --port 6379 --daemonize yes

# Wait for Redis to be ready
sleep 2

# Check if Redis is running
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "❌ Failed to start Redis"
    exit 1
fi

# Start the API server
echo "🔵 Starting API server..."
NODE_ENV=development tsx server/index.ts &
API_PID=$!

# Wait a bit for API to initialize
sleep 3

# Start the Worker process
echo "🟢 Starting Worker process..."
NODE_ENV=development tsx server/worker.ts &
WORKER_PID=$!

echo "✅ All services started!"
echo "   - Redis: Port 6379"
echo "   - API Server: PID $API_PID (Port 5000)"
echo "   - Worker: PID $WORKER_PID"
echo ""
echo "Press Ctrl+C to stop all services"

# Handle shutdown
trap "echo '🛑 Shutting down...'; kill $API_PID $WORKER_PID; redis-cli shutdown; exit" INT TERM

# Keep script running
wait