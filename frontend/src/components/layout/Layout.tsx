import { Sun, Moon, Clock } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { motion } from "framer-motion";

interface LayoutProps {
	children: React.ReactNode;
	lastUpdate?: string;
	isHistorical?: boolean;
}

export default function Layout({
	children,
	lastUpdate,
	isHistorical = false,
}: LayoutProps) {
	const { theme, toggleTheme } = useTheme();

	const formatLastUpdate = (timestamp?: string) => {
		if (!timestamp) return "No recent updates";

		// SQLite returns UTC timestamps without 'Z', so we need to append it
		const date = new Date(
			timestamp.includes("Z") ? timestamp : timestamp + "Z"
		);
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
		<div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
			{/* Header */}
			<header className="sticky top-0 z-50 glass dark:glass-dark">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between gap-4">
						<motion.div
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							className="flex items-center gap-3"
						>
							<div className="w-10 h-10 rounded-lg gradient-ups flex items-center justify-center text-white font-bold">
								RF
							</div>
							<div>
								<h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
									ReFuel
								</h1>
								<p className="text-xs text-gray-600 dark:text-gray-400">
									Competitive Intelligence
								</p>
							</div>
						</motion.div>

						<div className="flex items-center gap-3">
							{/* Last Update Time */}
							<motion.div
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg glass dark:glass-dark"
							>
								<Clock className="w-4 h-4 text-blue-500 dark:text-blue-400" />
								<div className="text-xs">
									<p className="text-gray-500 dark:text-gray-500">
										Last updated
									</p>
									<p className="font-semibold text-gray-700 dark:text-gray-300">
										{formatLastUpdate(lastUpdate)}
									</p>
								</div>
							</motion.div>

							{/* Status Badge */}
							<motion.div
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: 0.1 }}
								className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
									isHistorical
										? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20 dark:border-amber-500/30"
										: "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20 dark:border-green-500/30"
								}`}
							>
								<div
									className={`w-2 h-2 rounded-full ${
										isHistorical ? "bg-amber-500" : "bg-green-500 animate-pulse"
									}`}
								></div>
								<span
									className={`text-xs font-semibold ${
										isHistorical
											? "text-amber-700 dark:text-amber-400"
											: "text-green-700 dark:text-green-400"
									}`}
								>
									{isHistorical ? "Historical" : "Live Data"}
								</span>
							</motion.div>

							{/* Theme Toggle */}
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={toggleTheme}
								className="p-2 rounded-lg glass dark:glass-dark hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
							>
								{theme === "dark" ? (
									<Sun className="w-5 h-5 text-yellow-500" />
								) : (
									<Moon className="w-5 h-5 text-gray-700" />
								)}
							</motion.button>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-4 py-8">{children}</main>
		</div>
	);
}
