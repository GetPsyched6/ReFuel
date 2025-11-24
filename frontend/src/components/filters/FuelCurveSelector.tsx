import { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { X, Layers, ChevronDown } from "lucide-react";
import { fuelCurveApi } from "@/services/api";

interface CurveVersion {
	id: number;
	carrier: string;
	service: string;
	market: string;
	fuel_category: string;
	fuel_type: string;
	effective_date: string;
	label: string;
	session_id: number;
	is_active: boolean;
}

interface FuelCurveSelectorProps {
	selectedCarriers: string[];
	market: string;
	fuelCategory: string;
	selectedCurveVersions: Map<string, number[]>;
	onSelectionChange: (selections: Map<string, number[]>) => void;
}

export function FuelCurveSelector({
	selectedCarriers,
	market,
	fuelCategory,
	selectedCurveVersions,
	onSelectionChange,
}: FuelCurveSelectorProps) {
	const [open, setOpen] = useState(false);
	const [availableVersions, setAvailableVersions] = useState<
		Record<string, CurveVersion[]>
	>({});
	const [loading, setLoading] = useState(false);

	// Fetch available curve versions when filters change
	useEffect(() => {
		if (selectedCarriers.length === 0 || !market || !fuelCategory) {
			setAvailableVersions({});
			onSelectionChange(new Map());
			return;
		}

		const fetchVersions = async () => {
			setLoading(true);
			try {
				console.log('🔍 FuelCurveSelector fetching versions:', {
					market,
					fuelCategory,
					selectedCarriers
				});
				const response = await fuelCurveApi.getVersions(
					market,
					fuelCategory,
					selectedCarriers
				);
				console.log('✅ FuelCurveSelector received versions:', response.data);
				const versions = response.data.versions_by_carrier || {};
				setAvailableVersions(versions);
				console.log('📦 Available versions state set:', versions);

				// Auto-select ONLY active curves
				const newSelections = new Map<string, number[]>();
				Object.entries(versions).forEach(([carrier, carrierVersions]) => {
					const activeCurves = (carrierVersions as CurveVersion[])
						.filter((v) => v.is_active)
						.map((v) => v.id);
					if (activeCurves.length > 0) {
						newSelections.set(carrier, activeCurves);
					}
				});
				console.log('✨ Auto-selected active curves:', Array.from(newSelections.entries()));
				onSelectionChange(newSelections);
			} catch (error) {
				console.error("❌ Failed to fetch fuel curve versions:", error);
				setAvailableVersions({});
				onSelectionChange(new Map());
			} finally {
				setLoading(false);
			}
		};

		fetchVersions();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedCarriers, market, fuelCategory]);

	const toggleCurveVersion = (carrier: string, versionId: number) => {
		const newSelections = new Map(selectedCurveVersions);
		const current = newSelections.get(carrier) || [];

		if (current.includes(versionId)) {
			// Remove version
			const updated = current.filter((id) => id !== versionId);
			if (updated.length === 0) {
				newSelections.delete(carrier);
			} else {
				newSelections.set(carrier, updated);
			}
		} else {
			// Add version
			newSelections.set(carrier, [...current, versionId]);
		}

		onSelectionChange(newSelections);
	};

	const getSelectedCount = () => {
		let count = 0;
		selectedCurveVersions.forEach((versions) => {
			count += versions.length;
		});
		return count;
	};

	const getButtonText = () => {
		const count = getSelectedCount();
		if (count === 0) return "Select Fuel Curves";
		if (count === 1) return "1 curve selected";
		
		// Check if multiple carriers
		const carrierCount = selectedCurveVersions.size;
		if (carrierCount === 1) {
			return `${count} curves selected`;
		}
		return `${count} curves from ${carrierCount} carriers`;
	};

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger asChild>
				<button
					className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/80 dark:bg-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-700/80 transition-colors font-medium text-gray-900 dark:text-gray-100"
				>
					<Layers className="w-4 h-4" />
					<span className="text-sm">{getButtonText()}</span>
					{loading && (
						<div className="w-4 h-4 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
					)}
				</button>
			</Popover.Trigger>

			<Popover.Portal>
				<Popover.Content
					className="z-50 w-[520px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
					align="start"
					sideOffset={8}
				>
					{/* Header */}
					<div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
									Select Fuel Curves
								</h3>
								<p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
									Choose versions to compare
								</p>
							</div>
							<Popover.Close asChild>
								<button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
									<X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
								</button>
							</Popover.Close>
						</div>
					</div>

					{/* Content */}
					<div className="p-4">
						{loading ? (
							<div className="text-center py-8">
								<div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
									<div className="w-4 h-4 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
									<span>Loading curves...</span>
								</div>
							</div>
						) : selectedCarriers.length === 0 ? (
							<div className="text-center py-8">
								<Layers className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
								<p className="text-sm text-gray-600 dark:text-gray-400">
									No carriers selected
								</p>
							</div>
						) : (
							<div className="space-y-2 max-h-[400px] overflow-y-auto">
								{selectedCarriers.map((carrier) => {
									const versions = availableVersions[carrier] || [];
									const selectedVersionIds = selectedCurveVersions.get(carrier) || [];
									console.log(`📋 Rendering ${carrier}:`, {
										versionsCount: versions.length,
										versions: versions,
										selectedIds: selectedVersionIds
									});

									// Carrier colors
									const carrierAccents: Record<string, string> = {
										UPS: "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10",
										FedEx: "border-l-purple-500 bg-purple-50/50 dark:bg-purple-900/10",
										DHL: "border-l-red-500 bg-red-50/50 dark:bg-red-900/10",
									};

									const accentClass = carrierAccents[carrier] || "border-l-gray-400 bg-gray-50 dark:bg-gray-900/30";

									return (
										<div
											key={carrier}
											className={`rounded-md border border-gray-200 dark:border-gray-700 ${accentClass} border-l-[3px] overflow-hidden`}
										>
											<div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
												<span className="font-medium text-sm text-gray-900 dark:text-gray-100">
													{carrier}
												</span>
												{versions.length > 0 && (
													<span className="text-xs text-gray-500 dark:text-gray-400">
														{selectedVersionIds.length} of {versions.length} selected
													</span>
												)}
											</div>

											<div className="p-2 bg-white dark:bg-gray-800">
												{versions.length === 0 ? (
													<div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
														No versions available
													</div>
												) : (
													<div className="space-y-1">
														{versions.map((version) => (
															<label
																key={version.id}
																className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors group"
															>
																<input
																	type="checkbox"
																	checked={selectedVersionIds.includes(version.id)}
																	onChange={() => toggleCurveVersion(carrier, version.id)}
																	className="mt-0.5 w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
																/>
																<div className="flex-1 min-w-0">
																	<div className="text-sm font-medium text-gray-900 dark:text-gray-100">
																		{version.label}
																	</div>
																	<div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
																		{version.service}
																	</div>
																</div>
															</label>
														))}
													</div>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* Footer */}
					<div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
						<div className="text-sm text-gray-600 dark:text-gray-400">
							<span className="font-medium text-gray-900 dark:text-gray-100">
								{getSelectedCount()}
							</span>
							{" "}curve{getSelectedCount() !== 1 ? "s" : ""} selected
						</div>
						<Popover.Close asChild>
							<button className="px-4 py-1.5 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
								Apply
							</button>
						</Popover.Close>
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
