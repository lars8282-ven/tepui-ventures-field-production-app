import { parseISO, getDaysInMonth } from "date-fns";

/**
 * Get days in month for a date string
 */
function getDaysInMonthForDate(dateStr: string): number {
  try {
    const date = parseISO(dateStr);
    return getDaysInMonth(date);
  } catch {
    return 30; // Default fallback
  }
}

/**
 * Convert monthly value to daily rate
 * Oil: MBbl/month -> Bbl/day (multiply by 1000, divide by days)
 * Gas: MMcf/month -> Mcf/day (multiply by 1000, divide by days)
 */
function convertToDailyRate(monthlyValue: number, dateStr: string): number {
  if (monthlyValue === 0) return 0;
  const daysInMonth = getDaysInMonthForDate(dateStr);
  // Monthly values are in MBbl or MMcf, convert to Bbl or Mcf, then divide by days
  const dailyRate = (monthlyValue * 1000) / daysInMonth;
  return dailyRate;
}

/**
 * Find a row in assumptions by search terms
 */
function findRow(
  searchTerms: string[],
  assumptions: Array<{ label: string; values: Record<string, number> }>
): { label: string; values: Record<string, number> } | undefined {
  return assumptions.find((c) => {
    const lowerLabel = c.label.toLowerCase();
    return searchTerms.some((term) => lowerLabel.includes(term.toLowerCase()));
  });
}

/**
 * Get baseline daily rate for a specific date and type
 * Returns the combined PDP + PDSI daily rate
 */
export function getBaselineDailyRate(
  structuredData: {
    pdpAssumptions: Array<{ label: string; values: Record<string, number> }>;
    pdsiAssumptions: Array<{ label: string; values: Record<string, number> }>;
    dates: string[];
  } | undefined,
  date: string,
  type: "oil" | "gas" | "boe"
): number | null {
  if (!structuredData) return null;

  const { pdpAssumptions, pdsiAssumptions, dates } = structuredData;

  // Find the closest date in baseline (exact match or closest)
  let targetDate = date;
  if (!dates.includes(date)) {
    // Find closest date
    const sortedDates = [...dates].sort();
    const dateObj = parseISO(date);
    let closestDate = sortedDates[0];
    let minDiff = Math.abs(parseISO(closestDate).getTime() - dateObj.getTime());

    for (const d of sortedDates) {
      const diff = Math.abs(parseISO(d).getTime() - dateObj.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = d;
      }
    }
    targetDate = closestDate;
  }

  if (type === "oil") {
    // Find Gross Prod Oil rows
    const pdpOil =
      findRow(["gross prod oil", "gross oil", "gross prod"], pdpAssumptions) ||
      pdpAssumptions.find(
        (c) =>
          c.label.toLowerCase().includes("oil") &&
          c.label.toLowerCase().includes("gross")
      );
    const pdsiOil =
      findRow(["gross prod oil", "gross oil", "gross prod"], pdsiAssumptions) ||
      pdsiAssumptions.find(
        (c) =>
          c.label.toLowerCase().includes("oil") &&
          c.label.toLowerCase().includes("gross")
      );

    const pdpOilMonthly = pdpOil?.values[targetDate] || 0;
    const pdsiOilMonthly = pdsiOil?.values[targetDate] || 0;
    const totalMonthly = pdpOilMonthly + pdsiOilMonthly;

    return convertToDailyRate(totalMonthly, targetDate);
  } else if (type === "gas") {
    // Find Gross Sales Gas rows
    const pdpGas =
      findRow(["gross sales gas", "gross gas", "gross sales"], pdpAssumptions) ||
      pdpAssumptions.find(
        (c) =>
          c.label.toLowerCase().includes("gas") &&
          c.label.toLowerCase().includes("gross")
      );
    const pdsiGas =
      findRow(["gross sales gas", "gross gas", "gross sales"], pdsiAssumptions) ||
      pdsiAssumptions.find(
        (c) =>
          c.label.toLowerCase().includes("gas") &&
          c.label.toLowerCase().includes("gross")
      );

    const pdpGasMonthly = pdpGas?.values[targetDate] || 0;
    const pdsiGasMonthly = pdsiGas?.values[targetDate] || 0;
    const totalMonthly = pdpGasMonthly + pdsiGasMonthly;

    return convertToDailyRate(totalMonthly, targetDate);
  } else if (type === "boe") {
    // Calculate BOE from Oil and Gas
    const oilRate = getBaselineDailyRate(structuredData, date, "oil");
    const gasRate = getBaselineDailyRate(structuredData, date, "gas");

    if (oilRate === null || gasRate === null) return null;

    // BOE = Oil (Bbl) + Gas (Mcf) / 6
    // Note: gasRate is in Mcf/day, need to convert to Bbl equivalent
    return oilRate + gasRate / 6;
  }

  return null;
}

/**
 * Get baseline rates for all dates in a date range
 */
export function getBaselineRatesForDates(
  structuredData: {
    pdpAssumptions: Array<{ label: string; values: Record<string, number> }>;
    pdsiAssumptions: Array<{ label: string; values: Record<string, number> }>;
    dates: string[];
  } | undefined,
  dates: string[]
): Array<{ date: string; oilRate: number; gasRate: number; boe: number }> {
  if (!structuredData) return [];

  return dates.map((date) => {
    const oilRate = getBaselineDailyRate(structuredData, date, "oil") || 0;
    const gasRate = getBaselineDailyRate(structuredData, date, "gas") || 0;
    const boe = getBaselineDailyRate(structuredData, date, "boe") || 0;

    return { date, oilRate, gasRate, boe };
  });
}

