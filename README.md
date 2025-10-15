# ReFuel - Competitive Intelligence Platform

A comprehensive fuel surcharge competitive intelligence platform for UPS, featuring real-time scraping, AI-powered insights, and beautiful data visualization.

## 🚀 Features

- **Automated Scraping**: Stealth scraping of UPS, FedEx, and DHL fuel surcharge rates
- **Multiple Comparison Views**: Normalized, Overlap, and Complete data views
- **AI Insights**: Watsonx-powered competitive analysis and recommendations
- **Interactive Chatbot**: Ask questions about fuel surcharge data
- **Historical Trends**: Track rate changes over time with beautiful charts
- **MCP Server**: Model Context Protocol server for AI agent integration
- **Premium UI**: Glassmorphism design with dark/light mode

## 📁 Project Structure

```
ReFuel/
├── backend/                 # Python FastAPI backend
│   ├── api/                # API routes
│   ├── mcp/                # MCP server
│   ├── models/             # Database models
│   ├── services/           # Business logic
│   ├── scraper/            # Selenium scraper
│   └── config.py           # Configuration
├── frontend/               # React frontend
│   ├── src/
│   │   ├── features/       # Feature modules
│   │   ├── components/     # UI components
│   │   └── services/       # API client
├── database/               # SQLite database
└── fuel_scraper/          # Original scraper (reference)
```

## 🛠️ Tech Stack

**Backend:**

- Python 3.11+
- FastAPI
- SQLite + aiosqlite
- Selenium (web scraping)
- Watsonx AI (REST API - Llama 3.3 70B)
- MCP (Model Context Protocol)

**Frontend:**

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Recharts
- Radix UI

## 📦 Installation

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install webdriver-manager  # For Selenium
```

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install
```

### Environment Configuration

Create `backend/.env`:

```env
# Watsonx AI
WATSONX_API_KEY=your_api_key_here
WATSONX_PROJECT_ID=your_project_id_here

# Optional: Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

## 🚀 Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
source venv/bin/activate
python run.py
```

API will be available at: http://localhost:8000
API Docs: http://localhost:8000/docs

### Start MCP Server (Terminal 2, optional)

```bash
cd backend
source venv/bin/activate
python run_mcp.py
```

### Start Frontend (Terminal 3)

```bash
cd frontend
npm run dev
```

Frontend will be available at: http://localhost:5173

## 📊 API Endpoints

### Scraper

- `POST /api/scraper/scrape` - Trigger manual scrape
- `GET /api/scraper/latest` - Get latest session
- `GET /api/scraper/sessions` - List sessions
- `GET /api/scraper/sessions/{id}/data` - Get session data

### Comparison

- `GET /api/comparison/compare?view={normalized|overlap|complete}` - Compare carriers
- `GET /api/comparison/carrier/{carrier}` - Carrier-focused view

### History

- `GET /api/history/trends?days=30` - Get historical trends
- `GET /api/history/changes` - Detect significant changes

### AI

- `POST /api/ai/insights` - Generate AI insights
- `POST /api/ai/chat` - Chat with AI assistant

## 🤖 MCP Server

The MCP server exposes fuel surcharge data for AI agent integration:

**Available Tools:**

- `get_current_rates` - Latest rates
- `get_historical_rates` - Historical data
- `compare_carriers` - Side-by-side comparison
- `get_trends` - Trend analysis
- `get_insights` - AI insights

## 🎨 UI Features

- **Glassmorphism**: Modern glass-effect cards
- **Dark/Light Mode**: Toggle theme
- **Animations**: Smooth Framer Motion transitions
- **Data Visualization**: Line & bar charts for all comparison views
- **Responsive**: Mobile-friendly design
- **UPS Branding**: Brown and gold color scheme

## 📝 Database Schema

See `database/schema.sql` for complete schema.

**Main Tables:**

- `scrape_sessions` - Scraping sessions
- `fuel_surcharges` - Fuel surcharge data
- `ai_insights` - Cached AI insights
- `notifications` - Notification log

## 🔄 Scraping

The scraper uses Selenium with stealth techniques:

- Headless Chrome
- User agent spoofing
- Navigator property masking
- CDP commands for anti-detection

**Supported Carriers:**

- ✅ UPS Ground
- ✅ FedEx Ground
- ✅ DHL Road

## 📈 Comparison Views

1. **Normalized Grid**: $0.25 intervals with interpolation
2. **Overlap View**: Only ranges where all carriers have data
3. **Complete View**: All ranges from all carriers

## 🤖 AI Integration

Powered by IBM Watsonx:

- Competitive analysis
- UPS-focused recommendations
- Revenue optimization insights
- Interactive chatbot

## 🚧 Future Enhancements

- [ ] Cron job for automated scraping
- [ ] Email notifications for rate changes
- [ ] Export to Excel/PDF
- [ ] Advanced trend predictions
- [ ] Multi-user authentication

## 📄 License

Proprietary - Internal UPS POC

## 👥 Team

Built for UPS competitive intelligence

---

**Note**: Ensure you have Chrome/Chromium installed for Selenium scraping.
