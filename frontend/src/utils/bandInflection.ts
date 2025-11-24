/**
 * Band Inflection Detection Utility
 *
 * An inflection point is where the step width (price range size) changes significantly.
 * For example: first half uses $0.09 steps, then after inflection switches to $0.04 steps.
 */

export interface Band {
	at_least_usd: number;
	but_less_than_usd: number;
	surcharge_pct: number;
}

interface ComparisonRow {
	at_least_usd: number;
	but_less_than_usd: number;
	ups_pct: number | null;
	fedex_pct: number | null;
	dhl_pct: number | null;
}

/**
 * Find the inflection point in a set of fuel curve bands.
 * Returns the price where the step width changes significantly, or null if no inflection.
 *
 * Algorithm:
 * 1. Calculate step widths for all bands
 * 2. Establish baseline from early bands (first ~30%)
 * 3. Look for sustained change in step width (70% smaller OR 130% larger)
 * 4. Require at least 2 consecutive bands with changed width
 */
export function findInflection(bands: Band[]): number | null {
	if (bands.length < 4) {
		return null;
	}

	// Sort by price
	const sortedBands = [...bands].sort(
		(a, b) => a.at_least_usd - b.at_least_usd
	);

	// Calculate step widths
	const stepWidths = sortedBands.map(
		(band) => band.but_less_than_usd - band.at_least_usd
	);

	if (stepWidths.length < 4) {
		return null;
	}

	// Establish baseline from early bands (first ~30%, minimum 3)
	const earlyWindowSize = Math.max(
		2,
		Math.min(3, Math.floor(stepWidths.length * 0.3))
	);
	const earlyWidths = stepWidths.slice(0, earlyWindowSize);
	const baselineWidth =
		earlyWidths.reduce((sum, w) => sum + w, 0) / earlyWidths.length;

	// Thresholds for detecting change
	const narrowThreshold = baselineWidth * 0.7; // 70% of baseline = significantly narrower
	const wideThreshold = baselineWidth * 1.3; // 130% of baseline = significantly wider
	const minConsecutive = 2;

	// Look for wide-to-narrow inflection (most common case)
	for (let i = earlyWindowSize; i <= stepWidths.length - minConsecutive; i++) {
		let consecutiveNarrow = 0;

		for (let j = i; j < Math.min(stepWidths.length, i + 4); j++) {
			if (stepWidths[j] < narrowThreshold) {
				consecutiveNarrow++;
			} else {
				break;
			}
		}

		if (consecutiveNarrow >= minConsecutive) {
			return sortedBands[i].at_least_usd;
		}
	}

	// Look for narrow-to-wide inflection (less common)
	for (let i = earlyWindowSize; i <= stepWidths.length - minConsecutive; i++) {
		let consecutiveWide = 0;

		for (let j = i; j < Math.min(stepWidths.length, i + 4); j++) {
			if (stepWidths[j] > wideThreshold) {
				consecutiveWide++;
			} else {
				break;
			}
		}

		if (consecutiveWide >= minConsecutive) {
			return sortedBands[i].at_least_usd;
		}
	}

	return null;
}

/**
 * Find inflection points for multiple carriers in comparison data.
 * Returns a Map of carrier name → inflection price.
 *
 * @param data - Comparison rows with ups_pct, fedex_pct, dhl_pct fields
 * @param carriers - List of carrier names to check
 * @param skipSet - Set of carrier names to skip (e.g., carriers with explicit formulas)
 */
export function findCarrierInflections(
	data: ComparisonRow[],
	carriers: string[],
	skipSet: Set<string>
): Map<string, number> {
	const inflections = new Map<string, number>();

	for (const carrier of carriers) {
		// Skip if in skip set
		if (skipSet.has(carrier)) {
			continue;
		}

		// Extract bands for this carrier
		const carrierKey = getCarrierKey(carrier);
		const bands = extractCarrierBands(data, carrierKey);

		if (bands.length >= 4) {
			const inflectionPrice = findInflection(bands);
			if (inflectionPrice !== null) {
				inflections.set(carrier, inflectionPrice);
				console.log(
					`📍 ${carrier} inflection detected at $${inflectionPrice.toFixed(2)}`
				);
			}
		}
	}

	return inflections;
}

/**
 * Map carrier name to the corresponding percentage field key
 */
function getCarrierKey(carrier: string): "ups_pct" | "fedex_pct" | "dhl_pct" {
	switch (carrier.toUpperCase()) {
		case "UPS":
			return "ups_pct";
		case "FEDEX":
			return "fedex_pct";
		case "DHL":
			return "dhl_pct";
		default:
			// Default to fedex for unknown carriers
			return "fedex_pct";
	}
}

/**
 * Extract bands for a specific carrier from comparison data
 */
function extractCarrierBands(
	data: ComparisonRow[],
	carrierKey: "ups_pct" | "fedex_pct" | "dhl_pct"
): Band[] {
	return data
		.filter((row) => row[carrierKey] !== null && row[carrierKey] !== undefined)
		.map((row) => ({
			at_least_usd: row.at_least_usd,
			but_less_than_usd: row.but_less_than_usd,
			surcharge_pct: row[carrierKey]!,
		}))
		.sort((a, b) => a.at_least_usd - b.at_least_usd);
}
