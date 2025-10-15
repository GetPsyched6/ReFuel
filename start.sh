#!/bin/bash

# ReFuel - Quick Start Script
# Starts all services needed for the POC

# Colors for output
GREEN='\033[0.32m'
BLUE='\033[0.34m'
YELLOW='\033[1;33m'
NC='\033[0m'  # No Color

echo -e "${BLUE}🚀 ReFuel - Competitive Intelligence Platform${NC}"
echo -e "${BLUE}============================================${NC}\n"

# Check if virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Creating...${NC}"
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip setuptools
    pip install -r requirements.txt
    cd ..
fi

# Check if node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Node modules not found. Installing...${NC}"
    cd frontend
    npm install
    cd ..
fi

# Check for .env file
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Copying template...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${YELLOW}⚠️  Please edit backend/.env with your Watsonx credentials${NC}"
fi

echo -e "\n${GREEN}✅ Starting services...${NC}\n"

# Kill any existing processes on the ports
echo -e "${BLUE}Cleaning up ports...${NC}"
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Create logs directory
mkdir -p logs

# Start backend in background
echo -e "${GREEN}Starting backend API on port 8000...${NC}"
cd backend
source venv/bin/activate
python run.py > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend in background
echo -e "${GREEN}Starting frontend on port 5173...${NC}"
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo -e "\n${GREEN}✅ Services started!${NC}\n"
echo -e "${BLUE}📍 Frontend:${NC} http://localhost:5173"
echo -e "${BLUE}📍 Backend API:${NC} http://localhost:8000"
echo -e "${BLUE}📍 API Docs:${NC} http://localhost:8000/docs\n"

echo -e "${YELLOW}💡 Logs are in ./logs/${NC}"
echo -e "${YELLOW}💡 Press Ctrl+C to stop all services${NC}\n"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping services...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Services stopped${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Wait for both processes
wait

