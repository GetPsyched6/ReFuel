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
	view: "normalized" | "overlap" | "complete";
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

	if (data.length === 0) {
		return null;
	}

	return (
		<Card glass>
			<div className="flex items-center gap-3 mb-6">
				<div className="p-2 rounded-lg bg-ups-gold/10">
					<TrendingUp className="w-5 h-5 text-ups-gold" />
				</div>
				<h2 className="text-xl font-bold">
					{view === "normalized"
						? "Normalized Comparison Chart"
						: view === "overlap"
						? "Overlap Comparison Chart"
						: "Complete Comparison Chart"}
				</h2>
			</div>

			<div className="space-y-6">
				{/* Line Chart */}
				<div>
					<h3 className="text-sm font-semibold mb-3 text-gray-600 dark:text-gray-400">
						Trend View
					</h3>
					<ResponsiveContainer width="100%" height={250}>
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
								stroke="#D4A574"
								strokeWidth={2}
								dot={{ fill: "#D4A574", r: 4 }}
								connectNulls
							/>
							<Line
								type="monotone"
								dataKey="FedEx"
								stroke="#A78BFA"
								strokeWidth={2}
								dot={{ fill: "#A78BFA", r: 4 }}
								connectNulls
							/>
							<Line
								type="monotone"
								dataKey="DHL"
								stroke="#FBBF24"
								strokeWidth={2}
								dot={{ fill: "#FBBF24", r: 4 }}
								connectNulls
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>

				{/* Bar Chart */}
				<div>
					<h3 className="text-sm font-semibold mb-3 text-gray-600 dark:text-gray-400">
						Side-by-Side Comparison
					</h3>
					<ResponsiveContainer width="100%" height={250}>
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
							<Bar dataKey="UPS" fill="#D4A574" />
							<Bar dataKey="FedEx" fill="#A78BFA" />
							<Bar dataKey="DHL" fill="#FBBF24" />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>
		</Card>
	);
}
