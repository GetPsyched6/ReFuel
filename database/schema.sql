-- ReFuel Database Schema
-- SQLite database for fuel surcharge competitive intelligence

-- Scrape sessions tracking
CREATE TABLE IF NOT EXISTS scrape_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL CHECK(status IN ('success', 'partial', 'failed')),
    carriers_scraped TEXT NOT NULL,  -- JSON array: ["UPS", "FedEx", "DHL"]
    total_rows INTEGER DEFAULT 0,
    notes TEXT
);

-- Fuel surcharge data
CREATE TABLE IF NOT EXISTS fuel_surcharges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    carrier TEXT NOT NULL CHECK(carrier IN ('UPS', 'FedEx', 'DHL')),
    service TEXT NOT NULL,
    at_least_usd REAL NOT NULL,
    but_less_than_usd REAL NOT NULL,
    surcharge_pct REAL NOT NULL,
    scraped_at DATETIME NOT NULL,
    FOREIGN KEY (session_id) REFERENCES scrape_sessions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_surcharges_session ON fuel_surcharges(session_id);
CREATE INDEX IF NOT EXISTS idx_surcharges_carrier ON fuel_surcharges(carrier);
CREATE INDEX IF NOT EXISTS idx_surcharges_price_range ON fuel_surcharges(at_least_usd, but_less_than_usd);

-- AI insights (cached)
CREATE TABLE IF NOT EXISTS ai_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    insight_type TEXT NOT NULL CHECK(insight_type IN ('summary', 'competitive_analysis', 'ups_optimization')),
    content TEXT NOT NULL,  -- JSON object
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    model_used TEXT,
    FOREIGN KEY (session_id) REFERENCES scrape_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_insights_session ON ai_insights(session_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON ai_insights(insight_type);

-- Notifications log
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('rate_change', 'scrape_complete', 'scrape_failed', 'significant_change')),
    message TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    recipient TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
    FOREIGN KEY (session_id) REFERENCES scrape_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_session ON notifications(session_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

