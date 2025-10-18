import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { historyApi } from "@/services/api";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";

export default function HistoricalTrends() {
	const [trends, setTrends] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadTrends();
	}, []);

	const loadTrends = async () => {
		try {
			const response = await historyApi.getTrends(undefined, 30);

			// Group by date
			const trendsByDate: any = {};
			response.data.trends.forEach((trend: any) => {
				if (!trendsByDate[trend.date]) {
					trendsByDate[trend.date] = { date: trend.date };
				}
				trendsByDate[trend.date][trend.carrier] = parseFloat(
					trend.avg_surcharge
				);
			});

			setTrends(Object.values(trendsByDate).reverse());
		} catch (error) {
			console.error("Failed to load trends:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<Card glass className="animate-pulse">
				<div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
			</Card>
		);
	}

	return (
		<Card glass>
			<div className="flex items-center gap-3 mb-6">
				<div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
					<TrendingUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
				</div>
				<h2 className="text-xl font-bold">Historical Trends (30 Days)</h2>
			</div>

			{trends.length > 0 ? (
				<ResponsiveContainer width="100%" height={300}>
					<LineChart data={trends}>
						<CartesianGrid
							strokeDasharray="3 3"
							className="stroke-gray-300 dark:stroke-gray-700"
						/>
						<XAxis
							dataKey="date"
							className="text-xs"
							tick={{ fill: "currentColor" }}
						/>
						<YAxis
							className="text-xs"
							tick={{ fill: "currentColor" }}
							label={{
								value: "Surcharge %",
								angle: -90,
								position: "insideLeft",
							}}
						/>
						<Tooltip
							contentStyle={{
								backgroundColor: "rgba(0, 0, 0, 0.8)",
								border: "none",
								borderRadius: "8px",
								color: "white",
							}}
						/>
						<Legend />
						<Line
							type="monotone"
							dataKey="UPS"
							stroke="#3B82F6"
							strokeWidth={3}
							strokeDasharray="0"
							dot={{ fill: "#3B82F6", r: 5 }}
						/>
						<Line
							type="monotone"
							dataKey="FedEx"
							stroke="#8B5CF6"
							strokeWidth={2}
							strokeDasharray="5 5"
							dot={{ fill: "#8B5CF6", r: 4 }}
						/>
						<Line
							type="monotone"
							dataKey="DHL"
							stroke="#F97316"
							strokeWidth={2}
							dot={{ fill: "#F97316", r: 4 }}
						/>
					</LineChart>
				</ResponsiveContainer>
			) : (
				<div className="text-center py-12 text-gray-500 dark:text-gray-400">
					No historical data available
				</div>
			)}
		</Card>
	);
}
