import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import {
	LineChart,
	Line,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface ComparisonRow {
	price_range: string;
	at_least_usd: number;
	but_less_than_usd: number;
	ups_pct: number | null;
	fedex_pct: number | null;
	dhl_pct: number | null;
}

interface ComparisonChartProps {
	data: ComparisonRow[];
	view: "normalized" | "overlap" | "complete" | "comparable";
}

export default function ComparisonChart({ data, view }: ComparisonChartProps) {
	const chartData = useMemo(() => {
		return data.map((row) => ({
			range: row.price_range,
			UPS: row.ups_pct,
			FedEx: row.fedex_pct,
			DHL: row.dhl_pct,
		}));
	}, [data]);

	// Calculate responsive bar size based on number of data points
	const barSize = Math.max(
		20,
		Math.min(40, Math.floor(800 / chartData.length))
	);

	if (data.length === 0) {
		return null;
	}

	return (
		<Card glass>
			<div className="flex items-center gap-3 mb-6">
				<div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 animate-pulse">
					<TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
				</div>
				<h2 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
					{view === "normalized"
						? "Normalized Comparison Chart"
						: view === "overlap"
						? "Overlap Comparison Chart"
						: view === "comparable"
						? "Comparable Ranges Chart"
						: "Complete Comparison Chart"}
				</h2>
			</div>

			<div className="space-y-8">
				{/* Line Chart */}
				<div className="p-4 rounded-xl bg-gradient-to-br from-gray-50/50 to-transparent dark:from-gray-800/30 dark:to-transparent border border-gray-200/50 dark:border-gray-700/50">
					<h3 className="text-sm font-semibold mb-4 text-gray-700 dark:text-gray-300 flex items-center gap-2">
						<div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"></div>
						Trend View
					</h3>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={chartData}>
							<CartesianGrid
								strokeDasharray="3 3"
								className="stroke-gray-300 dark:stroke-gray-700"
							/>
							<XAxis
								dataKey="range"
								className="text-xs"
								tick={{ fill: "currentColor" }}
								angle={-45}
								textAnchor="end"
								height={80}
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
								connectNulls
							/>
							<Line
								type="monotone"
								dataKey="FedEx"
								stroke="#10B981"
								strokeWidth={2}
								strokeDasharray="5 5"
								dot={{
									fill: "#10B981",
									r: 4,
									strokeWidth: 2,
									stroke: "#10B981",
								}}
								connectNulls
							/>
							<Line
								type="monotone"
								dataKey="DHL"
								stroke="#F97316"
								strokeWidth={2}
								strokeDasharray="0"
								dot={{ fill: "#F97316", r: 4 }}
								connectNulls
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>

				{/* Bar Chart */}
				<div className="p-4 rounded-xl bg-gradient-to-br from-gray-50/50 to-transparent dark:from-gray-800/30 dark:to-transparent border border-gray-200/50 dark:border-gray-700/50">
					<h3 className="text-sm font-semibold mb-4 text-gray-700 dark:text-gray-300 flex items-center gap-2">
						<div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"></div>
						Side-by-Side Comparison
					</h3>
					<ResponsiveContainer width="100%" height={300}>
						<BarChart data={chartData}>
							<CartesianGrid
								strokeDasharray="3 3"
								className="stroke-gray-300 dark:stroke-gray-700"
							/>
							<XAxis
								dataKey="range"
								className="text-xs"
								tick={{ fill: "currentColor" }}
								angle={-45}
								textAnchor="end"
								height={80}
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
							<Bar dataKey="UPS" fill="#3B82F6" barSize={barSize} />
							<Bar dataKey="FedEx" fill="#10B981" barSize={barSize} />
							<Bar dataKey="DHL" fill="#F97316" barSize={barSize} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>
		</Card>
	);
}
