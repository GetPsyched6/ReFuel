import { useEffect, useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { comparisonApi } from "@/services/api";
import { Loader2, BarChart3, Table as TableIcon, TrendingUp } from "lucide-react";
import ComparisonChart from "./ComparisonChart";
import * as Tabs from "@radix-ui/react-tabs";
import { extrapolateBands, Band } from "@/utils/bandExtrapolation";
import { applyViewTransformation, type ViewType, type RawBand } from "@/utils/viewTransformations";

interface ComparisonRow {
	price_range: string;
	at_least_usd: number;
	but_less_than_usd: number;
	ups_pct: number | null;
	fedex_pct: number | null;
	dhl_pct: number | null;
	ups_pct_changed?: boolean;
	ups_pct_prev?: number;
	fedex_pct_changed?: boolean;
	fedex_pct_prev?: number;
	dhl_pct_changed?: boolean;
	dhl_pct_prev?: number;
	current_timestamp?: string;
	previous_timestamp?: string;
	ups_extrapolated?: boolean;
	fedex_extrapolated?: boolean;
	dhl_extrapolated?: boolean;
}

export default function ComparisonTable({
	view,
	sessionId,
	fuelCategory,
	market,
	carriers,
	onCarriersWithDataChange,
	onHasDataChange,
}: {
	view:
		| "normalized"
		| "normalized_fine"
		| "overlap"
		| "complete"
		| "comparable";
	sessionId?: number;
	fuelCategory?: string;
	market?: string;
	carriers?: string[];
	onCarriersWithDataChange?: (carriers: string[]) => void;
	onHasDataChange?: (hasData: boolean) => void;
}) {
	const [rawData, setRawData] = useState<ComparisonRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [chartOrTable, setChartOrTable] = useState<"chart" | "table">("chart");
	const [showExtrapolation, setShowExtrapolation] = useState(false);
	
	// Multi-curve mode is disabled
	const isMultiCurveMode = false;
	const multiCurveData: any[] = [];
	const processedCurves: any[] = [];

	const loadRawData = useCallback(async () => {
		if (!sessionId || !fuelCategory || !market) {
			setRawData([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const response = await comparisonApi.getComparison(
				"raw",
				sessionId,
				false,
				fuelCategory,
				market,
				carriers
			);
			setRawData(response.data.rows || []);
		} catch (error) {
			console.error("Failed to load raw data:", error);
			setRawData([]);
		} finally {
			setLoading(false);
		}
	}, [sessionId, fuelCategory, market, carriers]);

	// Load data
	useEffect(() => {
		if (sessionId) {
			loadRawData();
		}
	}, [sessionId, loadRawData]);

	// STEP 1: Merge raw + extrapolated data
	const mergedData = useMemo(() => {
		if (!showExtrapolation || rawData.length === 0 || !market || !fuelCategory) {
			console.log('📊 Using raw data only (no extrapolation)');
			return rawData.map(row => ({ ...row }));
		}

		console.log('🔮 Computing extrapolation for merged dataset...');
		
		// Build a map of real data ranges per carrier to avoid overwriting
		const realDataRanges = new Map<string, { min: number; max: number }>();
		const availableCarriers = carriers || ["UPS", "FedEx", "DHL"];

		for (const carrier of availableCarriers) {
			const carrierBands = rawData.filter((r: any) => {
				const carrierKey = carrier.toLowerCase() + '_pct';
				return r[carrierKey] !== null && r[carrierKey] !== undefined;
			});
			
			if (carrierBands.length > 0) {
				const min = Math.min(...carrierBands.map(b => b.at_least_usd));
				const max = Math.max(...carrierBands.map(b => b.but_less_than_usd));
				realDataRanges.set(carrier, { min, max });
			}
		}

		// Compute extrapolated bands for each carrier
		const extrapolatedMap = new Map<string, Band[]>();

		for (const carrier of availableCarriers) {
			const carrierBands: Band[] = rawData
				.filter((r: any) => {
					const carrierKey = carrier.toLowerCase() + '_pct';
					return r[carrierKey] !== null && r[carrierKey] !== undefined;
				})
				.map((r: any) => ({
					at_least_usd: r.at_least_usd,
					but_less_than_usd: r.but_less_than_usd,
					surcharge_pct: r[carrier.toLowerCase() + '_pct']
				}));

			if (carrierBands.length > 0) {
				const extrapolated = extrapolateBands(
					carrierBands,
					carrier,
					market,
					fuelCategory
				);
				if (extrapolated.length > 0) {
					extrapolatedMap.set(carrier, extrapolated);
					console.log(`   ${carrier}: ${extrapolated.length} extrapolated bands`);
					console.log(`   ${carrier} first 5:`, extrapolated.slice(0, 5).map(b => 
						`$${b.at_least_usd.toFixed(2)}-${b.but_less_than_usd.toFixed(2)}: ${b.surcharge_pct}%`
					));
					console.log(`   ${carrier} last 5:`, extrapolated.slice(-5).map(b => 
						`$${b.at_least_usd.toFixed(2)}-${b.but_less_than_usd.toFixed(2)}: ${b.surcharge_pct}%`
					));
				}
			}
		}

		// Start with all real data - use array instead of map to preserve all rows
		const allBands: ComparisonRow[] = rawData.map(row => ({
			...row,
			ups_extrapolated: false,
			fedex_extrapolated: false,
			dhl_extrapolated: false,
		}));

		// Add ONLY extrapolated bands that don't overlap with real data
		for (const [carrier, bands] of extrapolatedMap) {
			const realRange = realDataRanges.get(carrier);
			if (!realRange) continue;

			bands.forEach(band => {
				// Only add if this band is OUTSIDE the real data range
				const isOutsideRange = band.but_less_than_usd <= realRange.min || 
				                       band.at_least_usd >= realRange.max;
				
				if (!isOutsideRange) {
					console.warn(`⚠️ Skipping extrapolated band [${band.at_least_usd}-${band.but_less_than_usd}] for ${carrier} - overlaps with real data range [${realRange.min}-${realRange.max}]`);
					return;
				}

				const carrierKey = `${carrier.toLowerCase()}_pct` as keyof ComparisonRow;
				const extrapolatedKey = `${carrier.toLowerCase()}_extrapolated` as keyof ComparisonRow;

				// Check if a row already exists at EXACTLY this price range (both start AND end must match)
				const existingIndex = allBands.findIndex(b => 
					Math.abs(b.at_least_usd - band.at_least_usd) < 0.0001 &&
					Math.abs(b.but_less_than_usd - band.but_less_than_usd) < 0.0001
				);

				if (existingIndex >= 0) {
					// Update existing row (same price range, different carrier data)
					(allBands[existingIndex] as any)[carrierKey] = band.surcharge_pct;
					(allBands[existingIndex] as any)[extrapolatedKey] = true;
				} else {
					// Create new row for this unique price range
					const newRow: ComparisonRow = {
						price_range: `$${band.at_least_usd.toFixed(2)}-$${band.but_less_than_usd.toFixed(2)}`,
						at_least_usd: band.at_least_usd,
						but_less_than_usd: band.but_less_than_usd,
						ups_pct: null,
						fedex_pct: null,
						dhl_pct: null,
						ups_extrapolated: false,
						fedex_extrapolated: false,
						dhl_extrapolated: false,
					};
					(newRow as any)[carrierKey] = band.surcharge_pct;
					(newRow as any)[extrapolatedKey] = true;
					allBands.push(newRow);
				}
			});
		}

		const merged = allBands.sort((a, b) => a.at_least_usd - b.at_least_usd);
		console.log(`✅ Merged dataset: ${merged.length} bands (${rawData.length} raw + ${merged.length - rawData.length} extrapolated)`);
		console.log('   First 10 bands:', merged.slice(0, 10).map(b => {
			const ups = b.ups_pct !== null ? `UPS ${b.ups_pct}%${b.ups_extrapolated ? '[E]' : ''}` : '';
			const fedex = b.fedex_pct !== null ? `FedEx ${b.fedex_pct}%${b.fedex_extrapolated ? '[E]' : ''}` : '';
			const dhl = b.dhl_pct !== null ? `DHL ${b.dhl_pct}%${b.dhl_extrapolated ? '[E]' : ''}` : '';
			return `$${b.at_least_usd.toFixed(2)}-${b.but_less_than_usd.toFixed(2)}: ${[ups, fedex, dhl].filter(Boolean).join(', ')}`;
		}));
		return merged;
	}, [rawData, showExtrapolation, market, fuelCategory, carriers]);

	// STEP 2: Apply view transformation to merged data
	const displayData = useMemo(() => {
		console.log(`🔄 Applying view transformation: ${view}`);
		const transformed = applyViewTransformation(mergedData as RawBand[], view as ViewType);
		console.log(`✅ View transformation complete: ${transformed.length} bands`);
		console.log('   First 10 display bands:', transformed.slice(0, 10).map(b => {
			const ups = b.ups_pct !== null ? `UPS ${b.ups_pct}%${b.ups_extrapolated ? '[E]' : ''}` : '';
			const fedex = b.fedex_pct !== null ? `FedEx ${b.fedex_pct}%${b.fedex_extrapolated ? '[E]' : ''}` : '';
			const dhl = b.dhl_pct !== null ? `DHL ${b.dhl_pct}%${b.dhl_extrapolated ? '[E]' : ''}` : '';
			return `$${b.at_least_usd.toFixed(2)}-${b.but_less_than_usd.toFixed(2)}: ${[ups, fedex, dhl].filter(Boolean).join(', ')}`;
		}));
		return transformed as ComparisonRow[];
	}, [mergedData, view]);


	// Determine which carriers have data
	const carriersWithData = useMemo(() => {
		const carriersSet = new Set<string>();
		displayData.forEach((row) => {
			if (row.ups_pct !== null) carriersSet.add("UPS");
			if (row.fedex_pct !== null) carriersSet.add("FedEx");
			if (row.dhl_pct !== null) carriersSet.add("DHL");
		});
		return Array.from(carriersSet);
	}, [displayData]);

	// Notify parent component of carriers with data
	useEffect(() => {
		if (onCarriersWithDataChange) {
			onCarriersWithDataChange(carriersWithData);
		}
	}, [carriersWithData, onCarriersWithDataChange]);

	useEffect(() => {
		const hasData = displayData.length > 0;
		onHasDataChange?.(hasData);
	}, [displayData.length, onHasDataChange]);

	const currencySymbol = useMemo(() => {
		const normalizedMarket = market?.toUpperCase();
		const normalizedCategory = fuelCategory ?? "all";
		const useEuro =
			normalizedMarket === "DE" &&
			(normalizedCategory === "ground_domestic" ||
				normalizedCategory === "ground_regional" ||
				normalizedCategory === "international_ground_export_import");
		return useEuro ? "€" : "$";
	}, [market, fuelCategory]);

	const formatPriceValue = (value: number) =>
		`${currencySymbol}${value.toFixed(2)}`;

	const formatPriceRange = (row: ComparisonRow) =>
		`${formatPriceValue(row.at_least_usd)}-${formatPriceValue(
			row.but_less_than_usd
		)}`;

	if (loading) {
		return (
			<Card glass className="flex items-center justify-center py-12">
				<Loader2 className="w-8 h-8 animate-spin text-blue-500 dark:text-blue-400" />
			</Card>
		);
	}

	return (
		<Card glass>
			<Tabs.Root
				value={chartOrTable}
				onValueChange={(v) => setChartOrTable(v as "chart" | "table")}
				className="w-full"
			>
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
					<h2 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent animate-gradient">
						Fuel Surcharge Comparison
					</h2>
					<div className="flex items-center gap-3">
						<button
							onClick={() => setShowExtrapolation(!showExtrapolation)}
							className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
								showExtrapolation
									? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50"
									: "bg-gray-100/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border border-gray-300/50 dark:border-gray-600/50"
							}`}
							title={showExtrapolation ? "Hide extrapolated bands" : "Show extrapolated bands"}
						>
							<TrendingUp className="w-4 h-4" />
							<span>Extrapolation</span>
						</button>
					<Tabs.List className="inline-flex items-center gap-1 p-1 rounded-full backdrop-blur-xl bg-white/10 dark:bg-gray-900/30 border border-white/20 dark:border-gray-700/50">
						<Tabs.Trigger
							value="chart"
							className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=inactive]:text-gray-600 dark:data-[state=inactive]:text-gray-300 hover:bg-white/40 dark:hover:bg-gray-800/40"
						>
							<BarChart3 className="w-4 h-4" />
							Chart View
						</Tabs.Trigger>
						<Tabs.Trigger
							value="table"
							className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=inactive]:text-gray-600 dark:data-[state=inactive]:text-gray-300 hover:bg-white/40 dark:hover:bg-gray-800/40"
						>
							<TableIcon className="w-4 h-4" />
							Table View
						</Tabs.Trigger>
					</Tabs.List>
					</div>
				</div>

				<Tabs.Content value="chart" className="focus:outline-none">
					{displayData.length > 0 ? (
						<ComparisonChart
							data={displayData}
							view={view}
							carriersWithData={carriersWithData}
							currencySymbol={currencySymbol}
							sessionId={sessionId}
							fuelCategory={fuelCategory}
							market={market}
							showExtrapolation={showExtrapolation}
						/>
					) : (
						<div className="text-center py-8 text-gray-500 dark:text-gray-400">
							No data available for chart
						</div>
					)}
				</Tabs.Content>

				<Tabs.Content value="table" className="focus:outline-none">
					{view === "comparable" && (
						<div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
							<p className="text-sm text-blue-800 dark:text-blue-200">
								<strong>Comparable Ranges:</strong> Shows intersection ranges
								where at least 2 carriers have data. Perfect for side-by-side
								comparison.
							</p>
						</div>
					)}

					<div className="overflow-x-auto max-h-[850px] overflow-y-auto">
						<table className="w-full relative">
							<thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
								<tr className="border-b border-gray-200 dark:border-gray-700 shadow-sm">
									<th className="text-left py-3 px-4 font-semibold">
										Price Range
									</th>
									{carriersWithData.includes("UPS") && (
										<th className="text-center py-3 px-4 font-semibold">UPS</th>
									)}
									{carriersWithData.includes("FedEx") && (
										<th className="text-center py-3 px-4 font-semibold">
											FedEx
										</th>
									)}
									{carriersWithData.includes("DHL") && (
										<th className="text-center py-3 px-4 font-semibold">DHL</th>
									)}
								</tr>
							</thead>
							<tbody>
								{displayData.map((row, idx) => {
									// Calculate min value for highlighting
									const carrierValueMap = {
										UPS: row.ups_pct,
										FedEx: row.fedex_pct,
										DHL: row.dhl_pct,
									};
									const numericValues = carriersWithData
										.map((carrier) => carrierValueMap[carrier])
										.filter(
											(value): value is number =>
												value !== null && value !== undefined
										);
									
									const minValue =
										numericValues.length >= 2
											? Math.min(...numericValues)
											: null;
									return (
										<tr
											key={idx}
											className="border-b border-gray-100 dark:border-gray-800 hover:bg-gradient-to-r hover:from-amber-50/50 hover:to-transparent dark:hover:from-amber-900/10 dark:hover:to-transparent transition-all duration-200"
										>
											<td className="py-3 px-4 font-medium">
												{formatPriceRange(row)}
											</td>
											{carriersWithData.includes("UPS") && (
												<td className="py-3 px-4 text-center">
													<SurchargeCell
														value={row.ups_pct}
														isLowest={
															minValue !== null &&
															row.ups_pct !== null &&
															row.ups_pct === minValue
														}
														hasChanged={row.ups_pct_changed}
														previousValue={row.ups_pct_prev}
														currentTimestamp={row.current_timestamp}
														previousTimestamp={row.previous_timestamp}
																isExtrapolated={row.ups_extrapolated}
													/>
												</td>
											)}
											{carriersWithData.includes("FedEx") && (
												<td className="py-3 px-4 text-center">
													<SurchargeCell
														value={row.fedex_pct}
														isLowest={
															minValue !== null &&
															row.fedex_pct !== null &&
															row.fedex_pct === minValue
														}
														hasChanged={row.fedex_pct_changed}
														previousValue={row.fedex_pct_prev}
														currentTimestamp={row.current_timestamp}
														previousTimestamp={row.previous_timestamp}
																isExtrapolated={row.fedex_extrapolated}
													/>
												</td>
											)}
											{carriersWithData.includes("DHL") && (
												<td className="py-3 px-4 text-center">
													<SurchargeCell
														value={row.dhl_pct}
														isLowest={
															minValue !== null &&
															row.dhl_pct !== null &&
															row.dhl_pct === minValue
														}
														hasChanged={row.dhl_pct_changed}
														previousValue={row.dhl_pct_prev}
														currentTimestamp={row.current_timestamp}
														previousTimestamp={row.previous_timestamp}
																isExtrapolated={row.dhl_extrapolated}
													/>
												</td>
											)}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{displayData.length === 0 && (
						<div className="text-center py-8 text-gray-500 dark:text-gray-400">
							No data available
						</div>
					)}
				</Tabs.Content>
			</Tabs.Root>
		</Card>
	);
}

function SurchargeCell({
	value,
	hasChanged,
	previousValue,
	currentTimestamp,
	previousTimestamp,
	isLowest = false,
	isExtrapolated = false,
}: {
	value: number | null;
	hasChanged?: boolean;
	previousValue?: number;
	currentTimestamp?: string;
	previousTimestamp?: string;
	isLowest?: boolean;
	isExtrapolated?: boolean;
}) {
	if (value === null) {
		return <span className="text-gray-400 dark:text-gray-600">-</span>;
	}

	const formatDate = (timestamp?: string) => {
		if (!timestamp) return "";
		const date = new Date(
			timestamp.includes("Z") ? timestamp : timestamp + "Z"
		);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	// Show amber pill if value changed from previous session
	const showAmber = hasChanged && previousValue !== undefined;

	const baseClasses =
		"inline-block px-3 py-1 rounded-full font-semibold transition-all duration-200 hover:scale-110 cursor-default shadow-sm";

	const pill = (
		<span
			className={cn(
				baseClasses,
				isExtrapolated
					? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-dashed border-orange-500"
					: isLowest
					? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-white border-emerald-500/80 shadow-emerald-500/40 ring-1 ring-emerald-400/40 border"
					: showAmber
					? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg ring-2 ring-amber-300/50 dark:ring-amber-600/30 border-transparent border"
					: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 border"
			)}
		>
			{value.toFixed(2)}%
		</span>
	);

	// If changed, wrap in tooltip
	if (showAmber) {
		return (
			<div className="group relative inline-block">
				{pill}
				<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none">
					<div className="font-semibold mb-1">Rate Changed</div>
					<div>
						Last session ({formatDate(previousTimestamp)}):{" "}
						<span className="font-bold">{previousValue?.toFixed(2)}%</span>
					</div>
					<div>
						Current session ({formatDate(currentTimestamp)}):{" "}
						<span className="font-bold">{value.toFixed(2)}%</span>
					</div>
					<div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
				</div>
			</div>
		);
	}

	return pill;
}

import { cn } from "@/utils/cn";
