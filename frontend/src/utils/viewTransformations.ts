/**
 * View transformation logic for fuel surcharge data
 * These transformations are applied AFTER merging extrapolated + real data
 */

export interface RawBand {
	at_least_usd: number;
	but_less_than_usd: number;
	ups_pct: number | null;
	fedex_pct: number | null;
	dhl_pct: number | null;
	ups_extrapolated?: boolean;
	fedex_extrapolated?: boolean;
	dhl_extrapolated?: boolean;
	// Allow dynamic keys for additional curves (e.g., fedex_24_pct)
	[key: string]: number | boolean | null | undefined;
}

export type ViewType = 'normalized' | 'normalized_fine' | 'overlap' | 'complete' | 'comparable' | 'raw';

/**
 * Apply view transformation to merged data
 */
export function applyViewTransformation(
	data: RawBand[],
	viewType: ViewType
): RawBand[] {
	switch (viewType) {
		case 'raw':
			return data; // No transformation
			
		case 'normalized':
			return normalizeToStepWidth(data, 0.10);
			
		case 'normalized_fine':
			return normalizeToStepWidth(data, 0.02);
			
		case 'overlap':
			return getOverlapView(data);
			
		case 'complete':
			return normalizeToStepWidth(data, 0.01);
			
		case 'comparable':
			return getComparableView(data);
			
		default:
			return data;
	}
}

/**
 * Normalize data to a specific step width
 * Re-buckets all bands to uniform steps, preserving extrapolation flags
 */
function normalizeToStepWidth(data: RawBand[], stepWidth: number): RawBand[] {
	if (data.length === 0) return [];
	
	const minPrice = Math.min(...data.map(d => d.at_least_usd));
	const maxPrice = Math.max(...data.map(d => d.but_less_than_usd));
	
	console.log(`  📏 Normalizing to step width ${stepWidth}, range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`);
	console.log(`  📦 Source data has ${data.length} bands`);
	
	// Detect any additional curve columns (e.g., fedex_24_pct, ups_15_pct)
	// These are dynamic columns for historical/additional curve versions
	// IMPORTANT: Scan ALL rows since not every row has every column
	const additionalCurveColumnsSet = new Set<string>();
	const additionalCurveExtrapolatedSet = new Set<string>();
	for (const row of data) {
		for (const key of Object.keys(row)) {
			// Match pattern like "fedex_24_pct" or "ups_15_pct" (carrier_id_pct)
			if (key.match(/^(ups|fedex|dhl)_\d+_pct$/i)) {
				additionalCurveColumnsSet.add(key);
			}
			// Also detect extrapolation flags like "fedex_24_extrapolated"
			if (key.match(/^(ups|fedex|dhl)_\d+_extrapolated$/i)) {
				additionalCurveExtrapolatedSet.add(key);
			}
		}
	}
	const additionalCurveColumns = Array.from(additionalCurveColumnsSet);
	const additionalCurveExtrapolatedColumns = Array.from(additionalCurveExtrapolatedSet);
	if (additionalCurveColumns.length > 0) {
		console.log(`  📊 Found additional curve columns:`, additionalCurveColumns);
		console.log(`  📊 Found additional curve extrapolated flags:`, additionalCurveExtrapolatedColumns);
	}
	
	// Log FedEx source bands in the extrapolated backward range for debugging
	const backwardBands = data.filter(d => d.fedex_pct !== null && d.but_less_than_usd <= 3.55 && d.fedex_extrapolated);
	if (backwardBands.length > 0) {
		console.log(`  🔍 FedEx backward extrapolated bands in source:`, backwardBands.map(b => 
			`$${b.at_least_usd.toFixed(2)}-${b.but_less_than_usd.toFixed(2)}: ${b.fedex_pct}%`
		));
	}
	
	const normalizedBands: RawBand[] = [];
	let currentPrice = Math.floor(minPrice / stepWidth) * stepWidth;
	let debugCount = 0;
	
	while (currentPrice < maxPrice) {
		const nextPrice = parseFloat((currentPrice + stepWidth).toFixed(2));
		
		// Find source bands that overlap with this normalized range
		const sourceUPS = findOverlappingBand(data, currentPrice, nextPrice, 'ups_pct');
		const sourceFedEx = findOverlappingBand(data, currentPrice, nextPrice, 'fedex_pct');
		const sourceDHL = findOverlappingBand(data, currentPrice, nextPrice, 'dhl_pct');
		
		// Debug first 5 FedEx lookups in the backward extrapolated range
		if (sourceFedEx && currentPrice >= 3.28 && currentPrice < 3.55 && debugCount < 5) {
			console.log(`    🔎 [$${currentPrice.toFixed(2)}-$${nextPrice.toFixed(2)}] → FedEx source: $${sourceFedEx.at_least_usd.toFixed(2)}-${sourceFedEx.but_less_than_usd.toFixed(2)} = ${sourceFedEx.fedex_pct}%${sourceFedEx.fedex_extrapolated ? ' [E]' : ''}`);
			debugCount++;
		}
		
		const band: RawBand = {
			at_least_usd: currentPrice,
			but_less_than_usd: nextPrice,
			ups_pct: sourceUPS?.ups_pct ?? null,
			fedex_pct: sourceFedEx?.fedex_pct ?? null,
			dhl_pct: sourceDHL?.dhl_pct ?? null,
			ups_extrapolated: sourceUPS?.ups_extrapolated ?? false,
			fedex_extrapolated: sourceFedEx?.fedex_extrapolated ?? false,
			dhl_extrapolated: sourceDHL?.dhl_extrapolated ?? false,
		};
		
		// Handle additional curve columns
		for (const colKey of additionalCurveColumns) {
			const sourceBand = findOverlappingBand(data, currentPrice, nextPrice, colKey);
			band[colKey] = sourceBand?.[colKey] ?? null;
			
			// Also preserve extrapolation flag if it exists
			const extrapolatedKey = colKey.replace('_pct', '_extrapolated');
			if (sourceBand && extrapolatedKey in sourceBand) {
				band[extrapolatedKey] = sourceBand[extrapolatedKey];
			}
		}
		
		normalizedBands.push(band);
		
		currentPrice = nextPrice;
	}
	
	return normalizedBands;
}

/**
 * Find source band that best matches the given price range for a specific column
 * Returns the band that has the most coverage of the target range
 * Tiebreaker: if equal coverage, prefer the band that contains the target range START
 * 
 * @param columnKey - The column key to check (e.g., 'ups_pct', 'fedex_pct', 'fedex_24_pct')
 */
function findOverlappingBand(
	data: RawBand[],
	rangeStart: number,
	rangeEnd: number,
	columnKey: string
): RawBand | null {
	// Find all bands for this column that overlap with the target range
	const candidates: { band: RawBand; coverage: number; containsStart: boolean }[] = [];
	
	for (const band of data) {
		if (band[columnKey] !== null && band[columnKey] !== undefined) {
			// Calculate overlap between [rangeStart, rangeEnd) and [band.at_least, band.but_less_than)
			const overlapStart = Math.max(rangeStart, band.at_least_usd);
			const overlapEnd = Math.min(rangeEnd, band.but_less_than_usd);
			
			if (overlapStart < overlapEnd) {
				const coverage = overlapEnd - overlapStart;
				// Check if this band contains the start of the target range
				const containsStart = band.at_least_usd <= rangeStart && rangeStart < band.but_less_than_usd;
				candidates.push({ band, coverage, containsStart });
			}
		}
	}
	
	// Return the band with the most coverage
	// Tiebreaker: prefer the band that contains the target range start
	if (candidates.length === 0) {
		return null;
	}
	
	candidates.sort((a, b) => {
		// First, sort by coverage (higher is better)
		if (Math.abs(a.coverage - b.coverage) > 0.0001) {
			return b.coverage - a.coverage;
		}
		// Tiebreaker: prefer the band that contains the start point
		if (a.containsStart && !b.containsStart) return -1;
		if (!a.containsStart && b.containsStart) return 1;
		// If still tied, prefer the band with a higher start price (more recent/forward band)
		return b.band.at_least_usd - a.band.at_least_usd;
	});
	
	return candidates[0].band;
}

/**
 * Get overlap view - only show price ranges where multiple carriers have data
 */
function getOverlapView(data: RawBand[]): RawBand[] {
	return data.filter(band => {
		const carrierCount = [band.ups_pct, band.fedex_pct, band.dhl_pct]
			.filter(pct => pct !== null).length;
		return carrierCount >= 2; // At least 2 carriers must have data
	});
}

/**
 * Get comparable view - similar to overlap but with normalized steps
 */
function getComparableView(data: RawBand[]): RawBand[] {
	const normalized = normalizeToStepWidth(data, 0.05);
	return getOverlapView(normalized);
}

