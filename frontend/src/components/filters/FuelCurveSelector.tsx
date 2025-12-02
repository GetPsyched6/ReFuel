import { useState, useEffect, useMemo, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Check, GitBranch } from "lucide-react";
import { cn } from "@/utils/cn";
import { getCarrierColor } from "@/theme/carriers";

interface FuelCurveVersion {
	id: number;
	carrier: string;
	service: string;
	market: string;
	fuel_category: string;
	effective_date: string;
	label: string;
	is_active: boolean;
	has_exact_date: boolean;
}

export interface SelectedCurve {
	id: number;
	carrier: string;
	label: string;
	effectiveDate: string;
	isActive: boolean;
}

interface FuelCurveSelectorProps {
	carriers: string[];
	market: string;
	fuelCategory: string;
	sessionId?: number;
	onSelectionChange?: (selectedCurves: SelectedCurve[]) => void;
}

// Format a fuel curve label from the data we have
function formatCurveLabel(version: FuelCurveVersion): string {
	const date = new Date(version.effective_date);
	const monthNames = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const month = monthNames[date.getMonth()];
	const day = date.getDate();
	const year = date.getFullYear();
	
	// Format date based on precision
	const hasExactDate = version.has_exact_date ?? true;
	const dateStr = hasExactDate ? `${month} ${day}, ${year}` : `${month} ${year}`;

	// Use label if it's descriptive (starts with "Pre"), otherwise generate from date
	if (version.is_active) {
		return `Current (${dateStr})`;
	} else {
		// Historical curve - use the label if it's a "Pre" label, otherwise generate
		if (version.label && version.label.startsWith("Pre")) {
			return version.label;
		}
		return `Historical (${dateStr})`;
	}
}

export default function FuelCurveSelector({
	carriers,
	market,
	fuelCategory,
	onSelectionChange,
}: FuelCurveSelectorProps) {
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [curveVersions, setCurveVersions] = useState<FuelCurveVersion[]>([]);
	const [selectedCurves, setSelectedCurves] = useState<Map<string, number[]>>(
		new Map()
	);
	const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
	
	// Refs for cancellation
	const abortControllerRef = useRef<AbortController | null>(null);
	
	// Stabilize carriers to prevent unnecessary fetches
	const carriersKey = useMemo(() => carriers.slice().sort().join(","), [carriers]);

	// Notify parent when selection changes
	useEffect(() => {
		if (onSelectionChange) {
			const allSelected: SelectedCurve[] = [];
			selectedCurves.forEach((ids) => {
				for (const id of ids) {
					const version = curveVersions.find((v) => v.id === id);
					if (version) {
						allSelected.push({
							id: version.id,
							carrier: version.carrier,
							label: formatCurveLabel(version),
							effectiveDate: version.effective_date,
							isActive: version.is_active,
						});
					}
				}
			});
			onSelectionChange(allSelected);
		}
	}, [selectedCurves, curveVersions, onSelectionChange]);

	// Fetch available curve versions when filters change
	useEffect(() => {
		if (carriers.length === 0) return;
		
		// Cancel previous request
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		
		const abortController = new AbortController();
		abortControllerRef.current = abortController;
		
		const fetchCurveVersions = async () => {
			try {
				const params = new URLSearchParams({
					market,
					fuel_category: fuelCategory,
					carriers: carriers.join(","),
				});
				const response = await fetch(
					`/api/fuel-curves/versions?${params.toString()}`,
					{ signal: abortController.signal }
				);
				
				if (abortController.signal.aborted) return;
				
				if (response.ok) {
					const data = await response.json();
					const allVersions: FuelCurveVersion[] = data.versions || [];

					setCurveVersions(allVersions);

					// Auto-select active curves for each carrier
					const initialSelection = new Map<string, number[]>();
					for (const carrier of carriers) {
						const carrierVersions = allVersions.filter(
							(v: FuelCurveVersion) => v.carrier === carrier && v.is_active
						);
						if (carrierVersions.length > 0) {
							initialSelection.set(
								carrier,
								carrierVersions.map((v: FuelCurveVersion) => v.id)
							);
						}
					}
					setSelectedCurves(initialSelection);
				}
			} catch (error: any) {
				if (error?.name === "AbortError") return;
				console.error("Failed to fetch curve versions:", error);
			}
		};

		fetchCurveVersions();
		
		return () => {
			abortController.abort();
		};
	}, [carriersKey, market, fuelCategory]); // Use carriersKey instead of carriers

	// Group versions by carrier
	const versionsByCarrier = useMemo(() => {
		const grouped = new Map<string, FuelCurveVersion[]>();
		for (const carrier of carriers) {
			grouped.set(
				carrier,
				curveVersions.filter((v) => v.carrier === carrier)
			);
		}
		return grouped;
	}, [curveVersions, carriers]);

	// Calculate summary for button text
	const totalCurves = useMemo(() => {
		let count = 0;
		selectedCurves.forEach((ids) => {
			count += ids.length;
		});
		return count;
	}, [selectedCurves]);

	const carriersWithCurves = useMemo(() => {
		let count = 0;
		selectedCurves.forEach((ids) => {
			if (ids.length > 0) count++;
		});
		return count;
	}, [selectedCurves]);

	const toggleCurve = (carrier: string, curveId: number) => {
		setSelectedCurves((prev) => {
			const newMap = new Map(prev);
			const current = newMap.get(carrier) || [];

			if (current.includes(curveId)) {
				// Don't allow deselecting the last curve
				if (current.length > 1) {
					newMap.set(
						carrier,
						current.filter((id) => id !== curveId)
					);
				}
			} else {
				newMap.set(carrier, [...current, curveId]);
			}

			return newMap;
		});
	};

	const toggleDropdown = (carrier: string, open: boolean) => {
		setOpenDropdowns((prev) => {
			const newSet = new Set(prev);
			if (open) {
				newSet.add(carrier);
			} else {
				newSet.delete(carrier);
			}
			return newSet;
		});
	};

	return (
		<Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
			<Popover.Trigger asChild>
				<button
					className={cn(
						"w-full px-4 py-2.5 rounded-xl",
						"backdrop-blur-xl bg-white/80 dark:bg-gray-800/80",
						"border-2 border-gray-200 dark:border-gray-700",
						"hover:border-amber-400 dark:hover:border-amber-500",
						"data-[state=open]:border-amber-500 dark:data-[state=open]:border-amber-400",
						"data-[state=open]:ring-4 data-[state=open]:ring-amber-500/20",
						"flex items-center justify-between gap-3",
						"text-left text-gray-900 dark:text-gray-100",
						"shadow-lg hover:shadow-xl",
						"transition-all duration-200",
						"focus:outline-none"
					)}
				>
					<div className="flex items-center gap-3">
						<span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100/80 dark:bg-gray-700/60 text-amber-600 dark:text-amber-400 flex-shrink-0">
							<GitBranch className="w-4 h-4" />
						</span>
						<div className="flex flex-col min-w-0">
							<span className="font-semibold text-sm leading-tight">
								{totalCurves} Fuel Curve{totalCurves !== 1 ? "s" : ""}
							</span>
							<span className="text-xs text-gray-600 dark:text-gray-400 leading-tight">
								from {carriersWithCurves} carrier
								{carriersWithCurves !== 1 ? "s" : ""}
							</span>
						</div>
					</div>
					<ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
				</button>
			</Popover.Trigger>

			<Popover.Portal>
				<Popover.Content
					className={cn(
						"backdrop-blur-xl bg-white/95 dark:bg-gray-800/95",
						"border-2 border-gray-200 dark:border-gray-700",
						"rounded-2xl shadow-2xl",
						"p-5",
						"z-[9999]",
						"min-w-[380px] max-w-[450px]"
					)}
					sideOffset={12}
					align="start"
				>
					<div className="space-y-4">
						<div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
							<GitBranch className="w-5 h-5 text-amber-500" />
							<h3 className="font-semibold text-gray-900 dark:text-gray-100">
								Select Fuel Curves
							</h3>
						</div>

						<div className="space-y-3">
							{carriers.map((carrier) => {
								const versions = versionsByCarrier.get(carrier) || [];
								const selected = selectedCurves.get(carrier) || [];
								const carrierColor = getCarrierColor(carrier);
								const isDropdownOpen = openDropdowns.has(carrier);

								// Get display text for the dropdown
								let dropdownText = "No curves available";
								if (versions.length > 0) {
									if (selected.length === 0) {
										dropdownText = "Select curve...";
									} else if (selected.length === 1) {
										const selectedVersion = versions.find(
											(v) => v.id === selected[0]
										);
										dropdownText = selectedVersion
											? formatCurveLabel(selectedVersion)
											: "Current Fuel Curve";
									} else {
										dropdownText = `${selected.length} curves selected`;
									}
								}

								return (
									<div key={carrier} className="flex items-center gap-4">
										{/* Carrier name with color indicator */}
										<div className="flex items-center gap-2 min-w-[80px]">
											<div
												className="w-3 h-3 rounded-full"
												style={{ backgroundColor: carrierColor }}
											/>
											<span className="font-medium text-gray-800 dark:text-gray-200">
												{carrier}
											</span>
										</div>

										{/* Curve dropdown */}
										<DropdownMenu.Root
											open={isDropdownOpen}
											onOpenChange={(open) => toggleDropdown(carrier, open)}
										>
											<DropdownMenu.Trigger asChild>
												<button
													disabled={versions.length === 0}
													className={cn(
														"flex-1 px-3 py-2 rounded-xl",
														"bg-gray-100/80 dark:bg-gray-700/80",
														"border border-gray-200 dark:border-gray-600",
														"hover:border-gray-300 dark:hover:border-gray-500",
														"data-[state=open]:border-amber-400 dark:data-[state=open]:border-amber-500",
														"flex items-center justify-between gap-2",
														"text-sm text-gray-700 dark:text-gray-300",
														"transition-all duration-150",
														"focus:outline-none",
														versions.length === 0 &&
															"opacity-50 cursor-not-allowed"
													)}
												>
													<span className="truncate">{dropdownText}</span>
													<ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400" />
												</button>
											</DropdownMenu.Trigger>

											<DropdownMenu.Portal>
												<DropdownMenu.Content
													className={cn(
														"backdrop-blur-xl bg-white/95 dark:bg-gray-800/95",
														"border border-gray-200 dark:border-gray-700",
														"rounded-xl shadow-xl",
														"p-1.5",
														"z-[10000]",
														"min-w-[220px]"
													)}
													sideOffset={6}
													align="start"
												>
													{versions.length === 0 ? (
														<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
															No curves available
														</div>
													) : (
														versions.map((version) => {
															const isSelected = selected.includes(version.id);
															return (
																<DropdownMenu.Item
																	key={version.id}
																	className={cn(
																		"flex items-center gap-2 px-3 py-2 rounded-lg",
																		"cursor-pointer outline-none",
																		"hover:bg-gray-100 dark:hover:bg-gray-700/50",
																		"transition-colors",
																		isSelected &&
																			"bg-amber-50 dark:bg-amber-900/20"
																	)}
																	onSelect={(e) => {
																		e.preventDefault();
																		toggleCurve(carrier, version.id);
																	}}
																>
																	<div
																		className={cn(
																			"w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
																			isSelected
																				? "bg-amber-500 border-amber-500"
																				: "border-gray-300 dark:border-gray-600"
																		)}
																	>
																		{isSelected && (
																			<Check className="w-3 h-3 text-white" />
																		)}
																	</div>
																	<span
																		className={cn(
																			"text-sm",
																			isSelected
																				? "text-amber-700 dark:text-amber-400 font-medium"
																				: "text-gray-700 dark:text-gray-300"
																		)}
																	>
																		{formatCurveLabel(version)}
																	</span>
																</DropdownMenu.Item>
															);
														})
													)}
												</DropdownMenu.Content>
											</DropdownMenu.Portal>
										</DropdownMenu.Root>
									</div>
								);
							})}
						</div>

						{/* Info footer */}
						<div className="pt-3 border-t border-gray-200 dark:border-gray-700">
							<p className="text-xs text-gray-500 dark:text-gray-400">
								Select multiple fuel curve versions to compare historical
								changes.
							</p>
						</div>
					</div>

					<Popover.Arrow className="fill-white dark:fill-gray-800" />
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
