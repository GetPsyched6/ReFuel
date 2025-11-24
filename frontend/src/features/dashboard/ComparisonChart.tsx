import { useMemo, useState, useEffect } from "react";
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
	ReferenceLine,
	ReferenceDot,
	ComposedChart,
} from "recharts";
import { TrendingUp, Maximize2, Minimize2 } from "lucide-react";
import { getCarrierBrandColor, getExtrapolatedOpacity } from "@/theme/carriers";
import { findCarrierInflections, findInflection } from "@/utils/bandInflection";
import { comparisonApi, metadataApi } from "@/services/api";
import { getCarrierColorVariant, getStrokeDashArray, getCarrierColor } from "@/theme/carriers";
import { useTheme } from "@/components/layout/ThemeProvider";

interface ComparisonRow {
	price_range: string;
	at_least_usd: number;
	but_less_than_usd: number;
	ups_pct: number | null;
	fedex_pct: number | null;
	dhl_pct: number | null;
	isExtrapolated?: boolean;
}

interface CurveData {
	curve_id: number;
	carrier: string;
	label: string;
	effective_date: string;
	processedRows: any[];
	hasExtrapolation: boolean;
}

interface AdditionalCurve {
	id: number;
	carrier: string;
	label: string;
	effectiveDate: string;
	isActive: boolean;
}

interface ComparisonChartProps {
	data: ComparisonRow[];
	curves?: CurveData[];
	view:
		| "normalized"
		| "normalized_fine"
		| "overlap"
		| "complete"
		| "comparable";
	carriersWithData?: string[];
	currencySymbol?: string;
	sessionId?: number;
	fuelCategory?: string;
	market?: string;
	showExtrapolation?: boolean;
	additionalCurves?: AdditionalCurve[];
	additionalCurveRawData?: Map<number, any[]>;
}

export default function ComparisonChart({
	data,
	curves,
	view,
	carriersWithData = [],
	currencySymbol = "$",
	sessionId,
	fuelCategory,
	market,
	showExtrapolation = true,
	additionalCurves = [],
	additionalCurveRawData = new Map(),
}: ComparisonChartProps) {
	const [completeData, setCompleteData] = useState<ComparisonRow[]>([]);
	const [yAxisMode, setYAxisMode] = useState<"auto" | "fixed">("auto");
	const [inflectionSkipList, setInflectionSkipList] = useState<Set<string>>(new Set());
	const { theme } = useTheme();
	
	const isMultiCurveMode = curves && curves.length > 0;
	
	const formatRangeLabel = (min: number, max: number) =>
		`${currencySymbol}${min.toFixed(2)}-${currencySymbol}${max.toFixed(2)}`;

	// Single merged dataset (LEGACY MODE - already contains real + extrapolated with flags)
	const chartData = useMemo(() => {
		if (isMultiCurveMode) return [];
		console.log('📊 Chart rendering', data.length, 'bands');
		return data.map((row: any) => {
			const baseData: any = {
			range: formatRangeLabel(row.at_least_usd, row.but_less_than_usd),
				priceValue: row.at_least_usd,
			UPS: row.ups_pct,
			FedEx: row.fedex_pct,
			DHL: row.dhl_pct,
				UPS_extrapolated: row.ups_extrapolated || false,
				FedEx_extrapolated: row.fedex_extrapolated || false,
				DHL_extrapolated: row.dhl_extrapolated || false,
			};
			
			// Include additional curve columns (e.g., fedex_24_pct -> FedEx_24)
			for (const curve of additionalCurves) {
				const columnKey = `${curve.carrier.toLowerCase()}_${curve.id}_pct`;
				const extrapolatedKey = `${curve.carrier.toLowerCase()}_${curve.id}_extrapolated`;
				const chartKey = `${curve.carrier}_${curve.id}`;
				if (row[columnKey] !== undefined) {
					baseData[chartKey] = row[columnKey];
				}
				// Also include extrapolation flag
				baseData[`${chartKey}_extrapolated`] = row[extrapolatedKey] || false;
			}
			
			return baseData;
		});
	}, [data, currencySymbol, isMultiCurveMode, additionalCurves]);

	// MULTI-CURVE MODE: Convert curve data to chart format
	// Strategy: Create separate continuous datasets for each curve to avoid gaps
	const multiCurveChartData = useMemo(() => {
		if (!isMultiCurveMode) return [];
		
		console.log('📊 Multi-curve chart rendering', curves?.length || 0, 'curves', {
			curvesDetail: curves?.map((c: any) => ({
				carrier: c.carrier,
				curve_id: c.curve_id,
				processedRowsCount: c.processedRows?.length || 0
			}))
		});
		
		// Collect all unique price points from all curves
		const allPricePoints = new Set<number>();
		curves.forEach((curve: CurveData) => {
			if (curve.processedRows && Array.isArray(curve.processedRows)) {
				curve.processedRows.forEach((row: any) => {
					allPricePoints.add(row.at_least_usd);
				});
			}
		});
		
		const sortedPrices = Array.from(allPricePoints).sort((a, b) => a - b);
		console.log(`   💰 Collected ${sortedPrices.length} unique price points`);
		
		// Create chart data - only include curve data where it exists
		const chartData = sortedPrices.map((price) => {
			const dataPoint: any = {
				priceValue: price,
				range: '' 
			};
			
			// For each curve, only add data if the curve has a value at this price
			curves.forEach((curve: CurveData) => {
				const curveKey = `${curve.carrier}_${curve.curve_id}`;
				const row = curve.processedRows?.find((r: any) => r.at_least_usd === price);
				
				if (row) {
					dataPoint[curveKey] = row.surcharge_pct;
					dataPoint[`${curveKey}_extrapolated`] = row.is_extrapolated || false;
					dataPoint[`${curveKey}_label`] = curve.label;
					if (!dataPoint.range && row.price_range) {
						dataPoint.range = row.price_range;
					}
				}
				// Don't set null - just omit the key entirely
			});
			
			if (!dataPoint.range) {
				const nextPrice = sortedPrices[sortedPrices.indexOf(price) + 1] || price + 0.01;
				dataPoint.range = formatRangeLabel(price, nextPrice);
			}
			
			return dataPoint;
		});
		
		console.log(`   📈 Created chart data with ${chartData.length} points`);
		return chartData;
	}, [curves, isMultiCurveMode, formatRangeLabel]);

	const barSize = useMemo(() => {
		const dataLength = isMultiCurveMode ? multiCurveChartData.length : chartData.length;
		return Math.max(
			15,
			Math.min(35, Math.floor(600 / Math.max(dataLength, 1)))
	);
	}, [chartData, multiCurveChartData, isMultiCurveMode]);

	const yDomain = useMemo<[number, number]>(() => {
		const values: number[] = [];
		
		if (isMultiCurveMode) {
			// Multi-curve mode: get all values from all curves
			multiCurveChartData.forEach((dataPoint: any) => {
				Object.keys(dataPoint).forEach((key) => {
					if (key.includes('_') && !key.includes('_extrapolated') && !key.includes('_label') && 
					    key !== 'priceValue' && key !== 'range') {
						const val = dataPoint[key];
						if (typeof val === 'number' && !isNaN(val)) {
							values.push(val);
						}
					}
				});
			});
		} else {
			// Legacy mode: get values from UPS/FedEx/DHL columns
		data.forEach((row) => {
			if (row.ups_pct != null) values.push(row.ups_pct);
			if (row.fedex_pct != null) values.push(row.fedex_pct);
			if (row.dhl_pct != null) values.push(row.dhl_pct);
		});
		}
		
		if (!values.length) return [0, 25];
		
		if (yAxisMode === "fixed") {
			const max = Math.max(...values);
			return [0, Math.ceil(max * 1.1)];
		}
		
		const min = Math.min(...values);
		const max = Math.max(...values);
		const padding = Math.max(0.25, (max - min || 1) * 0.1);
		return [Math.max(0, min - padding), max + padding];
	}, [data, yAxisMode]);

	// Fetch inflection skip list on mount
	useEffect(() => {
		const fetchSkipList = async () => {
			try {
				const response = await metadataApi.getInflectionSkipList();
				const skipList = response.data.skip_list || [];
				const skipSet = new Set(
					skipList.map((item: any) => 
						`${item.market}|${item.carrier}|${item.fuel_category}`
					)
				);
				setInflectionSkipList(skipSet);
				console.log('🚫 Inflection skip list loaded:', skipList);
			} catch (error) {
				console.error("Failed to fetch inflection skip list:", error);
			}
		};
		fetchSkipList();
	}, []);

	// Check if current selection should skip inflection detection
	const shouldSkipInflection = (carrier: string): boolean => {
		if (!market || !fuelCategory) return false;
		const key = `${market}|${carrier}|${fuelCategory}`;
		return inflectionSkipList.has(key);
	};

	// Fetch RAW data for inflection detection only
	useEffect(() => {
		const fetchRawDataForInflection = async () => {
			// Check if ALL carriers in this view should skip inflection
			const allCarriersSkipped = carriersWithData.every(carrier => 
				shouldSkipInflection(carrier)
			);
			
			if (allCarriersSkipped && carriersWithData.length > 0) {
				console.log('🚫 Skipping inflection detection - all carriers flagged as converted data');
				setCompleteData([]);
				return;
			}

			try {
				const response = await comparisonApi.getComparison(
					"raw",
					sessionId,
					false,
					fuelCategory,
					market,
					carriersWithData.length > 0 ? carriersWithData : undefined
				);
				const rows = response.data.rows || [];
				console.log('📊 Inflection Detection (RAW DB Data):', {
					market,
					fuelCategory,
					carriers: carriersWithData,
					skipped: carriersWithData.filter(shouldSkipInflection),
					totalRows: rows.length,
					uniqueStepWidths: [...new Set(rows.map((r: any) => 
						(r.but_less_than_usd - r.at_least_usd).toFixed(3)
					))],
					sampleRows: rows.slice(0, 5)
				});
				setCompleteData(rows);
			} catch (error) {
				console.error("Failed to fetch data for inflection detection:", error);
				setCompleteData([]);
			}
		};

		if (sessionId && fuelCategory && market && carriersWithData.length > 0 && inflectionSkipList.size >= 0) {
			fetchRawDataForInflection();
		} else {
			setCompleteData([]);
		}
	}, [sessionId, fuelCategory, market, carriersWithData, inflectionSkipList]);

	useEffect(() => {
		const fetchRawDataForInflection = async () => {
			// Check if ALL carriers in this view should skip inflection
			const allCarriersSkipped = carriersWithData.every(carrier => 
				shouldSkipInflection(carrier)
			);
			
			if (allCarriersSkipped && carriersWithData.length > 0) {
				console.log('🚫 Skipping inflection detection - all carriers flagged as converted data');
				setCompleteData([]);
				return;
			}

			try {
				const response = await comparisonApi.getComparison(
					"raw",
					sessionId,
					false,
					fuelCategory,
					market,
					carriersWithData.length > 0 ? carriersWithData : undefined
				);
				const rows = response.data.rows || [];
				console.log('📊 Inflection Detection (RAW DB Data):', {
					market,
					fuelCategory,
					carriers: carriersWithData,
					skipped: carriersWithData.filter(shouldSkipInflection),
					totalRows: rows.length,
					uniqueStepWidths: [...new Set(rows.map((r: any) => 
						(r.but_less_than_usd - r.at_least_usd).toFixed(3)
					))],
					sampleRows: rows.slice(0, 5)
				});
				setCompleteData(rows);
			} catch (error) {
				console.error("Failed to fetch data for inflection detection:", error);
				setCompleteData([]);
			}
		};
		
		if (sessionId && fuelCategory && market && carriersWithData.length > 0 && inflectionSkipList.size >= 0) {
			fetchRawDataForInflection();
		} else {
			setCompleteData([]);
		}
	}, [sessionId, fuelCategory, market, carriersWithData, inflectionSkipList]);

	const xAxisTicks = useMemo(() => {
		const activeData = isMultiCurveMode ? multiCurveChartData : chartData;
		if (activeData.length === 0) return undefined;
		
		// Calculate range from merged data
		const minPrice = Math.min(...activeData.map(d => d.priceValue));
		const maxPriceValues = activeData.map(d => {
			const [_, maxStr] = d.range.split('-');
			return parseFloat(maxStr.replace(/[$€]/g, ''));
		});
		const maxPrice = Math.max(...maxPriceValues);
		
		const priceRange = maxPrice - minPrice;
		
		// Calculate average step width for smarter tick spacing
		const stepWidths = activeData.slice(0, Math.min(5, activeData.length)).map(d => {
			const [_, maxStr] = d.range.split('-');
			const maxVal = parseFloat(maxStr.replace(/[$€]/g, ''));
			return maxVal - d.priceValue;
		});
		const avgStepWidth = stepWidths.reduce((a, b) => a + b, 0) / stepWidths.length;
		
		let tickStep: number;
		if (avgStepWidth <= 0.025) {
			tickStep = 0.10;
		} else if (avgStepWidth <= 0.06) {
			tickStep = 0.20;
		} else if (avgStepWidth <= 0.15) {
			tickStep = priceRange > 3 ? 0.50 : 0.25;
		} else {
			tickStep = priceRange > 5 ? 1.0 : 0.50;
		}
		
		const ticks: number[] = [];
		let currentTick = Math.floor(minPrice / tickStep) * tickStep;
		
		while (currentTick <= maxPrice) {
			ticks.push(Number(currentTick.toFixed(2)));
			currentTick += tickStep;
		}
		
		if (ticks.length < 3) {
			return undefined;
		}
		
		return ticks;
	}, [chartData, multiCurveChartData, isMultiCurveMode]);

	const inflections = useMemo(() => {
		if (isMultiCurveMode) {
			// Multi-curve mode: Compute inflections per curve
			const inflectionMap = new Map<string, number>();
			
			curves?.forEach((curve: CurveData) => {
				if (shouldSkipInflection(curve.carrier)) {
					return;
				}
				
				// Get raw bands for this curve
				const rawBands = (curve as any).rawRows || curve.processedRows;
				const bands = rawBands
					.filter((r: any) => r.surcharge_pct !== null)
					.map((r: any) => ({
						at_least_usd: r.at_least_usd,
						but_less_than_usd: r.but_less_than_usd,
						surcharge_pct: r.surcharge_pct
					}));
				
				const inflectionPrice = findCarrierInflections(
					bands.map((b: any) => ({ ...b, ups_pct: null, fedex_pct: null, dhl_pct: null })),
					[curve.carrier],
					new Set()
				).get(curve.carrier);
				
				if (inflectionPrice) {
					const curveKey = `${curve.carrier}_${curve.curve_id}`;
					inflectionMap.set(curveKey, inflectionPrice);
				}
			});
			
			return inflectionMap;
		} else {
			// Legacy mode: Use complete data
			const inflectionMap = new Map<string, number>();
			
			if (completeData.length > 0 && carriersWithData.length > 0) {
				// Build skip set with carrier names only (not full keys)
				const carrierSkipSet = new Set<string>();
				for (const carrier of carriersWithData) {
					if (shouldSkipInflection(carrier)) {
						carrierSkipSet.add(carrier);
					}
				}
				
				console.log('🔍 Checking inflections for carriers:', carriersWithData, 
					'(skipped:', Array.from(carrierSkipSet), ')');
				
				const mainInflections = findCarrierInflections(completeData, carriersWithData, carrierSkipSet);
				mainInflections.forEach((price, carrier) => inflectionMap.set(carrier, price));
			}
			
			// Also detect inflections for additional curves using RAW data (not normalized)
			if (additionalCurves.length > 0 && additionalCurveRawData.size > 0) {
				console.log('🔍 Checking inflections for additional curves (using RAW data)...', {
					additionalCurvesCount: additionalCurves.length,
					additionalCurves: additionalCurves.map(c => `${c.carrier}_${c.id}`),
					rawDataAvailable: Array.from(additionalCurveRawData.keys())
				});
				
				for (const curve of additionalCurves) {
					if (shouldSkipInflection(curve.carrier)) {
						console.log(`   ⏭️ Skipping ${curve.carrier}_${curve.id} (in skip list)`);
						continue;
					}
					
					const chartKey = `${curve.carrier}_${curve.id}`;
					
					// Get RAW data for this curve (before any view transformation)
					const rawRows = additionalCurveRawData.get(curve.id);
					if (!rawRows || rawRows.length === 0) {
						console.log(`   ⚠️ No raw data for ${chartKey}`);
						continue;
					}
					
					// Extract bands from raw data
					const curveBands = rawRows
						.map((row: any) => ({
							at_least_usd: row.at_least_usd,
							but_less_than_usd: row.but_less_than_usd,
							surcharge_pct: row.surcharge_pct
						}))
						.sort((a: any, b: any) => a.at_least_usd - b.at_least_usd);
					
					console.log(`   📊 ${chartKey}: ${curveBands.length} raw bands for inflection detection`);
					
					if (curveBands.length >= 4) {
						// Log the step widths to help debug
						const stepWidths = curveBands.map((b: any) => (b.but_less_than_usd - b.at_least_usd).toFixed(3));
						console.log(`   📏 Step widths (RAW): ${stepWidths.join(', ')}`);
						
						// Use findInflection directly with the raw bands
						const inflectionPrice = findInflection(curveBands);
						
						if (inflectionPrice) {
							inflectionMap.set(chartKey, inflectionPrice);
							console.log(`   📍 Found inflection for ${chartKey} at $${inflectionPrice.toFixed(2)}`);
						} else {
							console.log(`   ⚪ No inflection found for ${chartKey}`);
						}
					} else {
						console.log(`   ⚠️ Not enough bands for ${chartKey} (need 4+, got ${curveBands.length})`);
					}
				}
			}
			
			return inflectionMap;
		}
	}, [completeData, carriersWithData, inflectionSkipList, market, fuelCategory, isMultiCurveMode, curves, additionalCurves, data, additionalCurveRawData]);

	const getInflectionMarkerY = (inflectionPrice: number, carrierOrKey: string): number | null => {
		// Check if this is an additional curve key (e.g., "FedEx_24")
		const isAdditionalCurve = carrierOrKey.includes('_') && /\d/.test(carrierOrKey);
		
		if (isAdditionalCurve) {
			// For additional curves, look in data with the dynamic column
			const [carrier, curveId] = carrierOrKey.split('_');
			const columnKey = `${carrier.toLowerCase()}_${curveId}_pct`;
			
			const bandAtInflection = data.find(
				(row: any) => row.at_least_usd <= inflectionPrice && 
				             row.but_less_than_usd > inflectionPrice &&
				             row[columnKey] !== null && row[columnKey] !== undefined
			);
			
			return bandAtInflection ? (bandAtInflection as any)[columnKey] : null;
		}
		
		// Main carrier
		const carrierKey = carrierOrKey === "UPS" ? "UPS" : carrierOrKey === "FedEx" ? "FedEx" : "DHL";
		
		const bandAtInflection = completeData.find(
			row => row.at_least_usd <= inflectionPrice && row.but_less_than_usd > inflectionPrice
		);
		
		if (!bandAtInflection) {
			return null;
		}

		if (carrierKey === "UPS") return bandAtInflection.ups_pct;
		if (carrierKey === "FedEx") return bandAtInflection.fedex_pct;
		if (carrierKey === "DHL") return bandAtInflection.dhl_pct;
		return null;
	};

	const getMultiCurveInflectionMarkerY = (inflectionPrice: number, curveKey: string): number | null => {
		if (!isMultiCurveMode) return null;
		
		const curve = curves?.find((c: CurveData) => `${c.carrier}_${c.curve_id}` === curveKey);
		if (!curve) return null;
		
		const bandAtInflection = curve.processedRows.find(
			(row: any) => row.at_least_usd <= inflectionPrice && row.but_less_than_usd > inflectionPrice
		);
		
		return bandAtInflection?.surcharge_pct || null;
	};

	const isInflectionInView = (inflectionPrice: number): boolean => {
		const activeData = isMultiCurveMode ? multiCurveChartData : chartData;
		if (activeData.length === 0) return false;
		const minPrice = Math.min(...activeData.map((r: any) => r.priceValue));
		// Get max price from range strings
		const maxPrices = activeData.map((d: any) => {
			const parts = d.range?.split('-') || [];
			const maxStr = parts[1] || '';
			return parseFloat(maxStr.replace(/[$€]/g, '')) || 0;
		});
		const maxPrice = Math.max(...maxPrices);
		return inflectionPrice >= minPrice && inflectionPrice <= maxPrice;
	};

	// Group inflections by price (for handling overlapping inflection points)
	const inflectionsByPrice = useMemo(() => {
		const grouped = new Map<number, Array<{ key: string; carrier: string; markerY: number | null; label: string }>>();
		
		Array.from(inflections.entries()).forEach(([key, inflectionPrice]) => {
			if (!inflectionPrice || !isInflectionInView(inflectionPrice)) return;
			
			// Check if this is an additional curve key (e.g., "FedEx_24")
			const isAdditionalCurve = key.includes('_') && /\d/.test(key);
			const carrier = key.split('_')[0];
			
			const markerY = isMultiCurveMode 
				? getMultiCurveInflectionMarkerY(inflectionPrice, key)
				: getInflectionMarkerY(inflectionPrice, key);
			
			// Get label for additional curves
			let label = carrier;
			if (isAdditionalCurve && !isMultiCurveMode) {
				const additionalCurve = additionalCurves.find(c => `${c.carrier}_${c.id}` === key);
				if (additionalCurve) {
					label = `${carrier} ${additionalCurve.label}`;
				}
			}
			
			if (!grouped.has(inflectionPrice)) {
				grouped.set(inflectionPrice, []);
			}
			
			grouped.get(inflectionPrice)!.push({ key, carrier, markerY, label });
		});
		
		return grouped;
	}, [inflections, isMultiCurveMode, data, additionalCurves, chartData, multiCurveChartData]);

	const inflectionPoints = useMemo(() => {
		const points: Array<{
			priceValue: number;
			carrier: string;
			surcharge: number;
			label: string;
		}> = [];
		
		Array.from(inflections.entries()).forEach(([carrier, inflectionPrice]) => {
			if (!inflectionPrice || !isInflectionInView(inflectionPrice)) return;
			
			const markerY = getInflectionMarkerY(inflectionPrice, carrier);
			if (markerY === null) return;
			
			points.push({
				priceValue: inflectionPrice,
				carrier,
				surcharge: markerY,
				label: `${carrier} Inflection Point`,
			});
		});
		
		return points;
	}, [inflections, data, completeData]);

	// Check if there's any data to display (either legacy data or multi-curve data)
	const hasData = isMultiCurveMode 
		? (curves && curves.length > 0 && curves.some((c: CurveData) => c.processedRows && c.processedRows.length > 0))
		: data.length > 0;
	
	if (!hasData) {
		console.log('⚠️ ComparisonChart: No data to display', {
			isMultiCurveMode,
			dataLength: data.length,
			curvesLength: curves?.length,
			curvesDetail: curves?.map((c: any) => ({ carrier: c.carrier, processedRows: c.processedRows?.length }))
		});
		return null;
	}

	return (
		<Card glass>
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
				<div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 animate-pulse">
					<TrendingUp className="w-5 h-5 text-amber-500 dark:text-amber-300" />
				</div>
				<h2 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
					{view === "normalized"
						? "Normalized Comparison Chart"
						: view === "normalized_fine"
						? "Precision Grid Chart (2¢ Steps)"
						: view === "overlap"
						? "Overlap Comparison Chart"
						: view === "comparable"
						? "Comparable Ranges Chart"
						: "Complete Comparison Chart"}
				</h2>
				</div>
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
			</div>

			<div className="space-y-8">
				<div className="p-4 rounded-xl bg-gradient-to-br from-gray-50/50 to-transparent dark:from-gray-800/30 dark:to-transparent border border-gray-200/50 dark:border-gray-700/50">
					<h3 className="text-sm font-semibold mb-4 text-gray-700 dark:text-gray-300 flex items-center gap-2">
						<div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"></div>
						Trend View
					</h3>
					<ResponsiveContainer width="100%" height={300}>
						<ComposedChart 
							data={isMultiCurveMode ? multiCurveChartData : chartData}
							isAnimationActive={true}
							animationDuration={800}
							animationEasing="ease-in-out"
						>
							<CartesianGrid
								strokeDasharray="3 3"
								className="stroke-gray-300 dark:stroke-gray-700"
							/>
							<XAxis
								dataKey="priceValue"
								type="number"
								domain={['dataMin', 'dataMax']}
								ticks={xAxisTicks}
								className="text-xs"
								tick={{ fill: "currentColor" }}
								angle={-45}
								textAnchor="end"
								height={80}
								tickFormatter={(value) => `${currencySymbol}${value.toFixed(2)}`}
							/>
							<YAxis
								className="text-xs"
								tick={{ fill: "currentColor" }}
								label={{
									value: "Surcharge %",
									angle: -90,
									position: "insideLeft",
								}}
								domain={yDomain}
							/>
							<Tooltip
								contentStyle={{
									backgroundColor: "rgba(0, 0, 0, 0.8)",
									border: "none",
									borderRadius: "8px",
									color: "white",
								}}
								labelFormatter={(value) => {
									const price = Number(value);
									const row = chartData.find(r => r.priceValue === price);
									if (row) {
										return `Price Range: ${row.range}`;
									}
									return `Price: ${currencySymbol}${price.toFixed(2)}`;
								}}
								formatter={(value: any, name: string, props: any) => {
									if (value === null || value === undefined) return null;
									const dataPoint = props.payload;
									// Use dataKey for extrapolation check (name is display name, dataKey is the actual key)
									const dataKey = props.dataKey || name;
									const isExtrapolated = dataPoint[`${dataKey}_extrapolated`] === true;
									const formattedValue = `${Number(value).toFixed(2)}%`;
									if (isExtrapolated) {
										return [formattedValue + " (Extrapolated, not published by carrier)", name];
									}
									return [formattedValue, name];
								}}
							/>
							<Legend />
							{isMultiCurveMode ? (
								// Multi-curve mode: Render line for each curve version
								curves?.map((curve: CurveData, index: number) => {
									const curveKey = `${curve.carrier}_${curve.curve_id}`;
									const carrierCurves = curves.filter(c => c.carrier === curve.carrier);
									const carrierIndex = carrierCurves.indexOf(curve);
									const totalVersions = carrierCurves.length;
									const color = getCarrierColorVariant(curve.carrier, carrierIndex, totalVersions, theme);
									const dashArray = getStrokeDashArray(curve.carrier);
									
									return (
										<Line
											key={curveKey}
											type="stepAfter"
											dataKey={curveKey}
											name={`${curve.carrier} - ${curve.effective_date.split('T')[0]}`}
											stroke={color}
											strokeWidth={2}
											strokeDasharray={dashArray}
											dot={{ fill: color, r: 2 }}
											connectNulls={true}
										/>
									);
								})
							) : (
								// Legacy mode: Render UPS/FedEx/DHL lines
								<>
							{(carriersWithData.length === 0 ||
								carriersWithData.includes("UPS")) && (
								<Line
									type="stepAfter"
									dataKey="UPS"
									stroke={getCarrierBrandColor("UPS")}
									strokeWidth={3}
									dot={(props: any) => {
										if (props.payload.UPS === null || props.payload.UPS === undefined) {
											return <circle cx={0} cy={0} r={0} />;
										}
										return (
											<circle
												cx={props.cx}
												cy={props.cy}
												r={2}
												fill={getCarrierBrandColor("UPS")}
											/>
										);
									}}
									connectNulls={false}
								/>
							)}
							{(carriersWithData.length === 0 ||
								carriersWithData.includes("FedEx")) && (
								<Line
									type="stepAfter"
									dataKey="FedEx"
									stroke={getCarrierBrandColor("FedEx")}
									strokeWidth={2}
									strokeDasharray="5 5"
									dot={(props: any) => {
										if (props.payload.FedEx === null || props.payload.FedEx === undefined) {
											return <circle cx={0} cy={0} r={0} />;
										}
										return (
											<circle
												cx={props.cx}
												cy={props.cy}
												r={2}
												fill={getCarrierBrandColor("FedEx")}
												stroke={getCarrierBrandColor("FedEx")}
												strokeWidth={1}
											/>
										);
									}}
									connectNulls={false}
								/>
							)}
							{(carriersWithData.length === 0 ||
								carriersWithData.includes("DHL")) && (
								<Line
									type="stepAfter"
									dataKey="DHL"
									stroke={getCarrierBrandColor("DHL")}
									strokeWidth={2}
									dot={(props: any) => {
										if (props.payload.DHL === null || props.payload.DHL === undefined) {
											return <circle cx={0} cy={0} r={0} />;
										}
										return (
											<circle
												cx={props.cx}
												cy={props.cy}
												r={4}
												fill={getCarrierBrandColor("DHL")}
											/>
										);
									}}
									connectNulls={false}
								/>
							)}
							
							{/* Additional (historical) curves */}
							{additionalCurves.map((curve, index) => {
								const chartKey = `${curve.carrier}_${curve.id}`;
								// Get shifted color for historical curves
								// Use index+1 so the first additional curve gets a distinct color shift
								const shiftedColor = getCarrierColorVariant(
									curve.carrier,
									index + 1, // version index (1, 2, 3... for additional curves)
									additionalCurves.length + 1, // total versions = active + additional
									theme === 'dark' ? 'dark' : 'light'
								);
								const dashArray = curve.carrier === "FedEx" ? "8 4" : "4 4"; // Different dash for historical
								
								return (
									<Line
										key={chartKey}
										type="stepAfter"
										dataKey={chartKey}
										name={`${curve.carrier} ${curve.label}`}
										stroke={shiftedColor}
										strokeWidth={2}
										strokeDasharray={dashArray}
										dot={(props: any) => {
											// Only render dot if there's actual data at this point
											const value = props.payload[chartKey];
											if (value === null || value === undefined) {
												return <circle cx={0} cy={0} r={0} />;
											}
											const isExtrapolated = props.payload[`${chartKey}_extrapolated`];
											return (
												<circle
													cx={props.cx}
													cy={props.cy}
													r={2}
													fill={shiftedColor}
													opacity={isExtrapolated ? 0.5 : 1}
												/>
											);
										}}
										connectNulls={false}
									/>
								);
							})}
								</>
							)}
							{Array.from(inflectionsByPrice.entries()).map(([inflectionPrice, carriersAtPrice], groupIndex) => {
								// For multiple inflections at same price, use the most prominent carrier's color
								// but show all info in tooltip
								const hasMultiple = carriersAtPrice.length > 1;
								const firstCarrier = carriersAtPrice[0].carrier;
								const carrierColor = getCarrierBrandColor(firstCarrier);
								
								// Create label showing all carriers if multiple
								const label = hasMultiple
									? `${carriersAtPrice.map(c => c.carrier).join(' & ')} - ${currencySymbol}${inflectionPrice.toFixed(2)}`
									: (isMultiCurveMode
										? `${curves?.find((c: CurveData) => `${c.carrier}_${c.curve_id}` === carriersAtPrice[0].key)?.label || carriersAtPrice[0].label || carriersAtPrice[0].key} - ${currencySymbol}${inflectionPrice.toFixed(2)}`
										: `${carriersAtPrice[0].label || firstCarrier} - ${currencySymbol}${inflectionPrice.toFixed(2)}`);

								// Use different dash patterns if multiple inflections overlap
								const dashPattern = hasMultiple ? "4 2 8 2" : "8 4";

								return (
									<ReferenceLine
										key={`inflection-${inflectionPrice}`}
										x={inflectionPrice}
										stroke={hasMultiple ? "#ffffff" : carrierColor}
										strokeWidth={hasMultiple ? 3 : 2.5}
										strokeDasharray={dashPattern}
										label={{
											value: label,
											position: 'top',
											fill: hasMultiple ? "#ffffff" : carrierColor,
											fontSize: 11,
											fontWeight: 'bold',
											offset: 10,
										}}
										style={{ cursor: 'pointer' }}
										onMouseEnter={(e: any) => {
											const tooltip = document.createElement('div');
											tooltip.id = `inflection-tooltip-${inflectionPrice}`;
											tooltip.style.position = 'fixed';
											tooltip.style.background = 'rgba(15, 15, 20, 0.98)';
											tooltip.style.border = hasMultiple ? '2px solid rgba(255,255,255,0.3)' : `2px solid ${carrierColor}`;
											tooltip.style.borderRadius = '12px';
											tooltip.style.padding = '14px 18px';
											tooltip.style.color = 'white';
											tooltip.style.fontSize = '13px';
											tooltip.style.pointerEvents = 'none';
											tooltip.style.zIndex = '9999';
											tooltip.style.left = `${e.clientX + 15}px`;
											tooltip.style.top = `${e.clientY - 10}px`;
											tooltip.style.minWidth = '200px';
											tooltip.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
											
											// Build tooltip content for ALL carriers at this price
											let tooltipHTML = `
												<div style="font-weight: 600; margin-bottom: 10px; font-size: 14px; display: flex; align-items: center; gap: 6px;">
													<span style="font-size: 16px;">📍</span> Inflection Point${hasMultiple ? 's' : ''}
												</div>
												<div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
													<span style="color: #999; font-size: 12px;">Price:</span> <strong style="font-size: 15px;">${currencySymbol}${inflectionPrice.toFixed(2)}</strong>
												</div>
											`;
											
											carriersAtPrice.forEach((item, idx) => {
												const itemCarrierColor = getCarrierBrandColor(item.carrier);
												const itemLabel = isMultiCurveMode
													? curves?.find((c: CurveData) => `${c.carrier}_${c.curve_id}` === item.key)?.label || item.label || item.carrier
													: item.label || item.carrier;
												
												tooltipHTML += `
													<div style="margin-bottom: ${idx < carriersAtPrice.length - 1 ? '10px' : '0'}; padding: 10px 12px; background: rgba(255,255,255,0.04); border-radius: 8px; border-left: 3px solid ${itemCarrierColor};">
														<div style="font-weight: 600; color: ${itemCarrierColor}; margin-bottom: 4px; font-size: 13px;">
															${itemLabel}
														</div>
														<div style="font-size: 12px; color: #ccc;">
															Surcharge: <strong style="color: white;">${item.markerY?.toFixed(2)}%</strong>
														</div>
													</div>
												`;
											});
											
											tooltipHTML += `
												<div style="font-size: 11px; color: #666; font-style: italic; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
													Step width changes from wide to narrow
												</div>
											`;
											
											tooltip.innerHTML = tooltipHTML;
											document.body.appendChild(tooltip);
										}}
										onMouseMove={(e: any) => {
											const tooltip = document.getElementById(`inflection-tooltip-${inflectionPrice}`);
											if (tooltip) {
												tooltip.style.left = `${e.clientX + 15}px`;
												tooltip.style.top = `${e.clientY - 10}px`;
											}
										}}
										onMouseLeave={() => {
											const tooltip = document.getElementById(`inflection-tooltip-${inflectionPrice}`);
											if (tooltip) {
												tooltip.remove();
											}
										}}
									/>
								);
							})}
							{inflectionPoints.map((point) => (
								<ReferenceDot
									key={`inflection-dot-${point.carrier}`}
									x={point.priceValue}
									y={point.surcharge}
									r={8}
									fill="white"
									stroke={getCarrierBrandColor(point.carrier)}
									strokeWidth={4}
								/>
							))}
						</ComposedChart>
					</ResponsiveContainer>
				</div>

				<div className="p-4 rounded-xl bg-gradient-to-br from-gray-50/50 to-transparent dark:from-gray-800/30 dark:to-transparent border border-gray-200/50 dark:border-gray-700/50">
					<h3 className="text-sm font-semibold mb-4 text-gray-700 dark:text-gray-300 flex items-center gap-2">
						<div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"></div>
						Side-by-Side Comparison
					</h3>
					<ResponsiveContainer width="100%" height={300}>
						<BarChart 
							data={isMultiCurveMode ? multiCurveChartData : chartData}
							isAnimationActive={true}
							animationDuration={800}
							animationEasing="ease-in-out"
						>
							<CartesianGrid
								strokeDasharray="3 3"
								className="stroke-gray-300 dark:stroke-gray-700"
							/>
							<XAxis
								dataKey="priceValue"
								type="number"
								domain={['dataMin', 'dataMax']}
								ticks={xAxisTicks}
								className="text-xs"
								tick={{ fill: "currentColor" }}
								angle={-45}
								textAnchor="end"
								height={80}
								tickFormatter={(value) => `${currencySymbol}${value.toFixed(2)}`}
							/>
							<YAxis
								className="text-xs"
								tick={{ fill: "currentColor" }}
								label={{
									value: "Surcharge %",
									angle: -90,
									position: "insideLeft",
								}}
								domain={yDomain}
							/>
							<Tooltip
								contentStyle={{
									backgroundColor: "rgba(0, 0, 0, 0.8)",
									border: "none",
									borderRadius: "8px",
									color: "white",
								}}
								labelFormatter={(value) => {
									const price = Number(value);
									const row = chartData.find(r => r.priceValue === price);
									if (row) {
										return `Price Range: ${row.range}`;
									}
									return `Price: ${currencySymbol}${price.toFixed(2)}`;
								}}
								formatter={(value: any, name: string, props: any) => {
									if (value === null || value === undefined) return null;
									const dataPoint = props.payload;
									// Use dataKey for extrapolation check (name is display name, dataKey is the actual key)
									const dataKey = props.dataKey || name;
									const isExtrapolated = dataPoint[`${dataKey}_extrapolated`] === true;
									const formattedValue = `${Number(value).toFixed(2)}%`;
									if (isExtrapolated) {
										return [formattedValue + " (Extrapolated, not published by carrier)", name];
									}
									return [formattedValue, name];
								}}
							/>
							<Legend />
							{isMultiCurveMode ? (
								// Multi-curve mode: Render bar for each curve version
								curves?.map((curve: CurveData, index: number) => {
									const curveKey = `${curve.carrier}_${curve.curve_id}`;
									const carrierCurves = curves.filter(c => c.carrier === curve.carrier);
									const carrierIndex = carrierCurves.indexOf(curve);
									const totalVersions = carrierCurves.length;
									const color = getCarrierColorVariant(curve.carrier, carrierIndex, totalVersions, theme);
									
									return (
										<Bar
											key={curveKey}
											dataKey={curveKey}
											name={`${curve.carrier} - ${curve.effective_date.split('T')[0]}`}
											fill={color}
											barSize={barSize}
											fillOpacity={(entry: any) => entry[`${curveKey}_extrapolated`] ? getExtrapolatedOpacity() : 1}
										/>
									);
								})
							) : (
								// Legacy mode: Render UPS/FedEx/DHL bars
								<>
							{(carriersWithData.length === 0 ||
								carriersWithData.includes("UPS")) && (
								<Bar
									dataKey="UPS"
									fill={getCarrierBrandColor("UPS")}
									barSize={barSize}
											fillOpacity={(entry: any) => entry.UPS_extrapolated ? getExtrapolatedOpacity() : 1}
								/>
							)}
							{(carriersWithData.length === 0 ||
								carriersWithData.includes("FedEx")) && (
								<Bar
									dataKey="FedEx"
									fill={getCarrierBrandColor("FedEx")}
									barSize={barSize}
											fillOpacity={(entry: any) => entry.FedEx_extrapolated ? getExtrapolatedOpacity() : 1}
								/>
							)}
							{(carriersWithData.length === 0 ||
								carriersWithData.includes("DHL")) && (
								<Bar
									dataKey="DHL"
									fill={getCarrierBrandColor("DHL")}
									barSize={barSize}
											fillOpacity={(entry: any) => entry.DHL_extrapolated ? getExtrapolatedOpacity() : 1}
								/>
									)}
									
									{/* Additional (historical) curve bars */}
									{additionalCurves.map((curve, index) => {
										const chartKey = `${curve.carrier}_${curve.id}`;
										const shiftedColor = getCarrierColorVariant(
											curve.carrier,
											index + 1,
											additionalCurves.length + 1,
											theme === 'dark' ? 'dark' : 'light'
										);
										
										return (
											<Bar
												key={chartKey}
												dataKey={chartKey}
												name={`${curve.carrier} ${curve.label}`}
												fill={shiftedColor}
												barSize={barSize}
												fillOpacity={(entry: any) => entry[`${chartKey}_extrapolated`] ? getExtrapolatedOpacity() : 1}
											/>
										);
									})}
								</>
							)}
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>
		</Card>
	);
}
