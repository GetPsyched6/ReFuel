import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
	X,
	Settings,
	Save,
	Globe,
	Clock,
	ChevronDown,
	Check,
	Truck,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import * as Popover from "@radix-ui/react-popover";
import { getCarrierBrandColor } from "@/theme/carriers";
import { cn } from "@/utils/cn";

interface CarrierSettings {
	countries: string[];
	repeatEvery: number;
	repeatUnit: "day" | "week" | "month";
	repeatOnDays: number[]; // 0-6 for Sun-Sat, only used when repeatUnit is "week"
	repeatOnDate: number; // 1-31, only used when repeatUnit is "month"
}

interface ScraperSettings {
	carriers: Record<string, CarrierSettings>;
}

interface CarrierConfig {
	name: string;
	availableCountries: string[];
}

const CARRIERS: CarrierConfig[] = [
	{ name: "UPS", availableCountries: ["US", "DE"] },
	{ name: "FedEx", availableCountries: ["US", "DE"] },
	{ name: "DHL", availableCountries: ["DE"] }, // DHL only has DE
];

const COUNTRIES: Record<string, { name: string; flag: string }> = {
	US: { name: "United States", flag: "🇺🇸" },
	DE: { name: "Germany", flag: "🇩🇪" },
};

const DAYS_OF_WEEK = [
	{ short: "S", full: "Sun", value: 0 },
	{ short: "M", full: "Mon", value: 1 },
	{ short: "T", full: "Tue", value: 2 },
	{ short: "W", full: "Wed", value: 3 },
	{ short: "T", full: "Thu", value: 4 },
	{ short: "F", full: "Fri", value: 5 },
	{ short: "S", full: "Sat", value: 6 },
];

const DEFAULT_SETTINGS: ScraperSettings = {
	carriers: {
		UPS: { countries: ["US", "DE"], repeatEvery: 1, repeatUnit: "week", repeatOnDays: [1], repeatOnDate: 1 },
		FedEx: { countries: ["US", "DE"], repeatEvery: 1, repeatUnit: "week", repeatOnDays: [1], repeatOnDate: 1 },
		DHL: { countries: ["DE"], repeatEvery: 1, repeatUnit: "week", repeatOnDays: [1], repeatOnDate: 1 },
	},
};

const STORAGE_KEY = "refuel_scraper_settings";

function loadSettings(): ScraperSettings {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			return JSON.parse(saved);
		}
	} catch (e) {
		console.error("Failed to load settings:", e);
	}
	return DEFAULT_SETTINGS;
}

function saveSettings(settings: ScraperSettings) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch (e) {
		console.error("Failed to save settings:", e);
	}
}

function getOrdinalSuffix(n: number): string {
	const s = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatFrequencyLabel(settings: CarrierSettings): string {
	const { repeatEvery, repeatUnit, repeatOnDays, repeatOnDate } = settings;
	
	if (repeatUnit === "day") {
		return repeatEvery === 1 ? "Daily" : `Every ${repeatEvery} days`;
	}
	
	if (repeatUnit === "week") {
		const dayNames = repeatOnDays
			.sort((a, b) => a - b)
			.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.full)
			.filter(Boolean);
		
		if (repeatEvery === 1) {
			if (dayNames.length === 1) return `Weekly on ${dayNames[0]}`;
			return `Weekly on ${dayNames.join(", ")}`;
		}
		return `Every ${repeatEvery} weeks on ${dayNames.join(", ")}`;
	}
	
	if (repeatUnit === "month") {
		const dateStr = getOrdinalSuffix(repeatOnDate || 1);
		if (repeatEvery === 1) return `Monthly on the ${dateStr}`;
		return `Every ${repeatEvery} months on the ${dateStr}`;
	}
	
	return "Custom";
}

interface SettingsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
	const [settings, setSettings] = useState<ScraperSettings>(loadSettings);
	const [hasChanges, setHasChanges] = useState(false);

	useEffect(() => {
		if (open) {
			setSettings(loadSettings());
			setHasChanges(false);
		}
	}, [open]);

	const toggleCountry = (carrier: string, country: string) => {
		setSettings((prev) => {
			const currentCountries = prev.carriers[carrier]?.countries || [];
			const newCountries = currentCountries.includes(country)
				? currentCountries.filter((c) => c !== country)
				: [...currentCountries, country];
			
			if (newCountries.length === 0) return prev;
			
			return {
				...prev,
				carriers: {
					...prev.carriers,
					[carrier]: {
						...prev.carriers[carrier],
						countries: newCountries,
					},
				},
			};
		});
		setHasChanges(true);
	};

	const updateRepeatEvery = (carrier: string, value: number) => {
		setSettings((prev) => ({
			...prev,
			carriers: {
				...prev.carriers,
				[carrier]: {
					...prev.carriers[carrier],
					repeatEvery: Math.max(1, Math.min(99, value)),
				},
			},
		}));
		setHasChanges(true);
	};

	const updateRepeatUnit = (carrier: string, unit: "day" | "week" | "month") => {
		setSettings((prev) => ({
			...prev,
			carriers: {
				...prev.carriers,
				[carrier]: {
					...prev.carriers[carrier],
					repeatUnit: unit,
					// Reset to Monday when switching to week
					repeatOnDays: unit === "week" ? [1] : prev.carriers[carrier].repeatOnDays,
				},
			},
		}));
		setHasChanges(true);
	};

	const toggleRepeatDay = (carrier: string, day: number) => {
		setSettings((prev) => {
			const currentDays = prev.carriers[carrier]?.repeatOnDays || [];
			const newDays = currentDays.includes(day)
				? currentDays.filter((d) => d !== day)
				: [...currentDays, day];
			
			if (newDays.length === 0) return prev;
			
			return {
				...prev,
				carriers: {
					...prev.carriers,
					[carrier]: {
						...prev.carriers[carrier],
						repeatOnDays: newDays,
					},
				},
			};
		});
		setHasChanges(true);
	};

	const handleSave = () => {
		saveSettings(settings);
		setHasChanges(false);
		onOpenChange(false);
	};

	const handleCancel = () => {
		setSettings(loadSettings());
		setHasChanges(false);
		onOpenChange(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay asChild>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
					/>
				</Dialog.Overlay>
				<Dialog.Content asChild>
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						transition={{ type: "spring", duration: 0.4 }}
						className="fixed inset-0 m-auto w-[90vw] max-w-5xl h-[85vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl z-[101] flex flex-col"
					>
						{/* Header */}
						<div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 dark:border-gray-800">
							<div className="flex items-center gap-4">
								<div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
									<Settings className="w-6 h-6 text-white" />
								</div>
								<div>
									<Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-white">
										Scraper Settings
									</Dialog.Title>
									<Dialog.Description className="text-sm text-gray-500 dark:text-gray-400">
										Configure carrier data collection schedules
									</Dialog.Description>
								</div>
							</div>
							<Dialog.Close asChild>
								<button className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
									<X className="w-5 h-5 text-gray-500" />
								</button>
							</Dialog.Close>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto p-8">
							<div className="space-y-8">
								{CARRIERS.map((carrierConfig, index) => {
									const carrier = carrierConfig.name;
									const carrierSettings = settings.carriers[carrier] || {
										countries: [],
										repeatEvery: 1,
										repeatUnit: "week" as const,
										repeatOnDays: [1],
										repeatOnDate: 1,
									};
									const carrierColor = getCarrierBrandColor(carrier);

									return (
										<motion.div
											key={carrier}
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: index * 0.1 }}
											className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30"
										>
											{/* Carrier Header */}
											<div className="flex items-center gap-4 mb-6">
												<div
													className="w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-lg"
													style={{
														background: `linear-gradient(135deg, ${carrierColor}, ${carrierColor}cc)`,
														boxShadow: `0 4px 20px ${carrierColor}40`,
													}}
												>
													<Truck className="w-7 h-7" />
												</div>
												<div>
													<h3 className="text-xl font-bold text-gray-900 dark:text-white">
														{carrier}
													</h3>
													<p className="text-sm text-gray-500 dark:text-gray-400">
														{formatFrequencyLabel(carrierSettings)} · {carrierSettings.countries.length} {carrierSettings.countries.length === 1 ? "country" : "countries"}
													</p>
												</div>
											</div>

											<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
												{/* Countries Section */}
												<div>
													<label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
														<Globe className="w-4 h-4" />
														Markets to Scrape
													</label>
													
													<Popover.Root>
														<Popover.Trigger asChild>
															<button
																className={cn(
																	"w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl",
																	"bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
																	"hover:border-gray-300 dark:hover:border-gray-600 transition-all",
																	"focus:outline-none focus:ring-2 focus:ring-offset-2"
																)}
																style={{ ["--tw-ring-color" as string]: carrierColor }}
															>
																<div className="flex items-center gap-2 flex-wrap">
																	{carrierSettings.countries.length > 0 ? (
																		carrierSettings.countries.map((code) => (
																			<span
																				key={code}
																				className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium"
																				style={{
																					backgroundColor: `${carrierColor}15`,
																					color: carrierColor,
																				}}
																			>
																				<span>{COUNTRIES[code]?.flag}</span>
																				<span>{COUNTRIES[code]?.name}</span>
																			</span>
																		))
																	) : (
																		<span className="text-gray-400">Select countries...</span>
																	)}
																</div>
																<ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
															</button>
														</Popover.Trigger>
														
														<Popover.Portal>
															<Popover.Content
																className="w-64 p-2 rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 z-[200]"
																sideOffset={8}
																align="start"
															>
																{carrierConfig.availableCountries.map((code) => {
																	const isSelected = carrierSettings.countries.includes(code);
																	return (
																		<button
																			key={code}
																			onClick={() => toggleCountry(carrier, code)}
																			className={cn(
																				"w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors",
																				isSelected
																					? "bg-gray-100 dark:bg-gray-700"
																					: "hover:bg-gray-50 dark:hover:bg-gray-700/50"
																			)}
																		>
																			<div className="flex items-center gap-3">
																				<span className="text-xl">{COUNTRIES[code]?.flag}</span>
																				<span className="font-medium text-gray-900 dark:text-white">
																					{COUNTRIES[code]?.name}
																				</span>
																			</div>
																			{isSelected && (
																				<Check className="w-4 h-4" style={{ color: carrierColor }} />
																			)}
																		</button>
																	);
																})}
															</Popover.Content>
														</Popover.Portal>
													</Popover.Root>
												</div>

												{/* Frequency Section */}
												<div>
													<label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
														<Clock className="w-4 h-4" />
														Scrape Schedule
													</label>
													
													<div className="space-y-4">
														{/* Repeat Every Row */}
														<div className="flex items-center gap-3">
															<span className="text-sm text-gray-600 dark:text-gray-400">Repeat every</span>
															<input
																type="number"
																min={1}
																max={99}
																value={carrierSettings.repeatEvery}
																onChange={(e) => updateRepeatEvery(carrier, parseInt(e.target.value) || 1)}
																className={cn(
																	"w-16 px-3 py-2 text-center rounded-lg font-medium",
																	"bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
																	"focus:outline-none focus:ring-2 focus:ring-offset-1",
																	"text-gray-900 dark:text-white"
																)}
																style={{ ["--tw-ring-color" as string]: carrierColor }}
															/>
															<Select.Root
																value={carrierSettings.repeatUnit}
																onValueChange={(value) => updateRepeatUnit(carrier, value as "day" | "week" | "month")}
															>
																<Select.Trigger
																	className={cn(
																		"flex items-center justify-between gap-2 px-4 py-2 rounded-lg min-w-[120px]",
																		"bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
																		"hover:border-gray-300 dark:hover:border-gray-600 transition-all",
																		"focus:outline-none focus:ring-2 focus:ring-offset-1"
																	)}
																	style={{ ["--tw-ring-color" as string]: carrierColor }}
																>
																	<Select.Value />
																	<Select.Icon>
																		<ChevronDown className="w-4 h-4 text-gray-400" />
																	</Select.Icon>
																</Select.Trigger>

																<Select.Portal>
																	<Select.Content
																		className="overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-[200]"
																		position="popper"
																		sideOffset={4}
																	>
																		<Select.Viewport className="p-1">
																			{["day", "week", "month"].map((unit) => (
																				<Select.Item
																					key={unit}
																					value={unit}
																					className={cn(
																						"px-3 py-2 rounded-lg cursor-pointer outline-none",
																						"hover:bg-gray-100 dark:hover:bg-gray-700",
																						"data-[state=checked]:bg-gray-100 dark:data-[state=checked]:bg-gray-700",
																						"text-gray-900 dark:text-white font-medium"
																					)}
																				>
																					<Select.ItemText>
																						{carrierSettings.repeatEvery === 1 ? unit : `${unit}s`}
																					</Select.ItemText>
																				</Select.Item>
																			))}
																		</Select.Viewport>
																	</Select.Content>
																</Select.Portal>
															</Select.Root>
														</div>

														{/* Repeat On Days (only for week) */}
														{carrierSettings.repeatUnit === "week" && (
															<div>
																<span className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Repeat on</span>
																<div className="flex gap-1">
																	{DAYS_OF_WEEK.map((day) => {
																		const isSelected = carrierSettings.repeatOnDays.includes(day.value);
																		return (
																			<button
																				key={day.value}
																				onClick={() => toggleRepeatDay(carrier, day.value)}
																				className={cn(
																					"w-10 h-10 rounded-full font-medium text-sm transition-all",
																					isSelected
																						? "text-white shadow-lg"
																						: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
																				)}
																				style={
																					isSelected
																						? {
																								background: `linear-gradient(135deg, ${carrierColor}, ${carrierColor}cc)`,
																								boxShadow: `0 2px 8px ${carrierColor}40`,
																						  }
																						: {}
																				}
																				title={day.full}
																			>
																				{day.short}
																			</button>
																		);
																	})}
																</div>
															</div>
														)}

														{/* Repeat On Date (only for month) */}
														{carrierSettings.repeatUnit === "month" && (
															<div>
																<span className="text-sm text-gray-600 dark:text-gray-400 block mb-2">On day</span>
																<Select.Root
																	value={String(carrierSettings.repeatOnDate || 1)}
																	onValueChange={(value) => {
																		setSettings((prev) => ({
																			...prev,
																			carriers: {
																				...prev.carriers,
																				[carrier]: {
																					...prev.carriers[carrier],
																					repeatOnDate: parseInt(value),
																				},
																			},
																		}));
																		setHasChanges(true);
																	}}
																>
																	<Select.Trigger
																		className={cn(
																			"flex items-center justify-between gap-2 px-4 py-2 rounded-lg w-32",
																			"bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
																			"hover:border-gray-300 dark:hover:border-gray-600 transition-all",
																			"focus:outline-none focus:ring-2 focus:ring-offset-1"
																		)}
																		style={{ ["--tw-ring-color" as string]: carrierColor }}
																	>
																		<Select.Value>
																			{getOrdinalSuffix(carrierSettings.repeatOnDate || 1)}
																		</Select.Value>
																		<Select.Icon>
																			<ChevronDown className="w-4 h-4 text-gray-400" />
																		</Select.Icon>
																	</Select.Trigger>

																	<Select.Portal>
																		<Select.Content
																			className="overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-[200] max-h-64"
																			position="popper"
																			sideOffset={4}
																		>
																			<Select.Viewport className="p-1">
																				{Array.from({ length: 31 }, (_, i) => i + 1).map((date) => (
																					<Select.Item
																						key={date}
																						value={String(date)}
																						className={cn(
																							"px-3 py-1.5 rounded-lg cursor-pointer outline-none",
																							"hover:bg-gray-100 dark:hover:bg-gray-700",
																							"data-[state=checked]:bg-gray-100 dark:data-[state=checked]:bg-gray-700",
																							"text-gray-900 dark:text-white text-sm"
																						)}
																					>
																						<Select.ItemText>
																							{getOrdinalSuffix(date)}
																						</Select.ItemText>
																					</Select.Item>
																				))}
																			</Select.Viewport>
																		</Select.Content>
																	</Select.Portal>
																</Select.Root>
															</div>
														)}
													</div>
												</div>
											</div>
										</motion.div>
									);
								})}
							</div>
						</div>

						{/* Footer */}
						<div className="flex items-center justify-between px-8 py-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
							<div className="text-sm text-gray-500 dark:text-gray-400">
								{hasChanges ? (
									<span className="flex items-center gap-2">
										<div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
										Unsaved changes
									</span>
								) : (
									<span className="flex items-center gap-2">
										<div className="w-2 h-2 rounded-full bg-emerald-500" />
										All changes saved
									</span>
								)}
							</div>
							<div className="flex items-center gap-3">
								<button
									onClick={handleCancel}
									className="px-6 py-2.5 rounded-xl font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={handleSave}
									disabled={!hasChanges}
									className={cn(
										"flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white transition-all",
										hasChanges
											? "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/30"
											: "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
									)}
								>
									<Save className="w-4 h-4" />
									Save Settings
								</button>
							</div>
						</div>
					</motion.div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
