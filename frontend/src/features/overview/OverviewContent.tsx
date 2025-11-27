import { useState, useEffect, useMemo } from "react";
import {
	TrendingUp,
	TrendingDown,
	Minus,
	AlertTriangle,
	Activity,
	Info,
	Loader2,
} from "lucide-react";
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
import { overviewApi } from "@/services/api";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";
import OutlierScatter from "./OutlierScatter";
import CadenceHeatmap from "./CadenceHeatmap";
import RelativeSurchargeIndex from "./RelativeSurchargeIndex";
import FuelCurveVersionComparison from "./FuelCurveVersionComparison";
import { getCarrierBrandColor } from "@/theme/carriers";

interface OverviewContentProps {
	selectedCountry: string;
	selectedServiceType: string;
}

interface TimeSeriesData {
	date: string;
	[carrier: string]: string | number | null;
}

interface RecentMovement {
	carrier: string;
	service: string;
	latest_pct: number;
	delta_pp: number;
	direction: string;
	latest_date: string;
}

interface Outlier {
	date: string;
	carrier: string;
	service: string;
	surcharge_pct: number;
	median_pct: number;
	delta_pp: number;
}

interface OverviewData {
	context: {
		market: string;
		fuel_category: string;
	};
	carriers: string[];
	num_carriers: number;
	time_series: Record<string, Array<{ date: string; value: number }>>;
	recent_movement: RecentMovement[];
	outliers: Outlier[];
	outlier_threshold_pp: number;
	comparison_available: boolean;
	scatter_data?: Array<{
		date: string;
		carrier: string;
		service: string;
		surcharge_pct: number;
		median_pct: number;
		delta_pp: number;
	}>;
	cadence_data?: {
		carrier_updates: Record<
			string,
			Array<{
				date: string;
				old_pct: number;
				new_pct: number;
				service: string;
			}>
		>;
	};
	relative_index_data?: {
		carrier_indices: Array<{
			carrier: string;
			avg_surcharge: number;
			relative_index: number;
			delta_pp: number;
			intensity_level: string;
			is_cheapest: boolean;
		}>;
		window_size: number;
		has_data: boolean;
		num_carriers: number;
		cheapest_carrier?: string;
		message?: string;
	};
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
	ground_domestic: "Ground Domestic",
	ground_regional: "Ground Regional",
	domestic_air: "Domestic Air",
	international_air_export: "International Air Export",
	international_air_import: "International Air Import",
};

export default function OverviewContent({
	selectedCountry,
	selectedServiceType,
}: OverviewContentProps) {
	const [data, setData] = useState<OverviewData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [visibleCarriers, setVisibleCarriers] = useState<Set<string>>(
		new Set()
	);

	useEffect(() => {
		loadOverviewData();
	}, [selectedCountry, selectedServiceType]);

	const loadOverviewData = async () => {
		setLoading(true);
		setError(null);

		try {
			const response = await overviewApi.getAnalytics(
				selectedCountry,
				selectedServiceType,
				2.0
			);

			if (response.data.success) {
				const overviewData = response.data.data;
				setData(overviewData);
				// Initialize all carriers as visible
				setVisibleCarriers(new Set(overviewData.carriers));
			} else {
				setError("Failed to load overview data");
			}
		} catch (err: any) {
			console.error("Error loading overview:", err);
			setError(err.response?.data?.detail || "Failed to load overview data");
		} finally {
			setLoading(false);
		}
	};

	const toggleCarrier = (carrier: string) => {
		setVisibleCarriers((prev) => {
			const next = new Set(prev);
			if (next.has(carrier)) {
				next.delete(carrier);
			} else {
				next.add(carrier);
			}
			return next;
		});
	};

	// Transform time series data for recharts
	const chartData = useMemo(() => {
		if (!data) return [];

		// Get all unique dates across all carriers
		const dateSet = new Set<string>();
		Object.values(data.time_series).forEach((series) => {
			series.forEach((point) => dateSet.add(point.date));
		});

		const dates = Array.from(dateSet).sort();

		// Build chart data
		return dates.map((date) => {
			const point: TimeSeriesData = { date };
			data.carriers.forEach((carrier) => {
				const series = data.time_series[carrier] || [];
				const dataPoint = series.find((p) => p.date === date);
				point[carrier] = dataPoint ? dataPoint.value : null;
			});
			return point;
		});
	}, [data]);

	const yAxisDomain = useMemo(() => {
		if (!chartData || chartData.length === 0) return [0, 30];

		const allValues: number[] = [];
		chartData.forEach((point) => {
			data?.carriers.forEach((carrier) => {
				const val = point[carrier];
				if (typeof val === "number") {
					allValues.push(val);
				}
			});
		});

		if (allValues.length === 0) return [0, 30];

		const min = Math.min(...allValues);
		const max = Math.max(...allValues);
		const padding = (max - min) * 0.1 || 1;

		return [Math.max(0, min - padding), max + padding];
	}, [chartData, data]);

	if (loading) {
		return (
			<Card glass className="flex items-center justify-center py-12">
				<Loader2 className="w-8 h-8 animate-spin text-blue-500 dark:text-blue-400" />
			</Card>
		);
	}

	if (error) {
		return (
			<Card glass>
				<div className="text-center py-12">
					<AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
					<p className="text-red-600 dark:text-red-400">{error}</p>
				</div>
			</Card>
		);
	}

	if (!data) {
		return (
			<Card glass>
				<div className="text-center py-12 text-gray-500 dark:text-gray-400">
					No data available
				</div>
			</Card>
		);
	}

	const contextLabel = `${selectedCountry} • ${
		SERVICE_TYPE_LABELS[selectedServiceType] || selectedServiceType
	}`;

	return (
		<div className="space-y-6">
			{/* Context Info */}
			<Card glass>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20">
							<Activity className="w-5 h-5 text-green-500 dark:text-green-400" />
						</div>
						<div>
							<h3 className="text-xl font-bold">Overview Analytics</h3>
							<p className="text-sm text-gray-600 dark:text-gray-400">
								{contextLabel}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-4">
						<div className="text-right">
							<p className="text-2xl font-bold text-green-600 dark:text-green-400">
								{data.num_carriers}
							</p>
							<p className="text-xs text-gray-600 dark:text-gray-400">
								Carriers
							</p>
						</div>
						{!data.comparison_available && (
							<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
								<Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
								<span className="text-xs text-amber-700 dark:text-amber-300">
									Single carrier - comparison not available
								</span>
							</div>
						)}
					</div>
				</div>
			</Card>

			{/* Time Series Chart */}
			<Card glass>
				<div className="mb-6">
					<h3 className="text-lg font-bold mb-2">Historical Trend</h3>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Fuel surcharge rates over time
					</p>
				</div>

				{/* Carrier Toggle Chips */}
				<div className="flex flex-wrap gap-2 mb-6">
					{data.carriers.map((carrier) => {
						const isVisible = visibleCarriers.has(carrier);
						const color = getCarrierBrandColor(carrier);

						return (
							<button
								key={carrier}
								onClick={() => toggleCarrier(carrier)}
								className={cn(
									"px-4 py-2 rounded-full font-semibold transition-all duration-200",
									"border-2",
									isVisible
										? "shadow-lg"
										: "opacity-50 hover:opacity-75 bg-gray-100 dark:bg-gray-800"
								)}
								style={{
									borderColor: isVisible ? color : "transparent",
									backgroundColor: isVisible ? `${color}20` : undefined,
									color: isVisible ? color : undefined,
								}}
							>
								{carrier}
							</button>
						);
					})}
				</div>

				{/* Chart */}
				{chartData.length > 0 ? (
					<ResponsiveContainer width="100%" height={400}>
						<LineChart data={chartData}>
							<CartesianGrid
								strokeDasharray="3 3"
								className="stroke-gray-300 dark:stroke-gray-700"
							/>
							<XAxis
								dataKey="date"
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
								domain={yAxisDomain}
								tickFormatter={(value) => value.toFixed(1)}
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
							{/* Sort carriers so thicker lines render first (bottom) and thinner lines render last (top) */}
							{(() => {
								const carrierStyles: Record<
									string,
									{ strokeWidth: number; dotRadius: number }
								> = {
									UPS: { strokeWidth: 3, dotRadius: 5 },
									FedEx: { strokeWidth: 2, dotRadius: 4 },
									DHL: { strokeWidth: 2, dotRadius: 4 },
								};

								// Sort by strokeWidth descending so thicker lines are at the back
								const sortedCarriers = [...data.carriers].sort((a, b) => {
									const aStyle = carrierStyles[a] || { strokeWidth: 2 };
									const bStyle = carrierStyles[b] || { strokeWidth: 2 };
									return bStyle.strokeWidth - aStyle.strokeWidth;
								});

								return sortedCarriers.map((carrier, index) => {
									if (!visibleCarriers.has(carrier)) return null;

									const style = carrierStyles[carrier] || {
										strokeWidth: 2,
										dotRadius: 3 + index,
									};

									return (
										<Line
											key={carrier}
											type="monotone"
											dataKey={carrier}
											stroke={getCarrierBrandColor(carrier)}
											strokeWidth={style.strokeWidth}
											dot={{
												fill: getCarrierBrandColor(carrier),
												r: style.dotRadius,
											}}
											connectNulls
										/>
									);
								});
							})()}
						</LineChart>
					</ResponsiveContainer>
				) : (
					<div className="text-center py-8 text-gray-500 dark:text-gray-400">
						No time series data available
					</div>
				)}
			</Card>

			{/* Recent Movement */}
			<Card glass>
				<div className="mb-6">
					<div className="flex items-center gap-3 mb-2">
						<TrendingUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
						<h3 className="text-lg font-bold">Recent Movement</h3>
					</div>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Week-over-week changes in surcharge rates
					</p>
				</div>

				{data.recent_movement.length > 0 ? (
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-gray-200 dark:border-gray-700">
									<th className="text-left py-3 px-4 font-semibold">Carrier</th>
									<th className="text-left py-3 px-4 font-semibold">Service</th>
									<th className="text-center py-3 px-4 font-semibold">
										Latest %
									</th>
									<th className="text-center py-3 px-4 font-semibold">
										Change
									</th>
									<th className="text-center py-3 px-4 font-semibold">
										Direction
									</th>
									<th className="text-center py-3 px-4 font-semibold">Date</th>
								</tr>
							</thead>
							<tbody>
								{data.recent_movement.map((movement, idx) => {
									const isIncrease = movement.delta_pp > 0;
									const isFlat = Math.abs(movement.delta_pp) < 0.01;

									return (
										<tr
											key={idx}
											className="border-b border-gray-100 dark:border-gray-800 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent dark:hover:from-blue-900/10 dark:hover:to-transparent transition-all duration-200"
										>
											<td className="py-3 px-4 font-semibold">
												{movement.carrier}
											</td>
											<td className="py-3 px-4 text-sm">{movement.service}</td>
											<td className="py-3 px-4 text-center">
												<span className="inline-block px-3 py-1 rounded-full font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
													{movement.latest_pct.toFixed(2)}%
												</span>
											</td>
											<td className="py-3 px-4 text-center">
												<span
													className={cn(
														"inline-block px-3 py-1 rounded-full font-semibold border",
														isFlat
															? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
															: isIncrease
															? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700"
															: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
													)}
												>
													{movement.delta_pp > 0 ? "+" : ""}
													{movement.delta_pp.toFixed(2)} pp
												</span>
											</td>
											<td className="py-3 px-4 text-center">
												<div className="flex items-center justify-center gap-1">
													{movement.direction === "Up" && (
														<TrendingUp className="w-4 h-4 text-red-500" />
													)}
													{movement.direction === "Down" && (
														<TrendingDown className="w-4 h-4 text-green-500" />
													)}
													{movement.direction === "Flat" && (
														<Minus className="w-4 h-4 text-gray-500" />
													)}
													<span className="text-sm font-medium">
														{movement.direction}
													</span>
												</div>
											</td>
											<td className="py-3 px-4 text-center text-sm text-gray-600 dark:text-gray-400">
												{movement.latest_date}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				) : (
					<div className="text-center py-8 text-gray-500 dark:text-gray-400">
						No recent movement data available
					</div>
				)}
			</Card>

			{/* Outliers Widget - Only if comparison is available */}
			{data.comparison_available && (
				<Card glass>
					<div className="mb-6">
						<div className="flex items-center gap-3 mb-2">
							<AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
							<h3 className="text-lg font-bold">
								Outliers vs Competitor Average
							</h3>
						</div>
						<p className="text-sm text-gray-600 dark:text-gray-400">
							Carriers deviating more than {data.outlier_threshold_pp} pp from
							the median
						</p>
					</div>

					{data.outliers.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead>
									<tr className="border-b border-gray-200 dark:border-gray-700">
										<th className="text-left py-3 px-4 font-semibold">Date</th>
										<th className="text-left py-3 px-4 font-semibold">
											Carrier
										</th>
										<th className="text-left py-3 px-4 font-semibold">
											Service
										</th>
										<th className="text-center py-3 px-4 font-semibold">
											Surcharge %
										</th>
										<th className="text-center py-3 px-4 font-semibold">
											Median %
										</th>
										<th className="text-center py-3 px-4 font-semibold">
											Delta
										</th>
									</tr>
								</thead>
								<tbody>
									{data.outliers.map((outlier, idx) => {
										const isAbove = outlier.delta_pp > 0;

										return (
											<tr
												key={idx}
												className="border-b border-gray-100 dark:border-gray-800 hover:bg-gradient-to-r hover:from-amber-50/50 hover:to-transparent dark:hover:from-amber-900/10 dark:hover:to-transparent transition-all duration-200"
											>
												<td className="py-3 px-4 text-sm">{outlier.date}</td>
												<td className="py-3 px-4 font-semibold">
													{outlier.carrier}
												</td>
												<td className="py-3 px-4 text-sm">{outlier.service}</td>
												<td className="py-3 px-4 text-center">
													<span className="inline-block px-3 py-1 rounded-full font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
														{outlier.surcharge_pct.toFixed(2)}%
													</span>
												</td>
												<td className="py-3 px-4 text-center">
													<span className="inline-block px-3 py-1 rounded-full font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
														{outlier.median_pct.toFixed(2)}%
													</span>
												</td>
												<td className="py-3 px-4 text-center">
													<span
														className={cn(
															"inline-block px-3 py-1 rounded-full font-semibold border",
															isAbove
																? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700"
																: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
														)}
													>
														{outlier.delta_pp > 0 ? "+" : ""}
														{outlier.delta_pp.toFixed(2)} pp
													</span>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					) : (
						<div className="text-center py-8 text-gray-500 dark:text-gray-400">
							No outliers detected
						</div>
					)}
				</Card>
			)}

			{/* New Visualization Tiles */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Outlier Scatter */}
				<OutlierScatter
					data={data.scatter_data || []}
					threshold={data.outlier_threshold_pp}
					carriers={data.carriers}
				/>

				{/* Cadence Heatmap */}
				<CadenceHeatmap
					carrierUpdates={data.cadence_data?.carrier_updates || {}}
					carriers={data.carriers}
				/>
			</div>

			{/* Relative Surcharge Index - Full Width */}
			<RelativeSurchargeIndex
				carrierIndices={data.relative_index_data?.carrier_indices || []}
				windowSize={data.relative_index_data?.window_size || 0}
				hasData={data.relative_index_data?.has_data || false}
				numCarriers={data.relative_index_data?.num_carriers || 0}
				cheapestCarrier={data.relative_index_data?.cheapest_carrier}
				message={data.relative_index_data?.message}
			/>

			{/* Fuel Curve Version Comparison - Shows only if carrier has multiple versions */}
			<FuelCurveVersionComparison
				market={selectedCountry}
				fuelCategory={selectedServiceType}
			/>
		</div>
	);
}
