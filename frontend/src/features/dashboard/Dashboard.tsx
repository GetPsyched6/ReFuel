import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import Layout from "@/components/layout/Layout";
import AITabbedView from "../insights/AITabbedView";
import ComparisonTable from "./ComparisonTable";
import ScrapeNow from "../scraper/ScrapeNow";
import HistoricalTrends from "../history/HistoricalTrends";
import Chatbot from "../chatbot/Chatbot";
import {
	MessageCircle,
	Calendar,
	Table as TableIcon,
	X,
	Loader2,
	Zap,
	BarChart3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { historyApi } from "@/services/api";
import { CustomSelect } from "@/components/ui/CustomSelect";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/utils/cn";

interface Session {
	id: number;
	timestamp: string;
	status: string;
	carriers_scraped: string[];
	total_rows: number;
}

interface HistoricalRow {
	id: number;
	at_least_usd: number;
	but_less_than_usd: number;
	surcharge_pct: number;
	service: string;
}

type HistoricalDetails = Record<string, HistoricalRow[]> | null;

export default function Dashboard() {
	const [showChatbot, setShowChatbot] = useState(false);
	const [sessions, setSessions] = useState<Session[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
		null
	);
	const [activeView, setActiveView] = useState<
		"normalized" | "overlap" | "complete" | "comparable"
	>("overlap");
	const [primaryTab, setPrimaryTab] = useState("ai");
	const [showHistoricalModal, setShowHistoricalModal] = useState(false);
	const [historicalDetails, setHistoricalDetails] =
		useState<HistoricalDetails>(null);
	const [modalLoading, setModalLoading] = useState(false);
	const [modalError, setModalError] = useState<string | null>(null);

	useEffect(() => {
		loadSessions();
	}, []);

	const loadSessions = async () => {
		try {
			const response = await historyApi.getSessions();
			setSessions(response.data);
			if (response.data.length > 0) {
				setSelectedSessionId(response.data[0].id);
			}
		} catch (error) {
			console.error("Failed to load sessions:", error);
		}
	};

	const formatDate = (timestamp: string) => {
		const date = new Date(
			timestamp.includes("Z") ? timestamp : timestamp + "Z"
		);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const latestSession = sessions.length > 0 ? sessions[0] : null;
	const isHistorical =
		selectedSessionId !== null &&
		latestSession !== null &&
		selectedSessionId !== latestSession.id;
	const currentSessionId = useMemo(
		() => selectedSessionId || sessions[0]?.id || null,
		[selectedSessionId, sessions]
	);
	const currentSession = useMemo(
		() => sessions.find((s) => s.id === currentSessionId),
		[sessions, currentSessionId]
	);

	const openHistoricalModal = async () => {
		if (!currentSessionId) return;
		setShowHistoricalModal(true);
		setModalLoading(true);
		setModalError(null);
		try {
			const response = await historyApi.getSessionDetails(currentSessionId);
			setHistoricalDetails(response.data);
		} catch (error) {
			console.error("Failed to load session details:", error);
			setModalError("Unable to load session details");
		} finally {
			setModalLoading(false);
		}
	};

	const closeHistoricalModal = () => {
		setShowHistoricalModal(false);
	};

	const renderHistoricalCard = () => {
		if (sessions.length <= 1) return null;

		// Check if current session has different data from previous (not just row count)
		// Always show notification when viewing live data with historical sessions available
		const hasDataChanged = sessions.length >= 2 && !isHistorical;

		return (
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				className="backdrop-blur-xl bg-white/10 dark:bg-gray-900/30 border border-white/20 dark:border-gray-700/50 p-4 rounded-2xl shadow-2xl"
			>
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
							<Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h3 className="text-base font-semibold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
									View Historical Data
								</h3>
								{hasDataChanged && (
									<span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-lg">
										DATA UPDATED
									</span>
								)}
							</div>
							<p className="text-xs text-gray-600 dark:text-gray-400">
								{hasDataChanged
									? "Current session has different surcharge rates from previous week"
									: "Review past sessions"}
							</p>
						</div>
					</div>
					<div className="flex gap-2 w-full md:w-auto">
						<CustomSelect
							options={sessions.map((session) => ({
								value: session.id,
								label: `${formatDate(
									session.timestamp
								)} - ${session.carriers_scraped.join(", ")} (${
									session.total_rows
								} rows)`,
							}))}
							value={currentSessionId || sessions[0].id}
							onChange={(value) => setSelectedSessionId(Number(value))}
							placeholder="Select a data snapshot"
						/>
						<Button
							variant="secondary"
							className="flex items-center gap-2 px-3 whitespace-nowrap"
							onClick={openHistoricalModal}
						>
							<TableIcon className="w-4 h-4" />
							<span className="hidden sm:inline">View Raw Tables</span>
							<span className="sm:hidden">Tables</span>
						</Button>
					</div>
				</div>
			</motion.div>
		);
	};

	return (
		<Layout lastUpdate={latestSession?.timestamp} isHistorical={isHistorical}>
			<div className="space-y-6">
				{renderHistoricalCard()}

				<Tabs.Root
					value={primaryTab}
					onValueChange={setPrimaryTab}
					className="space-y-6"
				>
					<Tabs.List className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Tabs.Trigger value="ai" asChild>
							<motion.button
								whileHover={{ scale: 1.02, y: -2 }}
								whileTap={{ scale: 0.98 }}
								className="p-5 rounded-2xl backdrop-blur-xl bg-gray-200/40 dark:bg-gray-900/30 border border-gray-300/40 dark:border-gray-700/50 hover:shadow-2xl hover:border-purple-400/30 dark:hover:border-purple-500/30 transition-all duration-200 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-2xl data-[state=active]:ring-2 data-[state=active]:ring-purple-400/50 text-left"
							>
								<div className="flex items-center gap-2 mb-2">
									<Zap className="w-5 h-5" />
									<h2 className="text-lg font-semibold">
										AI Competitive Intelligence
									</h2>
								</div>
								<p className="text-sm opacity-80">
									Executive analysis, quick gaps, and pricing recommendations
								</p>
							</motion.button>
						</Tabs.Trigger>
						<Tabs.Trigger value="charts" asChild>
							<motion.button
								whileHover={{ scale: 1.02, y: -2 }}
								whileTap={{ scale: 0.98 }}
								className="p-5 rounded-2xl backdrop-blur-xl bg-gray-200/40 dark:bg-gray-900/30 border border-gray-300/40 dark:border-gray-700/50 hover:shadow-2xl hover:border-amber-400/30 dark:hover:border-amber-500/30 transition-all duration-200 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-600 data-[state=active]:to-amber-800 data-[state=active]:text-white data-[state=active]:shadow-2xl data-[state=active]:ring-2 data-[state=active]:ring-amber-500/50 text-left"
							>
								<div className="flex items-center gap-2 mb-2">
									<BarChart3 className="w-5 h-5" />
									<h2 className="text-lg font-semibold">Charts & Tables</h2>
								</div>
								<p className="text-sm opacity-80">
									Comparison views, historical trends, and raw data tables
								</p>
							</motion.button>
						</Tabs.Trigger>
					</Tabs.List>

					<Tabs.Content
						value="ai"
						className="space-y-6"
						forceMount
						hidden={primaryTab !== "ai"}
					>
						<AITabbedView sessionId={currentSessionId || undefined} />
					</Tabs.Content>

					<Tabs.Content
						value="charts"
						className="space-y-6"
						forceMount
						hidden={primaryTab !== "charts"}
					>
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

						<ComparisonTable
							view={activeView}
							sessionId={currentSessionId || undefined}
						/>

						<HistoricalTrends />
					</Tabs.Content>
				</Tabs.Root>

				<ScrapeNow onSuccess={loadSessions} />

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

				<AnimatePresence>
					{showChatbot && <Chatbot onClose={() => setShowChatbot(false)} />}
				</AnimatePresence>

				<AnimatePresence>
					{showHistoricalModal && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="fixed inset-0 z-50 flex items-center justify-center"
						>
							<div
								className="absolute inset-0 bg-black/60"
								onClick={closeHistoricalModal}
							></div>
							<motion.div
								initial={{ scale: 0.95, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								exit={{ scale: 0.95, opacity: 0 }}
								className="relative z-50 max-w-6xl w-full mx-4 rounded-3xl overflow-hidden backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 border border-white/20 dark:border-gray-700/40 shadow-3xl"
							>
								<div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
									<div>
										<h3 className="text-xl font-semibold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
											Session Details
										</h3>
										<p className="text-sm text-gray-600 dark:text-gray-400">
											{currentSession
												? formatDate(currentSession.timestamp)
												: ""}
										</p>
									</div>
									<button
										onClick={closeHistoricalModal}
										className="p-2 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors"
										aria-label="Close session details"
									>
										<X className="w-5 h-5" />
									</button>
								</div>
								<div className="p-6">
									{modalLoading ? (
										<div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 gap-2">
											<Loader2 className="w-5 h-5 animate-spin" />
											<span>Loading session details...</span>
										</div>
									) : modalError ? (
										<div className="text-center py-12 text-red-500 dark:text-red-300">
											{modalError}
										</div>
									) : historicalDetails ? (
										<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
											{["UPS", "FedEx", "DHL"].map((carrier) => (
												<div
													key={carrier}
													className="backdrop-blur-xl bg-white/60 dark:bg-gray-800/40 border border-white/40 dark:border-gray-700/40 rounded-2xl shadow-lg overflow-hidden"
												>
													<div
														className={cn(
															"px-4 py-3 text-sm font-semibold",
															carrier === "UPS"
																? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
																: carrier === "DHL"
																? "bg-gradient-to-r from-blue-500 to-sky-500 text-white"
																: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
														)}
													>
														{carrier} Data
													</div>
													<div className="max-h-[420px] overflow-y-auto">
														<table className="w-full text-sm">
															<thead className="sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
																<tr>
																	<th className="text-left py-2 px-3">
																		Service
																	</th>
																	<th className="text-left py-2 px-3">
																		Price Range
																	</th>
																	<th className="text-right py-2 px-3">
																		Surcharge %
																	</th>
																</tr>
															</thead>
															<tbody>
																{(historicalDetails[carrier] || []).map(
																	(row) => (
																		<tr
																			key={row.id}
																			className="border-b border-gray-100 dark:border-gray-800"
																		>
																			<td className="py-2 px-3 text-gray-600 dark:text-gray-300">
																				{row.service}
																			</td>
																			<td className="py-2 px-3 text-gray-700 dark:text-gray-200">
																				{`${row.at_least_usd.toFixed(
																					2
																				)} - ${row.but_less_than_usd.toFixed(
																					2
																				)}`}
																			</td>
																			<td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
																				{row.surcharge_pct.toFixed(2)}%
																			</td>
																		</tr>
																	)
																)}
																{(historicalDetails[carrier] || []).length ===
																	0 && (
																	<tr>
																		<td
																			colSpan={3}
																			className="py-6 text-center text-gray-500 dark:text-gray-400"
																		>
																			No data for this carrier
																		</td>
																	</tr>
																)}
															</tbody>
														</table>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="text-center py-12 text-gray-500 dark:text-gray-400">
											No data available
										</div>
									)}
								</div>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</Layout>
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
					: "bg-white/70 dark:bg-gray-900/30 border-2 border-gray-300 dark:border-gray-700/50 hover:shadow-2xl hover:border-amber-500/30 hover:bg-white/90 dark:hover:bg-gray-800/40"
			)}
		>
			<h3
				className={cn(
					"font-semibold mb-1",
					active ? "text-white" : "text-gray-900 dark:text-white"
				)}
			>
				{title}
			</h3>
			<p
				className={cn(
					"text-sm",
					active ? "text-white/90" : "text-gray-700 dark:text-gray-400"
				)}
			>
				{description}
			</p>
		</motion.div>
	);
}
