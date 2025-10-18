import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { comparisonApi } from "@/services/api";
import { Loader2, BarChart3, Table as TableIcon } from "lucide-react";
import ComparisonChart from "./ComparisonChart";
import * as Tabs from "@radix-ui/react-tabs";

interface ComparisonRow {
	price_range: string;
	at_least_usd: number;
	but_less_than_usd: number;
	ups_pct: number | null;
	fedex_pct: number | null;
	dhl_pct: number | null;
}

export default function ComparisonTable({
	view,
	sessionId,
}: {
	view: "normalized" | "overlap" | "complete" | "comparable";
	sessionId?: number;
}) {
	const [data, setData] = useState<ComparisonRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [chartOrTable, setChartOrTable] = useState<"chart" | "table">("chart");

	useEffect(() => {
		loadData();
	}, [view, sessionId]);

	const loadData = async () => {
		setLoading(true);
		try {
			const response = await comparisonApi.getComparison(view, sessionId);
			setData(response.data.rows || []);
		} catch (error) {
			console.error("Failed to load comparison:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<Card glass className="flex items-center justify-center py-12">
				<Loader2 className="w-8 h-8 animate-spin text-blue-500 dark:text-blue-400" />
			</Card>
		);
	}

	return (
		<Card glass>
			<h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent animate-gradient">
				Fuel Surcharge Comparison
			</h2>

			<Tabs.Root
				value={chartOrTable}
				onValueChange={(v) => setChartOrTable(v as "chart" | "table")}
				className="w-full"
			>
				<Tabs.List className="flex gap-2 p-1 rounded-xl glass dark:glass-dark mb-6">
					<Tabs.Trigger
						value="chart"
						className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=inactive]:text-gray-700 dark:data-[state=inactive]:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50"
					>
						<BarChart3 className="w-4 h-4" />
						Chart View
					</Tabs.Trigger>
					<Tabs.Trigger
						value="table"
						className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=inactive]:text-gray-700 dark:data-[state=inactive]:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50"
					>
						<TableIcon className="w-4 h-4" />
						Table View
					</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="chart" className="focus:outline-none">
					{data.length > 0 ? (
						<ComparisonChart data={data} view={view} />
					) : (
						<div className="text-center py-8 text-gray-500 dark:text-gray-400">
							No data available for chart
						</div>
					)}
				</Tabs.Content>

				<Tabs.Content value="table" className="focus:outline-none">
					{view === "normalized" && (
						<div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
							<p className="text-sm text-amber-800 dark:text-amber-200">
								<strong>Note:</strong> This view shows actual scraped data only.
								Blank cells indicate no data available for that carrier in that
								price range.
							</p>
						</div>
					)}

					{view === "comparable" && (
						<div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
							<p className="text-sm text-blue-800 dark:text-blue-200">
								<strong>Comparable Ranges:</strong> Shows intersection ranges
								where at least 2 carriers have data. Perfect for side-by-side
								comparison.
							</p>
						</div>
					)}

					<div className="overflow-x-auto max-h-[850px] overflow-y-auto">
						<table className="w-full relative">
							<thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
								<tr className="border-b border-gray-200 dark:border-gray-700 shadow-sm">
									<th className="text-left py-3 px-4 font-semibold">
										Price Range
									</th>
									<th className="text-center py-3 px-4 font-semibold">UPS</th>
									<th className="text-center py-3 px-4 font-semibold">FedEx</th>
									<th className="text-center py-3 px-4 font-semibold">DHL</th>
								</tr>
							</thead>
							<tbody>
								{data.map((row, idx) => {
									const values = [
										row.ups_pct,
										row.fedex_pct,
										row.dhl_pct,
									].filter((v) => v !== null) as number[];
									const minValue =
										values.length > 0 ? Math.min(...values) : null;

									return (
										<tr
											key={idx}
											className="border-b border-gray-100 dark:border-gray-800 hover:bg-gradient-to-r hover:from-amber-50/50 hover:to-transparent dark:hover:from-amber-900/10 dark:hover:to-transparent transition-all duration-200"
										>
											<td className="py-3 px-4 font-medium">
												{row.price_range}
											</td>
											<td className="py-3 px-4 text-center">
												<SurchargeCell
													value={row.ups_pct}
													isLowest={row.ups_pct === minValue}
												/>
											</td>
											<td className="py-3 px-4 text-center">
												<SurchargeCell
													value={row.fedex_pct}
													isLowest={row.fedex_pct === minValue}
												/>
											</td>
											<td className="py-3 px-4 text-center">
												<SurchargeCell
													value={row.dhl_pct}
													isLowest={row.dhl_pct === minValue}
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{data.length === 0 && (
						<div className="text-center py-8 text-gray-500 dark:text-gray-400">
							No data available
						</div>
					)}
				</Tabs.Content>
			</Tabs.Root>
		</Card>
	);
}

function SurchargeCell({
	value,
	isLowest,
}: {
	value: number | null;
	isLowest: boolean;
}) {
	if (value === null) {
		return <span className="text-gray-400 dark:text-gray-600">-</span>;
	}

	return (
		<span
			className={cn(
				"inline-block px-3 py-1 rounded-full font-semibold transition-all duration-200 hover:scale-110",
				isLowest
					? "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-lg ring-2 ring-green-300/50 dark:ring-green-600/30"
					: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
			)}
		>
			{value.toFixed(2)}%
		</span>
	);
}

import { cn } from "@/utils/cn";
