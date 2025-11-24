import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Database } from "lucide-react";
import { comparisonApi, fuelCurveApi } from "@/services/api";

interface FuelCurveVersion {
	id: number;
	carrier: string;
	is_active: boolean;
	effective_date: string;
	service: string;
}

interface CurveWithData {
	version: FuelCurveVersion;
	rows: any[];
}

interface RawDataModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sessionId?: number;
	fuelCategory?: string;
	market?: string;
	carriers?: string[];
}

export function RawDataModal({
	open,
	onOpenChange,
	sessionId,
	fuelCategory,
	market,
	carriers = [],
}: RawDataModalProps) {
	const [curveData, setCurveData] = useState<Map<string, CurveWithData[]>>(new Map());
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!open || !sessionId || !fuelCategory || !market) return;

		const fetchAllCurveData = async () => {
			setLoading(true);
			try {
				// First fetch current session raw data
				const response = await comparisonApi.getComparison(
					"raw",
					sessionId,
					false,
					fuelCategory,
					market,
					carriers.length > 0 ? carriers : undefined
				);
				const currentData = response.data.rows || [];

				// Fetch all curve versions for this filter
				const versionsResponse = await fuelCurveApi.getVersions(
					market,
					fuelCategory,
					carriers.length > 0 ? carriers : undefined
				);
				const versions: FuelCurveVersion[] = versionsResponse.data.versions || [];

				// Group by carrier
				const dataByCarrier = new Map<string, CurveWithData[]>();
				const targetCarriers = carriers.length > 0 ? carriers : ["UPS", "FedEx", "DHL"];

				for (const carrier of targetCarriers) {
					const carrierVersions = versions.filter((v) => v.carrier === carrier);
					const carrierCurves: CurveWithData[] = [];

					// First, add active/current curve from main data
					const activeVersion = carrierVersions.find((v) => v.is_active);
					const carrierKey = `${carrier.toLowerCase()}_pct`;
					const currentCarrierRows = currentData.filter(
						(row: any) => row[carrierKey] !== null && row[carrierKey] !== undefined
					);

					if (currentCarrierRows.length > 0 && activeVersion) {
						carrierCurves.push({
							version: activeVersion,
							rows: currentCarrierRows.map((row: any) => ({
								price_range: row.price_range,
								at_least_usd: row.at_least_usd,
								but_less_than_usd: row.but_less_than_usd,
								surcharge_pct: row[carrierKey],
							})),
						});
					}

					// Then fetch historical versions
					const historicalVersions = carrierVersions.filter((v) => !v.is_active);
					for (const version of historicalVersions) {
						try {
							const historicalResponse = await fetch(
								`/api/comparison/compare?curve_version_ids=${version.id}&view=raw`
							);
							if (historicalResponse.ok) {
								const historicalData = await historicalResponse.json();
								if (historicalData.curves && historicalData.curves.length > 0) {
									carrierCurves.push({
										version,
										rows: historicalData.curves[0].rows || [],
									});
								}
							}
						} catch (err) {
							console.error(`Failed to fetch historical curve ${version.id}:`, err);
						}
					}

					if (carrierCurves.length > 0) {
						dataByCarrier.set(carrier, carrierCurves);
					}
				}

				setCurveData(dataByCarrier);
			} catch (error) {
				console.error("Failed to fetch raw data:", error);
				setCurveData(new Map());
			} finally {
				setLoading(false);
			}
		};

		fetchAllCurveData();
	}, [open, sessionId, fuelCategory, market, carriers]);

	// Count total tables for layout
	const totalTables = Array.from(curveData.values()).reduce(
		(sum, curves) => sum + curves.length,
		0
	);

	// Carrier accent colors
	const carrierColors: Record<string, string> = {
		UPS: "#FFB500",
		FedEx: "#6B21A8",
		DHL: "#D40511",
	};

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
				<Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[1400px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-gray-50 dark:bg-gray-900 p-0 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 overflow-hidden">
					<div className="flex flex-col h-full max-h-[85vh]">
						{/* Header */}
						<div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
									<Database className="w-5 h-5 text-amber-600 dark:text-amber-400" />
								</div>
								<div>
									<Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
										Raw Fuel Curve Data
									</Dialog.Title>
									<Dialog.Description className="text-sm text-gray-500 dark:text-gray-400">
										{market?.toUpperCase()} · {fuelCategory?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} · {totalTables} version{totalTables !== 1 ? "s" : ""}
									</Dialog.Description>
								</div>
							</div>
							<Dialog.Close asChild>
								<button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
									<X className="w-5 h-5 text-gray-400" />
								</button>
							</Dialog.Close>
						</div>

						{/* Content */}
						{loading ? (
							<div className="flex-1 flex items-center justify-center py-20">
								<div className="text-center">
									<div className="w-10 h-10 border-3 border-gray-300 border-t-amber-500 rounded-full animate-spin mx-auto mb-3" />
									<p className="text-sm text-gray-500 dark:text-gray-400">Loading data...</p>
								</div>
							</div>
						) : curveData.size === 0 ? (
							<div className="flex-1 flex items-center justify-center py-20">
								<p className="text-gray-400">No data available</p>
							</div>
						) : (
							<div className="flex-1 overflow-x-auto overflow-y-auto p-6">
								<div className="flex gap-6 justify-center flex-wrap">
									{Array.from(curveData.entries()).map(([carrier, curves]) => {
										const baseColor = carrierColors[carrier] || "#6B7280";

										return curves.map((curveWithData) => {
											const isActive = curveWithData.version.is_active;
											const rows = curveWithData.rows;
											// Use base color for active, slightly muted for historical
											const accentColor = isActive ? baseColor : `${baseColor}99`;

											return (
												<div
													key={`${carrier}-${curveWithData.version.id}`}
													className="flex-shrink-0 w-[300px] bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700/50"
												>
													{/* Accent bar */}
													<div 
														className="h-1.5" 
														style={{ background: accentColor }}
													/>
													
													{/* Card Header */}
													<div className="px-5 py-4">
														<div className="flex items-start justify-between gap-3">
															<div className="flex-1 min-w-0">
																<h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-0.5">
																	{carrier}
																</h3>
																<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
																	{curveWithData.version.service}
																</p>
															</div>
															<span className={`flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${
																isActive 
																	? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
																	: "bg-gray-100 dark:bg-gray-700/70 text-gray-600 dark:text-gray-300"
															}`}>
																{isActive ? "Current" : "Historical"}
															</span>
														</div>
														<div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-500">
															<span>{formatDate(curveWithData.version.effective_date)}</span>
															<span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
															<span>{rows.length} price bands</span>
														</div>
													</div>
													
													{/* Table */}
													<div className="border-t border-gray-100 dark:border-gray-700/50">
														<div className="max-h-[300px] overflow-y-auto">
															<table className="w-full">
																<thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/80 backdrop-blur-sm">
																	<tr>
																		<th className="text-left py-2.5 px-4 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
																			Price Range
																		</th>
																		<th className="text-right py-2.5 px-4 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
																			Surcharge
																		</th>
																	</tr>
																</thead>
																<tbody>
																	{rows.map((row: any, rowIdx: number) => (
																		<tr
																			key={rowIdx}
																			className={`${
																				rowIdx % 2 === 0 
																					? "bg-white dark:bg-gray-800" 
																					: "bg-gray-50/50 dark:bg-gray-800/50"
																			} hover:bg-gray-100/70 dark:hover:bg-gray-700/30 transition-colors`}
																		>
																			<td className="py-2 px-4 text-sm text-gray-700 dark:text-gray-300 font-mono">
																				{row.price_range}
																			</td>
																			<td className="py-2 px-4 text-right">
																				<span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
																					{row.surcharge_pct?.toFixed(2)}%
																				</span>
																			</td>
																		</tr>
																	))}
																</tbody>
															</table>
														</div>
													</div>
												</div>
											);
										});
									})}
								</div>
							</div>
						)}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

