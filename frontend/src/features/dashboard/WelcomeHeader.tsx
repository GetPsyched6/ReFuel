import { motion } from "framer-motion";
import { Clock, Activity } from "lucide-react";

interface WelcomeHeaderProps {
	lastUpdate?: string;
}

export default function WelcomeHeader({ lastUpdate }: WelcomeHeaderProps) {
	const getGreeting = () => {
		const hour = new Date().getHours();
		if (hour < 12) return "Good morning";
		if (hour < 18) return "Good afternoon";
		return "Good evening";
	};

	const formatLastUpdate = (timestamp?: string) => {
		if (!timestamp) return "No recent updates";

		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "Just now";
		if (diffMins < 60)
			return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
		if (diffHours < 24)
			return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
		if (diffDays === 1) return "Yesterday";
		if (diffDays < 7) return `${diffDays} days ago`;

		return date.toLocaleDateString();
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: -20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="glass dark:glass-dark p-6 rounded-2xl mb-6 border border-gray-200/50 dark:border-gray-700/50"
		>
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
				<div>
					<h1 className="text-3xl md:text-4xl font-bold mb-2">
						<span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent animate-gradient">
							{getGreeting()}
						</span>
					</h1>
					<p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
						<Activity className="w-4 h-4" />
						<span>Competitive Intelligence Dashboard</span>
					</p>
				</div>

				<div className="flex items-center gap-3 text-sm">
					<div className="flex items-center gap-2 px-4 py-2 rounded-lg glass dark:glass-dark">
						<Clock className="w-4 h-4 text-blue-500 dark:text-blue-400" />
						<div>
							<p className="text-xs text-gray-500 dark:text-gray-500">
								Last updated
							</p>
							<p className="font-semibold text-gray-700 dark:text-gray-300">
								{formatLastUpdate(lastUpdate)}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 dark:border-green-500/30">
						<div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
						<span className="text-xs font-semibold text-green-700 dark:text-green-400">
							Live Data
						</span>
					</div>
				</div>
			</div>
		</motion.div>
	);
}
