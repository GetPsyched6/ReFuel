import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

interface CardProps {
	children: React.ReactNode;
	className?: string;
	glass?: boolean;
	gradient?: boolean;
}

export function Card({
	children,
	className,
	glass = false,
	gradient = false,
}: CardProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className={cn(
				"rounded-xl p-6 shadow-lg transition-all duration-300 hover:shadow-2xl",
				glass &&
					"backdrop-blur-xl bg-white/10 dark:bg-gray-900/30 border border-white/20 dark:border-gray-700/50 shadow-2xl",
				gradient &&
					"bg-gradient-to-br from-white/90 to-gray-100/90 dark:from-gray-800/90 dark:to-gray-900/90",
				!glass && !gradient && "bg-white dark:bg-gray-800",
				className
			)}
		>
			{children}
		</motion.div>
	);
}
