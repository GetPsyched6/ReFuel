import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import RadialGauge from "@/components/charts/RadialGauge";
import { Target, Info } from "lucide-react";
import { cn } from "@/utils/cn";
import { getCarrierBrandColor } from "@/theme/carriers";

interface CarrierIndex {
	carrier: string;
	avg_surcharge: number;
	relative_index: number;
	delta_pp: number;
	intensity_level: string;
	is_cheapest: boolean;
}

interface RelativeSurchargeIndexProps {
	carrierIndices: CarrierIndex[];
	windowSize: number;
	hasData: boolean;
	numCarriers: number;
	cheapestCarrier?: string;
	message?: string;
}

export default function RelativeSurchargeIndex({
	carrierIndices,
	windowSize,
	hasData,
	numCarriers,
	cheapestCarrier,
	message,
}: RelativeSurchargeIndexProps) {
	const intensityColors = useMemo(
		() => ({
			baseline: "text-green-600 dark:text-green-400",
			near_cheapest: "text-green-500 dark:text-green-400",
			slightly_higher: "text-yellow-600 dark:text-yellow-400",
			higher: "text-red-600 dark:text-red-400",
		}),
		[]
	);

	if (!hasData) {
		return (
			<Card glass>
				<div className="mb-4">
					<div className="flex items-center gap-3 mb-2">
						<Target className="w-5 h-5 text-indigo-500" />
						<h3 className="text-lg font-bold">Relative Surcharge Index</h3>
					</div>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Comparison vs cheapest carrier
					</p>
				</div>
				<div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
					<div className="text-center">
						<Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
						<p>{message || "No data available"}</p>
					</div>
				</div>
			</Card>
		);
	}

	if (numCarriers === 1) {
		const carrier = carrierIndices[0];
		return (
			<Card glass>
				<div className="mb-4">
					<div className="flex items-center gap-3 mb-2">
						<Target className="w-5 h-5 text-indigo-500" />
						<h3 className="text-lg font-bold">
							Relative Surcharge Index (Last {windowSize} periods)
						</h3>
					</div>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Only one carrier in this context
					</p>
				</div>

				<div className="flex justify-center py-8">
					<div className="text-center">
					<RadialGauge
						value={1.0}
						maxValue={1.5}
						color={getCarrierBrandColor(carrier.carrier)}
						size={160}
						strokeWidth={14}
						label="baseline"
					/>
						<div className="mt-4">
							<div className="font-bold text-lg">{carrier.carrier}</div>
							<div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
								Avg: {carrier.avg_surcharge.toFixed(2)}%
							</div>
							<div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
								No relative comparison available
							</div>
						</div>
					</div>
				</div>
			</Card>
		);
	}

	return (
		<Card glass>
			<div className="mb-6">
				<div className="flex items-center gap-3 mb-2">
					<Target className="w-5 h-5 text-indigo-500" />
					<h3 className="text-lg font-bold">
						Relative Surcharge Index (Last {windowSize} periods)
					</h3>
				</div>
				<p className="text-sm text-gray-600 dark:text-gray-400">
					How expensive is each carrier vs the cheapest ({cheapestCarrier})
				</p>
			</div>

			{(() => {
				const count = carrierIndices.length;
				
				// Special handling for 5 items: use flexbox to center the last row
				if (count === 5) {
					return (
						<div className="space-y-8">
							{/* First row: 3 items */}
							<div className="grid grid-cols-3 gap-8">
								{carrierIndices.slice(0, 3).map((carrier) => (
									<div key={carrier.carrier} className="flex flex-col items-center">
										<RadialGauge
											value={carrier.relative_index}
											maxValue={1.5}
											color={getCarrierBrandColor(carrier.carrier)}
											size={140}
											strokeWidth={12}
											label={carrier.relative_index.toFixed(2) + "x"}
										/>
										<div className="mt-4 text-center">
											<div className="font-bold text-lg flex items-center gap-2 justify-center">
												{carrier.carrier}
												{carrier.is_cheapest && (
													<span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
														Cheapest
													</span>
												)}
											</div>
											<div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
												Avg: {carrier.avg_surcharge.toFixed(2)}%
											</div>
											{!carrier.is_cheapest && (
												<div
													className={cn(
														"text-xs font-semibold mt-2",
														intensityColors[
															carrier.intensity_level as keyof typeof intensityColors
														] || "text-gray-600"
													)}
												>
													+{carrier.delta_pp.toFixed(2)} pp vs cheapest
												</div>
											)}
										</div>
									</div>
								))}
							</div>
							{/* Second row: 2 items centered */}
							<div className="flex justify-center gap-8">
								{carrierIndices.slice(3, 5).map((carrier) => (
									<div key={carrier.carrier} className="flex flex-col items-center">
										<RadialGauge
											value={carrier.relative_index}
											maxValue={1.5}
											color={getCarrierBrandColor(carrier.carrier)}
											size={140}
											strokeWidth={12}
											label={carrier.relative_index.toFixed(2) + "x"}
										/>
										<div className="mt-4 text-center">
											<div className="font-bold text-lg flex items-center gap-2 justify-center">
												{carrier.carrier}
												{carrier.is_cheapest && (
													<span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
														Cheapest
													</span>
												)}
											</div>
											<div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
												Avg: {carrier.avg_surcharge.toFixed(2)}%
											</div>
											{!carrier.is_cheapest && (
												<div
													className={cn(
														"text-xs font-semibold mt-2",
														intensityColors[
															carrier.intensity_level as keyof typeof intensityColors
														] || "text-gray-600"
													)}
												>
													+{carrier.delta_pp.toFixed(2)} pp vs cheapest
												</div>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					);
				}

				// For other counts, use grid
				let gridCols = "grid-cols-1";
				let containerClass = "";

				if (count === 2) {
					gridCols = "grid-cols-2";
					containerClass = "max-w-md mx-auto";
				} else if (count === 3) {
					gridCols = "grid-cols-3";
				} else if (count === 4) {
					gridCols = "grid-cols-2";
				} else if (count === 6) {
					gridCols = "grid-cols-3";
				}

				return (
					<div className={cn("grid gap-8", gridCols, containerClass)}>
						{carrierIndices.map((carrier) => (
							<div key={carrier.carrier} className="flex flex-col items-center">
								<RadialGauge
									value={carrier.relative_index}
									maxValue={1.5}
									color={getCarrierBrandColor(carrier.carrier)}
									size={140}
									strokeWidth={12}
									label={carrier.relative_index.toFixed(2) + "x"}
								/>
								<div className="mt-4 text-center">
									<div className="font-bold text-lg flex items-center gap-2 justify-center">
										{carrier.carrier}
										{carrier.is_cheapest && (
											<span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
												Cheapest
											</span>
										)}
									</div>
									<div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
										Avg: {carrier.avg_surcharge.toFixed(2)}%
									</div>
									{!carrier.is_cheapest && (
										<div
											className={cn(
												"text-xs font-semibold mt-2",
												intensityColors[
													carrier.intensity_level as keyof typeof intensityColors
												] || "text-gray-600"
											)}
										>
											+{carrier.delta_pp.toFixed(2)} pp vs cheapest
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				);
			})()}

			<div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
				<div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-green-500"></div>
						<span>Near cheapest (≤1.05x)</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-yellow-500"></div>
						<span>Slightly higher (1.05-1.10x)</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-red-500"></div>
						<span>Higher (&gt;1.10x)</span>
					</div>
				</div>
			</div>
		</Card>
	);
}

