import React, { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
	Zap,
	FileText,
	Lightbulb,
	Info,
	CheckCircle2,
	TrendingUp,
	AlertTriangle,
	BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import QuickInsights from "./QuickInsights";
import RateRecommendations from "./RateRecommendations";
import { aiApi } from "@/services/api";
import { motion } from "framer-motion";

interface ExecutiveAnalysisResponse {
	analysis: {
		summary: string;
		key_findings: string[];
		opportunities: string[];
		risks: string[];
		trend_commentary: string;
	};
	metadata?: {
		session_id: number;
		generated_at: string;
		note?: string;
	};
}

interface AITabbedViewProps {
	sessionId?: number;
}

const AITabbedView: React.FC<AITabbedViewProps> = ({ sessionId }) => {
	const [quickInsights, setQuickInsights] = useState<any>(null);
	const [executiveAnalysis, setExecutiveAnalysis] =
		useState<ExecutiveAnalysisResponse | null>(null);
	const [recommendations, setRecommendations] = useState<any>(null);

	const [loadingQuick, setLoadingQuick] = useState(true);
	const [loadingAnalysis, setLoadingAnalysis] = useState(true);
	const [loadingRecommendations, setLoadingRecommendations] = useState(true);

	const [errorQuick, setErrorQuick] = useState<string>();
	const [errorAnalysis, setErrorAnalysis] = useState<string>();
	const [errorRecommendations, setErrorRecommendations] = useState<string>();

	const [retryCount, setRetryCount] = useState(0);
	const MAX_RETRIES = 3;

	useEffect(() => {
		loadAllInsights();
	}, [sessionId]);

	const loadAllInsights = async () => {
		// Reset states
		setLoadingQuick(true);
		setLoadingAnalysis(true);
		setLoadingRecommendations(true);
		setErrorQuick(undefined);
		setErrorAnalysis(undefined);
		setErrorRecommendations(undefined);

		try {
			// Call the parallel endpoint
			const response = await aiApi.getAllInsights(sessionId);
			const data = response.data;

			// Quick Insights
			if (data.quick_insights?.error) {
				setErrorQuick(data.quick_insights.error);
			} else {
				setQuickInsights(data.quick_insights);
			}
			setLoadingQuick(false);

			// Executive Analysis - with retry logic for fallback data
			if (data.executive_analysis?.error) {
				setErrorAnalysis(data.executive_analysis.error);
				setLoadingAnalysis(false);
			} else if (
				data.executive_analysis?.metadata?.note?.includes("Fallback") &&
				retryCount < MAX_RETRIES
			) {
				// Fallback detected, retry after delay
				setTimeout(() => {
					setRetryCount((prev) => prev + 1);
					retryExecutiveAnalysis();
				}, 2000);
			} else {
				setExecutiveAnalysis(data.executive_analysis);
				setLoadingAnalysis(false);
			}

			// Rate Recommendations
			if (data.recommendations?.error) {
				setErrorRecommendations(data.recommendations.error);
			} else {
				setRecommendations(data.recommendations);
			}
			setLoadingRecommendations(false);
		} catch (error: any) {
			console.error("Failed to load AI insights:", error);
			setErrorQuick("Failed to load insights");
			setErrorAnalysis("Failed to load analysis");
			setErrorRecommendations("Failed to load recommendations");
			setLoadingQuick(false);
			setLoadingAnalysis(false);
			setLoadingRecommendations(false);
		}
	};

	const retryExecutiveAnalysis = async () => {
		try {
			const response = await aiApi.generateExecutiveAnalysis(sessionId);
			const data = response.data;

			if (
				data?.metadata?.note?.includes("Fallback") &&
				retryCount < MAX_RETRIES
			) {
				// Still fallback, retry again
				setTimeout(() => {
					setRetryCount((prev) => prev + 1);
					retryExecutiveAnalysis();
				}, 2000);
			} else {
				setExecutiveAnalysis(data);
				setLoadingAnalysis(false);
			}
		} catch (error) {
			setErrorAnalysis("Analysis unavailable");
			setLoadingAnalysis(false);
		}
	};

	const [activeTab, setActiveTab] = useState("recommendations");

	const tabConfigs = [
		{
			value: "insights",
			icon: Zap,
			title: "Quick Insights",
			description: "Instant competitive gaps and urgent actions",
			tooltip:
				"This analyzes current rates across all carriers and highlights where you're being undercut or have opportunities to increase prices. It compares this week's data with last week to catch urgent changes.",
			gradient: "from-blue-500 to-blue-600",
			glowColor: "group-hover:shadow-blue-500/20",
		},
		{
			value: "analysis",
			icon: FileText,
			title: "Executive Analysis",
			description: "Comprehensive strategic assessment",
			tooltip:
				"This provides a comprehensive strategic view of your competitive position, identifying key findings, opportunities to optimize revenue, potential risks from competitors, and market trend commentary.",
			gradient: "from-purple-500 to-purple-600",
			glowColor: "group-hover:shadow-purple-500/20",
		},
		{
			value: "recommendations",
			icon: Lightbulb,
			title: "Rate Recommendations",
			description: "AI-powered pricing suggestions",
			tooltip:
				"The AI examines every price range where competitors have data, then suggests 5-10 specific rate changes. Each recommendation includes whether to increase, decrease, or add new rates, with detailed reasoning based on competitor positioning and historical trends.",
			gradient: "from-emerald-500 to-emerald-600",
			glowColor: "group-hover:shadow-emerald-500/20",
		},
	];

	return (
		<Card glass className="p-6">
			<div className="mb-6">
				<h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
					AI Competitive Intelligence
				</h2>
				<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
					AI-powered insights and recommendations
				</p>
			</div>

			<Tabs.Root value={activeTab} onValueChange={setActiveTab}>
				{/* Card-Style Tab Buttons */}
				<Tabs.List className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
					{tabConfigs.map((tab) => {
						const Icon = tab.icon;
						const isActive = activeTab === tab.value;

						return (
							<Tabs.Trigger key={tab.value} value={tab.value} asChild>
								<motion.button
									whileHover={{ scale: 1.02, y: -2 }}
									whileTap={{ scale: 0.98 }}
									className={`group relative p-5 rounded-xl border-2 transition-all duration-300 text-left ${
										isActive
											? `bg-gradient-to-br ${tab.gradient} text-white border-transparent shadow-lg ${tab.glowColor}`
											: "bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
									}`}
								>
									<div className="flex items-start gap-3">
										<div
											className={`p-2.5 rounded-lg ${
												isActive
													? "bg-white/20"
													: "bg-gray-100 dark:bg-gray-700"
											} group-hover:scale-110 transition-transform duration-300`}
										>
											<Icon
												className={`w-6 h-6 ${
													isActive
														? "text-white"
														: "text-gray-600 dark:text-gray-400"
												}`}
											/>
										</div>
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-1">
												<h3
													className={`font-semibold ${
														isActive
															? "text-white"
															: "text-gray-900 dark:text-gray-100"
													}`}
												>
													{tab.title}
												</h3>
												<Tooltip content={tab.tooltip}>
													<button
														type="button"
														onClick={(e) => e.stopPropagation()}
														className={`p-1 rounded-full hover:bg-white/20 transition-colors ${
															isActive
																? "text-white/80 hover:text-white"
																: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
														}`}
													>
														<Info className="w-4 h-4" />
													</button>
												</Tooltip>
											</div>
											<p
												className={`text-sm ${
													isActive
														? "text-white/90"
														: "text-gray-600 dark:text-gray-400"
												}`}
											>
												{tab.description}
											</p>
										</div>
									</div>
									{isActive && (
										<div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
									)}
								</motion.button>
							</Tabs.Trigger>
						);
					})}
				</Tabs.List>

				{/* Quick Insights Tab */}
				<Tabs.Content value="insights" className="focus:outline-none">
					<QuickInsights
						insights={quickInsights}
						loading={loadingQuick}
						error={errorQuick}
					/>
				</Tabs.Content>

				{/* Executive Analysis Tab */}
				<Tabs.Content value="analysis" className="focus:outline-none">
					{loadingAnalysis ? (
						<div className="space-y-4 animate-in fade-in duration-500">
							{[1, 2, 3, 4].map((i) => (
								<div
									key={i}
									className="h-32 bg-gradient-to-r from-purple-50/50 via-blue-50/50 to-purple-50/50 dark:from-purple-900/20 dark:via-blue-900/20 dark:to-purple-900/20 rounded-lg animate-pulse"
								/>
							))}
							<p className="text-center text-sm text-purple-600 dark:text-purple-400 animate-pulse">
								🤖 AI generating comprehensive executive analysis...
							</p>
						</div>
					) : errorAnalysis ? (
						<div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
							<p className="text-red-700 dark:text-red-300">{errorAnalysis}</p>
						</div>
					) : executiveAnalysis ? (
						<div className="space-y-6 animate-in fade-in duration-500">
							{/* Summary */}
							<div className="p-6 bg-gradient-to-br from-white/80 to-purple-50/30 dark:from-gray-800/80 dark:to-purple-900/20 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-gray-700/50">
								<h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-3">
									Executive Summary
								</h3>
								<p className="text-gray-900 dark:text-gray-100 leading-relaxed">
									{executiveAnalysis.analysis.summary}
								</p>
							</div>

							{/* Key Findings */}
							<div className="p-6 bg-gradient-to-br from-white/80 to-blue-50/30 dark:from-gray-800/80 dark:to-blue-900/20 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-gray-700/50">
								<h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-3">
									Key Findings
								</h3>
								<ul className="space-y-2">
									{executiveAnalysis.analysis.key_findings.map(
										(finding, idx) => (
											<li
												key={idx}
												className="flex items-start gap-2 text-gray-900 dark:text-gray-100"
											>
												<CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
												<span>{finding}</span>
											</li>
										)
									)}
								</ul>
							</div>

							{/* Opportunities & Risks */}
							<div className="grid md:grid-cols-2 gap-4">
								{/* Opportunities */}
								<div className="p-6 bg-gradient-to-br from-white/80 to-emerald-50/30 dark:from-gray-800/80 dark:to-emerald-900/20 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-gray-700/50">
									<h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300 mb-3">
										Opportunities
									</h3>
									<ul className="space-y-2">
										{executiveAnalysis.analysis.opportunities.map(
											(opp, idx) => (
												<li
													key={idx}
													className="flex items-start gap-2 text-gray-900 dark:text-gray-100"
												>
													<TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-1 flex-shrink-0" />
													<span>{opp}</span>
												</li>
											)
										)}
									</ul>
								</div>

								{/* Risks */}
								<div className="p-6 bg-gradient-to-br from-white/80 to-amber-50/30 dark:from-gray-800/80 dark:to-amber-900/20 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-gray-700/50">
									<h3 className="text-lg font-semibold text-amber-700 dark:text-amber-300 mb-3">
										Risks
									</h3>
									<ul className="space-y-2">
										{executiveAnalysis.analysis.risks.map((risk, idx) => (
											<li
												key={idx}
												className="flex items-start gap-2 text-gray-900 dark:text-gray-100"
											>
												<AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-1 flex-shrink-0" />
												<span>{risk}</span>
											</li>
										))}
									</ul>
								</div>
							</div>

							{/* Trend Commentary */}
							<div className="p-6 bg-gradient-to-br from-white/80 to-gray-50/30 dark:from-gray-800/80 dark:to-gray-900/20 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-gray-700/50">
								<div className="flex items-center gap-2 mb-3">
									<BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
									<h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
										Trend Commentary
									</h3>
								</div>
								<p className="text-gray-900 dark:text-gray-100 leading-relaxed">
									{executiveAnalysis.analysis.trend_commentary}
								</p>
							</div>
						</div>
					) : null}
				</Tabs.Content>

				{/* Rate Recommendations Tab */}
				<Tabs.Content value="recommendations" className="focus:outline-none">
					<RateRecommendations
						data={recommendations}
						loading={loadingRecommendations}
						error={errorRecommendations}
					/>
				</Tabs.Content>
			</Tabs.Root>
		</Card>
	);
};

export default AITabbedView;
