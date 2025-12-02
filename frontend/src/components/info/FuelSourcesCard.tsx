import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, ChevronDown, ChevronUp, Fuel, ArrowRightLeft } from "lucide-react";
import { metadataApi } from "@/services/api";
import { getCarrierBrandColor } from "@/theme/carriers";

interface FuelSource {
	curve_id: number;
	carrier: string;
	market: string;
	fuel_category: string;
	fuel_source: string;
	service_name: string;
	needs_conversion: boolean;
	conversion_note: string | null;
}

interface FuelSourcesCardProps {
	market: string;
	fuelCategory: string;
	carriers: string[];
}

export default function FuelSourcesCard({
	market,
	fuelCategory,
	carriers,
}: FuelSourcesCardProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [fuelSources, setFuelSources] = useState<FuelSource[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchSources = async () => {
			try {
				const response = await metadataApi.getFuelSources();
				setFuelSources(response.data.fuel_sources || []);
			} catch (error) {
				console.error("Failed to fetch fuel sources:", error);
			} finally {
				setLoading(false);
			}
		};
		fetchSources();
	}, []);

	// Filter to current market/category and selected carriers
	const relevantSources = useMemo(() => {
		return fuelSources.filter(
			(s) =>
				s.market === market &&
				s.fuel_category === fuelCategory &&
				(carriers.length === 0 || carriers.includes(s.carrier))
		);
	}, [fuelSources, market, fuelCategory, carriers]);

	// Count carriers with converted units
	const convertedCount = useMemo(() => {
		return relevantSources.filter((s) => s.needs_conversion).length;
	}, [relevantSources]);

	// Get unique fuel sources for preview - MUST be before early return to follow rules of hooks
	const uniqueSources = useMemo(() => {
		const seen = new Set<string>();
		return relevantSources.filter((s) => {
			if (seen.has(s.fuel_source)) return false;
			seen.add(s.fuel_source);
			return true;
		}).slice(0, 3);
	}, [relevantSources]);

	// Format fuel source for cleaner display (shorten long names)
	const formatFuelSource = (source: string) => {
		const DISPLAY_LABELS: Record<string, string> = {
			"USGC Jet Fuel Price (USD/Gallon)": "US Gulf Coast Jet Fuel (USD/gal)",
			"Automotive Gas Oil (EUR/Liter)": "EU Automotive Gas Oil (EUR/L)",
			"EIA Diesel Fuel Price (USD/Gallon)": "EIA Weekly Diesel (USD/gal)",
			"US Gulf Coast Diesel (USD/Gallon)": "US Gulf Coast Diesel (USD/gal)",
			"ECDG Diesel Fuel Price (EUR/Liter)": "EU Commission Diesel (EUR/L)",
		};
		
		return DISPLAY_LABELS[source] || source || "Unknown";
	};

	// Generate concise label for collapsed state
	const getConvertedLabel = () => {
		if (convertedCount === 0) return null;
		if (convertedCount === 1) {
			const convertedSource = relevantSources.find((s) => s.needs_conversion);
			return `${convertedSource?.carrier} uses converted units`;
		}
		return `${convertedCount} carriers use converted units`;
	};

	if (loading || relevantSources.length === 0) {
		return null;
	}

	const convertedLabel = getConvertedLabel();

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="backdrop-blur-xl bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-teal-500/5 dark:from-blue-500/10 dark:via-cyan-500/10 dark:to-teal-500/10 border border-blue-200/30 dark:border-blue-500/20 rounded-2xl shadow-lg overflow-hidden"
		>
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/10 dark:hover:bg-gray-800/20 transition-colors"
			>
				<div className="flex items-center gap-3">
					<div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/30 dark:to-cyan-500/30">
						<Droplets className="w-4 h-4 text-blue-500 dark:text-blue-400" />
					</div>
					<div className="text-left">
						<span className="text-sm font-semibold text-gray-800 dark:text-gray-200 block">
							Fuel Pricing Sources
						</span>
						{!isExpanded && (
							<span className="text-xs text-gray-500 dark:text-gray-400">
								{uniqueSources.map((s, i) => (
									<span key={s.curve_id}>
										{i > 0 && " · "}
										{formatFuelSource(s.fuel_source).split(" (")[0]}
									</span>
								))}
								{relevantSources.length > 3 && ` +${relevantSources.length - 3} more`}
							</span>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2">
					{convertedLabel && (
						<span className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/30">
							{convertedLabel}
						</span>
					)}
					<div className="p-1.5 rounded-lg bg-gray-200/50 dark:bg-gray-700/50">
						{isExpanded ? (
							<ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
						) : (
							<ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
						)}
					</div>
				</div>
			</button>

			<AnimatePresence>
				{isExpanded && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.2 }}
						className="overflow-hidden"
					>
						<div className="px-4 pb-4">
							<div className="p-3 rounded-xl bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30">
								<div className="space-y-3">
									{relevantSources.map((source) => (
										<div
											key={source.curve_id}
											className="flex items-start gap-3"
										>
											{/* Carrier dot */}
											<div
												className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
												style={{
													backgroundColor: getCarrierBrandColor(source.carrier),
												}}
											/>

											<div className="flex-1 min-w-0">
												{/* Carrier name */}
												<div className="flex items-center gap-2 flex-wrap">
													<span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
														{source.carrier}
													</span>
													{source.needs_conversion && (
														<span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded">
															<ArrowRightLeft className="w-3 h-3" />
															Converted
														</span>
													)}
												</div>

												{/* Fuel source */}
												<div className="flex items-center gap-1.5 mt-0.5">
													<Fuel className="w-3 h-3 text-gray-500 dark:text-gray-500" />
													<span className="text-xs text-gray-600 dark:text-gray-400">
														{formatFuelSource(source.fuel_source)}
													</span>
												</div>

												{/* Conversion note */}
												{source.needs_conversion && (
													<p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-1 italic">
														Converted to {market === "DE" ? "EUR/L" : "USD/gal"} from {formatFuelSource(source.fuel_source)}
													</p>
												)}
											</div>
										</div>
									))}
								</div>

								{/* Legend */}
								{convertedCount > 0 && (
									<div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/30">
										<p className="text-[11px] text-gray-500 dark:text-gray-500">
											<span className="text-amber-600 dark:text-amber-400 font-medium">Converted</span> carriers
											use different fuel indices. Prices are converted to the
											local display unit (
											{market === "DE" ? "EUR/L" : "USD/gal"}) for comparison.
										</p>
									</div>
								)}
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
}
