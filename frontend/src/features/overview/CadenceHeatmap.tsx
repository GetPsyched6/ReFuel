import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Calendar, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { getCarrierBrandColor } from "@/theme/carriers";

interface CadenceUpdate {
	date: string;
	old_pct: number;
	new_pct: number;
	service: string;
}

interface CadenceHeatmapProps {
	carrierUpdates: Record<string, CadenceUpdate[]>;
	carriers: string[];
}

// Legacy mapping kept for reference; current rendering uses `getCarrierBrandColor`.
// const CARRIER_COLORS: Record<string, string> = {
// 	UPS: "#F97316",
// 	FedEx: "#8B5CF6",
// 	DHL: "#3B82F6",
// 	DPD: "#10B981",
// };

export default function CadenceHeatmap({
	carrierUpdates,
	carriers,
}: CadenceHeatmapProps) {
	const [activeCarrierIndex, setActiveCarrierIndex] = useState(0);

	const carriersWithData = useMemo(() => {
		return carriers.filter((carrier) => {
			const updates = carrierUpdates[carrier] || [];
			return updates.length > 0;
		});
	}, [carriers, carrierUpdates]);

	const activeCarrier = carriersWithData[activeCarrierIndex] || carriersWithData[0];

	const heatmapData = useMemo(() => {
		const datesByCarrier: Record<string, Set<string>> = {};
		const allDates = new Set<string>();

		carriers.forEach((carrier) => {
			datesByCarrier[carrier] = new Set();
			const updates = carrierUpdates[carrier] || [];
			updates.forEach((update) => {
				datesByCarrier[carrier].add(update.date);
				allDates.add(update.date);
			});
		});

		const sortedDates = Array.from(allDates).sort();

		const startDate = sortedDates.length > 0 ? new Date(sortedDates[0]) : new Date();
		const endDate =
			sortedDates.length > 0
				? new Date(sortedDates[sortedDates.length - 1])
				: new Date();

		const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
		const monthEnd = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);

		const monthsData: Array<{
			month: string;
			year: number;
			weeks: Array<{
				weekStart: Date;
				days: Array<{
					date: Date;
					dateStr: string;
					carrierUpdates: Record<string, CadenceUpdate | null>;
					isCurrentMonth: boolean;
				}>;
			}>;
		}> = [];

		let currentDate = new Date(monthStart);
		while (currentDate.getDay() !== 0) {
			currentDate.setDate(currentDate.getDate() - 1);
		}

		let currentMonth = -1;
		let currentMonthData: any = null;

		while (currentDate <= monthEnd) {
			const week = {
				weekStart: new Date(currentDate),
				days: [] as any[],
			};

			for (let i = 0; i < 7; i++) {
				const dateStr = currentDate.toISOString().split("T")[0];
				const dayData: any = {
					date: new Date(currentDate),
					dateStr,
					carrierUpdates: {},
					isCurrentMonth: currentDate >= monthStart && currentDate <= monthEnd,
				};

				carriers.forEach((carrier) => {
					const updates = carrierUpdates[carrier] || [];
					const update = updates.find((u) => u.date === dateStr);
					dayData.carrierUpdates[carrier] = update || null;
				});

				week.days.push(dayData);
				
				if (currentDate.getMonth() !== currentMonth && dayData.isCurrentMonth) {
					if (currentMonthData) {
						monthsData.push(currentMonthData);
					}
					currentMonth = currentDate.getMonth();
					currentMonthData = {
						month: currentDate.toLocaleDateString("en-US", { month: "long" }),
						year: currentDate.getFullYear(),
						weeks: [],
					};
				}

				currentDate.setDate(currentDate.getDate() + 1);
			}

			if (currentMonthData) {
				currentMonthData.weeks.push(week);
			}
		}

		if (currentMonthData) {
			monthsData.push(currentMonthData);
		}

		return { monthsData, monthStart, monthEnd };
	}, [carrierUpdates, carriers]);

	const hasAnyUpdates = useMemo(() => {
		return Object.values(carrierUpdates).some((updates) => updates.length > 0);
	}, [carrierUpdates]);

	const handlePrevCarrier = () => {
		setActiveCarrierIndex((prev) =>
			prev === 0 ? carriersWithData.length - 1 : prev - 1
		);
	};

	const handleNextCarrier = () => {
		setActiveCarrierIndex((prev) =>
			prev === carriersWithData.length - 1 ? 0 : prev + 1
		);
	};

	if (!hasAnyUpdates) {
		return (
			<Card glass>
				<div className="flex items-center gap-3 mb-4">
					<Calendar className="w-5 h-5 text-blue-500" />
					<h3 className="text-lg font-bold">Update Cadence</h3>
				</div>
				<div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
					<div className="text-center">
						<Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
						<p>No recent updates in this period</p>
					</div>
				</div>
			</Card>
		);
	}

	return (
		<Card glass>
			<div className="mb-4">
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-3">
						<Calendar className="w-5 h-5 text-blue-500" />
						<h3 className="text-lg font-bold">Update Cadence</h3>
					</div>
					{carriersWithData.length > 1 && (
						<div className="flex items-center gap-2">
							<button
								onClick={handlePrevCarrier}
								className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								aria-label="Previous carrier"
							>
								<ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
							</button>
							<button
								onClick={handleNextCarrier}
								className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								aria-label="Next carrier"
							>
								<ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
							</button>
						</div>
					)}
				</div>
				<p className="text-sm text-gray-600 dark:text-gray-400">
					When carriers changed their surcharge rates
				</p>
			</div>

			{activeCarrier && (
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<div
							className="w-3 h-3 rounded-full"
							style={{ backgroundColor: getCarrierBrandColor(activeCarrier) }}
						/>
						<span className="font-semibold text-sm">{activeCarrier}</span>
						<span className="text-xs text-gray-500 dark:text-gray-400">
							({carrierUpdates[activeCarrier]?.length || 0} update
							{(carrierUpdates[activeCarrier]?.length || 0) !== 1 ? "s" : ""})
						</span>
					</div>

					<div className="h-96 overflow-y-auto pr-2 space-y-4">
						{heatmapData.monthsData.map((monthData, monthIdx) => (
							<div key={monthIdx} className="space-y-2">
								<div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
									{monthData.month} {monthData.year}
								</div>
								<div className="grid grid-cols-7 gap-1">
									{monthData.weeks.map((week, weekIdx) => (
										<>
													{week.days.map((day, dayIdx) => {
												const update = day.carrierUpdates[activeCarrier];
												const carrierColor = getCarrierBrandColor(activeCarrier);
												
												// Position tooltip below for first week, above for others
												const isTopRow = weekIdx === 0 && monthIdx === 0;
												const tooltipPosition = isTopRow ? "top-full mt-2" : "bottom-full mb-2";
												const arrowPosition = isTopRow ? "top-0" : "bottom-0";
												const arrowDirection = isTopRow 
													? "border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900 dark:border-b-gray-800"
													: "border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800";

												return (
													<div
														key={`${monthIdx}-${weekIdx}-${dayIdx}`}
														className={cn(
															"aspect-square rounded flex items-center justify-center text-xs relative group cursor-pointer transition-all",
															!day.isCurrentMonth && "opacity-20",
															update
																? "font-bold shadow-lg ring-2"
																: "bg-gray-100 dark:bg-gray-800"
														)}
														style={
															update
																? {
																		backgroundColor: carrierColor + "40",
																		borderColor: carrierColor,
																		color: carrierColor,
																  }
																: {}
														}
													>
														{day.date.getDate()}
														{update && (
															<div className={cn(
																"absolute left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none",
																tooltipPosition
															)}>
																<div className="font-semibold">{day.dateStr}</div>
																<div className="text-gray-300">{update.service}</div>
																<div className="mt-1">
																	{update.old_pct !== null && update.old_pct !== undefined 
																		? `${update.old_pct}% → ${update.new_pct}%`
																		: `${update.new_pct}%`
																	}
																</div>
																{update.old_pct !== null && update.old_pct !== undefined && (
																	<div
																		className={cn(
																			"font-bold",
																			update.new_pct > update.old_pct
																				? "text-red-400"
																				: "text-green-400"
																		)}
																	>
																		{update.new_pct > update.old_pct ? "+" : ""}
																		{(update.new_pct - update.old_pct).toFixed(2)} pp
																	</div>
																)}
																<div className={cn(
																	"absolute left-1/2 -translate-x-1/2 w-0 h-0",
																	arrowPosition,
																	arrowDirection
																)}></div>
															</div>
														)}
													</div>
												);
											})}
										</>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			<div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
				<div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
					<div className="flex items-center gap-1">
						<div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-800" />
						<span>No change</span>
					</div>
					<div className="flex items-center gap-1 ml-4">
						<div className="w-3 h-3 rounded bg-blue-500/40 ring-2 ring-blue-500" />
						<span>Rate updated</span>
					</div>
				</div>
			</div>
		</Card>
	);
}

