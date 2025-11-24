import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface RadialGaugeProps {
	value: number;
	maxValue?: number;
	color: string;
	size?: number;
	strokeWidth?: number;
	label?: string;
	sublabel?: string;
}

export default function RadialGauge({
	value,
	maxValue = 1.5,
	color,
	size = 140,
	strokeWidth = 12,
	label,
	sublabel,
}: RadialGaugeProps) {
	const percentage = useMemo(() => {
		return Math.min((value / maxValue) * 100, 100);
	}, [value, maxValue]);

	const data = useMemo(
		() => [
			{ name: "filled", value: percentage },
			{ name: "empty", value: 100 - percentage },
		],
		[percentage]
	);

	const displayValue = useMemo(() => {
		return value.toFixed(2);
	}, [value]);

	return (
		<div className="flex flex-col items-center">
			<div className="relative" style={{ width: size, height: size }}>
				<ResponsiveContainer width="100%" height="100%">
					<PieChart>
						<Pie
							data={data}
							cx="50%"
							cy="50%"
							startAngle={90}
							endAngle={-270}
							innerRadius={size / 2 - strokeWidth}
							outerRadius={size / 2}
							dataKey="value"
							stroke="none"
						>
							<Cell fill={color} />
							<Cell fill="rgba(156, 163, 175, 0.2)" />
						</Pie>
					</PieChart>
				</ResponsiveContainer>

				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<div
						className="text-2xl font-bold"
						style={{ color }}
					>
						{displayValue}
					</div>
					{label && (
						<div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
							{label}
						</div>
					)}
				</div>
			</div>

			{sublabel && (
				<div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center max-w-[140px]">
					{sublabel}
				</div>
			)}
		</div>
	);
}

