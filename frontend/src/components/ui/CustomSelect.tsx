import { ReactNode, useMemo } from "react";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/utils/cn";

interface SelectOption {
	value: string | number;
	label: string;
	description?: string;
	icon?: ReactNode;
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
	const selectedOption = useMemo(
		() => options.find((opt) => String(opt.value) === String(value)),
		[options, value]
	);

	return (
		<Select.Root
			value={String(value)}
			onValueChange={(newValue) => {
				// Convert back to number if original value was number
				const option = options.find((opt) => String(opt.value) === newValue);
				if (option) {
					onChange(option.value);
				}
			}}
		>
			<Select.Trigger
				className={cn(
					"w-full px-4 py-2.5 rounded-xl",
					"backdrop-blur-xl bg-white/80 dark:bg-gray-800/80",
					"border-2 border-gray-200 dark:border-gray-700",
					"hover:border-blue-400 dark:hover:border-blue-500",
					"data-[state=open]:border-blue-500 dark:data-[state=open]:border-blue-400",
					"data-[state=open]:ring-4 data-[state=open]:ring-blue-500/20",
					"flex items-center justify-between gap-3",
					"text-left text-gray-900 dark:text-gray-100",
					"shadow-lg hover:shadow-xl",
					"transition-all duration-200",
					"focus:outline-none",
					className
				)}
			>
				<div className="flex items-center gap-3 w-full">
					{selectedOption?.icon && (
						<span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100/80 dark:bg-gray-700/60 text-gray-700 dark:text-gray-100 flex-shrink-0">
							{selectedOption.icon}
						</span>
					)}
					<div className="flex flex-col min-w-0">
						<span className="font-semibold text-sm leading-tight truncate">
							{selectedOption?.label || placeholder}
						</span>
						{selectedOption?.description && (
							<span className="text-xs text-gray-600 dark:text-gray-400 leading-tight truncate">
								{selectedOption.description}
							</span>
						)}
					</div>
				</div>

				<Select.Icon>
					<ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
				</Select.Icon>
			</Select.Trigger>

			<Select.Portal>
				<Select.Content
					className={cn(
						"overflow-hidden",
						"backdrop-blur-xl bg-white/95 dark:bg-gray-800/95",
						"border-2 border-gray-200 dark:border-gray-700",
						"rounded-xl shadow-2xl",
						"z-[9999]"
					)}
					position="popper"
					sideOffset={8}
				>
					<Select.Viewport className="p-1">
						{options.map((option) => (
							<Select.Item
								key={option.value}
								value={String(option.value)}
								className={cn(
									"group relative flex items-center gap-3",
									"px-4 py-2.5 rounded-lg",
									"text-left cursor-pointer",
									"text-gray-700 dark:text-gray-300",
									"data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700/50",
									"data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-blue-600",
									"data-[state=checked]:text-white data-[state=checked]:font-semibold",
									"transition-all duration-150",
									"focus:outline-none"
								)}
							>
								<div className="flex items-stretch gap-3 w-full">
									{option.icon && (
										<span className="inline-flex items-center justify-center w-10 rounded-xl bg-white/30 dark:bg-gray-800/60 text-gray-700 dark:text-gray-100 self-stretch">
											{option.icon}
										</span>
									)}

									<div className="flex flex-col justify-center flex-1 min-w-0">
										<Select.ItemText asChild>
											<span className="font-semibold text-sm leading-tight text-left truncate">
												{option.label}
											</span>
										</Select.ItemText>
										{option.description && (
											<span className="text-xs text-gray-700 dark:text-gray-300/80 leading-tight text-left truncate transition-colors group-data-[state=checked]:text-white/80 group-data-[highlighted]:text-gray-900 dark:group-data-[highlighted]:text-gray-100">
												{option.description}
											</span>
										)}
									</div>

									<div className="flex items-center justify-center w-8 self-stretch">
										<Select.ItemIndicator className="flex items-center justify-center w-full h-full text-white">
											<Check className="w-4 h-4" />
										</Select.ItemIndicator>
									</div>
								</div>
							</Select.Item>
						))}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
	);
}
