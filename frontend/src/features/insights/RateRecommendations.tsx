import React from "react";
import {
	TrendingUp,
	Plus,
	Target,
	Shield,
	ArrowRight,
	DollarSign,
	Award,
	BarChart3,
} from "lucide-react";

interface RateRecommendation {
	type:
		| "rate_adjustment"
		| "new_offering"
		| "competitive_response"
		| "defensive_move";
	price_range_min: number;
	price_range_max: number;
	current_rate: number | null;
	suggested_rate: number;
	competitors: {
		FedEx?: number;
		DHL?: number;
	};
	reasoning: string;
	impact_analysis: {
		revenue_impact: string;
		competitive_position: string;
		historical_context?: string;
	};
}

interface RateRecommendationsData {
	recommendations: RateRecommendation[];
	metadata?: {
		session_id: number;
		generated_at: string;
		total_recommendations: number;
		note?: string;
	};
}

interface RateRecommendationsProps {
	data: RateRecommendationsData | null;
	loading: boolean;
	error?: string;
}

const getTypeConfig = (type: string) => {
	switch (type) {
		case "rate_adjustment":
			return {
				icon: TrendingUp,
				label: "Rate Adjustment",
				gradient: "from-blue-500/10 to-blue-600/10",
				borderColor: "border-blue-200 dark:border-blue-800",
				iconColor: "text-blue-600 dark:text-blue-400",
				bgColor: "bg-blue-500/5 dark:bg-blue-500/10",
			};
		case "new_offering":
			return {
				icon: Plus,
				label: "New Offering",
				gradient: "from-emerald-500/10 to-emerald-600/10",
				borderColor: "border-emerald-200 dark:border-emerald-800",
				iconColor: "text-emerald-600 dark:text-emerald-400",
				bgColor: "bg-emerald-500/5 dark:bg-emerald-500/10",
			};
		case "competitive_response":
			return {
				icon: Target,
				label: "Competitive Response",
				gradient: "from-purple-500/10 to-purple-600/10",
				borderColor: "border-purple-200 dark:border-purple-800",
				iconColor: "text-purple-600 dark:text-purple-400",
				bgColor: "bg-purple-500/5 dark:bg-purple-500/10",
			};
		case "defensive_move":
			return {
				icon: Shield,
				label: "Defensive Move",
				gradient: "from-orange-500/10 to-orange-600/10",
				borderColor: "border-orange-200 dark:border-orange-800",
				iconColor: "text-orange-600 dark:text-orange-400",
				bgColor: "bg-orange-500/5 dark:bg-orange-500/10",
			};
		default:
			return {
				icon: TrendingUp,
				label: "Adjustment",
				gradient: "from-gray-500/10 to-gray-600/10",
				borderColor: "border-gray-200 dark:border-gray-800",
				iconColor: "text-gray-600 dark:text-gray-400",
				bgColor: "bg-gray-500/5 dark:bg-gray-500/10",
			};
	}
};

const RateRecommendations: React.FC<RateRecommendationsProps> = ({
	data,
	loading,
	error,
}) => {
	if (loading) {
		return (
			<div className="space-y-4 animate-in fade-in duration-500">
				{[1, 2, 3, 4, 5].map((i) => (
					<div
						key={i}
						className="h-48 bg-gradient-to-r from-emerald-50/50 via-blue-50/50 to-emerald-50/50 dark:from-emerald-900/20 dark:via-blue-900/20 dark:to-emerald-900/20 rounded-xl animate-pulse"
					/>
				))}
				<p className="text-center text-sm text-emerald-600 dark:text-emerald-400 animate-pulse">
					🤖 AI generating intelligent rate recommendations...
				</p>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
				<p className="text-red-700 dark:text-red-300">
					{error || "Unable to generate recommendations"}
				</p>
			</div>
		);
	}

	if (data.recommendations.length === 0) {
		return (
			<div className="p-8 text-center bg-gradient-to-br from-white/80 to-gray-50/50 dark:from-gray-800/80 dark:to-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-gray-700/50">
				<Target className="w-12 h-12 mx-auto mb-3 text-gray-400" />
				<p className="text-gray-600 dark:text-gray-400">
					No recommendations available at this time
				</p>
				{data.metadata?.note && (
					<p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
						{data.metadata.note}
					</p>
				)}
			</div>
		);
	}

	return (
		<div className="space-y-3 animate-in fade-in duration-500">
			<div className="flex items-center justify-between mb-1">
				<p className="text-sm text-gray-600 dark:text-gray-400">
					{data.recommendations.length} AI-powered recommendations
				</p>
			</div>

			{data.recommendations.map((rec, idx) => {
				const config = getTypeConfig(rec.type);
				const Icon = config.icon;

				return (
					<div
						key={idx}
						className={`group bg-gradient-to-br from-white/90 to-white/50 dark:from-gray-800/90 dark:to-gray-900/50 backdrop-blur-sm rounded-xl border ${config.borderColor} shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden`}
					>
						{/* Header */}
						<div className={`p-3 bg-gradient-to-br ${config.gradient}`}>
							<div className="flex items-center gap-2">
								<div
									className={`p-2 ${config.bgColor} rounded-lg group-hover:scale-110 transition-transform duration-300`}
								>
									<Icon className={`w-4 h-4 ${config.iconColor}`} />
								</div>
								<div>
									<h3 className={`text-sm font-semibold ${config.iconColor}`}>
										{config.label}
									</h3>
								</div>
							</div>
						</div>

						{/* Body */}
						<div className="p-4 space-y-3">
							{/* Price Range & Rate Comparison - Centered with Divider */}
							<div className="flex items-center justify-center gap-6">
								{/* Price Range - Prominent */}
								<div className="text-center">
									<div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
										Price Range
									</div>
									<div className="px-4 py-1.5 bg-gray-900/5 dark:bg-white/5 rounded-lg border-2 border-gray-300 dark:border-gray-600">
										<span className="text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">
											${rec.price_range_min.toFixed(2)} - $
											{rec.price_range_max.toFixed(2)}
										</span>
									</div>
								</div>

								{/* Vertical Divider */}
								<div className="h-16 w-px bg-gray-300 dark:bg-gray-600" />

								{/* Rate Comparison */}
								<div className="flex items-center gap-3">
									<div className="text-center">
										<div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
											{rec.current_rate !== null ? "Current" : "Status"}
										</div>
										{rec.current_rate !== null ? (
											<div className="px-3 py-1.5 bg-amber-500/20 dark:bg-amber-500/30 rounded-lg border border-amber-300 dark:border-amber-700">
												<span className="text-lg font-bold text-amber-700 dark:text-amber-300">
													{rec.current_rate.toFixed(2)}%
												</span>
											</div>
										) : (
											<div className="px-3 py-1.5 bg-gray-500/20 dark:bg-gray-500/30 rounded-lg border border-gray-300 dark:border-gray-700">
												<span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
													NEW
												</span>
											</div>
										)}
									</div>

									<ArrowRight className="w-6 h-6 text-gray-400 dark:text-gray-600" />

									<div className="text-center">
										<div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
											Suggested
										</div>
										<div className="px-3 py-1.5 bg-emerald-500/20 dark:bg-emerald-500/30 rounded-lg border border-emerald-300 dark:border-emerald-700 shadow-sm">
											<span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
												{rec.suggested_rate.toFixed(2)}%
											</span>
										</div>
									</div>
								</div>
							</div>

							{/* Competitors */}
							{Object.keys(rec.competitors).length > 0 && (
								<div className="flex items-center justify-center gap-3 flex-wrap">
									<span className="text-xs font-medium text-gray-600 dark:text-gray-400">
										Competitors:
									</span>
									{Object.entries(rec.competitors).map(([carrier, rate]) =>
										rate !== undefined && rate !== null ? (
											<span
												key={carrier}
												className="px-3 py-1.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-md text-sm font-medium border border-blue-200 dark:border-blue-800"
											>
												{carrier}: {rate.toFixed(2)}%
											</span>
										) : null
									)}
								</div>
							)}

							{/* Reasoning */}
							<div className="p-3 bg-gray-50/80 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
								<div className="flex items-start gap-2 mb-1.5">
									<Lightbulb className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
									<h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
										AI Reasoning
									</h4>
								</div>
								<p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
									{rec.reasoning}
								</p>
							</div>

							{/* Impact Analysis */}
							<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
								<div className="p-2.5 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
									<div className="flex items-center gap-1.5 mb-1">
										<DollarSign className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
										<div className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
											Revenue
										</div>
									</div>
									<div className="text-xs font-medium text-gray-900 dark:text-gray-100 capitalize">
										{rec.impact_analysis.revenue_impact.replace(/_/g, " ")}
									</div>
								</div>

								<div className="p-2.5 bg-purple-50/50 dark:bg-purple-900/20 rounded-lg border border-purple-200/50 dark:border-purple-800/50">
									<div className="flex items-center gap-1.5 mb-1">
										<Award className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
										<div className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
											Position
										</div>
									</div>
									<div className="text-xs font-medium text-gray-900 dark:text-gray-100 capitalize">
										{rec.impact_analysis.competitive_position.replace(
											/_/g,
											" "
										)}
									</div>
								</div>

								<div className="p-2.5 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200/50 dark:border-amber-800/50">
									<div className="flex items-center gap-1.5 mb-1">
										<BarChart3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
										<div className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
											History
										</div>
									</div>
									<div className="text-xs font-medium text-gray-900 dark:text-gray-100">
										{rec.impact_analysis.historical_context ||
											"No historical data"}
									</div>
								</div>
							</div>
						</div>
					</div>
				);
			})}

			{/* Metadata Footer */}
			{data.metadata && (
				<div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
					<p className="text-xs text-gray-500 dark:text-gray-500 text-center">
						Generated {new Date(data.metadata.generated_at).toLocaleString()}
					</p>
				</div>
			)}
		</div>
	);
};

// Missing import
import { Lightbulb } from "lucide-react";

export default RateRecommendations;
