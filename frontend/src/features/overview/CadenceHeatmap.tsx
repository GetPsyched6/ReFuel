import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/utils/cn";
import { getCarrierBrandColor } from "@/theme/carriers";
import { motion } from "framer-motion";

interface CadenceUpdate {
	date: string;
	old_pct: number | null;
	new_pct: number | null;
	service: string;
}

interface CadenceHeatmapProps {
	carrierUpdates: Record<string, CadenceUpdate[]>;
	carriers: string[];
}

export default function CadenceHeatmap({
	carrierUpdates,
	carriers,
}: CadenceHeatmapProps) {
	const carriersWithData = useMemo(() => {
		return carriers.filter((c) => (carrierUpdates[c]?.length || 0) > 0);
	}, [carriers, carrierUpdates]);

	const [activeCarrier, setActiveCarrier] = useState<string>(
		carriersWithData[0] || ""
	);

	// Process updates for active carrier, grouped by month
	const carrierData = useMemo(() => {
		const updates = carrierUpdates[activeCarrier] || [];
		const withDelta = updates.map((update) => ({
			...update,
			delta:
				update.old_pct !== null && update.new_pct !== null
					? update.new_pct - update.old_pct
					: null,
		}));

		// Sort by date descending
		withDelta.sort((a, b) => b.date.localeCompare(a.date));

		// Group by month
		const groups: Record<string, typeof withDelta> = {};
		withDelta.forEach((item) => {
			const date = new Date(item.date);
			const monthKey = date.toLocaleDateString("en-US", {
				month: "short",
				year: "numeric",
			});
			if (!groups[monthKey]) {
				groups[monthKey] = [];
			}
			groups[monthKey].push(item);
		});

		return { updates: withDelta, groupedByMonth: groups };
	}, [carrierUpdates, activeCarrier]);

	const totalUpdates = useMemo(() => {
		return Object.values(carrierUpdates).reduce(
			(sum, updates) => sum + updates.length,
			0
		);
	}, [carrierUpdates]);

	if (carriersWithData.length === 0) {
		return (
			<Card glass>
				<div className="flex items-center gap-3 mb-3">
					<div className="p-2 rounded-lg bg-indigo-500/10">
						<Activity className="w-4 h-4 text-indigo-500" />
					</div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-white">
						Update Cadence
					</h3>
				</div>
				<div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500">
					<p className="text-xs">No recent updates</p>
				</div>
			</Card>
		);
	}

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	const carrierColor = getCarrierBrandColor(activeCarrier);

	return (
		<Card glass>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<div className="p-2 rounded-lg bg-indigo-500/10">
						<Activity className="w-4 h-4 text-indigo-500" />
					</div>
					<div>
						<h3 className="text-sm font-semibold text-gray-900 dark:text-white">
							Update Cadence
						</h3>
						<p className="text-[10px] text-gray-500 dark:text-gray-400">
							{totalUpdates} total rate changes
						</p>
					</div>
				</div>
			</div>

			{/* Carrier Tabs */}
			<div className="flex gap-1 mb-3 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
				{carriersWithData.map((carrier) => {
					const color = getCarrierBrandColor(carrier);
					const isActive = carrier === activeCarrier;
					const count = carrierUpdates[carrier]?.length || 0;

					return (
						<button
							key={carrier}
							onClick={() => setActiveCarrier(carrier)}
							className={cn(
								"flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all",
								isActive
									? "bg-white dark:bg-gray-700 shadow-sm"
									: "hover:bg-white/50 dark:hover:bg-gray-700/50"
							)}
							style={isActive ? { color } : {}}
						>
							<div
								className="w-2 h-2 rounded-full"
								style={{ backgroundColor: color }}
							/>
							<span
								className={cn(
									!isActive && "text-gray-600 dark:text-gray-400"
								)}
							>
								{carrier}
							</span>
							<span
								className={cn(
									"text-[10px] px-1.5 py-0.5 rounded-full",
									isActive
										? "bg-gray-100 dark:bg-gray-600"
										: "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
								)}
							>
								{count}
							</span>
						</button>
					);
				})}
			</div>

			{/* Updates List */}
			<div className="max-h-96 overflow-y-auto space-y-4 pr-1">
				{Object.entries(carrierData.groupedByMonth).map(
					([monthKey, updates], monthIdx) => (
						<div key={monthKey}>
							{/* Month header */}
							<div className="sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 py-1">
								{monthKey}
							</div>

							{/* Updates */}
							<div className="space-y-1">
								{updates.map((item, idx) => {
									const isUp = item.delta !== null && item.delta > 0;
									const isDown = item.delta !== null && item.delta < 0;
									const isFlat =
										item.delta !== null && Math.abs(item.delta) < 0.01;

									return (
										<motion.div
											key={`${item.date}-${idx}`}
											initial={{ opacity: 0, y: 5 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: idx * 0.03 }}
											className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
										>
											{/* Date */}
											<div className="w-16 flex-shrink-0">
												<p className="text-xs font-medium text-gray-600 dark:text-gray-300">
													{formatDate(item.date)}
												</p>
											</div>

											{/* Rate change visualization */}
											<div className="flex-1 flex items-center gap-2">
												{item.old_pct !== null ? (
													<>
														<span className="text-xs text-gray-400 tabular-nums min-w-[45px] text-right">
															{item.old_pct?.toFixed(2)}%
														</span>
														<div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative max-w-[80px]">
															<motion.div
																initial={{ width: 0 }}
																animate={{ width: "100%" }}
																transition={{ duration: 0.3, delay: idx * 0.03 }}
																className="absolute inset-y-0 left-0 rounded-full"
																style={{ backgroundColor: carrierColor + "60" }}
															/>
														</div>
														<span
															className="text-xs font-semibold tabular-nums min-w-[45px]"
															style={{ color: carrierColor }}
														>
															{item.new_pct?.toFixed(2)}%
														</span>
													</>
												) : (
													<span
														className="text-xs font-semibold tabular-nums"
														style={{ color: carrierColor }}
													>
														{item.new_pct?.toFixed(2)}%
													</span>
												)}
											</div>

											{/* Delta badge */}
											{item.delta !== null && (
												<div
													className={cn(
														"flex items-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-md min-w-[60px] justify-center",
														isUp &&
															"bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
														isDown &&
															"bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
														isFlat &&
															"bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
													)}
												>
													{isUp && <TrendingUp className="w-3 h-3" />}
													{isDown && <TrendingDown className="w-3 h-3" />}
													{isFlat && <Minus className="w-3 h-3" />}
													<span className="tabular-nums">
														{isUp ? "+" : ""}
														{item.delta.toFixed(2)}
													</span>
												</div>
											)}
										</motion.div>
									);
								})}
							</div>
						</div>
					)
				)}
			</div>
		</Card>
	);
}
