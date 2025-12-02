import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { RefreshCw, AlertCircle, Layers, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { fuelCurveApi } from "@/services/api";
import { getCarrierBrandColor } from "@/theme/carriers";

interface CarrierVersion {
	id: number;
	carrier: string;
	market: string;
	fuel_category: string;
	effective_date: string;
	is_active: boolean;
	label: string;
	has_exact_date: boolean;
}

interface CarrierUpdateTimelineProps {
	market: string;
	fuelCategory: string;
}

const ALL_CARRIERS = ["UPS", "FedEx", "DHL"];

export default function CarrierUpdateTimeline({
	market,
	fuelCategory,
}: CarrierUpdateTimelineProps) {
	const [versions, setVersions] = useState<CarrierVersion[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchVersions = async () => {
			setLoading(true);
			try {
				const response = await fuelCurveApi.getVersions(
					market,
					fuelCategory,
					ALL_CARRIERS
				);
				const allVersions = response.data.versions || [];
				setVersions(allVersions);
			} catch (error) {
				console.error("Failed to fetch versions:", error);
				setVersions([]);
			} finally {
				setLoading(false);
			}
		};
		fetchVersions();
	}, [market, fuelCategory]);

	// Get carriers that actually have data for this market
	const activeCarriers = useMemo(() => {
		const carriersWithData = new Set(versions.map((v) => v.carrier));
		return ALL_CARRIERS.filter((c) => carriersWithData.has(c));
	}, [versions]);

	// Group versions by carrier
	const carrierVersionsMap = useMemo(() => {
		const map: Record<string, CarrierVersion[]> = {};

		activeCarriers.forEach((carrier) => {
			const carrierVersions = versions
				.filter((v) => v.carrier === carrier)
				.sort(
					(a, b) =>
						new Date(b.effective_date).getTime() -
						new Date(a.effective_date).getTime()
				);
			map[carrier] = carrierVersions;
		});

		return map;
	}, [versions, activeCarriers]);

	const formatDate = (dateStr: string, hasExactDate: boolean = true) => {
		const date = new Date(dateStr);
		if (hasExactDate) {
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		}
		// Only show month and year when we don't have the exact date
		return date.toLocaleDateString("en-US", {
			month: "short",
			year: "numeric",
		});
	};

	// Get the day before a date (for "to" dates)
	const getEndDate = (
		nextVersionDateStr: string,
		nextVersionHasExactDate: boolean
	) => {
		const date = new Date(nextVersionDateStr);
		if (nextVersionHasExactDate) {
			// Day before the next version started
			date.setDate(date.getDate() - 1);
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		}
		// If next version only has month precision, show month before
		date.setMonth(date.getMonth() - 1);
		return date.toLocaleDateString("en-US", {
			month: "short",
			year: "numeric",
		});
	};

	const getRelativeTime = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (days === 0) return "today";
		if (days === 1) return "yesterday";
		if (days < 7) return `${days} days ago`;
		if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
		if (days < 365) return `${Math.floor(days / 30)} months ago`;
		return `${Math.floor(days / 365)} years ago`;
	};

	if (loading) {
		return (
			<Card glass>
				<div className="flex items-center justify-center py-12">
					<RefreshCw className="w-6 h-6 animate-spin text-violet-500" />
				</div>
			</Card>
		);
	}

	if (activeCarriers.length === 0) {
		return (
			<Card glass>
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
					<p className="text-sm font-medium text-gray-500">
						No fuel curve data available
					</p>
					<p className="text-xs text-gray-400 mt-1">
						Try selecting a different market or service
					</p>
				</div>
			</Card>
		);
	}

	return (
		<Card glass>
			{/* Header */}
			<div className="flex items-center gap-3 mb-6">
				<div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 dark:from-violet-500/30 dark:to-purple-500/30">
					<Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
				</div>
				<div>
					<h3 className="text-lg font-bold text-gray-900 dark:text-white">
						Fuel Curve Versions
					</h3>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Historical rate table updates
					</p>
				</div>
			</div>

			{/* Carrier Sections */}
			<div className="space-y-6">
				{activeCarriers.map((carrier, carrierIndex) => {
					const carrierColor = getCarrierBrandColor(carrier);
					const carrierVersions = carrierVersionsMap[carrier] || [];

					return (
						<motion.div
							key={carrier}
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: carrierIndex * 0.08 }}
						>
							{/* Carrier Header */}
							<div className="flex items-center gap-3 mb-3">
								<div
									className="w-2 h-8 rounded-full"
									style={{ backgroundColor: carrierColor }}
								/>
								<span className="text-base font-bold text-gray-900 dark:text-white">
									{carrier}
								</span>
								<span className="text-xs text-gray-400 dark:text-gray-500">
									{carrierVersions.length} version
									{carrierVersions.length !== 1 ? "s" : ""}
								</span>
							</div>

							{/* Versions Grid */}
							<div className="ml-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
								{carrierVersions.slice(0, 3).map((version, versionIndex) => {
									const isLatest = versionIndex === 0;
									const prevInArray = carrierVersions[versionIndex - 1];
									const effectiveTo = isLatest
										? "Present"
										: getEndDate(
												prevInArray.effective_date,
												prevInArray.has_exact_date ?? true
										  );

									return (
										<motion.div
											key={version.id}
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{
												delay: carrierIndex * 0.08 + versionIndex * 0.04,
											}}
											className="group relative"
										>
											<div
												className={`
													relative overflow-hidden rounded-xl p-4 transition-all duration-300
													${
														isLatest
															? "bg-white dark:bg-gray-800 shadow-lg ring-1 ring-gray-200/50 dark:ring-gray-700/50"
															: "bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800"
													}
												`}
											>
												{/* Current indicator glow */}
												{isLatest && (
													<div
														className="absolute inset-0 opacity-[0.03] dark:opacity-[0.08]"
														style={{
															background: `linear-gradient(135deg, ${carrierColor}, transparent 60%)`,
														}}
													/>
												)}

												<div className="relative">
													{/* Status Badge */}
													<div className="flex items-center justify-between mb-3">
														{isLatest ? (
															<span
																className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white"
																style={{ backgroundColor: carrierColor }}
															>
																Current
															</span>
														) : (
															<span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
																Historical
															</span>
														)}
														<span className="text-[10px] text-gray-400 dark:text-gray-500">
															{getRelativeTime(version.effective_date)}
														</span>
													</div>

													{/* Date Range */}
													<div className="flex items-center gap-2">
														<div className="flex-1">
															<p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
																From
															</p>
															<p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
																{formatDate(
																	version.effective_date,
																	version.has_exact_date ?? true
																)}
															</p>
														</div>
														<ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
														<div className="flex-1 text-right">
															<p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
																To
															</p>
															<p
																className={`text-sm font-semibold ${
																	isLatest
																		? "text-emerald-600 dark:text-emerald-400"
																		: "text-gray-800 dark:text-gray-200"
																}`}
															>
																{effectiveTo}
															</p>
														</div>
													</div>
												</div>
											</div>
										</motion.div>
									);
								})}

								{/* No older versions placeholder */}
								{carrierVersions.length === 1 && (
									<div className="flex items-center justify-center p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700/50">
										<p className="text-xs text-gray-400 dark:text-gray-600">
											No historical data available
										</p>
									</div>
								)}

								{/* More versions indicator */}
								{carrierVersions.length > 3 && (
									<div className="flex items-center justify-center p-4 rounded-xl bg-gray-100 dark:bg-gray-800/40">
										<p className="text-xs font-medium text-gray-500 dark:text-gray-500">
											+{carrierVersions.length - 3} older
										</p>
									</div>
								)}
							</div>
						</motion.div>
					);
				})}
			</div>
		</Card>
	);
}
