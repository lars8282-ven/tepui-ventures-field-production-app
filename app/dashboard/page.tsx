"use client";

import { useMemo } from "react";
import { db } from "@/lib/instant";
import { format } from "date-fns";
import {
  calculateOilRateTotal,
  calculateGasRateTotal,
  calculateBOE,
  getWellsOnline,
  getDateRangeForMonth,
  calculateMonthlyAverage,
  getDailyProductionData,
  calculateOilRateFromInventoryChange,
} from "@/lib/dashboard-calculations";
import { getBaselineDailyRate, getBaselineRatesForDates } from "@/lib/baseline-utils";
import { DashboardRatesChart } from "@/components/charts/DashboardRatesChart";
import { DashboardWellsChart } from "@/components/charts/DashboardWellsChart";

export default function DashboardPage() {
  // Query all necessary data
  const { data: wellsData } = db.useQuery({
    wells: {
      $: {
        where: { status: "active" },
      },
    },
  });

  const { data: gaugingData } = db.useQuery({
    tankGauging: {},
  });

  const { data: readingsData } = db.useQuery({
    meterReadings: {},
  });

  const { data: baselineData } = db.useQuery({
    baselineUnderwriting: {},
  });

  // Extract data from InstantDB format - memoize to prevent new array references
  const wells = useMemo(
    () =>
      wellsData?.wells
        ? Array.isArray(wellsData.wells)
          ? wellsData.wells
          : Object.values(wellsData.wells)
        : [],
    [wellsData?.wells]
  );

  const gaugings = useMemo(
    () =>
      gaugingData?.tankGauging
        ? Array.isArray(gaugingData.tankGauging)
          ? gaugingData.tankGauging
          : Object.values(gaugingData.tankGauging)
        : [],
    [gaugingData?.tankGauging]
  );

  const readings = useMemo(
    () =>
      readingsData?.meterReadings
        ? Array.isArray(readingsData.meterReadings)
          ? readingsData.meterReadings
          : Object.values(readingsData.meterReadings)
        : [],
    [readingsData?.meterReadings]
  );

  // Get today's date key - memoize to prevent unnecessary recalculations
  const todayKey = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // Get monthly date range - memoize to prevent new Date objects on each render
  const { startDate, endDate } = useMemo(() => getDateRangeForMonth(), []);

  // Extract baseline data - memoize to prevent new array references
  const baselineRaw = baselineData?.baselineUnderwriting;
  const baselines = useMemo(
    () =>
      baselineRaw
        ? Array.isArray(baselineRaw)
          ? baselineRaw
          : Object.values(baselineRaw)
        : [],
    [baselineRaw]
  );
  const currentBaseline = baselines.length > 0 ? baselines[0] : null;
  const baselineStructuredData = currentBaseline?.structuredData;

  // Calculate today's values
  const todayOilRate = useMemo(
    () => calculateOilRateTotal(wells, gaugings, todayKey),
    [wells, gaugings, todayKey]
  );

  const todayGasRate = useMemo(
    () => calculateGasRateTotal(wells, readings, todayKey),
    [wells, readings, todayKey]
  );

  const todayBOE = useMemo(
    () => calculateBOE(todayOilRate, todayGasRate),
    [todayOilRate, todayGasRate]
  );

  // Calculate expected rates from baseline
  const expectedOilRate = useMemo(
    () => getBaselineDailyRate(baselineStructuredData, todayKey, "oil"),
    [baselineStructuredData, todayKey]
  );

  const expectedGasRate = useMemo(
    () => getBaselineDailyRate(baselineStructuredData, todayKey, "gas"),
    [baselineStructuredData, todayKey]
  );

  const expectedBOE = useMemo(
    () => getBaselineDailyRate(baselineStructuredData, todayKey, "boe"),
    [baselineStructuredData, todayKey]
  );

  // Calculate differences
  const oilDifference = useMemo(
    () => (expectedOilRate !== null ? todayOilRate - expectedOilRate : null),
    [todayOilRate, expectedOilRate]
  );

  const gasDifference = useMemo(
    () => (expectedGasRate !== null ? todayGasRate - expectedGasRate : null),
    [todayGasRate, expectedGasRate]
  );

  const boeDifference = useMemo(
    () => (expectedBOE !== null ? todayBOE - expectedBOE : null),
    [todayBOE, expectedBOE]
  );

  const { count: wellsOnlineCount, percentage: wellsOnlinePercentage } = useMemo(
    () => getWellsOnline(wells, gaugings, readings),
    [wells, gaugings, readings]
  );

  // Get daily production data for the month
  const dailyData = useMemo(
    () => getDailyProductionData(wells, gaugings, readings, startDate, endDate),
    [wells, gaugings, readings, startDate, endDate]
  );

  // Calculate monthly averages using inventory change method
  // (Total Inventory Today - Total Inventory at Start) / Days
  const monthlyAvgOilRate = useMemo(() => {
    return calculateOilRateFromInventoryChange(wells, gaugings, startDate, endDate);
  }, [wells, gaugings, startDate, endDate]);

  const monthlyAvgGasRate = useMemo(() => {
    const values = dailyData.map((d) => d.gasRate);
    return calculateMonthlyAverage(values, startDate, endDate);
  }, [dailyData, startDate, endDate]);

  const monthlyAvgBOE = useMemo(() => {
    const values = dailyData.map((d) => d.boe);
    return calculateMonthlyAverage(values, startDate, endDate);
  }, [dailyData, startDate, endDate]);

  const monthlyAvgWellsOnline = useMemo(() => {
    const values = dailyData.map((d) => d.wellCount);
    return calculateMonthlyAverage(values, startDate, endDate);
  }, [dailyData, startDate, endDate]);

  const monthlyAvgWellsOnlinePercentage = useMemo(() => {
    const values = dailyData.map((d) => d.wellPercentage);
    return calculateMonthlyAverage(values, startDate, endDate);
  }, [dailyData, startDate, endDate]);

  // Prepare chart data
  const ratesChartData = useMemo(
    () => {
      const chartData = dailyData.map((d) => ({
        date: d.date,
        oilRate: d.oilRate,
        gasRate: d.gasRate,
        boe: d.boe,
      }));
      
      // Debug: Check Dec 9th data
      if (process.env.NODE_ENV === "development") {
        const dec9Daily = dailyData.find((d) => d.date === "2025-12-09");
        const dec9Chart = chartData.find((d) => d.date === "2025-12-09");
        if (dec9Daily) {
          console.log("Dashboard - Dec 9th in dailyData - date:", dec9Daily.date, "gasRate:", dec9Daily.gasRate, "oilRate:", dec9Daily.oilRate, "boe:", dec9Daily.boe);
        } else {
          console.log("Dashboard - Dec 9th NOT FOUND in dailyData. Total entries:", dailyData.length, "Date range:", dailyData[0]?.date, "to", dailyData[dailyData.length - 1]?.date);
        }
        if (dec9Chart) {
          console.log("Dashboard - Dec 9th in ratesChartData - date:", dec9Chart.date, "gasRate:", dec9Chart.gasRate, "oilRate:", dec9Chart.oilRate, "boe:", dec9Chart.boe);
        } else {
          console.log("Dashboard - Dec 9th NOT FOUND in ratesChartData. Total entries:", chartData.length);
        }
      }
      
      return chartData;
    },
    [dailyData]
  );

  // Calculate baseline rates for chart dates
  const baselineChartData = useMemo(
    () => getBaselineRatesForDates(baselineStructuredData, ratesChartData.map((d) => d.date)),
    [baselineStructuredData, ratesChartData]
  );

  const wellsChartData = useMemo(
    () =>
      dailyData.map((d) => ({
        date: d.date,
        wellCount: d.wellCount,
        wellPercentage: d.wellPercentage,
      })),
    [dailyData]
  );

  // Metric card component helper
  const MetricCard = ({
    title,
    monthlyAvg,
    todayValue,
    expectedValue,
    difference,
    unit,
    icon,
    avgLabel = "Monthly Avg",
  }: {
    title: string;
    monthlyAvg: number;
    todayValue: number;
    expectedValue?: number | null;
    difference?: number | null;
    unit: string;
    icon: React.ReactNode;
    avgLabel?: string;
  }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">{icon}</div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="mt-1">
                <div className="text-lg font-medium text-gray-900">
                  {avgLabel}: {monthlyAvg > 0 ? `${Math.round(monthlyAvg)} ${unit}` : "-"}
                </div>
                <div className="text-sm text-gray-600">
                  Today: {todayValue > 0 ? `${Math.round(todayValue)} ${unit}` : "-"}
                </div>
                {expectedValue !== null && expectedValue !== undefined && (
                  <div className="text-sm text-gray-500 mt-1">
                    Expected: {Math.round(expectedValue)} {unit}
                  </div>
                )}
                {difference !== null && difference !== undefined && (
                  <div
                    className={`text-sm font-medium mt-1 ${
                      difference >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {difference >= 0 ? "+" : ""}
                    {Math.round(difference)} {unit}
                  </div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-tepui-gray">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Overview of field production and operations
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <MetricCard
          title="Oil Rate"
          monthlyAvg={monthlyAvgOilRate}
          todayValue={todayOilRate}
          expectedValue={expectedOilRate}
          difference={oilDifference}
          unit="bbls/day"
          icon={
            <svg
              className="h-10 w-10 text-[#00BFFF]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              {/* Oil Barrel */}
              <ellipse cx="12" cy="5" rx="5" ry="1.5" />
              <ellipse cx="12" cy="19" rx="5" ry="1.5" />
              <line x1="7" y1="5" x2="7" y2="19" />
              <line x1="17" y1="5" x2="17" y2="19" />
              <line x1="7" y1="9" x2="17" y2="9" />
              <line x1="7" y1="15" x2="17" y2="15" />
            </svg>
          }
        />

        <MetricCard
          title="Gas Rate"
          monthlyAvg={monthlyAvgGasRate}
          todayValue={todayGasRate}
          expectedValue={expectedGasRate}
          difference={gasDifference}
          unit="MCF/day"
          icon={
                <svg
              className="h-10 w-10 text-[#00BFFF]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
              strokeWidth={2}
            >
              {/* Simple flame shape */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21C10 19 9 16.5 9 14.5C9 12.5 10 11 11.5 10C12 9.5 12.2 9 12 8.5C11.8 9 11.5 9.5 11 10C9.5 11 8.5 12.5 8.5 14.5C8.5 16.5 9.5 19 11.5 21C11.7 21 11.8 21 12 21Z"
              />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                d="M12 21C13 19.5 14 17.5 14 15.5C14 13.8 13.2 12.5 12.5 12C12.2 11.7 12 11.5 12 11.3C11.8 11.5 11.6 11.7 11.3 12C10.6 12.5 9.8 13.8 9.8 15.5C9.8 17.5 10.8 19.5 12 21Z"
                  />
                </svg>
          }
        />

        <MetricCard
          title="BOE"
          monthlyAvg={monthlyAvgBOE}
          todayValue={todayBOE}
          expectedValue={expectedBOE}
          difference={boeDifference}
          unit="BOE/day"
          icon={
                <svg
              className="h-10 w-10 text-[#00BFFF]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
              strokeWidth={1.5}
                >
              {/* Drop */}
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                d="M12 3C10 6 8 8.5 8 11C8 14 10 16 12 16C14 16 16 14 16 11C16 8.5 14 6 12 3Z"
                  />
                </svg>
          }
        />

        <MetricCard
          title="Wells Online"
          monthlyAvg={monthlyAvgWellsOnline}
          todayValue={wellsOnlineCount}
          unit="wells"
          icon={
                <svg
              className="h-10 w-10 text-[#00BFFF]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
              strokeWidth={1.5}
                >
              {/* Pumpjack - triangular base with angled beam */}
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                d="M6 20L4 18L8 18L6 20Z"
              />
              <line x1="6" y1="18" x2="6" y2="14" />
              <line x1="6" y1="14" x2="10" y2="14" />
              <line x1="10" y1="14" x2="10" y2="9" />
              <line x1="10" y1="9" x2="14" y2="3" />
              <line x1="14" y1="3" x2="18" y2="7" />
              <line x1="18" y1="7" x2="18" y2="14" />
              <line x1="18" y1="14" x2="20" y2="14" />
              <circle cx="14" cy="3" r="1.5" />
              <circle cx="18" cy="7" r="1.5" />
              <line x1="12" y1="5" x2="12" y2="7" />
                </svg>
          }
        />

        <MetricCard
          title="% Wells Online"
          monthlyAvg={monthlyAvgWellsOnlinePercentage}
          todayValue={wellsOnlinePercentage}
          unit="%"
          icon={
                <svg
              className="h-10 w-10 text-[#00BFFF]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
              strokeWidth={1.5}
                >
              {/* Pumpjack - triangular base with angled beam */}
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                d="M6 20L4 18L8 18L6 20Z"
              />
              <line x1="6" y1="18" x2="6" y2="14" />
              <line x1="6" y1="14" x2="10" y2="14" />
              <line x1="10" y1="14" x2="10" y2="9" />
              <line x1="10" y1="9" x2="14" y2="3" />
              <line x1="14" y1="3" x2="18" y2="7" />
              <line x1="18" y1="7" x2="18" y2="14" />
              <line x1="18" y1="14" x2="20" y2="14" />
              <circle cx="14" cy="3" r="1.5" />
              <circle cx="18" cy="7" r="1.5" />
              <line x1="12" y1="5" x2="12" y2="7" />
                </svg>
          }
        />
              </div>

      {/* Charts */}
      <div className="space-y-6">
        <DashboardRatesChart data={ratesChartData} baselineData={baselineChartData} />
        <DashboardWellsChart data={wellsChartData} />
      </div>
    </div>
  );
}
