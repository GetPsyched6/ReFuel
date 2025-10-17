import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

interface TooltipProps {
	content: string;
	children: React.ReactNode;
	side?: "top" | "right" | "bottom" | "left";
	align?: "start" | "center" | "end";
}

export const Tooltip: React.FC<TooltipProps> = ({
	content,
	children,
	side = "top",
	align = "center",
}) => {
	return (
		<TooltipPrimitive.Provider delayDuration={200}>
			<TooltipPrimitive.Root>
				<TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
				<TooltipPrimitive.Portal>
					<TooltipPrimitive.Content
						side={side}
						align={align}
						sideOffset={5}
						className="z-50 max-w-[300px] px-3 py-2 text-sm text-white bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700/50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
					>
						{content}
						<TooltipPrimitive.Arrow className="fill-gray-900/95 dark:fill-gray-800/95" />
					</TooltipPrimitive.Content>
				</TooltipPrimitive.Portal>
			</TooltipPrimitive.Root>
		</TooltipPrimitive.Provider>
	);
};
