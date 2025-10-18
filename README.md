# ReFuel - Competitive Intelligence Platform

A comprehensive fuel surcharge competitive intelligence platform for UPS, featuring real-time scraping, AI-powered insights, and beautiful data visualization.

## Features

### Data & Intelligence

- **Automated Scraping**: Stealth scraping of UPS, FedEx, and DHL fuel surcharge rates using Selenium
- **4 Comparison Views**: Overlap, Comparable Ranges, Normalized Grid, and Complete data views
- **Smart Range Comparison**: Intelligent grouping of overlapping price ranges for meaningful side-by-side comparisons
- **Historical Trends**: Track rate changes over time with beautiful line charts
- **Visual Charts**: Line and bar charts for all comparison views

### AI-Powered Features

**Beautiful Card-Style Tab Interface** - Premium AI insights with intuitive navigation:

1. **Quick Insights Tab** (Intelligent Competitive Analysis):

   - **Competitive Gaps**: Where you're being undercut or have pricing power
   - **Urgent Actions**: Real-time alerts for immediate threats/opportunities with visual badges
   - **Week-Over-Week Trends**: Who increased/decreased rates and by how much
   - Historical comparison with previous session
   - Smart urgency detection (amber badge when action needed)
   - Fixed formatting (no more "2e+01%" bugs)

2. **Executive Analysis Tab** (Strategic Deep Dive):

   - Comprehensive strategic analysis
   - Key findings with data-backed insights
   - Opportunities and risks assessment
   - Trend commentary and forecasting
   - Auto-retry logic to prevent fallback data
   - Executive-ready presentation

3. **Rate Recommendations Tab** (AI-Powered Pricing):
   - **5-10 intelligent suggestions** with full context
   - **Beautiful card layout** - easy to scan, no more accordion
   - Four recommendation types with color coding:
     - Rate Adjustment (blue) - optimize existing rates
     - New Offering (emerald) - fill market gaps
     - Competitive Response (purple) - react to moves
     - Defensive Move (orange) - protect position
   - **Clear visual hierarchy**:
     - Large badges for current → suggested rates
     - Competitor rates in small chips
     - AI reasoning in readable boxes
     - Impact analysis with dedicated sections for revenue, competitive position, and historical context
   - Historical data integration
   - All recommendations visible at once

**Contextual Help Tooltips**:

- Info icons (ⓘ) on each tab card
- Natural language explanations
- Hover to learn what each AI feature does
- No technical jargon

**🤖 Intelligent Chatbot** (Separate Panel):

- Context-aware conversational AI with markdown support
- Answer questions about rates and prices
- Compare carriers and find competitive gaps
- Analyze trends and historical data
- Provide optimization recommendations
- Conversation memory for natural dialogue
- Query intelligence with automatic data fetching

**Parallel AI Processing**:

- All three AI insights generate simultaneously
- Independent loading states per tab
- Switch tabs while AI processes (non-blocking)
- Robust error handling per insight

### Technical Infrastructure

- **MCP Server**: Model Context Protocol server for AI agent integration
- **Watsonx AI**: Direct REST API integration with Llama 3.3 70B (robust JSON parsing, auto-refreshing tokens)
- **SQLite Database**: Historical data storage with session tracking
- **API-First Design**: RESTful API for all features

### User Experience

- **Welcome Dashboard**: Time-aware greeting with live data status
- **Custom Dropdown**: Beautiful portal-based dropdown with animations (no occlusion)
- **Premium UI**: Glassmorphism design with dark/light mode, gradients, and smooth animations
- **Sticky Headers**: Table headers remain visible while scrolling
- **Professional Color Scheme**: Blue (UPS), Emerald (FedEx), Orange (DHL) - optimized for accessibility

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

## Installation

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

Create `backend/.env` (copy from `backend/.env.example`):

```env
# Watsonx AI Configuration
WATSONX_API_KEY=your_api_key_here
WATSONX_PROJECT_ID=your_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL=meta-llama/llama-3-3-70b-instruct

# Optional: Email notifications (future use)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

**Note**: The Watsonx IAM token expires every 24 hours and is automatically refreshed by the token manager.

## Running the Application

### Quick Start (Recommended)

```bash
./start.sh
```

This will start both backend and frontend in the background with logging.

### Manual Start

#### Start Backend (Terminal 1)

```bash
cd backend
source venv/bin/activate
python run.py
```

API will be available at: http://localhost:8000  
API Docs: http://localhost:8000/docs

#### Start MCP Server (Terminal 2, optional)

```bash
cd backend
source venv/bin/activate
python run_mcp.py
```

#### Start Frontend (Terminal 3)

```bash
cd frontend
npm run dev
```

Frontend will be available at: http://localhost:5173

### Stopping the Application

```bash
# Kill backend
lsof -ti:8000 | xargs kill -9

# Kill frontend
pkill -f "vite"
```

## API Endpoints

### Scraper

- `POST /api/scraper/scrape` - Trigger manual scrape
- `GET /api/scraper/latest` - Get latest session
- `GET /api/scraper/sessions` - List sessions
- `GET /api/scraper/sessions/{id}/data` - Get session data

### Comparison

- `GET /api/comparison/compare?view={normalized|overlap|complete|comparable}&session_id={id}` - Compare carriers
- `GET /api/comparison/carrier/{carrier}` - Carrier-focused view

### History

- `GET /api/history/sessions` - Get all scrape sessions with metadata
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

## 🤖 AI Features Deep Dive

### Executive Analysis

Generates comprehensive strategic insights including:

- **Executive Summary**: 2-3 sentence overview of competitive landscape
- **Key Findings**: 4-5 data-driven insights with specific numbers
- **Opportunities**: 2-3 areas for competitive advantage or optimization
- **Risks & Considerations**: Areas of concern or competitive disadvantage
- **Market Trends**: Commentary on rate changes and market direction

### Intelligent Chatbot

The chatbot automatically detects query intent and provides relevant responses:

**Query Types**:

- **Rate Queries**: "What's UPS rate at $3.50?" → Returns specific rate information
- **Comparisons**: "Compare UPS and FedEx" → Shows carrier-by-carrier comparison
- **Extremes**: "Which carrier has the lowest rates?" → Returns min/max analysis
- **Opportunities**: "How can we optimize pricing?" → Provides strategic recommendations
- **Historical**: "What changed last week?" → Analyzes trends (requires historical data)

**Conversation Memory**: Remembers last 10 exchanges (20 messages) for natural dialogue

### Real-Time Insights

Three dynamic cards showing:

1. **Key Metrics**: Average surcharge % for each carrier (calculated from real data)
2. **Opportunities**: AI-identified competitive gaps and optimization areas
3. **Recommendations**: Strategic recommendations based on current data

## UI Features

- **Welcome Dashboard**: Time-aware greeting with last update status and live data indicator
- **Executive Analysis Card**: Comprehensive AI analysis with color-coded sections
- **Glassmorphism**: Modern glass-effect cards with backdrop blur
- **Dark/Light Mode**: Seamless theme toggle with smooth transitions
- **Animations**: Smooth Framer Motion transitions and hover effects
- **Data Visualization**: Interactive line & bar charts for all comparison views using Recharts
- **Custom Dropdown**: Portal-based dropdown with animations and scroll-to-close
- **Sticky Table Headers**: Headers stay visible when scrolling long tables
- **Responsive**: Mobile-friendly design with responsive layouts
- **Professional Color Scheme**: Blue (UPS), Emerald (FedEx), Orange (DHL) - optimized for accessibility
- **Gradient Accents**: Beautiful gradients throughout (blue-purple, purple-blue)
- **Session Selector**: View historical data with elegant custom dropdown

## 📝 Database Schema

See `database/schema.sql` for complete schema.

**Main Tables:**

- `scrape_sessions` - Scraping sessions
- `fuel_surcharges` - Fuel surcharge data
- `ai_insights` - Cached AI insights
- `notifications` - Notification log

## 🔄 Scraping

The scraper uses Selenium with advanced stealth techniques:

- **Headless Chrome**: Undetected automated browsing
- **User Agent Spoofing**: Mimics real browser behavior
- **Navigator Property Masking**: Hides automation flags
- **CDP Commands**: Chrome DevTools Protocol for anti-detection
- **Intelligent Table Selection**: Filters out historical/archived tables to ensure only current data is scraped
- **Accordion Handling**: Automatically expands collapsed sections (FedEx)
- **Cookie Management**: Handles cookie consent popups

**Supported Carriers:**

- UPS Ground: Direct scraping from official fuel surcharge page
- FedEx Ground: Handles accordion UI and dynamic content
- DHL Road: Scrapes German site with proper table identification

**Data Accuracy:**

- Only current fuel surcharge tables are scraped (not historical/archived data)
- All data is validated and cleaned before storage
- Each scrape session is tracked with metadata

## Comparison Views

1. **Overlap View**: Only ranges where all 3 carriers have data - perfect for direct comparison
2. **Comparable Ranges**: Intelligent grouping of overlapping ranges where at least 2 carriers have data - shows intersection ranges for meaningful comparison
3. **Normalized Grid**: $0.25 intervals showing actual scraped data only (no interpolation) - blank cells indicate no data
4. **Complete View**: All ranges from all carriers - comprehensive but sparse

## 🤖 AI Integration

Powered by IBM Watsonx REST API (Llama 3.3 70B):

- **Direct REST API**: Uses `httpx` for direct Watsonx API calls (no SDK)
- **Robust JSON Parsing**: Multiple fallback strategies for handling non-standard JSON responses
- **Auto Token Refresh**: IAM token manager with 24-hour expiration handling
- **Aggressive Prompt Engineering**: Optimized prompts for reliable JSON output
- **Competitive Analysis**: AI-powered insights and recommendations
- **UPS-Focused**: Revenue optimization and competitive positioning insights
- **Interactive Chatbot**: Context-aware conversational AI for data exploration

## 🚧 Future Enhancements

- [ ] Cron job for automated scraping
- [ ] Email notifications for rate changes
- [ ] Export to Excel/PDF
- [ ] Advanced trend predictions
- [ ] Multi-user authentication

## Troubleshooting

### Backend Issues

**Port 8000 already in use:**

```bash
lsof -ti:8000 | xargs kill -9
```

**Module import errors:**

- Ensure virtual environment is activated
- Check `sys.path.insert` statements in backend files
- Reinstall dependencies: `pip install -r requirements.txt`

**Selenium/Chrome issues:**

- Install Chrome/Chromium browser
- Install webdriver-manager: `pip install webdriver-manager`
- Check Chrome version compatibility

### Frontend Issues

**Port 5173 in use:**

```bash
pkill -f "vite"
```

**Build errors:**

- Clear node_modules: `rm -rf node_modules && npm install`
- Check TypeScript errors in console
- Ensure all dependencies are installed

### Scraping Issues

**No data returned:**

- Check website URLs are still valid
- Verify websites haven't changed structure
- Check browser console for JavaScript errors
- Review scraper logs for detailed error messages

**Historical data instead of current:**

- The scraper filters out historical tables automatically
- Check `scraper_selenium.py` for table selection logic

### AI/Watsonx Issues

**Invalid token:**

- Verify `WATSONX_API_KEY` in `.env`
- Token auto-refreshes every 24 hours
- Check token manager logs

**JSON parsing errors:**

- Multiple fallback strategies handle malformed JSON
- Check AI service logs for details
- Llama 3.3 70B sometimes returns unbalanced braces (handled automatically)

## 📄 License

Proprietary

---

**Note**: Ensure you have Chrome/Chromium installed for Selenium scraping.
