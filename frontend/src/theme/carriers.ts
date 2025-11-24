export type CarrierId = "UPS" | "FedEx" | "DHL" | "DPD" | (string & {});

interface CarrierColorScheme {
	/**
	 * Primary brand color for this carrier in light mode.
	 * Used for lines, bars, legends, and primary accents.
	 */
	light: string;
	/**
	 * Primary brand color for this carrier in dark mode.
	 * For now this matches `light`, but the shape is ready for future tuning.
	 */
	dark: string;
}

/**
 * Single source of truth for carrier brand colors.
 *
 * These values are already used in the fuel curve legends:
 * - UPS   – #F97316 (amber / orange)
 * - FedEx – #8B5CF6 (purple)
 * - DHL   – #3B82F6 (blue)
 *
 * Both light and dark variants currently share the same hex, but the API
 * is designed to support divergence later without changing call sites.
 */
export const CARRIER_COLOR_SCHEMES: Record<CarrierId, CarrierColorScheme> = {
	UPS: {
		light: "#F97316",
		dark: "#F97316",
	},
	FedEx: {
		light: "#8B5CF6",
		dark: "#8B5CF6",
	},
	DHL: {
		light: "#3B82F6",
		dark: "#3B82F6",
	},
	DPD: {
		light: "#10B981",
		dark: "#10B981",
	},
};

const DEFAULT_LIGHT = "#6B7280"; // gray-500
const DEFAULT_DARK = "#9CA3AF"; // gray-400

/**
 * Get the primary brand color for a carrier, parameterized by theme mode.
 */
export function getCarrierColor(
	carrier: string,
	mode: "light" | "dark" = "light"
): string {
	const scheme = CARRIER_COLOR_SCHEMES[carrier as CarrierId];
	if (!scheme) {
		return mode === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT;
	}
	return mode === "dark" ? scheme.dark : scheme.light;
}

/**
 * Convenience helper for places that just need a canonical brand color
 * and don't differentiate by theme.
 */
export function getCarrierBrandColor(carrier: string): string {
	return getCarrierColor(carrier, "light");
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16),
		  }
		: null;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(
	r: number,
	g: number,
	b: number
): { h: number; s: number; l: number } {
	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0,
		s = 0,
		l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
				break;
			case g:
				h = ((b - r) / d + 2) / 6;
				break;
			case b:
				h = ((r - g) / d + 4) / 6;
				break;
		}
	}

	return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to hex
 */
function hslToHex(h: number, s: number, l: number): string {
	h /= 360;
	s /= 100;
	l /= 100;

	let r, g, b;

	if (s === 0) {
		r = g = b = l;
	} else {
		const hue2rgb = (p: number, q: number, t: number) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}

	const toHex = (x: number) => {
		const hex = Math.round(x * 255).toString(16);
		return hex.length === 1 ? "0" + hex : hex;
	};

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Get extrapolated color variant for a carrier
 *
 * In dark mode: lighter/higher opacity (more visible on dark background)
 * In light mode: darker/lower saturation (distinct but visible on light background)
 */
export function getCarrierExtrapolatedColor(
	carrier: string,
	mode: "light" | "dark" = "light"
): string {
	const baseColor = getCarrierColor(carrier, mode);
	const rgb = hexToRgb(baseColor);

	if (!rgb) return baseColor;

	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

	if (mode === "dark") {
		// In dark mode: increase lightness by 20% (lighter)
		hsl.l = Math.min(100, hsl.l + 20);
	} else {
		// In light mode: decrease saturation by 30% and decrease lightness by 10% (darker/muted)
		hsl.s = Math.max(0, hsl.s - 30);
		hsl.l = Math.max(0, hsl.l - 10);
	}

	return hslToHex(hsl.h, hsl.s, hsl.l);
}

/**
 * Get opacity for extrapolated data
 */
export function getExtrapolatedOpacity(): number {
	return 0.7; // 70% opacity for extrapolated data
}

/**
 * Get color variant for multiple curve versions of the same carrier
 *
 * When a carrier has multiple fuel curve versions selected, each version
 * gets a color-shifted variant of the base carrier color to remain visually
 * distinct while maintaining the carrier's brand identity.
 *
 * @param carrier - Carrier name (e.g., "UPS", "FedEx")
 * @param versionIndex - Index of this version (0-based)
 * @param totalVersions - Total number of versions for this carrier
 * @param mode - "light" or "dark" theme mode
 * @returns Hex color string
 */
export function getCarrierColorVariant(
	carrier: string,
	versionIndex: number,
	totalVersions: number,
	mode: "light" | "dark" = "light"
): string {
	const baseColor = getCarrierColor(carrier, mode);

	// If only one version, return base color
	if (totalVersions === 1) {
		return baseColor;
	}

	const rgb = hexToRgb(baseColor);
	if (!rgb) return baseColor;

	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

	// Shift lightness for each version
	// Dark mode: make lighter (increase L) for better visibility on dark background
	// Light mode: make darker (decrease L) for better visibility on light background
	const lightnessShift = mode === "dark" ? 10 : -10;
	const newLightness = Math.max(
		20,
		Math.min(80, hsl.l + lightnessShift * versionIndex)
	);

	return hslToHex(hsl.h, hsl.s, newLightness);
}

/**
 * Get stroke dash array for a carrier's curve
 *
 * FedEx curves are always dashed to differentiate them visually.
 * All other carriers use solid lines.
 *
 * @param carrier - Carrier name
 * @returns SVG strokeDasharray value or undefined for solid lines
 */
export function getStrokeDashArray(carrier: string): string | undefined {
	return carrier === "FedEx" ? "5 5" : undefined;
}
