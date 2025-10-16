import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

interface SelectOption {
	value: string | number;
	label: string;
}

interface CustomSelectProps {
	options: SelectOption[];
	value: string | number;
	onChange: (value: string | number) => void;
	placeholder?: string;
	className?: string;
}

export function CustomSelect({
	options,
	value,
	onChange,
	placeholder = "Select an option",
	className,
}: CustomSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [dropdownPosition, setDropdownPosition] = useState({
		top: 0,
		left: 0,
		width: 0,
	});
	const containerRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const selectedOption = options.find((opt) => opt.value === value);

	// Update dropdown position when opened
	useEffect(() => {
		if (isOpen && buttonRef.current) {
			const rect = buttonRef.current.getBoundingClientRect();
			setDropdownPosition({
				top: rect.bottom + window.scrollY + 8,
				left: rect.left + window.scrollX,
				width: rect.width,
			});
		}
	}, [isOpen]);

	// Close dropdown when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Node;
			// Check if click is outside both the button container AND the dropdown
			if (
				containerRef.current &&
				!containerRef.current.contains(target) &&
				dropdownRef.current &&
				!dropdownRef.current.contains(target)
			) {
				setIsOpen(false);
			}
		}

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Close dropdown when scrolling
	useEffect(() => {
		if (!isOpen) return;

		function handleScroll() {
			setIsOpen(false);
		}

		window.addEventListener("scroll", handleScroll, true);
		return () => window.removeEventListener("scroll", handleScroll, true);
	}, [isOpen]);

	return (
		<div ref={containerRef} className={cn("relative", className)}>
			{/* Select Button */}
			<motion.button
				ref={buttonRef}
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				whileHover={{ scale: 1.01 }}
				whileTap={{ scale: 0.99 }}
				className={cn(
					"w-full px-4 py-3 rounded-xl",
					"backdrop-blur-xl bg-white/80 dark:bg-gray-800/80",
					"border-2 transition-all duration-200",
					isOpen
						? "border-blue-500 dark:border-blue-400 ring-4 ring-blue-500/20"
						: "border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500",
					"flex items-center justify-between gap-3",
					"text-left text-gray-900 dark:text-gray-100",
					"shadow-lg hover:shadow-xl"
				)}
			>
				<span className="flex-1 font-medium">
					{selectedOption ? selectedOption.label : placeholder}
				</span>
				<motion.div
					animate={{ rotate: isOpen ? 180 : 0 }}
					transition={{ duration: 0.2 }}
				>
					<ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
				</motion.div>
			</motion.button>

			{/* Dropdown Menu - Portal to body */}
			{isOpen &&
				createPortal(
					<AnimatePresence>
						<motion.div
							ref={dropdownRef}
							initial={{ opacity: 0, y: -10, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: -10, scale: 0.95 }}
							transition={{ duration: 0.15 }}
							className={cn(
								"backdrop-blur-xl bg-white/95 dark:bg-gray-800/95",
								"border-2 border-gray-200 dark:border-gray-700",
								"rounded-xl shadow-2xl overflow-hidden"
							)}
							style={{
								position: "fixed",
								top: `${dropdownPosition.top}px`,
								left: `${dropdownPosition.left}px`,
								width: `${dropdownPosition.width}px`,
								zIndex: 9999,
							}}
						>
							<div className="max-h-64 overflow-y-auto py-1">
								{options.map((option, index) => (
									<motion.button
										key={option.value}
										type="button"
										initial={{ opacity: 0, x: -10 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: index * 0.03 }}
										onClick={() => {
											onChange(option.value);
											setIsOpen(false);
										}}
										className={cn(
											"w-full px-4 py-3 text-left transition-all duration-150",
											"flex items-center gap-3",
											option.value === value
												? "bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold"
												: "hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
										)}
									>
										{option.value === value && (
											<motion.div
												layoutId="selected-indicator"
												className="w-2 h-2 rounded-full bg-white"
												initial={{ scale: 0 }}
												animate={{ scale: 1 }}
												transition={{
													type: "spring",
													stiffness: 300,
													damping: 20,
												}}
											/>
										)}
										<span className={option.value === value ? "" : "ml-5"}>
											{option.label}
										</span>
									</motion.button>
								))}
							</div>
						</motion.div>
					</AnimatePresence>,
					document.body
				)}
		</div>
	);
}
