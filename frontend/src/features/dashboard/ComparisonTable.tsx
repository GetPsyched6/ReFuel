import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { comparisonApi } from "@/services/api";
import { Loader2 } from "lucide-react";
import ComparisonChart from "./ComparisonChart";

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
	view: "normalized" | "overlap" | "complete";
	sessionId?: number;
}) {
	const [data, setData] = useState<ComparisonRow[]>([]);
	const [loading, setLoading] = useState(true);

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
				<Loader2 className="w-8 h-8 animate-spin text-ups-gold" />
			</Card>
		);
	}

	return (
		<>
			<Card glass>
				<h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-ups-brown to-ups-gold bg-clip-text text-transparent dark:from-ups-gold dark:to-yellow-300">
					Fuel Surcharge Comparison
				</h2>

				{view === "normalized" && (
					<div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
						<p className="text-sm text-amber-800 dark:text-amber-200">
							<strong>Note:</strong> This view shows actual scraped data only.
							Blank cells indicate no data available for that carrier in that
							price range.
						</p>
					</div>
				)}

				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b border-gray-200 dark:border-gray-700">
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
								const values = [row.ups_pct, row.fedex_pct, row.dhl_pct].filter(
									(v) => v !== null
								) as number[];
								const minValue = values.length > 0 ? Math.min(...values) : null;

								return (
									<tr
										key={idx}
										className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
									>
										<td className="py-3 px-4 font-medium">{row.price_range}</td>
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
			</Card>

			{/* Charts */}
			{!loading && data.length > 0 && (
				<ComparisonChart data={data} view={view} />
			)}
		</>
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
				"inline-block px-3 py-1 rounded-full font-semibold",
				isLowest
					? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
					: "text-gray-700 dark:text-gray-300"
			)}
		>
			{value.toFixed(1)}%
		</span>
	);
}

import { cn } from "@/utils/cn";
