import { useEffect, useState, useMemo } from "react";
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
import { TrendingUp, BarChart3, Table as TableIcon, Maximize2, Minimize2 } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/utils/cn";

interface HistoricalTrendsProps {
	carriers?: string[];
	fuelCategory?: string;
	market?: string;
	startDate?: string | null;
	endDate?: string | null;
}

export default function HistoricalTrends({
	carriers,
	fuelCategory,
	market,
	startDate,
	endDate,
}: HistoricalTrendsProps) {
	const [trends, setTrends] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [chartOrTable, setChartOrTable] = useState<"chart" | "table">("chart");
	const [yAxisMode, setYAxisMode] = useState<"auto" | "fixed">("auto");

	useEffect(() => {
		loadTrends();
	}, [carriers, fuelCategory, market, startDate, endDate]);

	const loadTrends = async () => {
		setLoading(true);
		try {
			// Build API call parameters
			const apiCarriers =
				carriers && carriers.length > 0 ? carriers : undefined;
			const apiFuelCategory =
				fuelCategory && fuelCategory !== "all" ? fuelCategory : undefined;
			const apiMarket = market || undefined;
			const apiDays = startDate && endDate ? undefined : undefined;
			const apiStartDate = startDate || undefined;
			const apiEndDate = endDate || undefined;

			const response = await historyApi.getTrends(
				apiCarriers,
				apiDays,
				apiFuelCategory,
				apiMarket,
				apiStartDate,
				apiEndDate
			);

			// Axios wraps the response, so data is in response.data
			const apiData = response.data;
			const trendsData = apiData?.trends || [];

			if (!trendsData || trendsData.length === 0) {
				setTrends([]);
				setLoading(false);
				return;
			}

			// Group by date
			const trendsByDate: any = {};
			trendsData.forEach((trend: any) => {
				if (!trendsByDate[trend.date]) {
					trendsByDate[trend.date] = { date: trend.date };
				}
				trendsByDate[trend.date][trend.carrier] = parseFloat(
					trend.avg_surcharge
				);
			});

			const sortedTrends = Object.values(trendsByDate).reverse();
			setTrends(sortedTrends);
		} catch (error: any) {
			console.error("Failed to load trends:", error);
			setTrends([]);
		} finally {
			setLoading(false);
		}
	};

	// Determine which carriers actually have data
	const carriersWithData = useMemo(() => {
		const carriersSet = new Set<string>();
		trends.forEach((point) => {
			if (point.UPS != null) carriersSet.add("UPS");
			if (point.FedEx != null) carriersSet.add("FedEx");
			if (point.DHL != null) carriersSet.add("DHL");
		});
		return Array.from(carriersSet);
	}, [trends]);

	const tableRows = useMemo(() => {
		return [...trends].sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
		);
	}, [trends]);

	// Calculate dynamic Y-axis domain to zoom into the data range
	const yAxisDomain = useMemo(() => {
		if (trends.length === 0) return [0, 25];

		let min = Infinity;
		let max = -Infinity;

		trends.forEach((point) => {
			carriersWithData.forEach((carrier) => {
				const value = point[carrier];
				if (value != null) {
					min = Math.min(min, value);
					max = Math.max(max, value);
				}
			});
		});

		if (yAxisMode === "fixed") {
			return [0, Math.ceil(max * 1.1)];
		}

		// Add padding (10% on each side) to make the chart more readable
		const range = max - min;
		const padding = range * 0.1 || 1; // At least 1% padding
		return [Math.max(0, min - padding), max + padding];
	}, [trends, carriersWithData, yAxisMode]);

	// Custom tooltip formatter to round values
	const CustomTooltip = ({ active, payload, label }: any) => {
		if (!active || !payload) return null;

		return (
			<div
				style={{
					backgroundColor: "rgba(0, 0, 0, 0.8)",
					border: "none",
					borderRadius: "8px",
					color: "white",
					padding: "12px",
				}}
			>
				<p style={{ marginBottom: "8px", fontWeight: "bold" }}>{label}</p>
				{payload.map((entry: any, index: number) => (
					<p
						key={index}
						style={{
							color: entry.color,
							margin: "4px 0",
						}}
					>
						{entry.name} : {entry.value?.toFixed(2)}
					</p>
				))}
			</div>
		);
	};

	if (loading) {
		return (
			<Card glass className="animate-pulse">
				<div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
			</Card>
		);
	}

	const getTitle = () => {
		if (startDate && endDate) {
			const start = new Date(startDate);
			const end = new Date(endDate);
			return `Historical Trends (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`;
		}
		return "Historical Trends (All Available Data)";
	};

	const header = (
		<div className="flex items-center gap-3 mb-6">
			<div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
				<TrendingUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
			</div>
			<h2 className="text-xl font-bold">{getTitle()}</h2>
		</div>
	);

	return (
		<Card glass>
			{trends.length > 0 ? (
				<Tabs.Root
					value={chartOrTable}
					onValueChange={(v) => setChartOrTable(v as "chart" | "table")}
					className="w-full"
				>
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
								<TrendingUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
							</div>
							<h2 className="text-xl font-bold">{getTitle()}</h2>
						</div>
						<div className="flex items-center gap-3">
							{chartOrTable === "chart" && (
								<div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50">
									<button
										onClick={() => setYAxisMode("auto")}
										className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
											yAxisMode === "auto"
												? "bg-amber-500 text-white shadow-lg"
												: "text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
										}`}
										title="Auto-scale Y-axis (zoomed)"
									>
										<Maximize2 className="w-3.5 h-3.5" />
									</button>
									<button
										onClick={() => setYAxisMode("fixed")}
										className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
											yAxisMode === "fixed"
												? "bg-amber-500 text-white shadow-lg"
												: "text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
										}`}
										title="Fixed Y-axis (0 to max)"
									>
										<Minimize2 className="w-3.5 h-3.5" />
									</button>
								</div>
							)}
							<Tabs.List className="inline-flex items-center gap-1 p-1 rounded-full backdrop-blur-xl bg-white/10 dark:bg-gray-900/30 border border-white/15 dark:border-gray-700/50">
								<Tabs.Trigger
									value="chart"
									className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=inactive]:text-gray-700 dark:data-[state=inactive]:text-gray-300 hover:bg-white/40 dark:hover:bg-gray-800/40"
								>
									<BarChart3 className="w-4 h-4" />
									Chart View
								</Tabs.Trigger>
								<Tabs.Trigger
									value="table"
									className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=inactive]:text-gray-700 dark:data-[state=inactive]:text-gray-300 hover:bg-white/40 dark:hover:bg-gray-800/40"
								>
									<TableIcon className="w-4 h-4" />
									Table View
								</Tabs.Trigger>
							</Tabs.List>
						</div>
					</div>

					<Tabs.Content value="chart" className="focus:outline-none">
						<ResponsiveContainer width="100%" height={300}>
							<LineChart 
								data={trends}
								isAnimationActive={true}
								animationDuration={800}
								animationEasing="ease-in-out"
							>
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
									domain={yAxisDomain}
									tickFormatter={(value) => value.toFixed(1)}
								/>
								<Tooltip content={<CustomTooltip />} />
								<Legend />
								{carriersWithData.includes("UPS") && (
									<Line
										type="monotone"
										dataKey="UPS"
										stroke="#F97316"
										strokeWidth={3}
										strokeDasharray="0"
										dot={{ fill: "#F97316", r: 5 }}
										connectNulls
									/>
								)}
								{carriersWithData.includes("FedEx") && (
									<Line
										type="monotone"
										dataKey="FedEx"
										stroke="#8B5CF6"
										strokeWidth={2}
										strokeDasharray="0"
										dot={{ fill: "#8B5CF6", r: 4 }}
										connectNulls
									/>
								)}
								{carriersWithData.includes("DHL") && (
									<Line
										type="monotone"
										dataKey="DHL"
										stroke="#3B82F6"
										strokeWidth={2}
										dot={{ fill: "#3B82F6", r: 4 }}
										connectNulls
									/>
								)}
							</LineChart>
						</ResponsiveContainer>
					</Tabs.Content>

					<Tabs.Content value="table" className="focus:outline-none">
						<div className="overflow-x-auto max-h-[600px] overflow-y-auto">
							<table className="w-full relative">
								<thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
									<tr className="border-b border-gray-200 dark:border-gray-700 shadow-sm">
										<th className="text-left py-3 px-4 font-semibold">Date</th>
										{carriersWithData.includes("UPS") && (
											<th className="text-center py-3 px-4 font-semibold">
												UPS
											</th>
										)}
										{carriersWithData.includes("FedEx") && (
											<th className="text-center py-3 px-4 font-semibold">
												FedEx
											</th>
										)}
										{carriersWithData.includes("DHL") && (
											<th className="text-center py-3 px-4 font-semibold">
												DHL
											</th>
										)}
									</tr>
								</thead>
								<tbody>
									{tableRows.map((row, idx) => {
										const carrierValueMap: Record<string, number | null> = {
											UPS: row.UPS ?? null,
											FedEx: row.FedEx ?? null,
											DHL: row.DHL ?? null,
										};
										const numericValues = carriersWithData
											.map((carrier) => carrierValueMap[carrier])
											.filter(
												(val): val is number =>
													typeof val === "number"
											);
										const minValue =
											numericValues.length >= 2
												? Math.min(...numericValues)
												: null;
										return (
											<tr
												key={idx}
												className="border-b border-gray-100 dark:border-gray-800 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent dark:hover:from-blue-900/10 dark:hover:to-transparent transition-all duration-200"
											>
												<td className="py-3 px-4 font-medium">{row.date}</td>
												{carriersWithData.includes("UPS") && (
													<td className="py-3 px-4 text-center">
														{row.UPS != null ? (
															<span
																className={cn(
																	"inline-block px-3 py-1 rounded-full font-semibold border shadow-sm",
																	minValue !== null &&
																		row.UPS === minValue
																		? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-white border-emerald-500/80"
																		: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600"
																)}
															>
																{row.UPS.toFixed(2)}%
															</span>
														) : (
															<span className="text-gray-400 dark:text-gray-600">
																-
															</span>
														)}
													</td>
												)}
												{carriersWithData.includes("FedEx") && (
													<td className="py-3 px-4 text-center">
														{row.FedEx != null ? (
															<span
																className={cn(
																	"inline-block px-3 py-1 rounded-full font-semibold border shadow-sm",
																	minValue !== null &&
																		row.FedEx === minValue
																		? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-white border-emerald-500/80"
																		: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600"
																)}
															>
																{row.FedEx.toFixed(2)}%
															</span>
														) : (
															<span className="text-gray-400 dark:text-gray-600">
																-
															</span>
														)}
													</td>
												)}
												{carriersWithData.includes("DHL") && (
													<td className="py-3 px-4 text-center">
														{row.DHL != null ? (
															<span
																className={cn(
																	"inline-block px-3 py-1 rounded-full font-semibold border shadow-sm",
																	minValue !== null &&
																		row.DHL === minValue
																		? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-white border-emerald-500/80"
																		: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600"
																)}
															>
																{row.DHL.toFixed(2)}%
															</span>
														) : (
															<span className="text-gray-400 dark:text-gray-600">
																-
															</span>
														)}
													</td>
												)}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</Tabs.Content>
				</Tabs.Root>
			) : (
				<>
					{header}
					<div className="text-center py-12 text-gray-500 dark:text-gray-400">
						No historical data available
					</div>
				</>
			)}
		</Card>
	);
}
