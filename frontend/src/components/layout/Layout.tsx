import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { motion } from "framer-motion";

export default function Layout({ children }: { children: React.ReactNode }) {
	const { theme, toggleTheme } = useTheme();

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
			{/* Header */}
			<header className="sticky top-0 z-50 glass dark:glass-dark">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<motion.div
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							className="flex items-center gap-3"
						>
							<div className="w-10 h-10 rounded-lg gradient-ups flex items-center justify-center text-white font-bold">
								RF
							</div>
							<div>
								<h1 className="text-xl font-bold bg-gradient-to-r from-ups-brown to-ups-gold bg-clip-text text-transparent dark:from-ups-gold dark:to-yellow-300">
									ReFuel
								</h1>
								<p className="text-xs text-gray-600 dark:text-gray-400">
									Competitive Intelligence
								</p>
							</div>
						</motion.div>

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
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-4 py-8">{children}</main>
		</div>
	);
}
