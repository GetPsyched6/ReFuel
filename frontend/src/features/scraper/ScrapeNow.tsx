import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { scraperApi } from "@/services/api";
import {
	Play,
	CheckCircle,
	XCircle,
	Loader2,
	ChevronDown,
	ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ScrapeNow({ onSuccess }: { onSuccess?: () => void }) {
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<any>(null);
	const [expanded, setExpanded] = useState(false);

	const handleScrape = async () => {
		setLoading(true);
		setResult(null);

		try {
			const response = await scraperApi.triggerScrape();
			setResult(response.data);
			setExpanded(true);
			if (response.data.status === "success" && onSuccess) {
				onSuccess();
			}
		} catch (error: any) {
			setResult({
				status: "failed",
				error: error.message,
			});
			setExpanded(true);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card glass>
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold mb-1">Manual Scrape</h3>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Trigger an on-demand scrape of all carriers
					</p>
				</div>

				<Button
					onClick={handleScrape}
					disabled={loading}
					className="min-w-[140px]"
				>
					{loading ? (
						<>
							<Loader2 className="w-4 h-4 animate-spin" />
							Scraping...
						</>
					) : (
						<>
							<Play className="w-4 h-4 fill-current" />
							Scrape Now
						</>
					)}
				</Button>
			</div>

			<AnimatePresence>
				{result && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="mt-4 overflow-hidden"
					>
						<div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50">
							<div className="flex items-center justify-between mb-3">
								<div className="flex items-center gap-2">
									{result.status === "success" ? (
										<CheckCircle className="w-5 h-5 text-green-500" />
									) : (
										<XCircle className="w-5 h-5 text-red-500" />
									)}
									<span className="font-semibold">
										{result.status === "success"
											? "Scrape Successful"
											: "Scrape Failed"}
									</span>
								</div>

								<button
									onClick={() => setExpanded(!expanded)}
									className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
								>
									{expanded ? (
										<ChevronUp className="w-4 h-4" />
									) : (
										<ChevronDown className="w-4 h-4" />
									)}
								</button>
							</div>

							{expanded && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									className="space-y-2 text-sm"
								>
									{result.error ? (
										<p className="text-red-600 dark:text-red-400">
											{result.error}
										</p>
									) : (
										<>
											<div className="flex justify-between">
												<span className="text-gray-600 dark:text-gray-400">
													Session ID:
												</span>
												<span className="font-mono">{result.session_id}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-600 dark:text-gray-400">
													Total Rows:
												</span>
												<span className="font-semibold">
													{result.total_rows}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-600 dark:text-gray-400">
													Carriers:
												</span>
												<span className="font-semibold">
													{result.carriers_scraped?.join(", ")}
												</span>
											</div>
										</>
									)}
								</motion.div>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</Card>
	);
}
