import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { aiApi } from "@/services/api";
import { Sparkles, TrendingUp, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function AIInsights() {
	const [insights, setInsights] = useState<any>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadInsights();
	}, []);

	const loadInsights = async () => {
		try {
			const response = await aiApi.generateInsights();
			setInsights(response.data.content);
		} catch (error) {
			console.error("Failed to load insights:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<Card glass className="animate-pulse">
				<div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
			</Card>
		);
	}

	if (!insights) {
		return null;
	}

	return (
		<Card glass className="border-l-4 border-ups-gold">
			<div className="flex items-start gap-4">
				<div className="p-3 rounded-lg bg-ups-gold/10">
					<Sparkles className="w-6 h-6 text-ups-gold" />
				</div>

				<div className="flex-1">
					<h2 className="text-xl font-bold mb-3 flex items-center gap-2">
						AI Insights
						<span className="text-xs px-2 py-1 rounded-full bg-ups-gold/20 text-ups-gold">
							Latest Analysis
						</span>
					</h2>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{insights.key_metrics && (
							<MetricCard
								title="Key Metrics"
								data={insights.key_metrics}
								icon={<TrendingUp className="w-5 h-5" />}
							/>
						)}

						{insights.opportunities && insights.opportunities.length > 0 && (
							<InsightCard
								title="Opportunities"
								items={insights.opportunities}
								icon={<AlertCircle className="w-5 h-5" />}
							/>
						)}

						{insights.recommendations &&
							insights.recommendations.length > 0 && (
								<InsightCard
									title="Recommendations"
									items={insights.recommendations}
									icon={<Sparkles className="w-5 h-5" />}
								/>
							)}
					</div>
				</div>
			</div>
		</Card>
	);
}

function MetricCard({ title, data, icon }: any) {
	return (
		<motion.div
			whileHover={{ scale: 1.02 }}
			className="p-4 rounded-lg glass dark:glass-dark"
		>
			<div className="flex items-center gap-2 mb-3">
				{icon}
				<h3 className="font-semibold">{title}</h3>
			</div>
			<div className="space-y-2 text-sm">
				{Object.entries(data).map(([carrier, metrics]: any) => (
					<div key={carrier} className="flex justify-between">
						<span className="text-gray-600 dark:text-gray-400">{carrier}:</span>
						<span className="font-semibold">{metrics.average_surcharge}%</span>
					</div>
				))}
			</div>
		</motion.div>
	);
}

function InsightCard({ title, items, icon }: any) {
	return (
		<motion.div
			whileHover={{ scale: 1.02 }}
			className="p-4 rounded-lg glass dark:glass-dark"
		>
			<div className="flex items-center gap-2 mb-3">
				{icon}
				<h3 className="font-semibold">{title}</h3>
			</div>
			<ul className="space-y-2 text-sm">
				{items.slice(0, 3).map((item: string, idx: number) => (
					<li key={idx} className="text-gray-600 dark:text-gray-400">
						• {item}
					</li>
				))}
			</ul>
		</motion.div>
	);
}
