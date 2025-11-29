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

// Different sizes and stroke widths for each carrier to distinguish overlapping points
const CARRIER_STYLES: Record<string, { size: number; strokeWidth: number }> = {
	UPS: { size: 90, strokeWidth: 3 },
	FedEx: { size: 60, strokeWidth: 2 },
	DHL: { size: 45, strokeWidth: 1.5 },
	DPD: { size: 35, strokeWidth: 1 },
};

export default function OutlierScatter({
	data,
	threshold,
	carriers,
}: OutlierScatterProps) {
	const chartData = useMemo(() => {
		// No more jittering - use different sizes/strokes to distinguish carriers
		return data.map((point) => ({
			...point,
			x: new Date(point.date).getTime(),
			y: point.delta_pp,
			size: (CARRIER_STYLES[point.carrier]?.size || 50) + Math.abs(point.delta_pp) * 10,
			strokeWidth: CARRIER_STYLES[point.carrier]?.strokeWidth || 2,
			key: `${point.date}-${point.carrier}`,
		}));
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

	// Group points by date for finding overlaps
	const pointsByDate = useMemo(() => {
		const grouped: Record<string, typeof chartData> = {};
		chartData.forEach((point) => {
			if (!grouped[point.date]) {
				grouped[point.date] = [];
			}
			grouped[point.date].push(point);
		});
		return grouped;
	}, [chartData]);

	const CustomTooltip = ({ active, payload }: any) => {
		if (!active || !payload || !payload.length) return null;

		const hoveredPoint = payload[0].payload;
		
		// Find all points at the same date (overlapping carriers)
		const overlappingPoints = pointsByDate[hoveredPoint.date] || [hoveredPoint];

		return (
			<div className="backdrop-blur-xl bg-gray-900/95 dark:bg-gray-800/95 border-2 border-gray-700 rounded-lg p-3 shadow-2xl max-w-xs">
				<div className="text-xs">
					<div className="font-bold text-white mb-2">{hoveredPoint.date}</div>
					
					{overlappingPoints.length > 1 && (
						<div className="text-[10px] text-gray-400 mb-2 uppercase tracking-wide">
							{overlappingPoints.length} carriers at this date
						</div>
					)}
					
					<div className="space-y-2">
						{overlappingPoints.map((point, idx) => (
							<div 
								key={point.carrier} 
								className={cn(
									"pb-2",
									idx < overlappingPoints.length - 1 && "border-b border-gray-600"
								)}
							>
								<div className="flex items-center gap-2 mb-1">
									<div 
										className="w-2.5 h-2.5 rounded-full"
										style={{ backgroundColor: CARRIER_COLORS[point.carrier] || "#6B7280" }}
									/>
									<span className="font-semibold" style={{ color: CARRIER_COLORS[point.carrier] || "#9CA3AF" }}>
										{point.carrier}
									</span>
								</div>
								<div className="pl-4 space-y-0.5 text-gray-300">
									<div>
										Surcharge: <span className="font-semibold text-white">{point.surcharge_pct}%</span>
									</div>
									<div>
										Median: <span className="font-semibold text-white">{point.median_pct}%</span>
									</div>
									<div
										className={cn(
											"font-bold",
											Math.abs(point.delta_pp) > threshold
												? "text-red-400"
												: "text-green-400"
										)}
									>
										Delta: {point.delta_pp > 0 ? "+" : ""}
										{point.delta_pp.toFixed(2)} pp
									</div>
								</div>
							</div>
						))}
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

					{/* Render in reverse order so smaller carriers appear on top */}
					{[...carriers].reverse().map((carrier) => {
						const carrierData = dataByCarrier[carrier] || [];
						if (carrierData.length === 0) return null;
						const style = CARRIER_STYLES[carrier] || { size: 50, strokeWidth: 2 };

						return (
							<Scatter
								key={carrier}
								name={carrier}
								data={carrierData}
								fill={CARRIER_COLORS[carrier] || "#6B7280"}
								stroke={CARRIER_COLORS[carrier] || "#6B7280"}
								strokeWidth={style.strokeWidth}
								fillOpacity={0.6}
							/>
						);
					})}
				</ScatterChart>
			</ResponsiveContainer>
		</Card>
	);
}

