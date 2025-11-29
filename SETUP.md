# ReFuel - Setup Guide

Fuel surcharge competitive intelligence dashboard with AI-powered insights.

---

## Quick Start (TL;DR)

```bash
# 1. Install dependencies
cd backend && pip install -r requirements.txt
cd ../frontend && npm install

# 2. Add your Watsonx keys to backend/.env
echo "WATSONX_API_KEY=your_key" > backend/.env
echo "WATSONX_PROJECT_ID=your_project_id" >> backend/.env

# 3. Run it
cd backend && python run.py &
cd frontend && npm run dev
```

Database with all fuel curve data is **already included** - no setup needed!

---

## Prerequisites

- **Python 3.9+**
- **Node.js 18+**
- **IBM Watsonx API access** (for AI features)

---

## 1. Clone & Install

```bash
# Backend dependencies
cd backend
pip install -r requirements.txt

# Frontend dependencies
cd ../frontend
npm install
```

---

## 2. Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# IBM Watsonx AI (required for AI features)
WATSONX_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id

# Optional - defaults shown
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL=ibm/granite-13b-chat-v2
```

### Getting Watsonx Credentials

1. Go to [IBM Cloud](https://cloud.ibm.com/)
2. Create a Watsonx.ai instance
3. **API Key**: IAM → API Keys → Create
4. **Project ID**: Open your Watsonx project → Settings → Project ID

---

## 3. Database

The SQLite database (`database/refuel.db`) is **included in the repo** with all fuel curve data pre-loaded. No setup needed!

To verify data exists:
```bash
sqlite3 database/refuel.db "SELECT COUNT(*) FROM fuel_curve_versions WHERE is_active = 1;"
```

**Included data:**
- US: Ground Domestic, Domestic Air, International Air (UPS, FedEx, DHL)
- Germany: Ground Domestic (UPS, FedEx, DHL)

---

## 4. Running the Application

### Start Backend (Terminal 1)
```bash
cd backend
python run.py
```
Backend runs at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

### Start Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
Frontend runs at: `http://localhost:5173`

---

## 5. Features Overview

| Tab | Description |
|-----|-------------|
| **Overview** | Carrier comparison charts, version analysis |
| **Charts & Tables** | Detailed fuel curve visualizations |
| **Historical** | Week-over-week rate changes |
| **AI Insights** | AI-powered competitive intelligence |

### AI Features
- **Quick Insights**: Competitive gaps and urgent actions
- **Executive Analysis**: Strategic assessment
- **Rate Recommendations**: AI pricing suggestions
- **Chatbot**: Ask questions about fuel surcharge data

### Filters
- **Market**: US, Germany (DE)
- **Service Type**: Ground Domestic, Domestic Air, International Air, etc.
- **Carrier**: UPS, FedEx, DHL

---

## 6. Troubleshooting

### AI not working?
- Check `.env` has valid `WATSONX_API_KEY` and `WATSONX_PROJECT_ID`
- Verify API key has Watsonx permissions
- Check backend console for errors

### Database errors?
```bash
# Reset database (loses all data)
rm database/refuel.db
python backend/init_db.py
```

### Frontend not connecting?
- Ensure backend is running on port 8000
- Check for CORS errors in browser console

---

## 7. Project Structure

```
ReFuel/
├── backend/
│   ├── api/routes/      # FastAPI endpoints
│   ├── services/        # AI service, scraper
│   ├── models/          # Database models
│   ├── config.py        # Settings
│   └── run.py           # Entry point
├── frontend/
│   ├── src/
│   │   ├── features/    # Dashboard, Overview, Insights
│   │   ├── components/  # Reusable UI components
│   │   └── services/    # API client
│   └── package.json
├── database/
│   └── refuel.db        # SQLite database
└── SETUP.md             # This file
```

---

## 8. Quick Commands Reference

```bash
# Start everything
cd backend && python run.py &
cd frontend && npm run dev

# Check database
sqlite3 database/refuel.db ".tables"

# Clear AI cache (via API)
curl -X POST http://localhost:8000/api/ai/invalidate-cache

# Scrape fresh data
curl -X POST http://localhost:8000/api/scraper/scrape
```

---

**Built with**: FastAPI, React, Recharts, Tailwind CSS, IBM Watsonx
