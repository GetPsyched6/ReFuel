import { useMemo } from "react";
import {
	ScatterChart,
	Scatter,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	ReferenceLine,
	Legend,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/utils/cn";

interface ScatterPoint {
	date: string;
	carrier: string;
	service: string;
	surcharge_pct: number;
	median_pct: number;
	delta_pp: number;
}

interface OutlierScatterProps {
	data: ScatterPoint[];
	threshold: number;
	carriers: string[];
}

const CARRIER_COLORS: Record<string, string> = {
	UPS: "#F97316",
	FedEx: "#8B5CF6",
	DHL: "#3B82F6",
	DPD: "#10B981",
};

export default function OutlierScatter({
	data,
	threshold,
	carriers,
}: OutlierScatterProps) {
	const chartData = useMemo(() => {
		const grouped: Record<string, typeof data> = {};
		
		data.forEach((point) => {
			const key = `${point.date}-${point.delta_pp.toFixed(2)}`;
			if (!grouped[key]) {
				grouped[key] = [];
			}
			grouped[key].push(point);
		});

		const result: any[] = [];
		Object.values(grouped).forEach((points) => {
			points.forEach((point, idx) => {
				const jitter = points.length > 1 ? (idx - (points.length - 1) / 2) * 0.15 : 0;
				result.push({
					...point,
					x: new Date(point.date).getTime(),
					y: point.delta_pp + jitter,
					size: Math.abs(point.delta_pp) * 15 + 60,
					key: `${point.date}-${point.carrier}-${idx}`,
				});
			});
		});

		return result;
	}, [data]);

	const dataByCarrier = useMemo(() => {
		const grouped: Record<string, typeof chartData> = {};
		chartData.forEach((point) => {
			if (!grouped[point.carrier]) {
				grouped[point.carrier] = [];
			}
			grouped[point.carrier].push(point);
		});
		return grouped;
	}, [chartData]);

	const xDomain = useMemo(() => {
		if (chartData.length === 0) return [0, 1];
		const times = chartData.map((d) => d.x);
		return [Math.min(...times), Math.max(...times)];
	}, [chartData]);

	const yDomain = useMemo(() => {
		if (chartData.length === 0) return [-threshold * 2, threshold * 2];
		const deltas = chartData.map((d) => d.y);
		const min = Math.min(...deltas);
		const max = Math.max(...deltas);
		const padding = Math.max(threshold, (max - min) * 0.1);
		return [min - padding, max + padding];
	}, [chartData, threshold]);

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	const CustomTooltip = ({ active, payload }: any) => {
		if (!active || !payload || !payload.length) return null;

		const data = payload[0].payload;

		return (
			<div className="backdrop-blur-xl bg-gray-900/95 dark:bg-gray-800/95 border-2 border-gray-700 rounded-lg p-3 shadow-2xl">
				<div className="text-xs space-y-1">
					<div className="font-bold text-white">{data.date}</div>
					<div className="text-blue-300">{data.carrier}</div>
					<div className="text-gray-300">{data.service}</div>
					<div className="border-t border-gray-600 my-1 pt-1">
						<div className="text-gray-300">
							Surcharge: <span className="font-semibold text-white">{data.surcharge_pct}%</span>
						</div>
						<div className="text-gray-300">
							Median: <span className="font-semibold text-white">{data.median_pct}%</span>
						</div>
						<div
							className={cn(
								"font-bold",
								Math.abs(data.delta_pp) > threshold
									? "text-red-400"
									: "text-green-400"
							)}
						>
							Delta: {data.delta_pp > 0 ? "+" : ""}
							{data.delta_pp.toFixed(2)} pp
						</div>
					</div>
				</div>
			</div>
		);
	};

	if (carriers.length < 2) {
		return (
			<Card glass>
				<div className="flex items-center gap-3 mb-4">
					<AlertTriangle className="w-5 h-5 text-amber-500" />
					<h3 className="text-lg font-bold">Delta vs Competitor Median</h3>
				</div>
				<div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
					<div className="text-center">
						<Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
						<p>Requires 2+ carriers for comparison</p>
					</div>
				</div>
			</Card>
		);
	}

	if (data.length === 0) {
		return (
			<Card glass>
				<div className="flex items-center gap-3 mb-4">
					<AlertTriangle className="w-5 h-5 text-amber-500" />
					<h3 className="text-lg font-bold">Delta vs Competitor Median</h3>
				</div>
				<div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
					No scatter data available
				</div>
			</Card>
		);
	}

	return (
		<Card glass>
			<div className="mb-4">
				<div className="flex items-center gap-3 mb-2">
					<AlertTriangle className="w-5 h-5 text-amber-500" />
					<h3 className="text-lg font-bold">Delta vs Competitor Median</h3>
				</div>
				<p className="text-sm text-gray-600 dark:text-gray-400">
					Deviation from median surcharge over time (±{threshold} pp threshold)
				</p>
			</div>

			<ResponsiveContainer width="100%" height={300}>
				<ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
					<CartesianGrid
						strokeDasharray="3 3"
						className="stroke-gray-300 dark:stroke-gray-700"
					/>
					<XAxis
						type="number"
						dataKey="x"
						domain={xDomain}
						tickFormatter={formatDate}
						className="text-xs"
						tick={{ fill: "currentColor" }}
					/>
					<YAxis
						type="number"
						dataKey="y"
						domain={yDomain}
						className="text-xs"
						tick={{ fill: "currentColor" }}
						label={{
							value: "Delta (pp)",
							angle: -90,
							position: "insideLeft",
						}}
					/>
					<Tooltip content={<CustomTooltip />} />
					<Legend />

					<ReferenceLine
						y={0}
						stroke="#666"
						strokeWidth={2}
						strokeDasharray="5 5"
					/>
					<ReferenceLine
						y={threshold}
						stroke="#EF4444"
						strokeWidth={1}
						strokeDasharray="3 3"
						opacity={0.5}
					/>
					<ReferenceLine
						y={-threshold}
						stroke="#EF4444"
						strokeWidth={1}
						strokeDasharray="3 3"
						opacity={0.5}
					/>

					{carriers.map((carrier) => {
						const carrierData = dataByCarrier[carrier] || [];
						if (carrierData.length === 0) return null;

						return (
							<Scatter
								key={carrier}
								name={carrier}
								data={carrierData}
								fill={CARRIER_COLORS[carrier] || "#6B7280"}
								stroke={CARRIER_COLORS[carrier] || "#6B7280"}
								strokeWidth={2}
								fillOpacity={0.6}
							/>
						);
					})}
				</ScatterChart>
			</ResponsiveContainer>
		</Card>
	);
}

