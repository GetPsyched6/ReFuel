/**
 * Unit Conversion Utility
 *
 * Handles conversion of fuel prices between different units.
 * Used for curves like DHL DE Ground Domestic which is stored in USD/gallon
 * but needs to be displayed in EUR/L for comparison with other DE carriers.
 *
 * IMPORTANT: Conversion should be applied AFTER extrapolation/inflection detection
 * to maintain data precision.
 */

export interface ConversionConfig {
	market: string;
	carrier: string;
	fuel_category: string;
	source_unit: string;
	display_unit: string;
	conversion_factor: number;
	note?: string;
}

// Default conversion factor: USD/gallon to EUR/L
// Formula: EUR/L = USD/gal × (EUR/USD rate) / (liters per gallon)
// With EUR/USD ≈ 0.92 and 3.785 L/gal: 0.92 / 3.785 ≈ 0.243
const DEFAULT_USD_GAL_TO_EUR_L = 0.243;

/**
 * Convert a price from USD/gallon to EUR/L
 */
export function usdGallonToEurLiter(
	usdPerGallon: number,
	conversionFactor?: number
): number {
	const factor = conversionFactor ?? DEFAULT_USD_GAL_TO_EUR_L;
	return Number((usdPerGallon * factor).toFixed(2));
}

/**
 * Check if a curve needs conversion for display
 */
export function needsConversion(
	market: string,
	carrier: string,
	fuelCategory: string,
	conversions: ConversionConfig[]
): ConversionConfig | null {
	return (
		conversions.find(
			(c) =>
				c.market === market &&
				c.carrier === carrier &&
				c.fuel_category === fuelCategory
		) || null
	);
}

/**
 * Convert a band's price range from source to display units
 */
export function convertBand<
	T extends { at_least_usd: number; but_less_than_usd: number }
>(band: T, conversionFactor: number): T {
	return {
		...band,
		at_least_usd: Number((band.at_least_usd * conversionFactor).toFixed(2)),
		but_less_than_usd: Number(
			(band.but_less_than_usd * conversionFactor).toFixed(2)
		),
	};
}

/**
 * Convert multiple bands
 */
export function convertBands<
	T extends { at_least_usd: number; but_less_than_usd: number }
>(bands: T[], conversionFactor: number): T[] {
	return bands.map((band) => convertBand(band, conversionFactor));
}

/**
 * Convert an inflection point price
 */
export function convertInflectionPoint(
	inflectionPrice: number | null,
	conversionFactor: number
): number | null {
	if (inflectionPrice === null) return null;
	return Number((inflectionPrice * conversionFactor).toFixed(2));
}

/**
 * Get display unit label based on conversion
 */
export function getDisplayUnit(
	market: string,
	carrier: string,
	fuelCategory: string,
	conversions: ConversionConfig[]
): { symbol: string; perUnit: string; label: string } {
	const conversion = needsConversion(
		market,
		carrier,
		fuelCategory,
		conversions
	);

	if (conversion?.display_unit === "eur_liter") {
		return { symbol: "€", perUnit: "/L", label: "EUR/Liter" };
	}

	// Default based on market
	if (market === "DE") {
		return { symbol: "€", perUnit: "/L", label: "EUR/Liter" };
	}

	return { symbol: "$", perUnit: "/gal", label: "USD/Gallon" };
}
