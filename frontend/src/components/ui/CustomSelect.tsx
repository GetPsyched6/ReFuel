import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
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
					"w-full px-4 py-3 rounded-xl",
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
				<Select.Value placeholder={placeholder} className="font-medium" />
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
									"relative flex items-center gap-3",
									"px-4 py-3 rounded-lg",
									"text-left cursor-pointer",
									"text-gray-700 dark:text-gray-300",
									"data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700/50",
									"data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-blue-600",
									"data-[state=checked]:text-white data-[state=checked]:font-semibold",
									"transition-all duration-150",
									"focus:outline-none"
								)}
							>
								<Select.ItemIndicator>
									<Check className="w-4 h-4" />
								</Select.ItemIndicator>
								<Select.ItemText className="data-[state=checked]:ml-0 ml-7">
									{option.label}
								</Select.ItemText>
							</Select.Item>
						))}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
	);
}
