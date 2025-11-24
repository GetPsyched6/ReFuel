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
		view:
			| "normalized"
			| "normalized_fine"
			| "overlap"
			| "complete"
			| "comparable"
			| "raw" = "normalized",
		sessionId?: number,
		includePrevious: boolean = false,
		fuelCategory?: string,
		market?: string,
		carriers?: string[]
	) => {
		const params: Record<string, any> = {
			view,
			include_previous: includePrevious,
		};

		if (sessionId !== undefined) params.session_id = sessionId;
		if (fuelCategory && fuelCategory !== "all")
			params.fuel_category = fuelCategory;
		if (market) params.market = market;
		if (carriers && carriers.length > 0) params.carriers = carriers.join(",");

		return api.get("/comparison/compare", { params });
	},

	getComparisonMultiCurves: (
		view:
			| "normalized"
			| "normalized_fine"
			| "overlap"
			| "complete"
			| "comparable"
			| "raw" = "normalized",
		curveVersionIds: number[],
		fuelCategory?: string,
		market?: string,
		carriers?: string[]
	) => {
		const params: Record<string, any> = {
			view,
			curve_version_ids: curveVersionIds.join(","),
		};

		if (fuelCategory && fuelCategory !== "all")
			params.fuel_category = fuelCategory;
		if (market) params.market = market;
		if (carriers && carriers.length > 0) params.carriers = carriers.join(",");

		return api.get("/comparison/compare", { params });
	},

	getCarrierFocus: (
		carrier: string,
		sessionId?: number,
		fuelCategory?: string,
		market?: string
	) =>
		api.get(`/comparison/carrier/${carrier}`, {
			params: {
				session_id: sessionId,
				fuel_category: fuelCategory !== "all" ? fuelCategory : undefined,
				market,
			},
		}),

	getCarrierLastUpdates: (
		sessionId?: number,
		fuelCategory?: string,
		market?: string
	) =>
		api.get("/comparison/carrier-last-updates", {
			params: {
				session_id: sessionId,
				fuel_category: fuelCategory !== "all" ? fuelCategory : undefined,
				market,
			},
		}),
};

// History endpoints
export const historyApi = {
	getSessions: () => api.get("/history/sessions"),

	getSessionDetails: (sessionId: number) =>
		api.get(`/history/sessions/${sessionId}/details`),

	getTrends: (
		carriers?: string[],
		days?: number,
		fuelCategory?: string,
		market?: string,
		startDate?: string,
		endDate?: string
	) => {
		const params: any = {};
		// Send carriers as array - axios will convert to multiple query params
		if (carriers && carriers.length > 0) params.carriers = carriers.join(",");
		if (days !== undefined) params.days = days;
		if (fuelCategory && fuelCategory !== "all")
			params.fuel_category = fuelCategory;
		if (market) params.market = market;
		if (startDate) params.start_date = startDate;
		if (endDate) params.end_date = endDate;
		return api.get("/history/trends", { params });
	},

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

// Metadata endpoints
export const metadataApi = {
	getFilterOptions: () => api.get("/metadata/filters"),
	getInflectionSkipList: () => api.get("/metadata/inflection-skip-list"),
};

// Fuel curve versions endpoints
export const fuelCurveApi = {
	getVersions: (market?: string, fuelCategory?: string, carriers?: string[]) => {
		const params: Record<string, any> = {};
		if (market) params.market = market;
		if (fuelCategory && fuelCategory !== "all") params.fuel_category = fuelCategory;
		if (carriers && carriers.length > 0) params.carriers = carriers.join(",");
		
		return api.get("/fuel-curves/versions", { params });
	},
};

// Overview analytics endpoints
export const overviewApi = {
	getAnalytics: (market: string, fuelCategory: string, outlierThreshold: number = 2.0) =>
		api.get("/overview/analytics", {
			params: {
				market,
				fuel_category: fuelCategory,
				outlier_threshold: outlierThreshold,
			},
		}),

	getAvailableContexts: () => api.get("/overview/available-contexts"),
};

export default api;
