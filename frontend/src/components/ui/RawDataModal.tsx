import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Database } from "lucide-react";
import { comparisonApi } from "@/services/api";

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
	const [data, setData] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!open || !sessionId || !fuelCategory || !market) return;

		const fetchRawData = async () => {
			setLoading(true);
			try {
				const response = await comparisonApi.getComparison(
					"raw",
					sessionId,
					false,
					fuelCategory,
					market,
					carriers.length > 0 ? carriers : undefined
				);
				setData(response.data.rows || []);
			} catch (error) {
				console.error("Failed to fetch raw data:", error);
				setData([]);
			} finally {
				setLoading(false);
			}
		};

		fetchRawData();
	}, [open, sessionId, fuelCategory, market, carriers]);

	const availableCarriers = carriers.length > 0 ? carriers : ["UPS", "FedEx", "DHL"];

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
				<Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[1400px] translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
					<div className="flex flex-col h-full max-h-[calc(85vh-3rem)]">
						{/* Header */}
						<div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
							<div className="flex items-center gap-3">
								<Database className="w-6 h-6 text-amber-500" />
								<div>
									<Dialog.Title className="text-xl font-bold text-gray-900 dark:text-gray-100">
										Raw Data View
									</Dialog.Title>
									<Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 mt-1">
										{market} · {fuelCategory} · {data.length} rows
									</Dialog.Description>
								</div>
							</div>
							<Dialog.Close asChild>
								<button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
									<X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
								</button>
							</Dialog.Close>
						</div>

						{/* Content */}
						{loading ? (
							<div className="flex-1 flex items-center justify-center">
								<div className="text-center">
									<div className="w-12 h-12 border-4 border-gray-300 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
									<p className="text-gray-600 dark:text-gray-400">Loading raw data...</p>
								</div>
							</div>
						) : data.length === 0 ? (
							<div className="flex-1 flex items-center justify-center">
								<p className="text-gray-500 dark:text-gray-400">No data available</p>
							</div>
						) : (
							<div className="flex-1 overflow-x-auto overflow-y-auto p-6">
								<div className={`flex gap-4 ${
									availableCarriers.filter(c => {
										const key = `${c.toLowerCase()}_pct`;
										return data.some((row: any) => row[key] !== null && row[key] !== undefined);
									}).length <= 2 ? 'justify-center' : 'min-w-fit'
								}`}>
									{availableCarriers.map((carrier) => {
										// Filter rows that have data for this carrier
										const carrierKey = `${carrier.toLowerCase()}_pct`;
										const carrierRows = data.filter((row: any) => 
											row[carrierKey] !== null && row[carrierKey] !== undefined
										);

										if (carrierRows.length === 0) return null;

										// Carrier colors - subtle accents
										const carrierAccents: Record<string, { border: string; bg: string; text: string }> = {
											UPS: { 
												border: "border-l-yellow-500", 
												bg: "bg-yellow-500/5 dark:bg-yellow-500/10",
												text: "text-yellow-700 dark:text-yellow-400"
											},
											FedEx: { 
												border: "border-l-purple-500", 
												bg: "bg-purple-500/5 dark:bg-purple-500/10",
												text: "text-purple-700 dark:text-purple-400"
											},
											DHL: { 
												border: "border-l-red-500", 
												bg: "bg-red-500/5 dark:bg-red-500/10",
												text: "text-red-700 dark:text-red-400"
											},
										};

										const accent = carrierAccents[carrier] || { 
											border: "border-l-gray-400", 
											bg: "bg-gray-500/5",
											text: "text-gray-700 dark:text-gray-400"
										};

										return (
											<div 
												key={carrier} 
												className={`flex-shrink-0 w-[320px] rounded-lg border border-gray-200 dark:border-gray-700 ${accent.border} border-l-4 overflow-hidden shadow-sm`}
											>
												<div className={`${accent.bg} px-4 py-3 border-b border-gray-200 dark:border-gray-700`}>
													<h3 className={`text-base font-semibold ${accent.text}`}>{carrier}</h3>
													<p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{carrierRows.length} price bands</p>
												</div>
												<div className="max-h-[500px] overflow-y-auto bg-white dark:bg-gray-800">
													<table className="w-full text-sm">
														<thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/95 backdrop-blur z-10">
															<tr className="border-b border-gray-200 dark:border-gray-700">
																<th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400 text-xs">
																	Price Range
																</th>
																<th className="text-right py-2 px-3 font-medium text-gray-600 dark:text-gray-400 text-xs">
																	Surcharge
																</th>
															</tr>
														</thead>
														<tbody>
															{carrierRows.map((row: any, idx: number) => (
																<tr
																	key={idx}
																	className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
																>
																	<td className="py-2 px-3 text-gray-700 dark:text-gray-300 font-mono text-xs">
																		{row.price_range}
																	</td>
																	<td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
																		{row[carrierKey].toFixed(2)}%
																	</td>
																</tr>
															))}
														</tbody>
													</table>
												</div>
											</div>
										);
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

