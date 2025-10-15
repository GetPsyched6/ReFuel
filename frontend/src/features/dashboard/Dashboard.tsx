import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import AIInsights from "../insights/AIInsights";
import ComparisonTable from "./ComparisonTable";
import ScrapeNow from "../scraper/ScrapeNow";
import HistoricalTrends from "../history/HistoricalTrends";
import Chatbot from "../chatbot/Chatbot";
import { MessageCircle, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { historyApi } from "@/services/api";

interface Session {
	id: number;
	timestamp: string;
	status: string;
	carriers_scraped: string[];
	total_rows: number;
}

export default function Dashboard() {
	const [showChatbot, setShowChatbot] = useState(false);
	const [activeView, setActiveView] = useState<
		"normalized" | "overlap" | "complete"
	>("overlap");
	const [sessions, setSessions] = useState<Session[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
		null
	);

	useEffect(() => {
		loadSessions();
	}, []);

	const loadSessions = async () => {
		try {
			const response = await historyApi.getSessions();
			setSessions(response.data);
			// Auto-select latest session (first one)
			if (response.data.length > 0) {
				setSelectedSessionId(response.data[0].id);
			}
		} catch (error) {
			console.error("Failed to load sessions:", error);
		}
	};

	const formatDate = (timestamp: string) => {
		const date = new Date(timestamp);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div className="space-y-6">
			{/* AI Insights Summary */}
			<AIInsights />

			{/* Session Selector */}
			{sessions.length > 1 && (
				<div className="glass dark:glass-dark p-4 rounded-xl">
					<div className="flex items-center gap-4">
						<Calendar className="w-5 h-5 text-ups-gold" />
						<div className="flex-1">
							<label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
								View Historical Data
							</label>
							<select
								value={selectedSessionId || ""}
								onChange={(e) => setSelectedSessionId(Number(e.target.value))}
								className="w-full md:w-auto px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-ups-gold text-gray-900 dark:text-gray-100"
							>
								{sessions.map((session) => (
									<option key={session.id} value={session.id}>
										{formatDate(session.timestamp)} -{" "}
										{session.carriers_scraped.join(", ")} ({session.total_rows}{" "}
										rows)
									</option>
								))}
							</select>
						</div>
					</div>
				</div>
			)}

			{/* View Selection Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<ViewCard
					title="Overlap View"
					description="Direct comparison - real data only"
					active={activeView === "overlap"}
					onClick={() => setActiveView("overlap")}
				/>
				<ViewCard
					title="Normalized Grid"
					description="$0.25 intervals - actual data only"
					active={activeView === "normalized"}
					onClick={() => setActiveView("normalized")}
				/>
				<ViewCard
					title="Complete View"
					description="All data points from all carriers"
					active={activeView === "complete"}
					onClick={() => setActiveView("complete")}
				/>
			</div>

			{/* Comparison Table */}
			<ComparisonTable
				view={activeView}
				sessionId={selectedSessionId || undefined}
			/>

			{/* Historical Trends Chart */}
			<HistoricalTrends />

			{/* Scrape Now */}
			<ScrapeNow onSuccess={loadSessions} />

			{/* Chatbot Button */}
			<motion.div
				className="fixed bottom-6 right-6 z-50"
				initial={{ scale: 0 }}
				animate={{ scale: 1 }}
			>
				<Button
					variant="primary"
					size="lg"
					className="rounded-full w-14 h-14 p-0 shadow-2xl"
					onClick={() => setShowChatbot(!showChatbot)}
				>
					<MessageCircle className="w-6 h-6" />
				</Button>
			</motion.div>

			{/* Chatbot */}
			<AnimatePresence>
				{showChatbot && <Chatbot onClose={() => setShowChatbot(false)} />}
			</AnimatePresence>
		</div>
	);
}

function ViewCard({
	title,
	description,
	active,
	onClick,
}: {
	title: string;
	description: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<motion.div
			whileHover={{ scale: 1.02 }}
			whileTap={{ scale: 0.98 }}
			onClick={onClick}
			className={cn(
				"p-4 rounded-xl cursor-pointer transition-all duration-200",
				active
					? "gradient-ups text-white shadow-xl"
					: "glass dark:glass-dark hover:shadow-lg"
			)}
		>
			<h3 className="font-semibold mb-1">{title}</h3>
			<p
				className={cn(
					"text-sm",
					active ? "text-white/80" : "text-gray-600 dark:text-gray-400"
				)}
			>
				{description}
			</p>
		</motion.div>
	);
}

import { cn } from "@/utils/cn";
