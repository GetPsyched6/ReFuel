import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { aiApi } from "@/services/api";
import {
	FileText,
	TrendingUp,
	AlertTriangle,
	Target,
	Lightbulb,
} from "lucide-react";
import { motion } from "framer-motion";

interface ExecutiveAnalysisData {
	summary: string;
	key_findings: string[];
	opportunities: string[];
	risks: string[];
	trend_commentary: string;
}

interface ExecutiveAnalysisResponse {
	analysis: ExecutiveAnalysisData;
	metadata: {
		session_id: number;
		carriers_analyzed: string[];
		total_ranges: number;
		generated_at: string;
	};
}

export default function ExecutiveAnalysis({
	sessionId,
}: {
	sessionId?: number;
}) {
	const [analysis, setAnalysis] = useState<ExecutiveAnalysisResponse | null>(
		null
	);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadAnalysis();
	}, [sessionId]);

	const loadAnalysis = async () => {
		try {
			setLoading(true);
			const response = await aiApi.generateExecutiveAnalysis(sessionId);
			setAnalysis(response.data);
		} catch (error) {
			console.error("Failed to load executive analysis:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<Card
				glass
				className="border-l-4 border-purple-500 dark:border-purple-400"
			>
				<div className="space-y-6 animate-pulse">
					<div className="flex items-start gap-4">
						<div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
							<FileText className="w-6 h-6 text-purple-500 dark:text-purple-400 animate-pulse" />
						</div>
						<div className="flex-1">
							<div className="h-8 bg-gradient-to-r from-purple-300/30 to-blue-300/30 dark:from-purple-700/30 dark:to-blue-700/30 rounded mb-2 w-2/3"></div>
							<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
						</div>
					</div>
					<div className="space-y-4">
						<div className="h-24 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded"></div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
							<div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
						</div>
						<div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
					</div>
					<div className="text-center text-purple-600 dark:text-purple-400 font-semibold animate-pulse">
						🤖 AI is generating comprehensive executive analysis...
					</div>
				</div>
			</Card>
		);
	}

	if (!analysis?.analysis) {
		return null;
	}

	const { summary, key_findings, opportunities, risks, trend_commentary } =
		analysis.analysis;

	return (
		<Card
			glass
			className="border-l-4 border-purple-500 dark:border-purple-400 overflow-hidden"
		>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex items-start gap-4">
					<div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
						<FileText className="w-6 h-6 text-purple-500 dark:text-purple-400" />
					</div>

					<div className="flex-1">
						<h2 className="text-2xl font-bold mb-2 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
							Executive Analysis
							<span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 font-semibold">
								AI-Powered
							</span>
						</h2>
						<p className="text-sm text-gray-500 dark:text-gray-400">
							{analysis.metadata?.total_ranges || 0} price ranges analyzed
							{analysis.metadata?.carriers_analyzed &&
								` across ${analysis.metadata.carriers_analyzed.join(", ")}`}
						</p>
					</div>
				</div>

				{/* Executive Summary */}
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700/30"
				>
					<h3 className="font-semibold text-lg mb-2 text-purple-900 dark:text-purple-200">
						Executive Summary
					</h3>
					<p className="text-gray-700 dark:text-gray-300 leading-relaxed">
						{summary}
					</p>
				</motion.div>

				{/* Main Content Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{/* Key Findings */}
					<AnalysisSection
						title="Key Findings"
						items={key_findings}
						icon={<TrendingUp className="w-5 h-5" />}
						color="blue"
						delay={0.2}
					/>

					{/* Opportunities */}
					<AnalysisSection
						title="Opportunities"
						items={opportunities}
						icon={<Target className="w-5 h-5" />}
						color="green"
						delay={0.3}
					/>
				</div>

				{/* Risks */}
				{risks && risks.length > 0 && (
					<AnalysisSection
						title="Risks & Considerations"
						items={risks}
						icon={<AlertTriangle className="w-5 h-5" />}
						color="amber"
						delay={0.4}
					/>
				)}

				{/* Trend Commentary */}
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.5 }}
					className="p-4 rounded-xl glass dark:glass-dark border border-gray-200 dark:border-gray-700"
				>
					<div className="flex items-center gap-2 mb-2">
						<Lightbulb className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
						<h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
							Market Trends
						</h3>
					</div>
					<p className="text-gray-700 dark:text-gray-300 leading-relaxed">
						{trend_commentary}
					</p>
				</motion.div>
			</div>
		</Card>
	);
}

interface AnalysisSectionProps {
	title: string;
	items: string[];
	icon: React.ReactNode;
	color: "blue" | "green" | "amber";
	delay: number;
}

function AnalysisSection({
	title,
	items,
	icon,
	color,
	delay,
}: AnalysisSectionProps) {
	const colorClasses = {
		blue: {
			border: "border-blue-200 dark:border-blue-700/30",
			bg: "from-blue-50/50 to-blue-100/50 dark:from-blue-900/10 dark:to-blue-800/10",
			text: "text-blue-900 dark:text-blue-200",
			iconText: "text-blue-500 dark:text-blue-400",
		},
		green: {
			border: "border-green-200 dark:border-green-700/30",
			bg: "from-green-50/50 to-green-100/50 dark:from-green-900/10 dark:to-green-800/10",
			text: "text-green-900 dark:text-green-200",
			iconText: "text-green-500 dark:text-green-400",
		},
		amber: {
			border: "border-amber-200 dark:border-amber-700/30",
			bg: "from-amber-50/50 to-amber-100/50 dark:from-amber-900/10 dark:to-amber-800/10",
			text: "text-amber-900 dark:text-amber-200",
			iconText: "text-amber-500 dark:text-amber-400",
		},
	};

	const classes = colorClasses[color];

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay }}
			className={`p-4 rounded-xl bg-gradient-to-br ${classes.bg} border ${classes.border}`}
		>
			<div className="flex items-center gap-2 mb-3">
				<div className={classes.iconText}>{icon}</div>
				<h3 className={`font-semibold text-lg ${classes.text}`}>{title}</h3>
			</div>
			<ul className="space-y-2">
				{items.map((item, idx) => (
					<li
						key={idx}
						className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
					>
						<span className={`mt-1 ${classes.iconText}`}>•</span>
						<span className="flex-1">{item}</span>
					</li>
				))}
			</ul>
		</motion.div>
	);
}
