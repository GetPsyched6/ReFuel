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
			className={cn(
				"rounded-xl p-6 shadow-lg",
				glass && "glass dark:glass-dark",
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
