import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import {
	GitCompare,
	ChevronLeft,
	ChevronRight,
	TrendingUp,
	TrendingDown,
	Minus,
	Calendar,
	Target,
	BarChart3,
	Info,
	Loader2,
	ArrowRight,
	Zap,
	Activity,
	Layers,
	CircleDot,
	Grid3x3,
} from "lucide-react";
import {
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	Cell,
	ReferenceLine,
	PieChart,
	Pie,
	Area,
	Line,
	ComposedChart,
	Scatter,
} from "recharts";
import { fuelCurveApi, comparisonApi } from "@/services/api";
import { motion } from "framer-motion";
import { getCarrierBrandColor } from "@/theme/carriers";
import { cn } from "@/utils/cn";

interface FuelCurveVersion {
	id: number;
	carrier: string;
	service: string;
	market: string;
	fuel_category: string;
	fuel_type: string;
	effective_date: string;
	label: string;
	session_id: number;
	is_active: boolean;
}

interface Band {
	at_least_usd: number;
	but_less_than_usd: number;
	surcharge_pct: number;
}

interface FuelCurveVersionComparisonProps {
	market: string;
	fuelCategory: string;
}

// Default fuel prices by market/category
const DEFAULT_FUEL_PRICES: Record<string, number> = {
	US_ground_domestic: 3.7, // USD per gallon
	US_ground_regional: 3.7,
	DE_ground_domestic: 1.55, // EUR per liter
	DE_ground_regional: 1.55,
	default: 3.7,
};

// Currency/unit info based on fuel_type patterns
interface CurrencyInfo {
	symbol: string;
	unit: string;
	perUnit: string;
}

function getCurrencyInfo(
	fuelType: string | undefined,
	market: string
): CurrencyInfo {
	if (!fuelType) {
		return market === "DE"
			? { symbol: "€", unit: "EUR", perUnit: "/L" }
			: { symbol: "$", unit: "USD", perUnit: "/gal" };
	}

	const lowerFuelType = fuelType.toLowerCase();

	if (
		lowerFuelType.includes("eur") ||
		lowerFuelType.includes("liter") ||
		lowerFuelType.includes("automotive gas oil")
	) {
		return { symbol: "€", unit: "EUR", perUnit: "/L" };
	}

	return { symbol: "$", unit: "USD", perUnit: "/gal" };
}

export default function FuelCurveVersionComparison({
	market,
	fuelCategory,
}: FuelCurveVersionComparisonProps) {
	const [versions, setVersions] = useState<Record<string, FuelCurveVersion[]>>(
		{}
	);
	const [loading, setLoading] = useState(true);
	const [activeCarrierIndex, setActiveCarrierIndex] = useState(0);
	const [curveData, setCurveData] = useState<Record<number, Band[]>>({});
	const [loadingCurves, setLoadingCurves] = useState(false);
	const [showAllRateShifts, setShowAllRateShifts] = useState(false);

	// Get default price for this market/category
	const defaultPrice =
		DEFAULT_FUEL_PRICES[`${market}_${fuelCategory}`] ||
		DEFAULT_FUEL_PRICES.default;
	const [inputPrice, setInputPrice] = useState(defaultPrice.toString());

	// Fetch fuel curve versions
	useEffect(() => {
		loadVersions();
	}, [market, fuelCategory]);

	const loadVersions = async () => {
		setLoading(true);
		try {
			const response = await fuelCurveApi.getVersions(market, fuelCategory);
			const versionsByCarrier = response.data.versions_by_carrier || {};
			setVersions(versionsByCarrier);
		} catch (err) {
			console.error("Error loading fuel curve versions:", err);
			setVersions({});
		} finally {
			setLoading(false);
		}
	};

	// Find carriers with multiple versions
	const carriersWithMultipleVersions = useMemo(() => {
		return Object.entries(versions)
			.filter(([_, versionList]) => versionList.length > 1)
			.map(([carrier, versionList]) => ({
				carrier,
				versions: versionList.sort(
					(a, b) =>
						new Date(b.effective_date).getTime() -
						new Date(a.effective_date).getTime()
				),
			}));
	}, [versions]);

	const activeCarrier = carriersWithMultipleVersions[activeCarrierIndex];

	// Fetch curve data for active carrier's versions
	useEffect(() => {
		if (!activeCarrier) return;

		const fetchCurveData = async () => {
			setLoadingCurves(true);
			const newCurveData: Record<number, Band[]> = {};

			try {
				for (const version of activeCarrier.versions) {
					// Use getComparisonMultiCurves with correct parameters
					const response = await comparisonApi.getComparisonMultiCurves("raw", [
						version.id,
					]);

					// The multi-curve API returns data in curves[].rows format
					const curves = response.data.curves || [];
					const curveData = curves.find((c: any) => c.curve_id === version.id);

					if (curveData && curveData.rows) {
						newCurveData[version.id] = curveData.rows
							.map((row: any) => ({
								at_least_usd: row.at_least_usd,
								but_less_than_usd: row.but_less_than_usd,
								surcharge_pct: row.surcharge_pct,
							}))
							.filter(
								(b: Band) =>
									b.surcharge_pct !== null && b.surcharge_pct !== undefined
							)
							.sort((a: Band, b: Band) => a.at_least_usd - b.at_least_usd);

						console.log(
							`Loaded ${newCurveData[version.id].length} bands for version ${
								version.id
							} (${version.label})`
						);
					}
				}
			} catch (err) {
				console.error("Error fetching curve data:", err);
			}

			setCurveData(newCurveData);
			setLoadingCurves(false);
		};

		fetchCurveData();
	}, [activeCarrier]);

	// Get the current (active) and previous version
	const currentVersion = activeCarrier?.versions.find((v) => v.is_active);
	const previousVersion = activeCarrier?.versions.find((v) => !v.is_active);

	// Get currency/unit info based on fuel type
	const currencyInfo = useMemo(() => {
		return getCurrencyInfo(currentVersion?.fuel_type, market);
	}, [currentVersion?.fuel_type, market]);

	// Update input price when market changes
	useEffect(() => {
		const newDefault =
			DEFAULT_FUEL_PRICES[`${market}_${fuelCategory}`] ||
			DEFAULT_FUEL_PRICES.default;
		setInputPrice(newDefault.toString());
	}, [market, fuelCategory]);

	const currentBands = currentVersion ? curveData[currentVersion.id] || [] : [];
	const previousBands = previousVersion
		? curveData[previousVersion.id] || []
		: [];

	// Parse input price
	const fuelPrice = useMemo(() => {
		const parsed = parseFloat(inputPrice);
		return isNaN(parsed) ? defaultPrice : parsed;
	}, [inputPrice, defaultPrice]);

	// Calculate impact at current price
	const impactData = useMemo(() => {
		if (!currentBands.length || !previousBands.length) return null;

		const findSurcharge = (bands: Band[], price: number) => {
			const band = bands.find(
				(b) => price >= b.at_least_usd && price < b.but_less_than_usd
			);
			return band?.surcharge_pct ?? null;
		};

		const currentSurcharge = findSurcharge(currentBands, fuelPrice);
		const previousSurcharge = findSurcharge(previousBands, fuelPrice);

		// Get curve ranges for messaging
		const currMin = currentBands[0]?.at_least_usd;
		const currMax = currentBands[currentBands.length - 1]?.but_less_than_usd;
		const prevMin = previousBands[0]?.at_least_usd;
		const prevMax = previousBands[previousBands.length - 1]?.but_less_than_usd;

		// If price is outside both curves
		if (currentSurcharge === null && previousSurcharge === null) {
			return {
				outOfRange: true,
				message: `Price outside both curve ranges`,
				currentRange: `${currencyInfo.symbol}${currMin?.toFixed(2)} - ${
					currencyInfo.symbol
				}${currMax?.toFixed(2)}`,
				previousRange: `${currencyInfo.symbol}${prevMin?.toFixed(2)} - ${
					currencyInfo.symbol
				}${prevMax?.toFixed(2)}`,
			};
		}

		// If price is outside current curve only
		if (currentSurcharge === null) {
			return {
				outOfRange: true,
				message: `Price below current curve range`,
				currentRange: `${currencyInfo.symbol}${currMin?.toFixed(2)} - ${
					currencyInfo.symbol
				}${currMax?.toFixed(2)}`,
				previousSurcharge,
			};
		}

		// If price is outside previous curve only
		if (previousSurcharge === null) {
			return {
				outOfRange: true,
				message: `Price outside previous curve range`,
				previousRange: `${currencyInfo.symbol}${prevMin?.toFixed(2)} - ${
					currencyInfo.symbol
				}${prevMax?.toFixed(2)}`,
				currentSurcharge,
			};
		}

		const delta = currentSurcharge - previousSurcharge;
		const percentChange =
			previousSurcharge !== 0 ? (delta / previousSurcharge) * 100 : 0;

		return {
			outOfRange: false,
			currentSurcharge,
			previousSurcharge,
			delta,
			percentChange,
			isIncrease: delta > 0,
			isFlat: Math.abs(delta) < 0.01,
		};
	}, [currentBands, previousBands, fuelPrice, currencyInfo]);

	// Calculate overlapping range info
	const overlapInfo = useMemo(() => {
		if (!currentBands.length || !previousBands.length) return null;

		const currMin = currentBands[0]?.at_least_usd || 0;
		const currMax =
			currentBands[currentBands.length - 1]?.but_less_than_usd || 0;
		const prevMin = previousBands[0]?.at_least_usd || 0;
		const prevMax =
			previousBands[previousBands.length - 1]?.but_less_than_usd || 0;

		const overlapMin = Math.max(currMin, prevMin);
		const overlapMax = Math.min(currMax, prevMax);
		const hasOverlap = overlapMin < overlapMax;

		return {
			hasOverlap,
			overlapMin,
			overlapMax,
			currMin,
			currMax,
			prevMin,
			prevMax,
		};
	}, [currentBands, previousBands]);

	// Calculate rate shift waterfall data - compare at overlapping price points
	const waterfallData = useMemo(() => {
		if (!currentBands.length || !previousBands.length) return [];

		// Find overlapping price range
		const currMin = currentBands[0]?.at_least_usd || 0;
		const currMax =
			currentBands[currentBands.length - 1]?.but_less_than_usd || 0;
		const prevMin = previousBands[0]?.at_least_usd || 0;
		const prevMax =
			previousBands[previousBands.length - 1]?.but_less_than_usd || 0;

		const overlapMin = Math.max(currMin, prevMin);
		const overlapMax = Math.min(currMax, prevMax);

		if (overlapMin >= overlapMax) return []; // No overlap

		// Compare at sample points in the overlapping range
		const findSurcharge = (bands: Band[], price: number) => {
			const band = bands.find(
				(b) => price >= b.at_least_usd && price < b.but_less_than_usd
			);
			return band?.surcharge_pct ?? null;
		};

		const data: Array<{
			range: string;
			delta: number;
			current: number;
			previous: number;
			at_least: number;
		}> = [];

		// Sample at each current band's start point within overlap
		currentBands.forEach((currBand) => {
			if (
				currBand.at_least_usd < overlapMin ||
				currBand.at_least_usd >= overlapMax
			)
				return;

			const prevSurcharge = findSurcharge(previousBands, currBand.at_least_usd);
			if (prevSurcharge === null) return;

			const delta = currBand.surcharge_pct - prevSurcharge;
			data.push({
				range: `${currencyInfo.symbol}${currBand.at_least_usd.toFixed(2)}`,
				delta: Number(delta.toFixed(2)),
				current: currBand.surcharge_pct,
				previous: prevSurcharge,
				at_least: currBand.at_least_usd,
			});
		});

		return data.sort((a, b) => a.at_least - b.at_least);
	}, [currentBands, previousBands, currencyInfo.symbol]);

	// Calculate change distribution - compare at overlapping price points
	const distributionData = useMemo(() => {
		if (!currentBands.length || !previousBands.length) return null;

		// Find overlapping price range
		const currMin = currentBands[0]?.at_least_usd || 0;
		const currMax =
			currentBands[currentBands.length - 1]?.but_less_than_usd || 0;
		const prevMin = previousBands[0]?.at_least_usd || 0;
		const prevMax =
			previousBands[previousBands.length - 1]?.but_less_than_usd || 0;

		const overlapMin = Math.max(currMin, prevMin);
		const overlapMax = Math.min(currMax, prevMax);

		if (overlapMin >= overlapMax) return null; // No overlap

		const findSurcharge = (bands: Band[], price: number) => {
			const band = bands.find(
				(b) => price >= b.at_least_usd && price < b.but_less_than_usd
			);
			return band?.surcharge_pct ?? null;
		};

		let increased = 0;
		let decreased = 0;
		let unchanged = 0;
		let totalDelta = 0;
		let comparedPoints = 0;

		// Compare at each current band's start point within overlap
		currentBands.forEach((currBand) => {
			if (
				currBand.at_least_usd < overlapMin ||
				currBand.at_least_usd >= overlapMax
			)
				return;

			const prevSurcharge = findSurcharge(previousBands, currBand.at_least_usd);
			if (prevSurcharge === null) return;

			comparedPoints++;
			const delta = currBand.surcharge_pct - prevSurcharge;
			totalDelta += delta;

			if (delta > 0.01) increased++;
			else if (delta < -0.01) decreased++;
			else unchanged++;
		});

		if (comparedPoints === 0) return null;

		return {
			increased,
			decreased,
			unchanged,
			total: comparedPoints,
			avgDelta: totalDelta / comparedPoints,
			pieData: [
				{ name: "Increased", value: increased, color: "#F87171" }, // Softer rose
				{ name: "Decreased", value: decreased, color: "#34D399" }, // Softer emerald
				{ name: "Unchanged", value: unchanged, color: "#9CA3AF" }, // Softer gray
			].filter((d) => d.value > 0),
		};
	}, [currentBands, previousBands]);

	// Calculate crossover point
	const crossoverData = useMemo(() => {
		if (!currentBands.length || !previousBands.length) return null;

		let crossoverPrice: number | null = null;
		let currentCheaperBelow = false;

		for (let price = 2.0; price <= 5.0; price += 0.01) {
			const findSurcharge = (bands: Band[], p: number) => {
				const band = bands.find(
					(b) => p >= b.at_least_usd && p < b.but_less_than_usd
				);
				return band?.surcharge_pct ?? null;
			};

			const curr = findSurcharge(currentBands, price);
			const prev = findSurcharge(previousBands, price);

			if (curr !== null && prev !== null) {
				const diff = curr - prev;

				if (crossoverPrice === null && Math.abs(diff) > 0.01) {
					currentCheaperBelow = diff < 0;
				}

				if (crossoverPrice === null && currentCheaperBelow && diff > 0.01) {
					crossoverPrice = price;
					break;
				}
				if (crossoverPrice === null && !currentCheaperBelow && diff < -0.01) {
					crossoverPrice = price;
					break;
				}
			}
		}

		return {
			crossoverPrice,
			currentCheaperBelow,
		};
	}, [currentBands, previousBands]);

	// Calculate band structure info
	const structureData = useMemo(() => {
		const getStructure = (bands: Band[]) => {
			if (bands.length < 2) return null;

			const stepWidths: number[] = [];
			for (let i = 0; i < bands.length; i++) {
				stepWidths.push(
					Number(
						(bands[i].but_less_than_usd - bands[i].at_least_usd).toFixed(3)
					)
				);
			}

			// Detect inflection
			let inflectionIdx = -1;
			for (let i = 1; i < stepWidths.length; i++) {
				if (Math.abs(stepWidths[i] - stepWidths[i - 1]) > 0.02) {
					inflectionIdx = i;
					break;
				}
			}

			return {
				numBands: bands.length,
				minPrice: bands[0]?.at_least_usd,
				maxPrice: bands[bands.length - 1]?.but_less_than_usd,
				stepWidths: [...new Set(stepWidths)],
				inflectionIdx,
				inflectionPrice:
					inflectionIdx >= 0 ? bands[inflectionIdx]?.at_least_usd : null,
			};
		};

		return {
			current: getStructure(currentBands),
			previous: getStructure(previousBands),
		};
	}, [currentBands, previousBands]);

	// === NEW: Variance Lollipop Data (connected dots showing change) ===
	const lollipopData = useMemo(() => {
		if (!currentBands.length || !previousBands.length) return [];

		const findSurcharge = (bands: Band[], price: number) => {
			const band = bands.find(
				(b) => price >= b.at_least_usd && price < b.but_less_than_usd
			);
			return band?.surcharge_pct ?? null;
		};

		// Sample at price intervals across both curves
		const allPrices = new Set<number>();
		currentBands.forEach((b) => allPrices.add(b.at_least_usd));
		previousBands.forEach((b) => allPrices.add(b.at_least_usd));

		const sortedPrices = Array.from(allPrices).sort((a, b) => a - b);

		return sortedPrices
			.map((price) => {
				const curr = findSurcharge(currentBands, price);
				const prev = findSurcharge(previousBands, price);
				if (curr === null && prev === null) return null;

				return {
					price,
					priceLabel: `${currencyInfo.symbol}${price.toFixed(2)}`,
					current: curr,
					previous: prev,
					delta: curr !== null && prev !== null ? curr - prev : null,
					hasBoth: curr !== null && prev !== null,
				};
			})
			.filter(Boolean) as Array<{
			price: number;
			priceLabel: string;
			current: number | null;
			previous: number | null;
			delta: number | null;
			hasBoth: boolean;
		}>;
	}, [currentBands, previousBands, currencyInfo.symbol]);

	// === NEW: Gap Analysis Data (for area between curves) ===
	const gapData = useMemo(() => {
		if (!currentBands.length || !previousBands.length) return [];

		const findSurcharge = (bands: Band[], price: number) => {
			const band = bands.find(
				(b) => price >= b.at_least_usd && price < b.but_less_than_usd
			);
			return band?.surcharge_pct ?? null;
		};

		// Get dynamic price range from actual data
		const allBands = [...currentBands, ...previousBands];
		const minPrice = Math.min(...allBands.map((b) => b.at_least_usd));
		const maxPrice = Math.max(...allBands.map((b) => b.but_less_than_usd));

		// Determine appropriate step size based on price range
		const range = maxPrice - minPrice;
		const step = range > 3 ? 0.05 : 0.02;

		// Generate points at small intervals for smooth area
		const data: Array<{
			price: number;
			current: number | null;
			previous: number | null;
			gap: number;
			gapPositive: number;
			gapNegative: number;
		}> = [];

		for (let price = minPrice; price <= maxPrice; price += step) {
			const curr = findSurcharge(currentBands, price);
			const prev = findSurcharge(previousBands, price);

			if (curr !== null || prev !== null) {
				const gap = (curr ?? prev ?? 0) - (prev ?? curr ?? 0);
				data.push({
					price,
					current: curr,
					previous: prev,
					gap,
					gapPositive: gap > 0 ? gap : 0,
					gapNegative: gap < 0 ? Math.abs(gap) : 0,
				});
			}
		}

		return data;
	}, [currentBands, previousBands]);

	// === NEW: Dot Matrix Data (intensity visualization) ===
	const dotMatrixData = useMemo(() => {
		if (!waterfallData.length) return [];

		const maxDelta = Math.max(...waterfallData.map((d) => Math.abs(d.delta)));

		return waterfallData.map((d) => ({
			...d,
			intensity: Math.abs(d.delta) / (maxDelta || 1),
			size: 10 + (Math.abs(d.delta) / (maxDelta || 1)) * 40,
		}));
	}, [waterfallData]);

	// === NEW: Key Metrics Summary ===
	const metricsSummary = useMemo(() => {
		if (!currentBands.length || !previousBands.length || !waterfallData.length)
			return null;

		// Use waterfallData for accurate metrics (only overlapping points)
		const validDeltas = waterfallData.filter((d) => d.delta !== null);
		const totalDelta = validDeltas.reduce((sum, d) => sum + d.delta, 0);
		const avgDeltaFromWaterfall =
			validDeltas.length > 0 ? totalDelta / validDeltas.length : 0;

		const currRange =
			currentBands.length > 0
				? currentBands[currentBands.length - 1].surcharge_pct -
				  currentBands[0].surcharge_pct
				: 0;
		const prevRange =
			previousBands.length > 0
				? previousBands[previousBands.length - 1].surcharge_pct -
				  previousBands[0].surcharge_pct
				: 0;

		// Separate increases (new > old) and decreases (new < old)
		const increases = validDeltas.filter((d) => d.delta > 0);
		const decreases = validDeltas.filter((d) => d.delta < 0);

		const maxIncrease =
			increases.length > 0 ? Math.max(...increases.map((d) => d.delta)) : null;
		const maxDecrease =
			decreases.length > 0
				? Math.min(...decreases.map((d) => d.delta)) // Most negative
				: null;

		// Count how many points increased vs decreased
		const increaseCount = increases.length;
		const decreaseCount = decreases.length;

		return {
			avgChange: avgDeltaFromWaterfall, // Fixed: use actual delta, not curve averages
			currRange,
			prevRange,
			rangeChange: currRange - prevRange,
			maxIncrease,
			maxDecrease,
			increaseCount,
			decreaseCount,
			totalPoints: validDeltas.length,
		};
	}, [currentBands, previousBands, waterfallData]);

	// Navigation handlers
	const handlePrevCarrier = () => {
		setActiveCarrierIndex((prev) =>
			prev === 0 ? carriersWithMultipleVersions.length - 1 : prev - 1
		);
	};

	const handleNextCarrier = () => {
		setActiveCarrierIndex((prev) =>
			prev === carriersWithMultipleVersions.length - 1 ? 0 : prev + 1
		);
	};

	if (loading) {
		return (
			<Card glass className="flex items-center justify-center py-12">
				<Loader2 className="w-8 h-8 animate-spin text-blue-500" />
			</Card>
		);
	}

	// Don't render if no carriers have multiple versions
	if (carriersWithMultipleVersions.length === 0) {
		return null;
	}

	const carrierColor = activeCarrier
		? getCarrierBrandColor(activeCarrier.carrier)
		: "#6B7280";

	return (
		<Card glass>
			{/* Header */}
			<div className="mb-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div
							className="p-2.5 rounded-xl"
							style={{ backgroundColor: `${carrierColor}15` }}
						>
							<GitCompare className="w-5 h-5" style={{ color: carrierColor }} />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
									Version Comparison
								</h3>
								{activeCarrier && (
									<span
										className="text-xs font-semibold px-2 py-0.5 rounded-md"
										style={{
											backgroundColor: `${carrierColor}15`,
											color: carrierColor,
										}}
									>
										{activeCarrier.carrier}
									</span>
								)}
							</div>
							<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
								{activeCarrier?.versions.length || 0} historical versions
							</p>
						</div>
					</div>
					{carriersWithMultipleVersions.length > 1 && (
						<div className="flex items-center gap-1">
							<button
								onClick={handlePrevCarrier}
								className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
								aria-label="Previous carrier"
							>
								<ChevronLeft className="w-4 h-4 text-slate-500" />
							</button>
							<button
								onClick={handleNextCarrier}
								className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
								aria-label="Next carrier"
							>
								<ChevronRight className="w-4 h-4 text-slate-500" />
							</button>
						</div>
					)}
				</div>
			</div>

			{loadingCurves ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="w-6 h-6 animate-spin text-gray-400" />
				</div>
			) : !currentBands.length || !previousBands.length ? (
				<div className="text-center py-8 text-gray-500 dark:text-gray-400">
					<Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
					<p>Unable to load curve data for comparison</p>
				</div>
			) : (
				<div className="space-y-6">
					{/* Version Comparison Header */}
					<div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30">
						{previousVersion && (
							<div className="flex items-center gap-2">
								<div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/20" />
								<div>
									<span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
										Previous
									</span>
									<p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
										{new Date(
											previousVersion.effective_date
										).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
											year: "numeric",
										})}
									</p>
								</div>
							</div>
						)}

						<div className="flex-1 flex items-center justify-center">
							<ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
						</div>

						{currentVersion && (
							<div className="flex items-center gap-2">
								<div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
								<div>
									<span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
										Current
									</span>
									<p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
										{new Date(currentVersion.effective_date).toLocaleDateString(
											"en-US",
											{
												month: "short",
												day: "numeric",
												year: "numeric",
											}
										)}
									</p>
								</div>
							</div>
						)}
					</div>

					{/* Range Overlap Info - Subtle inline */}
					{overlapInfo && (
						<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-1">
							<div
								className={cn(
									"w-1.5 h-1.5 rounded-full",
									overlapInfo.hasOverlap ? "bg-blue-400" : "bg-amber-400"
								)}
							/>
							{overlapInfo.hasOverlap ? (
								<span>
									Comparing prices from{" "}
									<span className="font-mono font-medium text-slate-600 dark:text-slate-300">
										${overlapInfo.overlapMin.toFixed(2)}
									</span>{" "}
									to{" "}
									<span className="font-mono font-medium text-slate-600 dark:text-slate-300">
										${overlapInfo.overlapMax.toFixed(2)}
									</span>
								</span>
							) : (
								<span className="text-amber-600 dark:text-amber-400">
									No overlapping price range between versions
								</span>
							)}
						</div>
					)}

					{/* Main Content Grid */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						{/* At Current Price Impact */}
						<div className="p-5 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-2">
									<Target className="w-4 h-4 text-slate-400" />
									<h4 className="font-medium text-sm tracking-wide uppercase text-slate-600 dark:text-slate-400">
										Surcharge Rate Calculator
									</h4>
								</div>
							</div>

							{/* Price Input - More prominent */}
							<div className="flex items-center gap-2 mb-5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
								<span className="text-lg font-medium text-slate-400">
									{currencyInfo.symbol}
								</span>
								<input
									type="text"
									value={inputPrice}
									onChange={(e) => setInputPrice(e.target.value)}
									className="w-24 px-2 py-1.5 text-lg font-semibold rounded-lg border-0 bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-0"
									placeholder={defaultPrice.toFixed(2)}
								/>
								<span className="text-sm text-slate-400">
									{currencyInfo.perUnit}
								</span>
								{overlapInfo?.hasOverlap && (
									<span className="text-[10px] text-slate-400 ml-auto">
										Range: {currencyInfo.symbol}
										{overlapInfo.overlapMin.toFixed(2)}–{currencyInfo.symbol}
										{overlapInfo.overlapMax.toFixed(2)}
									</span>
								)}
							</div>

							{impactData && !impactData.outOfRange ? (
								<div className="space-y-4">
									{/* Rate comparison */}
									<div className="flex items-center justify-between">
										<div className="text-center flex-1">
											<p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">
												Old Rate
											</p>
											<p className="text-2xl font-semibold text-amber-500 tabular-nums">
												{impactData.previousSurcharge?.toFixed(2)}%
											</p>
										</div>
										<div className="px-4">
											<ArrowRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
										</div>
										<div className="text-center flex-1">
											<p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">
												New Rate
											</p>
											<p className="text-2xl font-semibold text-emerald-500 tabular-nums">
												{impactData.currentSurcharge?.toFixed(2)}%
											</p>
										</div>
									</div>

									{/* Delta badge */}
									<div className="flex justify-center">
										<div
											className={cn(
												"inline-flex items-center gap-1.5 px-4 py-2 rounded-full",
												impactData.isFlat
													? "bg-slate-100 dark:bg-slate-800"
													: impactData.isIncrease
													? "bg-rose-50 dark:bg-rose-900/20"
													: "bg-emerald-50 dark:bg-emerald-900/20"
											)}
										>
											{impactData.isFlat ? (
												<Minus className="w-4 h-4 text-slate-500" />
											) : impactData.isIncrease ? (
												<TrendingUp className="w-4 h-4 text-rose-500" />
											) : (
												<TrendingDown className="w-4 h-4 text-emerald-500" />
											)}
											<span
												className={cn(
													"text-base font-semibold tabular-nums",
													impactData.isFlat
														? "text-slate-600"
														: impactData.isIncrease
														? "text-rose-600 dark:text-rose-400"
														: "text-emerald-600 dark:text-emerald-400"
												)}
											>
												{impactData.delta && impactData.delta > 0 ? "+" : ""}
												{impactData.delta?.toFixed(2)} pp
											</span>
											{!impactData.isFlat &&
												impactData.percentChange !== undefined && (
													<span className="text-xs text-slate-400 ml-1">
														({Math.abs(impactData.percentChange).toFixed(1)}%{" "}
														{impactData.isIncrease ? "↑" : "↓"})
													</span>
												)}
										</div>
									</div>
								</div>
							) : impactData?.outOfRange ? (
								<div className="text-center py-3 space-y-2">
									<p className="text-sm text-amber-600 dark:text-amber-400">
										{impactData.message}
									</p>
									<p className="text-xs text-slate-400">
										Enter a price in the overlap range
									</p>
								</div>
							) : (
								<p className="text-sm text-slate-400 text-center py-4">
									Enter a price to compare
								</p>
							)}
						</div>

						{/* Change Distribution */}
						{distributionData && (
							<div className="p-5 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm">
								<div className="flex items-center gap-2 mb-4">
									<BarChart3 className="w-4 h-4 text-slate-400" />
									<h4 className="font-medium text-sm tracking-wide uppercase text-slate-600 dark:text-slate-400">
										Distribution
									</h4>
								</div>

								<div className="flex items-center gap-6">
									<div className="relative">
										<ResponsiveContainer width={130} height={130}>
											<PieChart>
												<Pie
													data={distributionData.pieData}
													cx="50%"
													cy="50%"
													innerRadius={42}
													outerRadius={58}
													paddingAngle={3}
													dataKey="value"
													strokeWidth={0}
												>
													{distributionData.pieData.map((entry, index) => (
														<Cell key={index} fill={entry.color} />
													))}
												</Pie>
											</PieChart>
										</ResponsiveContainer>
										{/* Center label */}
										<div className="absolute inset-0 flex flex-col items-center justify-center">
											<span className="text-2xl font-bold text-slate-700 dark:text-slate-200">
												{distributionData.total}
											</span>
											<span className="text-[10px] text-slate-400 uppercase tracking-wider">
												points
											</span>
										</div>
									</div>

									<div className="flex-1 space-y-3">
										{distributionData.pieData.map((item) => (
											<div
												key={item.name}
												className="flex items-center justify-between"
											>
												<div className="flex items-center gap-2">
													<div
														className="w-2.5 h-2.5 rounded-full"
														style={{ backgroundColor: item.color }}
													/>
													<span className="text-xs font-medium text-slate-600 dark:text-slate-400">
														{item.name}
													</span>
												</div>
												<span className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
													{item.value}
												</span>
											</div>
										))}

										<div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700">
											<div className="flex items-center justify-between">
												<span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
													Avg shift
												</span>
												<span
													className={cn(
														"text-sm font-semibold tabular-nums",
														distributionData.avgDelta > 0
															? "text-rose-500"
															: distributionData.avgDelta < 0
															? "text-emerald-500"
															: "text-slate-500"
													)}
												>
													{distributionData.avgDelta > 0 ? "+" : ""}
													{distributionData.avgDelta.toFixed(2)} pp
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Rate Shift Waterfall - Refined Design */}
					{waterfallData.length > 0 && (
						<div className="p-5 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 shadow-sm">
							<div className="flex items-center justify-between mb-5">
								<div className="flex items-center gap-2">
									<Zap className="w-4 h-4 text-slate-400" />
									<h4 className="font-medium text-sm tracking-wide uppercase text-slate-600 dark:text-slate-400">
										Rate Shifts
									</h4>
								</div>
								<span className="text-[10px] text-slate-400 uppercase tracking-wider">
									{waterfallData.length} bands changed
								</span>
							</div>

							{/* Custom Bar Waterfall - Show max 5 items unless expanded */}
							<div className="space-y-2.5">
								{(showAllRateShifts
									? waterfallData
									: waterfallData.slice(0, 5)
								).map((item, idx) => {
									const maxDelta = Math.max(
										...waterfallData.map((d) => Math.abs(d.delta))
									);
									const widthPercent = Math.max(
										8,
										(Math.abs(item.delta) / maxDelta) * 100
									);
									const isIncrease = item.delta > 0;

									return (
										<motion.div
											key={idx}
											initial={{ opacity: 0, x: -10 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ delay: idx * 0.04 }}
											className="flex items-center gap-3 group"
										>
											{/* Price label */}
											<div className="w-16 text-xs font-mono font-medium text-slate-600 dark:text-slate-300 text-right bg-slate-50 dark:bg-slate-700/30 px-2 py-1 rounded">
												{item.range}
											</div>

											{/* Bar container */}
											<div className="flex-1 relative h-7 flex items-center bg-slate-50 dark:bg-slate-700/30 rounded-lg overflow-hidden">
												{/* Bar */}
												<motion.div
													initial={{ width: 0 }}
													animate={{ width: `${widthPercent}%` }}
													transition={{
														delay: idx * 0.04 + 0.1,
														duration: 0.4,
														ease: "easeOut",
													}}
													className={cn(
														"h-full rounded-r-lg flex items-center justify-end pr-2",
														isIncrease
															? "bg-gradient-to-r from-rose-400 via-rose-500 to-rose-600"
															: "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600"
													)}
													style={{
														boxShadow: isIncrease
															? "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px rgba(244,63,94,0.3)"
															: "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px rgba(16,185,129,0.3)",
													}}
												>
													<span className="text-[10px] font-bold text-white drop-shadow-sm whitespace-nowrap">
														{isIncrease ? "+" : ""}
														{item.delta.toFixed(2)}pp
													</span>
												</motion.div>
											</div>

											{/* Hover detail */}
											<div className="w-24 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-400 whitespace-nowrap text-right">
												{item.previous.toFixed(1)}% → {item.current.toFixed(1)}%
											</div>
										</motion.div>
									);
								})}
							</div>

							{/* Show more/less button */}
							{waterfallData.length > 5 && (
								<button
									onClick={() => setShowAllRateShifts(!showAllRateShifts)}
									className="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg transition-colors"
								>
									{showAllRateShifts
										? "Show less"
										: `Show ${waterfallData.length - 5} more...`}
								</button>
							)}

							{/* Legend */}
							<div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
								<span className="flex items-center gap-2 text-xs text-slate-500">
									<div className="w-4 h-2 rounded bg-gradient-to-r from-rose-400 to-rose-500" />
									Rate increased
								</span>
								<span className="flex items-center gap-2 text-xs text-slate-500">
									<div className="w-4 h-2 rounded bg-gradient-to-r from-emerald-400 to-emerald-500" />
									Rate decreased
								</span>
							</div>
						</div>
					)}

					{/* Band Structure Comparison - Redesigned */}
					{structureData.current && structureData.previous && (
						<div className="p-5 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/30 dark:to-slate-900/30 border border-slate-200 dark:border-slate-700">
							<div className="flex items-center gap-2 mb-5">
								<Layers className="w-4 h-4 text-slate-500" />
								<h4 className="font-medium text-sm tracking-wide uppercase text-slate-600 dark:text-slate-400">
									Structure Comparison
								</h4>
							</div>

							{/* Visual comparison bars */}
							<div className="space-y-4 mb-6">
								{/* Number of Bands */}
								<div>
									<div className="flex items-center justify-between mb-2">
										<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
											Price Bands
										</span>
										<span className="text-xs text-slate-400">
											{structureData.current.numBands >
											structureData.previous.numBands
												? "+"
												: ""}
											{structureData.current.numBands -
												structureData.previous.numBands}{" "}
											change
										</span>
									</div>
									<div className="flex items-center gap-3">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-1">
												<span className="text-[10px] text-amber-600 dark:text-amber-400 w-12">
													OLD
												</span>
												<div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
													<motion.div
														initial={{ width: 0 }}
														animate={{
															width: `${
																(structureData.previous.numBands /
																	Math.max(
																		structureData.previous.numBands,
																		structureData.current.numBands
																	)) *
																100
															}%`,
														}}
														className="h-full bg-amber-400 rounded-full"
													/>
												</div>
												<span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">
													{structureData.previous.numBands}
												</span>
											</div>
											<div className="flex items-center gap-2">
												<span className="text-[10px] text-emerald-600 dark:text-emerald-400 w-12">
													NEW
												</span>
												<div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
													<motion.div
														initial={{ width: 0 }}
														animate={{
															width: `${
																(structureData.current.numBands /
																	Math.max(
																		structureData.previous.numBands,
																		structureData.current.numBands
																	)) *
																100
															}%`,
														}}
														className="h-full bg-emerald-400 rounded-full"
													/>
												</div>
												<span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">
													{structureData.current.numBands}
												</span>
											</div>
										</div>
									</div>
								</div>

								{/* Price Coverage */}
								<div>
									<div className="flex items-center justify-between mb-2">
										<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
											Price Coverage
										</span>
									</div>
									{(() => {
										// Calculate dynamic range based on actual data
										const allPrices = [
											structureData.previous.minPrice || 0,
											structureData.previous.maxPrice || 0,
											structureData.current.minPrice || 0,
											structureData.current.maxPrice || 0,
										].filter((p) => p > 0);
										const minRange =
											Math.floor(Math.min(...allPrices) * 10) / 10;
										const maxRange =
											Math.ceil(Math.max(...allPrices) * 10) / 10;
										const rangeSpan = maxRange - minRange;
										const midPoint = minRange + rangeSpan / 2;

										return (
											<>
												<div className="relative h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
													{/* Scale markers - dynamic */}
													<div className="absolute inset-0 flex items-end justify-between px-2 pb-1">
														<span className="text-[9px] text-slate-400">
															{currencyInfo.symbol}
															{minRange.toFixed(2)}
														</span>
														<span className="text-[9px] text-slate-400">
															{currencyInfo.symbol}
															{midPoint.toFixed(2)}
														</span>
														<span className="text-[9px] text-slate-400">
															{currencyInfo.symbol}
															{maxRange.toFixed(2)}
														</span>
													</div>
													{/* Previous range bar */}
													<motion.div
														initial={{ opacity: 0 }}
														animate={{ opacity: 1 }}
														className="absolute top-1 h-2.5 bg-amber-400/60 rounded-full border border-amber-500/30"
														style={{
															left: `${
																(((structureData.previous.minPrice ||
																	minRange) -
																	minRange) /
																	rangeSpan) *
																100
															}%`,
															width: `${
																(((structureData.previous.maxPrice ||
																	minRange) -
																	(structureData.previous.minPrice ||
																		minRange)) /
																	rangeSpan) *
																100
															}%`,
														}}
													/>
													{/* Current range bar */}
													<motion.div
														initial={{ opacity: 0 }}
														animate={{ opacity: 1 }}
														transition={{ delay: 0.2 }}
														className="absolute top-4 h-2.5 bg-emerald-400/60 rounded-full border border-emerald-500/30"
														style={{
															left: `${
																(((structureData.current.minPrice || minRange) -
																	minRange) /
																	rangeSpan) *
																100
															}%`,
															width: `${
																(((structureData.current.maxPrice || minRange) -
																	(structureData.current.minPrice ||
																		minRange)) /
																	rangeSpan) *
																100
															}%`,
														}}
													/>
												</div>
												<div className="flex justify-between mt-1.5 text-[10px]">
													<span className="text-amber-600 dark:text-amber-400">
														{currencyInfo.symbol}
														{structureData.previous.minPrice?.toFixed(2)} –{" "}
														{currencyInfo.symbol}
														{structureData.previous.maxPrice?.toFixed(2)}
													</span>
													<span className="text-emerald-600 dark:text-emerald-400">
														{currencyInfo.symbol}
														{structureData.current.minPrice?.toFixed(2)} –{" "}
														{currencyInfo.symbol}
														{structureData.current.maxPrice?.toFixed(2)}
													</span>
												</div>
											</>
										);
									})()}
								</div>
							</div>

							{/* Detail cards */}
							<div className="grid grid-cols-2 gap-3">
								<div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
									<div className="flex items-center gap-2 mb-2">
										<div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
										<span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
											Previous
										</span>
									</div>
									<div className="space-y-1.5">
										<div className="flex justify-between items-center">
											<span className="text-[11px] text-slate-500">
												Step widths
											</span>
											<span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
												{structureData.previous.stepWidths
													.map((w) => `${currencyInfo.symbol}${w.toFixed(2)}`)
													.join(" · ")}
											</span>
										</div>
										{structureData.previous.inflectionPrice && (
											<div className="flex justify-between items-center">
												<span className="text-[11px] text-slate-500">
													Inflection
												</span>
												<span className="text-xs font-mono font-medium text-amber-600 dark:text-amber-400">
													@ {currencyInfo.symbol}
													{structureData.previous.inflectionPrice.toFixed(2)}
												</span>
											</div>
										)}
									</div>
								</div>

								<div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30">
									<div className="flex items-center gap-2 mb-2">
										<div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
										<span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
											Current
										</span>
									</div>
									<div className="space-y-1.5">
										<div className="flex justify-between items-center">
											<span className="text-[11px] text-slate-500">
												Step widths
											</span>
											<span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
												{structureData.current.stepWidths
													.map((w) => `${currencyInfo.symbol}${w.toFixed(2)}`)
													.join(" · ")}
											</span>
										</div>
										{structureData.current.inflectionPrice && (
											<div className="flex justify-between items-center">
												<span className="text-[11px] text-slate-500">
													Inflection
												</span>
												<span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
													@ {currencyInfo.symbol}
													{structureData.current.inflectionPrice.toFixed(2)}
												</span>
											</div>
										)}
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Crossover Analysis */}
					{crossoverData && crossoverData.crossoverPrice && (
						<div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-800/30">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
									<GitCompare className="w-4 h-4 text-blue-500" />
								</div>
								<div>
									<p className="text-sm font-medium text-slate-700 dark:text-slate-200">
										Crossover at{" "}
										<span className="font-bold text-blue-600 dark:text-blue-400">
											{currencyInfo.symbol}
											{crossoverData.crossoverPrice.toFixed(2)}
										</span>
										<span className="text-slate-400">
											{currencyInfo.perUnit}
										</span>
									</p>
									<p className="text-xs text-slate-500 mt-0.5">
										{crossoverData.currentCheaperBelow
											? "Current is cheaper below • Previous cheaper above"
											: "Previous was cheaper below • Current cheaper above"}
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Timeline */}
					<div className="p-5 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 shadow-sm">
						<div className="flex items-center gap-2 mb-5">
							<Calendar className="w-4 h-4 text-slate-400" />
							<h4 className="font-medium text-sm tracking-wide uppercase text-slate-600 dark:text-slate-400">
								Timeline
							</h4>
						</div>

						<div className="relative">
							{/* Timeline line - emerald at top (current), amber at bottom (historical) */}
							<div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400 to-amber-400 dark:from-emerald-500 dark:to-amber-500" />

							{activeCarrier?.versions.map((version, idx) => (
								<motion.div
									key={version.id}
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: idx * 0.1 }}
									className="relative flex items-start gap-4 pb-5"
								>
									<div
										className={cn(
											"w-5 h-5 rounded-full border-2 z-10 flex-shrink-0 flex items-center justify-center",
											version.is_active
												? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30"
												: "bg-amber-400 border-amber-400 shadow-lg shadow-amber-500/20"
										)}
									>
										<div className="w-1.5 h-1.5 rounded-full bg-white" />
									</div>
									<div className="flex-1 -mt-0.5">
										<div className="flex items-center gap-2">
											<span
												className={cn(
													"text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md",
													version.is_active
														? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
														: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
												)}
											>
												{version.is_active ? "Current" : "Historical"}
											</span>
										</div>
										<p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-1.5">
											{new Date(version.effective_date).toLocaleDateString(
												"en-US",
												{
													month: "long",
													day: "numeric",
													year: "numeric",
												}
											)}
										</p>
										{version.label && (
											<p className="text-xs text-slate-400 mt-0.5">
												{version.label}
											</p>
										)}
									</div>
								</motion.div>
							))}
						</div>
					</div>

					{/* ============ NEW VISUALIZATIONS ============ */}

					{/* Key Metrics Dashboard - Quick Stats */}
					{metricsSummary && (
						<div className="p-5 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/30 dark:to-slate-900/30 border border-slate-200 dark:border-slate-700">
							<div className="flex items-center justify-between mb-5">
								<div className="flex items-center gap-2">
									<Activity className="w-4 h-4 text-slate-500" />
									<h4 className="font-medium text-sm tracking-wide uppercase text-slate-600 dark:text-slate-400">
										Summary
									</h4>
								</div>
								<span className="text-xs text-slate-400">
									{metricsSummary.totalPoints} price points compared
								</span>
							</div>

							<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
								{/* Avg Change */}
								<motion.div
									initial={{ y: 10, opacity: 0 }}
									animate={{ y: 0, opacity: 1 }}
									transition={{ delay: 0.1 }}
									className="p-4 rounded-xl bg-white dark:bg-slate-800/50 shadow-sm"
								>
									<p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-2">
										Avg Shift
									</p>
									<p
										className={cn(
											"text-2xl font-semibold tabular-nums",
											metricsSummary.avgChange > 0
												? "text-rose-500"
												: metricsSummary.avgChange < 0
												? "text-emerald-500"
												: "text-slate-500"
										)}
									>
										{metricsSummary.avgChange > 0 ? "+" : ""}
										{metricsSummary.avgChange.toFixed(2)}
										<span className="text-sm font-normal ml-0.5">pp</span>
									</p>
								</motion.div>

								{/* Points Increased */}
								<motion.div
									initial={{ y: 10, opacity: 0 }}
									animate={{ y: 0, opacity: 1 }}
									transition={{ delay: 0.15 }}
									className="p-4 rounded-xl bg-white dark:bg-slate-800/50 shadow-sm"
								>
									<p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-2">
										Rates Up
									</p>
									<div className="flex items-baseline gap-2">
										<p className="text-2xl font-semibold text-rose-500 tabular-nums">
											{metricsSummary.increaseCount}
										</p>
										{metricsSummary.maxIncrease !== null && (
											<span className="text-xs text-slate-400">
												(max +{metricsSummary.maxIncrease.toFixed(1)}pp)
											</span>
										)}
									</div>
								</motion.div>

								{/* Points Decreased */}
								<motion.div
									initial={{ y: 10, opacity: 0 }}
									animate={{ y: 0, opacity: 1 }}
									transition={{ delay: 0.2 }}
									className="p-4 rounded-xl bg-white dark:bg-slate-800/50 shadow-sm"
								>
									<p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-2">
										Rates Down
									</p>
									<div className="flex items-baseline gap-2">
										<p
											className={cn(
												"text-2xl font-semibold tabular-nums",
												metricsSummary.decreaseCount > 0
													? "text-emerald-500"
													: "text-slate-300 dark:text-slate-600"
											)}
										>
											{metricsSummary.decreaseCount}
										</p>
										{metricsSummary.maxDecrease !== null && (
											<span className="text-xs text-slate-400">
												(max {metricsSummary.maxDecrease.toFixed(1)}pp)
											</span>
										)}
										{metricsSummary.decreaseCount === 0 && (
											<span className="text-xs text-slate-400">none</span>
										)}
									</div>
								</motion.div>

								{/* Band Count Change */}
								<motion.div
									initial={{ y: 10, opacity: 0 }}
									animate={{ y: 0, opacity: 1 }}
									transition={{ delay: 0.25 }}
									className="p-4 rounded-xl bg-white dark:bg-slate-800/50 shadow-sm"
								>
									<p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-2">
										Spread Δ
									</p>
									<p
										className={cn(
											"text-2xl font-semibold tabular-nums",
											metricsSummary.rangeChange > 0
												? "text-amber-500"
												: metricsSummary.rangeChange < 0
												? "text-blue-500"
												: "text-slate-500"
										)}
									>
										{metricsSummary.rangeChange > 0 ? "+" : ""}
										{metricsSummary.rangeChange.toFixed(2)}
										<span className="text-sm font-normal ml-0.5">%</span>
									</p>
								</motion.div>
							</div>
						</div>
					)}

					{/* Gap Analysis - Area Chart showing difference */}
					{gapData.length > 0 && (
						<div className="p-5 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 shadow-sm">
							<div className="flex items-center justify-between mb-5">
								<div className="flex items-center gap-2">
									<Layers className="w-4 h-4 text-slate-400" />
									<h4 className="font-medium text-sm tracking-wide uppercase text-slate-600 dark:text-slate-400">
										Curve Overlay
									</h4>
								</div>
								<span className="text-[10px] text-slate-400 uppercase tracking-wider">
									shaded area = difference
								</span>
							</div>

							<ResponsiveContainer width="100%" height={250}>
								<ComposedChart data={gapData}>
									<defs>
										<linearGradient
											id="gapPositive"
											x1="0"
											y1="0"
											x2="0"
											y2="1"
										>
											<stop offset="5%" stopColor="#F87171" stopOpacity={0.4} />
											<stop
												offset="95%"
												stopColor="#F87171"
												stopOpacity={0.05}
											/>
										</linearGradient>
										<linearGradient
											id="gapNegative"
											x1="0"
											y1="0"
											x2="0"
											y2="1"
										>
											<stop offset="5%" stopColor="#34D399" stopOpacity={0.4} />
											<stop
												offset="95%"
												stopColor="#34D399"
												stopOpacity={0.05}
											/>
										</linearGradient>
									</defs>
									<CartesianGrid
										strokeDasharray="3 3"
										className="stroke-gray-300 dark:stroke-gray-700"
									/>
									<XAxis
										dataKey="price"
										className="text-xs"
										tick={{ fill: "currentColor" }}
										tickFormatter={(v) =>
											`${currencyInfo.symbol}${v.toFixed(2)}`
										}
									/>
									<YAxis
										className="text-xs"
										tick={{ fill: "currentColor" }}
										tickFormatter={(v) => `${v}%`}
										domain={["dataMin - 1", "dataMax + 1"]}
									/>
									<Tooltip
										contentStyle={{
											backgroundColor: "rgba(0, 0, 0, 0.8)",
											border: "none",
											borderRadius: "8px",
											color: "white",
										}}
										formatter={(value: any, name: string) => {
											if (value === null) return ["-", name];
											return [`${Number(value).toFixed(2)}%`, name];
										}}
										labelFormatter={(label) =>
											`${currencyInfo.symbol}${Number(label).toFixed(2)}${
												currencyInfo.perUnit
											}`
										}
									/>
									<Line
										type="stepAfter"
										dataKey="previous"
										stroke="#F59E0B"
										strokeWidth={3}
										strokeDasharray="6 3"
										dot={false}
										name="Previous"
										connectNulls
									/>
									<Line
										type="stepAfter"
										dataKey="current"
										stroke="#10B981"
										strokeWidth={2}
										dot={false}
										name="Current"
										connectNulls
									/>
									<Area
										type="stepAfter"
										dataKey="gapPositive"
										fill="url(#gapPositive)"
										stroke="none"
										name="Increase"
									/>
								</ComposedChart>
							</ResponsiveContainer>

							<div className="flex items-center justify-center gap-6 mt-3 text-xs">
								<div className="flex items-center gap-2">
									<svg width="20" height="4" className="overflow-visible">
										<line
											x1="0"
											y1="2"
											x2="20"
											y2="2"
											stroke="#F59E0B"
											strokeWidth="2"
											strokeDasharray="4 2"
										/>
									</svg>
									<span className="text-slate-500 dark:text-slate-400">
										Previous
									</span>
								</div>
								<div className="flex items-center gap-2">
									<div className="w-5 h-0.5 bg-emerald-500 rounded-full" />
									<span className="text-slate-500 dark:text-slate-400">
										Current
									</span>
								</div>
								<div className="flex items-center gap-2">
									<div className="w-4 h-4 bg-gradient-to-br from-rose-400/40 to-rose-500/20 rounded" />
									<span className="text-slate-500 dark:text-slate-400">
										Difference
									</span>
								</div>
							</div>
						</div>
					)}

					{/* Variance Lollipop Chart - Connected Dots */}
					{lollipopData.length > 0 && (
						<div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-200 dark:border-gray-700">
							<div className="flex items-center gap-2 mb-4">
								<CircleDot className="w-4 h-4 text-pink-500" />
								<h4 className="font-semibold text-sm">Variance Lollipop</h4>
								<span className="text-xs text-gray-500 ml-auto">
									Dot position shows surcharge, line connects versions
								</span>
							</div>

							<ResponsiveContainer width="100%" height={400}>
								<ComposedChart data={lollipopData} layout="vertical">
									<CartesianGrid
										strokeDasharray="3 3"
										className="stroke-gray-300 dark:stroke-gray-700"
									/>
									<XAxis
										type="number"
										className="text-xs"
										tick={{ fill: "currentColor" }}
										tickFormatter={(v) => `${v}%`}
										domain={["dataMin - 0.5", "dataMax + 0.5"]}
									/>
									<YAxis
										type="category"
										dataKey="priceLabel"
										className="text-xs"
										tick={{ fill: "currentColor" }}
										width={50}
									/>
									<Tooltip
										contentStyle={{
											backgroundColor: "rgba(0, 0, 0, 0.8)",
											border: "none",
											borderRadius: "8px",
											color: "white",
										}}
										formatter={(value: any, name: string) => {
											if (value === null) return ["-", name];
											return [`${Number(value).toFixed(2)}%`, name];
										}}
									/>
									{/* Draw connecting lines */}
									{lollipopData
										.filter((d) => d.hasBoth)
										.map((d, i) => (
											<ReferenceLine
												key={i}
												segment={[
													{ x: d.previous!, y: d.priceLabel },
													{ x: d.current!, y: d.priceLabel },
												]}
												stroke={d.delta! > 0 ? "#EF4444" : "#22C55E"}
												strokeWidth={2}
												strokeOpacity={0.5}
											/>
										))}
									<Scatter dataKey="previous" fill="#F59E0B" name="Previous" />
									<Scatter dataKey="current" fill="#10B981" name="Current" />
								</ComposedChart>
							</ResponsiveContainer>
						</div>
					)}

					{/* Dot Matrix Intensity - Size encodes magnitude */}
					{dotMatrixData.length > 0 && (
						<div className="p-5 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 shadow-sm">
							<div className="flex items-center justify-between mb-5">
								<div className="flex items-center gap-2">
									<Grid3x3 className="w-4 h-4 text-slate-400" />
									<h4 className="font-medium text-sm tracking-wide uppercase text-slate-600 dark:text-slate-400">
										Change Heatmap
									</h4>
								</div>
								<span className="text-[10px] text-slate-400 uppercase tracking-wider">
									bubble size = magnitude
								</span>
							</div>

							{/* Grid layout with labels */}
							<div className="flex flex-wrap justify-center gap-4 py-2">
								{dotMatrixData.map((d, i) => (
									<motion.div
										key={i}
										initial={{ scale: 0, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{
											delay: i * 0.06,
											type: "spring",
											stiffness: 200,
										}}
										className="flex flex-col items-center gap-2 group cursor-pointer"
									>
										{/* Bubble with glow effect */}
										<div className="relative">
											<motion.div
												whileHover={{ scale: 1.15 }}
												transition={{ type: "spring", stiffness: 400 }}
												className={cn(
													"rounded-full flex items-center justify-center transition-shadow duration-200",
													d.delta > 0
														? "bg-gradient-to-br from-rose-400 via-rose-500 to-rose-600"
														: "bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600"
												)}
												style={{
													width: Math.max(36, d.size * 0.9),
													height: Math.max(36, d.size * 0.9),
													boxShadow:
														d.delta > 0
															? "0 4px 20px rgba(244, 63, 94, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)"
															: "0 4px 20px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
												}}
											>
												<span className="text-[11px] font-bold text-white drop-shadow-md">
													{d.delta > 0 ? "+" : ""}
													{d.delta.toFixed(1)}
												</span>
											</motion.div>
										</div>

										{/* Price label below */}
										<span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
											{d.range}
										</span>
									</motion.div>
								))}
							</div>

							{/* Legend */}
							<div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
								<span className="flex items-center gap-2 text-xs text-slate-500">
									<div className="w-4 h-4 rounded-full bg-gradient-to-br from-rose-400 to-rose-500 shadow-sm" />
									Rate increased
								</span>
								<span className="flex items-center gap-2 text-xs text-slate-500">
									<div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-sm" />
									Rate decreased
								</span>
							</div>
						</div>
					)}

					{/* Price Point Comparison - Horizontal Bars */}
					{lollipopData.length > 0 && (
						<div className="p-5 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 shadow-sm">
							<div className="flex items-center justify-between mb-5">
								<div className="flex items-center gap-2">
									<BarChart3 className="w-4 h-4 text-slate-400" />
									<h4 className="font-medium text-sm tracking-wide uppercase text-slate-600 dark:text-slate-400">
										Rate Comparison
									</h4>
								</div>
							</div>

							{/* Custom horizontal bars with better design */}
							<div className="space-y-3">
								{lollipopData
									.filter((d) => d.hasBoth)
									.map((item, idx) => {
										const maxVal = Math.max(
											...lollipopData
												.filter((d) => d.hasBoth)
												.flatMap((d) => [d.previous || 0, d.current || 0])
										);
										const prevWidth = ((item.previous || 0) / maxVal) * 100;
										const currWidth = ((item.current || 0) / maxVal) * 100;
										const delta = (item.current || 0) - (item.previous || 0);

										return (
											<div key={idx} className="group">
												{/* Price label row */}
												<div className="flex items-center justify-between mb-1.5">
													<span className="text-xs font-medium text-slate-600 dark:text-slate-300 font-mono">
														{item.priceLabel}
													</span>
													<span
														className={cn(
															"text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
															delta > 0
																? "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
																: delta < 0
																? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
																: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
														)}
													>
														{delta > 0 ? "+" : ""}
														{delta.toFixed(2)}pp
													</span>
												</div>

												{/* Bars */}
												<div className="space-y-1">
													{/* Previous bar */}
													<div className="flex items-center gap-2">
														<span className="text-[9px] text-slate-400 w-8 uppercase">
															Old
														</span>
														<div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
															<motion.div
																initial={{ width: 0 }}
																animate={{ width: `${prevWidth}%` }}
																transition={{
																	delay: idx * 0.03,
																	duration: 0.4,
																}}
																className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full flex items-center justify-end pr-2"
															>
																<span className="text-[9px] font-semibold text-white drop-shadow-sm">
																	{(item.previous || 0).toFixed(1)}%
																</span>
															</motion.div>
														</div>
													</div>

													{/* Current bar */}
													<div className="flex items-center gap-2">
														<span className="text-[9px] text-slate-400 w-8 uppercase">
															New
														</span>
														<div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
															<motion.div
																initial={{ width: 0 }}
																animate={{ width: `${currWidth}%` }}
																transition={{
																	delay: idx * 0.03 + 0.1,
																	duration: 0.4,
																}}
																className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full flex items-center justify-end pr-2"
															>
																<span className="text-[9px] font-semibold text-white drop-shadow-sm">
																	{(item.current || 0).toFixed(1)}%
																</span>
															</motion.div>
														</div>
													</div>
												</div>
											</div>
										);
									})}
							</div>

							{/* Legend */}
							<div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
								<span className="flex items-center gap-2 text-xs text-slate-500">
									<div className="w-4 h-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500" />
									Previous version
								</span>
								<span className="flex items-center gap-2 text-xs text-slate-500">
									<div className="w-4 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
									Current version
								</span>
							</div>
						</div>
					)}
				</div>
			)}
		</Card>
	);
}
