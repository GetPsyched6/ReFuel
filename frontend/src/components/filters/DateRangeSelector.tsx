import { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Calendar, X } from "lucide-react";
import { cn } from "@/utils/cn";

interface DateRangeSelectorProps {
	startDate: string | null;
	endDate: string | null;
	onDateRangeChange: (start: string | null, end: string | null) => void;
}

type QuickSelect = "1m" | "3m" | "6m" | null;

export default function DateRangeSelector({
	startDate,
	endDate,
	onDateRangeChange,
}: DateRangeSelectorProps) {
	// Sync activeQuickSelect with props - if dates are null, "All" is active
	const [activeQuickSelect, setActiveQuickSelect] = useState<QuickSelect>(
		!startDate && !endDate ? null : null
	);
	const [popoverOpen, setPopoverOpen] = useState(false);

	// Update activeQuickSelect when dates change externally
	useEffect(() => {
		if (!startDate && !endDate) {
			setActiveQuickSelect(null);
		} else if (startDate && endDate) {
			// Check if it matches an exact 1/3/6 month offset (by calendar months)
			const start = new Date(startDate);
			const end = new Date(endDate);

			const monthsDiff =
				(end.getFullYear() - start.getFullYear()) * 12 +
				(end.getMonth() - start.getMonth());

			if (monthsDiff === 1) {
				setActiveQuickSelect("1m");
			} else if (monthsDiff === 3) {
				setActiveQuickSelect("3m");
			} else if (monthsDiff === 6) {
				setActiveQuickSelect("6m");
			} else {
				setActiveQuickSelect(null);
			}
		}
	}, [startDate, endDate]);

	// Calculate date ranges for quick selects
	const getQuickSelectRange = (months: number): [string, string] => {
		const end = new Date();
		const start = new Date();
		start.setMonth(start.getMonth() - months);

		return [start.toISOString().split("T")[0], end.toISOString().split("T")[0]];
	};

	const handleQuickSelect = (type: QuickSelect) => {
		if (type === null) {
			setActiveQuickSelect(null);
			onDateRangeChange(null, null);
			return;
		}

		const monthsMap = { "1m": 1, "3m": 3, "6m": 6 };
		const [start, end] = getQuickSelectRange(monthsMap[type]);
		setActiveQuickSelect(type);
		onDateRangeChange(start, end);
	};

	const handleCustomDateChange = (start: string | null, end: string | null) => {
		setActiveQuickSelect(null);
		onDateRangeChange(start, end);
	};

	const formatDateDisplay = (date: string | null) => {
		if (!date) return "Select date";
		const d = new Date(date);
		return d.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const getDisplayText = () => {
		if (startDate && endDate) {
			return `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;
		}
		return "Select date range";
	};

	return (
		<div className="backdrop-blur-xl bg-white/10 dark:bg-gray-900/30 border border-white/20 dark:border-gray-700/50 p-4 rounded-2xl shadow-2xl">
			<div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
				<div className="flex items-center gap-2">
					<Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
					<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
						Date Range:
					</span>
				</div>

				<div className="flex flex-col sm:flex-row gap-3 flex-1 w-full lg:w-auto items-center">
					{/* Quick Select Buttons */}
					<div className="flex gap-2">
						<button
							onClick={() => handleQuickSelect(null)}
							className={cn(
								"px-4 py-2.5 rounded-xl font-medium transition-all duration-200",
								"border-2",
								!startDate && !endDate
									? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-lg"
									: "backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl"
							)}
						>
							All
						</button>
						<button
							onClick={() => handleQuickSelect("1m")}
							className={cn(
								"px-4 py-2.5 rounded-xl font-medium transition-all duration-200",
								"border-2",
								activeQuickSelect === "1m"
									? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-lg"
									: "backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl"
							)}
						>
							Last Month
						</button>
						<button
							onClick={() => handleQuickSelect("3m")}
							className={cn(
								"px-4 py-2.5 rounded-xl font-medium transition-all duration-200",
								"border-2",
								activeQuickSelect === "3m"
									? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-lg"
									: "backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl"
							)}
						>
							Last 3 Months
						</button>
						<button
							onClick={() => handleQuickSelect("6m")}
							className={cn(
								"px-4 py-2.5 rounded-xl font-medium transition-all duration-200",
								"border-2",
								activeQuickSelect === "6m"
									? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-lg"
									: "backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl"
							)}
						>
							Last 6 Months
						</button>
					</div>

					{/* Custom Date Range Picker - Button Style */}
					<Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
						<Popover.Trigger asChild>
							<button
								className={cn(
									"px-4 py-2.5 rounded-xl font-medium transition-all duration-200",
									"backdrop-blur-xl bg-white/80 dark:bg-gray-800/80",
									"border-2 border-gray-200 dark:border-gray-700",
									"hover:border-blue-400 dark:hover:border-blue-500",
									"data-[state=open]:border-blue-500 dark:data-[state=open]:border-blue-400",
									"data-[state=open]:ring-4 data-[state=open]:ring-blue-500/20",
									"text-gray-900 dark:text-gray-100",
									"shadow-lg hover:shadow-xl",
									"flex items-center gap-2",
									"focus:outline-none",
									"min-w-[220px] justify-between"
								)}
							>
								<span>{getDisplayText()}</span>
								<Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
							</button>
						</Popover.Trigger>

						<Popover.Portal>
							<Popover.Content
								className={cn(
									"backdrop-blur-xl bg-white/95 dark:bg-gray-800/95",
									"border-2 border-gray-200 dark:border-gray-700",
									"rounded-xl shadow-2xl",
									"p-4",
									"z-[9999]",
									"min-w-[300px]"
								)}
								sideOffset={8}
								align="start"
							>
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
											Custom Date Range
										</h3>
										{(startDate || endDate) && (
											<button
												onClick={() => {
													handleQuickSelect(null);
													setPopoverOpen(false);
												}}
												className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
											>
												<X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
											</button>
										)}
									</div>

									<div className="flex flex-col gap-3">
										<div>
											<label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
												Start Date
											</label>
											<input
												type="date"
												value={startDate || ""}
												onChange={(e) =>
													handleCustomDateChange(
														e.target.value || null,
														endDate
													)
												}
												className={cn(
													"w-full px-3 py-2 rounded-lg",
													"backdrop-blur-xl bg-white/80 dark:bg-gray-700/80",
													"border-2 border-gray-200 dark:border-gray-600",
													"hover:border-blue-400 dark:hover:border-blue-500",
													"focus:border-blue-500 dark:focus:border-blue-400",
													"focus:ring-2 focus:ring-blue-500/20",
													"text-gray-900 dark:text-gray-100",
													"transition-all duration-200",
													"focus:outline-none"
												)}
											/>
										</div>
										<div>
											<label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
												End Date
											</label>
											<input
												type="date"
												value={endDate || ""}
												onChange={(e) =>
													handleCustomDateChange(
														startDate,
														e.target.value || null
													)
												}
												className={cn(
													"w-full px-3 py-2 rounded-lg",
													"backdrop-blur-xl bg-white/80 dark:bg-gray-700/80",
													"border-2 border-gray-200 dark:border-gray-600",
													"hover:border-blue-400 dark:hover:border-blue-500",
													"focus:border-blue-500 dark:focus:border-blue-400",
													"focus:ring-2 focus:ring-blue-500/20",
													"text-gray-900 dark:text-gray-100",
													"transition-all duration-200",
													"focus:outline-none"
												)}
											/>
										</div>
									</div>
								</div>
							</Popover.Content>
						</Popover.Portal>
					</Popover.Root>
				</div>
			</div>
		</div>
	);
}
