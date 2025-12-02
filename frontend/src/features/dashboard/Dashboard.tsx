import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/Button";
import Layout from "@/components/layout/Layout";
import AITabbedView from "../insights/AITabbedView";
import ComparisonTable from "./ComparisonTable";
import ScrapeNow from "../scraper/ScrapeNow";
import HistoricalTrends from "../history/HistoricalTrends";
import Chatbot from "../chatbot/Chatbot";
import GlobalFilters from "@/components/filters/GlobalFilters";
import DateRangeSelector from "@/components/filters/DateRangeSelector";
import OverviewContent from "../overview/OverviewContent";
import {
	MessageCircle,
	Zap,
	BarChart3,
	TrendingUp,
	Gauge,
	Layers,
	Users,
	Grid,
	Infinity as InfinityIcon,
	Ruler,
	GitBranch,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { historyApi, metadataApi } from "@/services/api";
import { CustomSelect } from "@/components/ui/CustomSelect";
import FuelCurveSelector, { SelectedCurve } from "@/components/filters/FuelCurveSelector";
import FuelSourcesCard from "@/components/info/FuelSourcesCard";
import * as Tabs from "@radix-ui/react-tabs";

interface Session {
	id: number;
	timestamp: string;
	status: string;
	carriers_scraped: string[];
	total_rows: number;
}

type ViewMode =
	| "normalized"
	| "normalized_fine"
	| "overlap"
	| "complete"
	| "comparable";

const DEFAULT_CARRIERS = ["UPS", "FedEx", "DHL"];
const SERVICE_TYPE_ORDER = [
	"ground_domestic",
	"ground_regional",
	"domestic_air",
	"international_air_export",
	"international_air_import",
	"international_ground_export_import",
];

type MarketAvailability = Record<
	string,
	{
		carriers: string[];
		services: string[];
	}
>;

export default function Dashboard() {
	const [showChatbot, setShowChatbot] = useState(false);
	const [sessions, setSessions] = useState<Session[]>([]);

	// Global filter state
	const [selectedCountry, setSelectedCountry] = useState("US");
	const [selectedCarriers, setSelectedCarriers] = useState<string[]>([
		"UPS",
		"FedEx",
		"DHL",
	]);
	const [selectedServiceType, setSelectedServiceType] =
		useState("ground_domestic");
	const [filterAvailability, setFilterAvailability] =
		useState<MarketAvailability>({});
	const [filtersLoaded, setFiltersLoaded] = useState(false);

	// Session and view state
	const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
		null
	);
	const [activeView, setActiveView] = useState<ViewMode>("overlap");

	// Tab state
	const [primaryTab, setPrimaryTab] = useState("charts");
	const [chartsSubTab, setChartsSubTab] = useState("fuel-curves");

	// Date range state for historical tab
	const [startDate, setStartDate] = useState<string | null>(null);
	const [endDate, setEndDate] = useState<string | null>(null);

	// Track carriers with data for conditional rendering
	const [carriersWithData, setCarriersWithData] = useState<string[]>([]);
	const [comparisonHasData, setComparisonHasData] = useState(true);
	const [userCarriersOverride, setUserCarriersOverride] = useState(false);
	const prevCountryRef = useRef<string | null>(null);

	// Selected fuel curves from the FuelCurveSelector
	const [selectedFuelCurves, setSelectedFuelCurves] = useState<SelectedCurve[]>([]);


	// Switch away from comparable view if only one carrier has data
	useEffect(() => {
		if (activeView === "comparable" && carriersWithData.length < 2) {
			setActiveView("overlap");
		}
	}, [carriersWithData.length, activeView]);

	useEffect(() => {
		if (activeView === "overlap" && !comparisonHasData) {
			setActiveView("normalized");
		}
	}, [activeView, comparisonHasData]);

	useEffect(() => {
		loadSessions();
	}, []);
	useEffect(() => {
		loadFilterAvailability();
	}, []);

	const loadSessions = async () => {
		try {
			const response = await historyApi.getSessions();
			setSessions(response.data);
			if (response.data.length > 0) {
				setSelectedSessionId(response.data[0].id);
				// Don't initialize dates - "All" should be selected by default (null dates)
			}
		} catch (error) {
			console.error("Failed to load sessions:", error);
		}
	};
	const loadFilterAvailability = async () => {
		try {
			const response = await metadataApi.getFilterOptions();
			const markets: MarketAvailability = response.data?.markets ?? {};
			setFilterAvailability(markets);
		} catch (error) {
			console.error("Failed to load filter availability:", error);
			setFilterAvailability({});
		} finally {
			setFiltersLoaded(true);
		}
	};

	const formatDate = (timestamp: string) => {
		const date = new Date(
			timestamp.includes("Z") ? timestamp : timestamp + "Z"
		);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const latestSession = sessions.length > 0 ? sessions[0] : null;
	const isHistorical =
		selectedSessionId !== null &&
		latestSession !== null &&
		selectedSessionId !== latestSession.id;
	const currentSessionId = useMemo(
		() => selectedSessionId || sessions[0]?.id || null,
		[selectedSessionId, sessions]
	);

	const handleDateRangeChange = (start: string | null, end: string | null) => {
		setStartDate(start);
		setEndDate(end);
	};

	const handleCarriersChange = (carriers: string[]) => {
		setSelectedCarriers(carriers);
		setUserCarriersOverride(true);
	};

	useEffect(() => {
		if (!filtersLoaded) return;
		if (Object.keys(filterAvailability).length === 0) return;
		if (!filterAvailability[selectedCountry]) {
			const [firstMarket] = Object.keys(filterAvailability);
			if (firstMarket) {
				setSelectedCountry(firstMarket);
			}
		}
	}, [filterAvailability, filtersLoaded, selectedCountry]);

	useEffect(() => {
		if (!filtersLoaded) return;
		const availability = filterAvailability[selectedCountry];
		const carriersForMarket =
			availability && availability.carriers.length > 0
				? availability.carriers
				: DEFAULT_CARRIERS;

		const countryChanged = prevCountryRef.current !== selectedCountry;
		if (countryChanged) {
			prevCountryRef.current = selectedCountry;
			setSelectedCarriers(carriersForMarket);
			setUserCarriersOverride(false);
			return;
		}

		if (!userCarriersOverride) {
			setSelectedCarriers(carriersForMarket);
		}
	}, [
		selectedCountry,
		filterAvailability,
		filtersLoaded,
		userCarriersOverride,
	]);

	useEffect(() => {
		if (!filtersLoaded) return;
		const availability = filterAvailability[selectedCountry];
		if (!availability) return;

		const validServices = availability.services.filter(
			(service) => service && service !== "all"
		);
		if (!validServices.length) {
			setSelectedServiceType("ground_domestic");
			return;
		}

		if (!validServices.includes(selectedServiceType)) {
			setSelectedServiceType(validServices[0]);
		}
	}, [selectedCountry, filterAvailability, filtersLoaded, selectedServiceType]);

	const availableCarriers =
		filterAvailability[selectedCountry]?.carriers ?? DEFAULT_CARRIERS;

	const availableServicesRaw =
		filterAvailability[selectedCountry]?.services ?? SERVICE_TYPE_ORDER;

	const sanitizedAvailableServices = availableServicesRaw.filter(
		(service) => service && service !== "all"
	);

	const availableServicesUnsorted = [
		...new Set(
			sanitizedAvailableServices.length
				? sanitizedAvailableServices
				: ["ground_domestic"]
		),
	];

	const availableServices = availableServicesUnsorted.sort((a, b) => {
		const rank = (value: string) => {
			const index = SERVICE_TYPE_ORDER.indexOf(value);
			return index === -1 ? Number.MAX_SAFE_INTEGER : index;
		};
		return rank(a) - rank(b);
	});

	const usesEuro = useMemo(() => {
		const normalizedMarket = selectedCountry?.toUpperCase();
		return (
			normalizedMarket === "DE" &&
			(selectedServiceType === "ground_domestic" ||
				selectedServiceType === "ground_regional" ||
				selectedServiceType === "international_ground_export_import")
		);
	}, [selectedCountry, selectedServiceType]);

	const normalizedCurrencySymbol = usesEuro ? "€" : "$";

	const viewOptions = useMemo(() => {
		const baseOptions = [
			{
				value: "overlap",
				label: "Overlap View",
				description: "Direct comparison",
				icon: <Layers className="w-4 h-4" />,
			},
			{
				value: "comparable",
				label: "Comparable Ranges",
				description: "Grouped overlaps - 2+ carriers",
				icon: <Users className="w-4 h-4" />,
			},
			{
				value: "normalized",
				label: "Normalized Grid",
				description: `${normalizedCurrencySymbol}0.10 intervals`,
				icon: <Grid className="w-4 h-4" />,
			},
			{
				value: "normalized_fine",
				label: "Precision Grid",
				description: `${normalizedCurrencySymbol}0.02 steps`,
				icon: <Ruler className="w-4 h-4" />,
			},
			{
				value: "complete",
				label: "Complete View",
				description: "All data points",
				icon: <InfinityIcon className="w-4 h-4" />,
			},
		];

		return carriersWithData.length >= 2
			? baseOptions
			: baseOptions.filter((option) => option.value !== "comparable");
	}, [carriersWithData.length, normalizedCurrencySymbol]);

	return (
		<Layout lastUpdate={latestSession?.timestamp} isHistorical={isHistorical}>
			<div className="space-y-6">
				{/* Global Filters */}
				<GlobalFilters
					selectedCountry={selectedCountry}
					selectedCarriers={selectedCarriers}
					selectedServiceType={selectedServiceType}
					onCountryChange={(country) => {
						setSelectedCountry(country);
						setUserCarriersOverride(false);
					}}
					onCarriersChange={handleCarriersChange}
					onServiceTypeChange={setSelectedServiceType}
					availableCarriers={availableCarriers}
					availableServiceTypes={availableServices}
					sessionId={currentSessionId || undefined}
				/>

				{/* Main Tabs */}
				<Tabs.Root
					value={primaryTab}
					onValueChange={setPrimaryTab}
					className="space-y-6"
				>
					<Tabs.List className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Tabs.Trigger value="overview" asChild>
							<motion.button
								whileHover={{ scale: 1.02, y: -2 }}
								whileTap={{ scale: 0.98 }}
								className="p-5 rounded-2xl backdrop-blur-xl bg-gray-200/40 dark:bg-gray-900/30 border border-gray-300/40 dark:border-gray-700/50 hover:shadow-2xl hover:border-green-400/30 dark:hover:border-green-500/30 transition-all duration-200 data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-500 data-[state=active]:to-green-700 data-[state=active]:text-white data-[state=active]:shadow-2xl data-[state=active]:ring-2 data-[state=active]:ring-green-400/50 text-left"
							>
								<div className="flex items-center gap-2 mb-2">
									<Gauge className="w-5 h-5" />
									<h2 className="text-lg font-semibold">Overview</h2>
								</div>
								<p className="text-sm opacity-80">
									Dashboard summary and key metrics
								</p>
							</motion.button>
						</Tabs.Trigger>

						<Tabs.Trigger value="charts" asChild>
							<motion.button
								whileHover={{ scale: 1.02, y: -2 }}
								whileTap={{ scale: 0.98 }}
								className="p-5 rounded-2xl backdrop-blur-xl bg-gray-200/40 dark:bg-gray-900/30 border border-gray-300/40 dark:border-gray-700/50 hover:shadow-2xl hover:border-amber-400/30 dark:hover:border-amber-500/30 transition-all duration-200 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-600 data-[state=active]:to-amber-800 data-[state=active]:text-white data-[state=active]:shadow-2xl data-[state=active]:ring-2 data-[state=active]:ring-amber-500/50 text-left"
							>
								<div className="flex items-center gap-2 mb-2">
									<BarChart3 className="w-5 h-5" />
									<h2 className="text-lg font-semibold">Charts & Tables</h2>
								</div>
								<p className="text-sm opacity-80">
									Comparison views, historical trends, and raw data tables
								</p>
							</motion.button>
						</Tabs.Trigger>

						<Tabs.Trigger value="ai" asChild>
							<motion.button
								whileHover={{ scale: 1.02, y: -2 }}
								whileTap={{ scale: 0.98 }}
								className="p-5 rounded-2xl backdrop-blur-xl bg-gray-200/40 dark:bg-gray-900/30 border border-gray-300/40 dark:border-gray-700/50 hover:shadow-2xl hover:border-purple-400/30 dark:hover:border-purple-500/30 transition-all duration-200 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-2xl data-[state=active]:ring-2 data-[state=active]:ring-purple-400/50 text-left"
							>
								<div className="flex items-center gap-2 mb-2">
									<Zap className="w-5 h-5" />
									<h2 className="text-lg font-semibold">
										AI Competitive Intelligence
									</h2>
								</div>
								<p className="text-sm opacity-80">
									Executive analysis, quick gaps, and pricing recommendations
								</p>
							</motion.button>
						</Tabs.Trigger>
					</Tabs.List>

				{/* Overview Tab */}
				<Tabs.Content value="overview" className="space-y-6">
					<OverviewContent
						selectedCountry={selectedCountry}
						selectedServiceType={selectedServiceType}
					/>
				</Tabs.Content>

				{/* Charts & Tables Tab with Sub-tabs */}
				<Tabs.Content value="charts" className="space-y-6">
						<Tabs.Root
							value={chartsSubTab}
							onValueChange={setChartsSubTab}
							className="space-y-6"
						>
							<Tabs.List className="flex gap-2 p-1 rounded-xl backdrop-blur-xl bg-white/10 dark:bg-gray-900/30 border border-white/20 dark:border-gray-700/50">
								<Tabs.Trigger
									value="fuel-curves"
									className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=inactive]:text-gray-700 dark:data-[state=inactive]:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50"
								>
									<Gauge className="w-4 h-4" />
									Fuel Curves
								</Tabs.Trigger>
								<Tabs.Trigger
									value="historical"
									className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=inactive]:text-gray-700 dark:data-[state=inactive]:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50"
								>
									<TrendingUp className="w-4 h-4" />
									Historical Fuel Surcharge
								</Tabs.Trigger>
							</Tabs.List>

							{/* Fuel Curves Sub-tab */}
							<Tabs.Content value="fuel-curves" className="space-y-6">
								{/* Compact control row */}
								{sessions.length > 0 && (
									<motion.div
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										className="backdrop-blur-xl bg-white/10 dark:bg-gray-900/30 border border-white/20 dark:border-gray-700/40 p-4 rounded-2xl shadow-2xl"
									>
										<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-0">
											<div className="flex-1 min-w-[260px]">
												<div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
													<Layers className="w-4 h-4 text-amber-500" />
													View Mode
												</div>
												<CustomSelect
													options={viewOptions}
													value={activeView}
													onChange={(value) => setActiveView(value as ViewMode)}
													placeholder="Select view"
												/>
											</div>
											
											{/* Divider */}
											<div className="hidden lg:block w-px bg-gray-300/50 dark:bg-gray-600/50 mx-6 self-stretch" />
											
											<div className="flex-1 min-w-[260px]">
												<div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
													<GitBranch className="w-4 h-4 text-amber-500" />
													Select Fuel Curves
												</div>
												<FuelCurveSelector
													carriers={selectedCarriers}
													market={selectedCountry}
													fuelCategory={selectedServiceType}
													sessionId={currentSessionId || undefined}
													onSelectionChange={setSelectedFuelCurves}
												/>
											</div>
										</div>
									</motion.div>
								)}

								{/* Fuel Sources Info */}
								<FuelSourcesCard
									market={selectedCountry}
									fuelCategory={selectedServiceType}
									carriers={selectedCarriers}
								/>

								{/* Comparison Table */}
								<ComparisonTable
									view={activeView}
									sessionId={currentSessionId || undefined}
									fuelCategory={selectedServiceType}
									market={selectedCountry}
									carriers={selectedCarriers}
									selectedCurves={selectedFuelCurves}
									onCarriersWithDataChange={setCarriersWithData}
									onHasDataChange={setComparisonHasData}
								/>
							</Tabs.Content>

							{/* Historical Sub-tab */}
							<Tabs.Content value="historical" className="space-y-6">
								<DateRangeSelector
									startDate={startDate}
									endDate={endDate}
									onDateRangeChange={handleDateRangeChange}
								/>

								<HistoricalTrends
									carriers={selectedCarriers}
									fuelCategory={selectedServiceType}
									market={selectedCountry}
									startDate={startDate}
									endDate={endDate}
								/>
							</Tabs.Content>
						</Tabs.Root>
					</Tabs.Content>

				{/* AI Tab */}
				<Tabs.Content value="ai" className="space-y-6">
					<AITabbedView
						fuelCategory={selectedServiceType}
						market={selectedCountry}
					/>
				</Tabs.Content>
				</Tabs.Root>

				<ScrapeNow onSuccess={loadSessions} />

				<motion.div
					className="fixed bottom-6 right-6 z-50"
					initial={{ scale: 0 }}
					animate={{ scale: 1 }}
				>
					<Button
						variant="primary"
						size="lg"
						className="rounded-full w-14 h-14 p-0 shadow-2xl"
						onClick={() => setShowChatbot(!showChatbot)}
					>
						<MessageCircle className="w-6 h-6" />
					</Button>
				</motion.div>

				<AnimatePresence>
					{showChatbot && (
						<Chatbot
							onClose={() => setShowChatbot(false)}
							market={selectedCountry}
							fuelCategory={selectedServiceType}
						/>
					)}
				</AnimatePresence>
			</div>
		</Layout>
	);
}
