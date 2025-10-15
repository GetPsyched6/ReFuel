# ReFuel - Setup Guide

Complete setup guide for the ReFuel Competitive Intelligence Platform.

## Prerequisites

- **Python 3.11+** (3.13 recommended)
- **Node.js 18+** and npm
- **Chrome/Chromium browser** (for Selenium)
- **Git**

## Quick Start (5 minutes)

### 1. Backend Setup

```bash
# Navigate to project root
cd /Volumes/RochusSSD/GenAI/ReFuel

# Create Python virtual environment
cd backend
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate  # Windows

# Install Python dependencies
pip install -r requirements.txt
pip install webdriver-manager setuptools

# Copy environment template
cp .env.example .env

# Edit .env with your Watsonx credentials
nano .env  # or use your preferred editor
```

### 2. Initialize Database

The database will be automatically created when you first start the backend. The schema is in `database/schema.sql`.

### 3. Frontend Setup

```bash
# Open new terminal
cd /Volumes/RochusSSD/GenAI/ReFuel/frontend

# Install Node dependencies
npm install
```

### 4. Start Services

**Terminal 1 - Backend API:**

```bash
cd /Volumes/RochusSSD/GenAI/ReFuel/backend
source venv/bin/activate
python run.py
```

**Terminal 2 - Frontend:**

```bash
cd /Volumes/RochusSSD/GenAI/ReFuel/frontend
npm run dev
```

**Terminal 3 - MCP Server (optional):**

```bash
cd /Volumes/RochusSSD/GenAI/ReFuel/backend
source venv/bin/activate
python run_mcp.py
```

### 5. Access Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **MCP Server**: stdio mode (for agents)

## Configuration

### Backend (.env)

```env
# Required for AI features
WATSONX_API_KEY=your_watsonx_api_key
WATSONX_PROJECT_ID=your_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL=ibm/granite-13b-chat-v2

# Optional email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
NOTIFICATION_EMAIL=recipient@example.com

# Debug mode
DEBUG=True
```

### Getting Watsonx Credentials

1. Go to [IBM Cloud](https://cloud.ibm.com)
2. Create/access Watson Studio project
3. Get API key from IAM settings
4. Get Project ID from project settings

## Troubleshooting

### Python Import Errors

If you see `ModuleNotFoundError`:

```bash
# Make sure venv is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt

# Add setuptools for Python 3.13
pip install setuptools
```

### Selenium/Chrome Issues

```bash
# Install webdriver-manager
pip install webdriver-manager

# Make sure Chrome is installed
# On macOS:
brew install --cask google-chrome
```

### Database Issues

```bash
# Delete and recreate database
rm ../database/refuel.db

# Restart backend - it will recreate automatically
python run.py
```

### Frontend Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# If path alias issues:
npm install -D @types/node
```

### Port Already in Use

```bash
# Find and kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or use different port in config.py
API_PORT=8001
```

## Development Workflow

### Running Tests

```bash
# Backend (when tests are added)
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Building for Production

```bash
# Frontend
cd frontend
npm run build

# Serve production build
npm run preview
```

### Database Migrations

Currently using direct SQL. For migrations:

```bash
# Create migration
touch database/migrations/001_add_new_table.sql

# Apply manually or integrate Alembic later
```

## Architecture Notes

### Backend Flow

1. FastAPI receives request
2. Service layer processes logic
3. Database layer handles persistence
4. Response returned

### Frontend Flow

1. React component calls API service
2. Axios makes HTTP request
3. Data processed and displayed
4. State managed with React hooks

### MCP Integration

- Exposes data via stdio
- Used by AI agents
- Implements MCP protocol tools

## Next Steps

1. ✅ Configure Watsonx credentials
2. ✅ Run initial scrape
3. ✅ Test all comparison views
4. ✅ Try AI insights and chatbot
5. ✅ Set up cron jobs (if needed)
6. ✅ Configure email notifications

## Support

For issues or questions:

- Check `README.md` for feature documentation
- Review API docs at `/docs` endpoint
- Check logs in console output

## Production Deployment

For production deployment:

1. Set `DEBUG=False` in `.env`
2. Configure proper CORS origins
3. Use production-grade WSGI server (Gunicorn)
4. Set up reverse proxy (Nginx)
5. Configure SSL certificates
6. Set up database backups
7. Configure monitoring and logging

---

**Happy coding! 🚀**
