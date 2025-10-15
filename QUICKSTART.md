# ReFuel - Quick Start Guide

Get ReFuel up and running in 5 minutes!

## Fastest Way (One Command)

```bash
# From project root
./start.sh
```

This script will:

1. Create Python virtual environment if needed
2. Install all dependencies
3. Start backend API (port 8000)
4. Start frontend (port 5173)
5. Show you the URLs

## Manual Start (Step by Step)

### 1. Backend

```bash
cd backend

# First time setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy environment template and add your Watsonx API key
cp .env.example .env
nano .env

# Start API server
python run.py
```

### 2. Frontend

```bash
cd frontend

# First time setup
npm install

# Start dev server
npm run dev
```

## Access the Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## First Steps

1. **Configure Watsonx** (for AI features):

   - Edit `backend/.env`
   - Add your `WATSONX_API_KEY` and `WATSONX_PROJECT_ID`

2. **Run Your First Scrape**:

   - Open http://localhost:5173
   - Click "Scrape Now" button
   - Wait ~30 seconds for data to load

3. **Explore the UI**:
   - View AI-generated insights at the top
   - Try different comparison views (Normalized, Overlap, Complete)
   - Check historical trends chart
   - Chat with AI assistant (bottom right button)

## MCP Server (For AI Agents)

To start the MCP server for agent integration:

```bash
cd backend
source venv/bin/activate
python run_mcp.py
```

The MCP server runs in stdio mode for seamless agent integration.

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port
lsof -ti:8000 | xargs kill -9  # Backend
lsof -ti:5173 | xargs kill -9  # Frontend
```

### Dependencies Missing

```bash
# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Chrome Driver Issues

```bash
# Install webdriver-manager
pip install webdriver-manager

# Ensure Chrome is installed
brew install --cask google-chrome  # macOS
```

## Next Steps

- Read `README.md` for full documentation
- See `SETUP.md` for detailed configuration
- Check `refuel-poc-architecture.plan.md` for architecture details

## Support

For issues:

- Check logs in `./logs/` directory
- Review API documentation at `/docs` endpoint
- Ensure Chrome browser is installed for scraping

---

**Enjoy exploring fuel surcharge intelligence! 📊🚀**
