import React from "react";
import { AlertTriangle, TrendingUp, Target } from "lucide-react";

interface QuickInsightsData {
	competitive_gaps: string;
	urgent_actions: string;
	trend_summary: string;
}

interface QuickInsightsProps {
	insights: QuickInsightsData | null;
	loading: boolean;
	error?: string;
}

const QuickInsights: React.FC<QuickInsightsProps> = ({
	insights,
	loading,
	error,
}) => {
	if (loading) {
		return (
			<div className="space-y-4 animate-in fade-in duration-500">
				{[1, 2, 3].map((i) => (
					<div
						key={i}
						className="h-20 bg-gradient-to-r from-blue-50/50 via-purple-50/50 to-blue-50/50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-blue-900/20 rounded-lg animate-pulse"
					/>
				))}
				<p className="text-center text-sm text-blue-600 dark:text-blue-400 animate-pulse">
					🤖 AI analyzing competitive landscape...
				</p>
			</div>
		);
	}

	if (error || !insights) {
		return (
			<div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
				<p className="text-red-700 dark:text-red-300">
					{error || "Unable to generate quick insights"}
				</p>
			</div>
		);
	}

	// Check if urgent actions contain "No urgent" or similar
	const isUrgent =
		insights &&
		!insights.urgent_actions.toLowerCase().includes("no urgent") &&
		!insights.urgent_actions.toLowerCase().includes("no significant");

	return (
		<div className="space-y-4 animate-in fade-in duration-500">
			{/* Competitive Gaps */}
			<div className="group p-6 bg-gradient-to-br from-white/80 to-blue-50/50 dark:from-gray-800/80 dark:to-blue-900/20 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-300">
				<div className="flex items-start gap-3">
					<div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
						<Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
					</div>
					<div className="flex-1">
						<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
							Competitive Gaps
						</h4>
						<p className="text-gray-900 dark:text-gray-100 leading-relaxed">
							{insights.competitive_gaps}
						</p>
					</div>
				</div>
			</div>

			{/* Urgent Actions */}
			<div
				className={`group p-6 bg-gradient-to-br ${
					isUrgent
						? "from-white/80 to-amber-50/50 dark:from-gray-800/80 dark:to-amber-900/20 border-amber-300 dark:border-amber-700"
						: "from-white/80 to-emerald-50/50 dark:from-gray-800/80 dark:to-emerald-900/20 border-gray-200/50 dark:border-gray-700/50"
				} backdrop-blur-sm rounded-lg border shadow-sm hover:shadow-md transition-all duration-300`}
			>
				<div className="flex items-start gap-3">
					<div
						className={`p-2 ${
							isUrgent
								? "bg-amber-500/10 dark:bg-amber-500/20"
								: "bg-emerald-500/10 dark:bg-emerald-500/20"
						} rounded-lg group-hover:scale-110 transition-transform duration-300`}
					>
						<AlertTriangle
							className={`w-5 h-5 ${
								isUrgent
									? "text-amber-600 dark:text-amber-400"
									: "text-emerald-600 dark:text-emerald-400"
							}`}
						/>
					</div>
					<div className="flex-1">
						<div className="flex items-center gap-2 mb-2">
							<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
								Urgent Actions
							</h4>
							{isUrgent && (
								<span className="px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full border border-amber-300 dark:border-amber-700">
									Action Required
								</span>
							)}
						</div>
						<p className="text-gray-900 dark:text-gray-100 leading-relaxed">
							{insights.urgent_actions}
						</p>
					</div>
				</div>
			</div>

			{/* Trend Summary */}
			<div className="group p-6 bg-gradient-to-br from-white/80 to-purple-50/50 dark:from-gray-800/80 dark:to-purple-900/20 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-300">
				<div className="flex items-start gap-3">
					<div className="p-2 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
						<TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
					</div>
					<div className="flex-1">
						<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
							Week-Over-Week Trends
						</h4>
						<p className="text-gray-900 dark:text-gray-100 leading-relaxed">
							{insights.trend_summary}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default QuickInsights;
