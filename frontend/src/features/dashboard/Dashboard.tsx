import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import AIInsights from "../insights/AIInsights";
import ExecutiveAnalysis from "../insights/ExecutiveAnalysis";
import WelcomeHeader from "./WelcomeHeader";
import ComparisonTable from "./ComparisonTable";
import ScrapeNow from "../scraper/ScrapeNow";
import HistoricalTrends from "../history/HistoricalTrends";
import Chatbot from "../chatbot/Chatbot";
import { MessageCircle, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { historyApi } from "@/services/api";
import { CustomSelect } from "@/components/ui/CustomSelect";

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
		"normalized" | "overlap" | "complete" | "comparable"
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

	const latestSession = sessions.length > 0 ? sessions[0] : null;

	return (
		<div className="space-y-6">
			{/* Welcome Header */}
			<WelcomeHeader lastUpdate={latestSession?.timestamp} />

			{/* AI Insights Summary */}
			<AIInsights />

			{/* Executive Analysis */}
			<ExecutiveAnalysis sessionId={selectedSessionId || undefined} />

			{/* Session Selector */}
			{sessions.length > 1 && (
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					className="backdrop-blur-xl bg-white/10 dark:bg-gray-900/30 border border-white/20 dark:border-gray-700/50 p-6 rounded-2xl shadow-2xl"
				>
					<div className="flex items-center gap-3 mb-4">
						<div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
							<Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
						</div>
						<h3 className="text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
							View Historical Data
						</h3>
					</div>
					<CustomSelect
						options={sessions.map((session) => ({
							value: session.id,
							label: `${formatDate(
								session.timestamp
							)} - ${session.carriers_scraped.join(", ")} (${
								session.total_rows
							} rows)`,
						}))}
						value={selectedSessionId || sessions[0].id}
						onChange={(value) => setSelectedSessionId(Number(value))}
						placeholder="Select a data snapshot"
					/>
				</motion.div>
			)}

			{/* View Selection Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<ViewCard
					title="Overlap View"
					description="Direct comparison - real data only"
					active={activeView === "overlap"}
					onClick={() => setActiveView("overlap")}
				/>
				<ViewCard
					title="Comparable Ranges"
					description="Grouped overlaps - 2+ carriers"
					active={activeView === "comparable"}
					onClick={() => setActiveView("comparable")}
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
			whileHover={{ scale: 1.02, y: -2 }}
			whileTap={{ scale: 0.98 }}
			onClick={onClick}
			transition={{ duration: 0.2, ease: "easeOut" }}
			className={cn(
				"p-4 rounded-xl cursor-pointer transition-all duration-200",
				active
					? "bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-2xl ring-2 ring-amber-500/50"
					: "backdrop-blur-xl bg-white/10 dark:bg-gray-900/30 border border-white/20 dark:border-gray-700/50 hover:shadow-2xl hover:border-amber-500/30"
			)}
		>
			<h3 className="font-semibold mb-1">{title}</h3>
			<p
				className={cn(
					"text-sm",
					active ? "text-white/90" : "text-gray-600 dark:text-gray-400"
				)}
			>
				{description}
			</p>
		</motion.div>
	);
}

import { cn } from "@/utils/cn";
