import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Check, Database } from "lucide-react";
import { cn } from "@/utils/cn";
import { RawDataModal } from "@/components/ui/RawDataModal";

interface GlobalFiltersProps {
	selectedCountry: string;
	selectedCarriers: string[];
	selectedServiceType: string;
	availableCarriers: string[];
	availableServiceTypes: string[];
	onCountryChange: (country: string) => void;
	onCarriersChange: (carriers: string[]) => void;
	onServiceTypeChange: (serviceType: string) => void;
	sessionId?: number;
}

const COUNTRIES = [
	{ value: "US", label: "United States", flag: "🇺🇸" },
	{ value: "DE", label: "Germany", flag: "🇩🇪" },
];

const DEFAULT_CARRIERS = ["UPS", "FedEx", "DHL"];

// { value: "all", label: "All Services" }, // Removed per design: ground is default
const SERVICE_TYPES = [
	{ value: "ground_domestic", label: "Ground Domestic" },
	{ value: "ground_regional", label: "Ground Regional" },
	{ value: "domestic_air", label: "Domestic Air" },
	{ value: "international_air_export", label: "International Air Export" },
	{ value: "international_air_import", label: "International Air Import" },
];

export default function GlobalFilters({
	selectedCountry,
	selectedCarriers,
	selectedServiceType,
	availableCarriers,
	availableServiceTypes,
	onCountryChange,
	onCarriersChange,
	onServiceTypeChange,
	sessionId,
}: GlobalFiltersProps) {
	const [carriersOpen, setCarriersOpen] = useState(false);
	const [countryOpen, setCountryOpen] = useState(false);
	const [serviceTypeOpen, setServiceTypeOpen] = useState(false);
	const [rawDataModalOpen, setRawDataModalOpen] = useState(false);

	const carriersList =
		availableCarriers.length > 0 ? availableCarriers : DEFAULT_CARRIERS;

	// Filter out unwanted service types
	const EXCLUDED_SERVICE_TYPES = [
		"international_ground_export_import",
		"domestic_air_freight",
	];

	const sanitizedServiceTypes = availableServiceTypes.filter(
		(value) =>
			value && value !== "all" && !EXCLUDED_SERVICE_TYPES.includes(value)
	);

	const recognizedServiceOptions = SERVICE_TYPES.filter(
		(option) =>
			availableServiceTypes.length === 0 ||
			sanitizedServiceTypes.includes(option.value)
	);

	const extraServiceOptions = sanitizedServiceTypes
		.filter((value) => !SERVICE_TYPES.some((option) => option.value === value))
		.map((value) => ({
			value,
			label: value
				.split("_")
				.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
				.join(" "),
		}));

	const serviceTypeOptions =
		recognizedServiceOptions.length > 0 || extraServiceOptions.length > 0
			? [...recognizedServiceOptions, ...extraServiceOptions]
			: SERVICE_TYPES;

	const toggleCarrier = (carrier: string) => {
		if (selectedCarriers.includes(carrier)) {
			if (selectedCarriers.length > 1) {
				onCarriersChange(selectedCarriers.filter((c) => c !== carrier));
			}
		} else {
			onCarriersChange([...selectedCarriers, carrier]);
		}
	};

	const selectAllCarriers = () => {
		if (carriersList.length === 0) return;
		onCarriersChange(carriersList);
	};

	const allSelected =
		carriersList.length > 0 && selectedCarriers.length === carriersList.length;
	const selectedCountryData = COUNTRIES.find(
		(c) => c.value === selectedCountry
	);
	const selectedCountryLabel = selectedCountryData?.label || selectedCountry;
	const selectedServiceTypeLabel =
		serviceTypeOptions.find((s) => s.value === selectedServiceType)?.label ||
		selectedServiceType;

	return (
		<div className="backdrop-blur-xl bg-white/10 dark:bg-gray-900/30 border border-white/20 dark:border-gray-700/50 p-4 rounded-2xl shadow-2xl">
			<div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
				<div className="flex items-center gap-2">
					<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
						Filters:
					</span>
				</div>

				<div className="flex flex-col sm:flex-row gap-3 flex-1 w-full lg:w-auto">
					{/* Country Selector - Button Style */}
					<div className="flex-1 min-w-[200px]">
						<label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
							Country
						</label>
						<DropdownMenu.Root open={countryOpen} onOpenChange={setCountryOpen}>
							<DropdownMenu.Trigger asChild>
								<button
									disabled={carriersList.length === 0}
									className={cn(
										"w-full px-4 py-2.5 rounded-xl",
										"backdrop-blur-xl bg-white/80 dark:bg-gray-800/80",
										"border-2 border-gray-200 dark:border-gray-700",
										"hover:border-blue-400 dark:hover:border-blue-500",
										"data-[state=open]:border-blue-500 dark:data-[state=open]:border-blue-400",
										"data-[state=open]:ring-4 data-[state=open]:ring-blue-500/20",
										"flex items-center justify-between gap-3",
										"text-left text-gray-900 dark:text-gray-100 font-medium",
										"shadow-lg hover:shadow-xl",
										"transition-all duration-200",
										"focus:outline-none"
									)}
								>
									<span className="flex items-center gap-2">
										<span className="text-xl leading-none">
											{selectedCountryData?.flag}
										</span>
										<span>{selectedCountryLabel}</span>
									</span>
									<ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
								</button>
							</DropdownMenu.Trigger>

							<DropdownMenu.Portal>
								<DropdownMenu.Content
									className={cn(
										"backdrop-blur-xl bg-white/95 dark:bg-gray-800/95",
										"border-2 border-gray-200 dark:border-gray-700",
										"rounded-xl shadow-2xl",
										"p-2",
										"z-[9999]",
										"min-w-[200px]"
									)}
									sideOffset={8}
									align="start"
								>
									{COUNTRIES.map((country) => {
										const isSelected = selectedCountry === country.value;
										return (
											<DropdownMenu.Item
												key={country.value}
												className={cn(
													"px-3 py-2 rounded-lg",
													"cursor-pointer outline-none",
													"hover:bg-gray-100 dark:hover:bg-gray-700/50",
													"transition-colors",
													isSelected && "bg-blue-50 dark:bg-blue-900/20"
												)}
												onSelect={(e) => {
													e.preventDefault();
													onCountryChange(country.value);
													setCountryOpen(false);
												}}
											>
												<div className="flex items-center gap-3">
													<span className="text-xl leading-none">
														{country.flag}
													</span>
													<span
														className={cn(
															"text-sm",
															isSelected
																? "text-blue-600 dark:text-blue-400 font-semibold"
																: "text-gray-700 dark:text-gray-300"
														)}
													>
														{country.label}
													</span>
												</div>
											</DropdownMenu.Item>
										);
									})}
								</DropdownMenu.Content>
							</DropdownMenu.Portal>
						</DropdownMenu.Root>
					</div>

					{/* Carriers Multi-Select */}
					<div className="flex-1 min-w-[200px]">
						<label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
							Carriers
						</label>
						<DropdownMenu.Root
							open={carriersOpen}
							onOpenChange={setCarriersOpen}
						>
							<DropdownMenu.Trigger asChild>
								<button
									className={cn(
										"w-full px-4 py-2.5 rounded-xl",
										"backdrop-blur-xl bg-white/80 dark:bg-gray-800/80",
										"border-2 border-gray-200 dark:border-gray-700",
										"hover:border-blue-400 dark:hover:border-blue-500",
										"data-[state=open]:border-blue-500 dark:data-[state=open]:border-blue-400",
										"data-[state=open]:ring-4 data-[state=open]:ring-blue-500/20",
										"flex items-center justify-between gap-3",
										"text-left text-gray-900 dark:text-gray-100 font-medium",
										"shadow-lg hover:shadow-xl",
										"transition-all duration-200",
										"focus:outline-none"
									)}
								>
									<span>
										{allSelected
											? "All Carriers"
											: selectedCarriers.length === 1
											? selectedCarriers[0]
											: `${selectedCarriers.length} Carriers`}
									</span>
									<ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
								</button>
							</DropdownMenu.Trigger>

							<DropdownMenu.Portal>
								<DropdownMenu.Content
									className={cn(
										"backdrop-blur-xl bg-white/95 dark:bg-gray-800/95",
										"border-2 border-gray-200 dark:border-gray-700",
										"rounded-xl shadow-2xl",
										"p-2",
										"z-[9999]",
										"min-w-[200px]"
									)}
									sideOffset={8}
									align="start"
								>
									{carriersList.length > 0 ? (
										<>
											<DropdownMenu.Item
												className={cn(
													"flex items-center gap-3 px-3 py-2 rounded-lg",
													"cursor-pointer outline-none",
													"hover:bg-gray-100 dark:hover:bg-gray-700/50",
													"transition-colors"
												)}
												onSelect={(e) => {
													e.preventDefault();
													selectAllCarriers();
												}}
											>
												<div
													className={cn(
														"w-4 h-4 rounded border-2 flex items-center justify-center",
														allSelected
															? "bg-blue-500 border-blue-500"
															: "border-gray-300 dark:border-gray-600"
													)}
												>
													{allSelected && (
														<Check className="w-3 h-3 text-white" />
													)}
												</div>
												<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
													Select All
												</span>
											</DropdownMenu.Item>

											<DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

											{carriersList.map((carrier) => {
												const isSelected = selectedCarriers.includes(carrier);
												return (
													<DropdownMenu.Item
														key={carrier}
														className={cn(
															"flex items-center gap-3 px-3 py-2 rounded-lg",
															"cursor-pointer outline-none",
															"hover:bg-gray-100 dark:hover:bg-gray-700/50",
															"transition-colors"
														)}
														onSelect={(e) => {
															e.preventDefault();
															toggleCarrier(carrier);
														}}
													>
														<div
															className={cn(
																"w-4 h-4 rounded border-2 flex items-center justify-center",
																isSelected
																	? "bg-blue-500 border-blue-500"
																	: "border-gray-300 dark:border-gray-600"
															)}
														>
															{isSelected && (
																<Check className="w-3 h-3 text-white" />
															)}
														</div>
														<span className="text-sm text-gray-700 dark:text-gray-300">
															{carrier}
														</span>
													</DropdownMenu.Item>
												);
											})}
										</>
									) : (
										<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
											No carriers available for this country
										</div>
									)}
								</DropdownMenu.Content>
							</DropdownMenu.Portal>
						</DropdownMenu.Root>
					</div>

					{/* Service Type Selector - Button Style */}
					<div className="flex-1 min-w-[250px]">
						<label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
							Service Type
						</label>
						<DropdownMenu.Root
							open={serviceTypeOpen}
							onOpenChange={setServiceTypeOpen}
						>
							<DropdownMenu.Trigger asChild>
								<button
									className={cn(
										"w-full px-4 py-2.5 rounded-xl",
										"backdrop-blur-xl bg-white/80 dark:bg-gray-800/80",
										"border-2 border-gray-200 dark:border-gray-700",
										"hover:border-blue-400 dark:hover:border-blue-500",
										"data-[state=open]:border-blue-500 dark:data-[state=open]:border-blue-400",
										"data-[state=open]:ring-4 data-[state=open]:ring-blue-500/20",
										"flex items-center justify-between gap-3",
										"text-left text-gray-900 dark:text-gray-100 font-medium",
										"shadow-lg hover:shadow-xl",
										"transition-all duration-200",
										"focus:outline-none"
									)}
								>
									<span className="truncate">{selectedServiceTypeLabel}</span>
									<ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
								</button>
							</DropdownMenu.Trigger>

							<DropdownMenu.Portal>
								<DropdownMenu.Content
									className={cn(
										"backdrop-blur-xl bg-white/95 dark:bg-gray-800/95",
										"border-2 border-gray-200 dark:border-gray-700",
										"rounded-xl shadow-2xl",
										"p-2",
										"z-[9999]",
										"min-w-[250px]"
									)}
									sideOffset={8}
									align="start"
								>
									{serviceTypeOptions.map((type) => {
										const isSelected = selectedServiceType === type.value;
										return (
											<DropdownMenu.Item
												key={type.value}
												className={cn(
													"px-3 py-2 rounded-lg",
													"cursor-pointer outline-none",
													"hover:bg-gray-100 dark:hover:bg-gray-700/50",
													"transition-colors",
													isSelected && "bg-blue-50 dark:bg-blue-900/20"
												)}
												onSelect={(e) => {
													e.preventDefault();
													onServiceTypeChange(type.value);
													setServiceTypeOpen(false);
												}}
											>
												<span
													className={cn(
														"text-sm",
														isSelected
															? "text-blue-600 dark:text-blue-400 font-semibold"
															: "text-gray-700 dark:text-gray-300"
													)}
												>
													{type.label}
												</span>
											</DropdownMenu.Item>
										);
									})}
								</DropdownMenu.Content>
							</DropdownMenu.Portal>
						</DropdownMenu.Root>
					</div>
				</div>

				{sessionId && (
					<div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
						<button
							onClick={() => setRawDataModalOpen(true)}
							className={cn(
								"w-full px-4 py-2 rounded-xl",
								"backdrop-blur-xl bg-gray-100/60 dark:bg-gray-800/60",
								"border border-gray-300/50 dark:border-gray-600/50",
								"hover:bg-gray-200/80 dark:hover:bg-gray-700/80",
								"hover:border-gray-400 dark:hover:border-gray-500",
								"flex items-center justify-center gap-2",
								"text-sm font-medium text-gray-700 dark:text-gray-300",
								"transition-all duration-200"
							)}
						>
							<Database className="w-4 h-4" />
							Show Raw Data
						</button>
						<RawDataModal
							open={rawDataModalOpen}
							onOpenChange={setRawDataModalOpen}
							sessionId={sessionId}
							fuelCategory={selectedServiceType}
							market={selectedCountry}
							carriers={selectedCarriers}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
