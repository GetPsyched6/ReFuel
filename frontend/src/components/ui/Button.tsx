import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/utils/cn";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
	children: React.ReactNode;
	variant?: "primary" | "secondary" | "ghost";
	size?: "sm" | "md" | "lg";
}

export function Button({
	children,
	className,
	variant = "primary",
	size = "md",
	disabled,
	...props
}: ButtonProps) {
	const variants = {
		primary: "gradient-ups text-white hover:opacity-90",
		secondary:
			"bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600",
		ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800",
	};

	const sizes = {
		sm: "px-3 py-1.5 text-sm",
		md: "px-4 py-2",
		lg: "px-6 py-3 text-lg",
	};

	return (
		<motion.button
			whileHover={disabled ? undefined : { scale: 1.02 }}
			whileTap={disabled ? undefined : { scale: 0.98 }}
			className={cn(
				"rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2",
				variants[variant],
				sizes[size],
				disabled && "opacity-50 cursor-not-allowed",
				className
			)}
			disabled={disabled}
			{...props}
		>
			{children}
		</motion.button>
	);
}
