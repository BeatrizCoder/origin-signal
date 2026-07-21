#!/bin/bash
echo "🐝 Starting OriginSignal dev environment..."

# MongoDB
if ! docker ps | grep -q originsignal_mongo; then
  echo "Starting MongoDB..."
  docker start originsignal_mongo 2>/dev/null || docker run -d --name originsignal_mongo -p 27017:27017 mongo:7
fi

# Backend
echo "Starting backend..."
cd ~/projects/originsignal/backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &

# Frontend
echo "Starting frontend..."
cd ~/projects/originsignal/frontend
npm run dev &

echo "✅ OriginSignal running:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   Docs:     http://localhost:8000/docs"
