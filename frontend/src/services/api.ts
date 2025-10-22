import axios from "axios";

const API_BASE = "/api";

export const api = axios.create({
	baseURL: API_BASE,
	headers: {
		"Content-Type": "application/json",
	},
});

// Scraper endpoints
export const scraperApi = {
	triggerScrape: (carriers?: string[]) =>
		api.post("/scraper/scrape", { carriers }),

	getLatestSession: () => api.get("/scraper/latest"),

	getSessionData: (sessionId: number) =>
		api.get(`/scraper/sessions/${sessionId}/data`),

	getSessions: (limit = 10) => api.get(`/scraper/sessions?limit=${limit}`),
};

// Comparison endpoints
export const comparisonApi = {
	getComparison: (
		view: "normalized" | "overlap" | "complete" | "comparable" = "normalized",
		sessionId?: number,
		includePrevious: boolean = false
	) =>
		api.get("/comparison/compare", {
			params: {
				view,
				session_id: sessionId,
				include_previous: includePrevious,
			},
		}),

	getCarrierFocus: (carrier: string, sessionId?: number) =>
		api.get(`/comparison/carrier/${carrier}`, {
			params: { session_id: sessionId },
		}),

	getCarrierLastUpdates: (sessionId?: number) =>
		api.get("/comparison/carrier-last-updates", {
			params: { session_id: sessionId },
		}),
};

// History endpoints
export const historyApi = {
	getSessions: () => api.get("/history/sessions"),

	getSessionDetails: (sessionId: number) =>
		api.get(`/history/sessions/${sessionId}/details`),

	getTrends: (carriers?: string[], days = 30) =>
		api.get("/history/trends", {
			params: { carriers, days },
		}),

	getChanges: (thresholdPct = 0.5) =>
		api.get("/history/changes", {
			params: { threshold_pct: thresholdPct },
		}),
};

// AI endpoints
export const aiApi = {
	generateInsights: (sessionId?: number) =>
		api.post("/ai/insights", { session_id: sessionId }),

	getInsights: (sessionId: number) => api.get(`/ai/insights/${sessionId}`),

	chat: (message: string, history: any[] = [], sessionId?: number) =>
		api.post("/ai/chat", { message, history, session_id: sessionId }),

	generateExecutiveAnalysis: (sessionId?: number) =>
		api.post("/ai/executive-analysis", { session_id: sessionId }),

	generateQuickInsights: (sessionId?: number) =>
		api.post("/ai/quick-insights", { session_id: sessionId }),

	generateRateRecommendations: (sessionId?: number) =>
		api.post("/ai/rate-recommendations", { session_id: sessionId }),

	getAllInsights: (sessionId?: number) =>
		api.post("/ai/all-insights", { session_id: sessionId }),
};

export default api;
