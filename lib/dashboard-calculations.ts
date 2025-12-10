/**
 * Dashboard calculation utilities for production metrics
 */

import { format } from "date-fns";
import {
  calculateBarrels,
  calculateRate,
  calculateDaysDifference,
  getLatestGauging,
  getPreviousGauging,
  getTankFactor,
  type TankGauging,
} from "./calculations";

interface Well {
  id: string;
  name: string;
  wellNumber: string;
  metadata?: {
    tankFactor?: number | string;
    [key: string]: any;
  };
}

interface MeterReading {
  id: string;
  wellId: string;
  value: number;
  timestamp: string;
  meterType?: string;
  unit?: string;
  createdAt: string;
}

/**
 * Get date range for current month (up to today)
 */
export function getDateRangeForMonth(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now); // End at today
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

/**
 * Check if a date is today
 */
export function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  return format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
}

/**
 * Check if a date is within a month range
 */
export function isInMonth(dateString: string, startDate: Date, endDate: Date): boolean {
  try {
    const date = new Date(dateString);
    // Handle invalid dates
    if (isNaN(date.getTime())) return false;
    return date >= startDate && date <= endDate;
  } catch {
    return false;
  }
}

/**
 * Calculate oil production rate for a single well on a specific date
 */
function calculateWellOilRate(
  well: Well,
  gaugings: TankGauging[],
  date: string | null
): number {
  let totalRate = 0;
  const tankFactor = getTankFactor(well);

  if (tankFactor <= 0) return 0;

  // Calculate rate for each tank and sum
  ["Tank 1", "Tank 2", "Tank 3"].forEach((tankNumber) => {
    let latest: TankGauging | null = null;

    if (date) {
      // Get gauging for specific date
      const dateGaugings = gaugings.filter((g) => {
        if (g.wellId !== well.id || g.tankNumber !== tankNumber) return false;
        const gaugeDate = new Date(g.timestamp || g.createdAt);
        const gaugeDateKey = format(gaugeDate, "yyyy-MM-dd");
        return gaugeDateKey === date;
      });
      
      if (dateGaugings.length > 0) {
        latest = dateGaugings.sort(
          (a, b) =>
            new Date(b.timestamp || b.createdAt).getTime() -
            new Date(a.timestamp || a.createdAt).getTime()
        )[0];
      }
    } else {
      latest = getLatestGauging(gaugings, well.id, tankNumber);
    }

    if (latest) {
      const barrels = calculateBarrels(latest.level, tankFactor);
      const previous = getPreviousGauging(
        gaugings,
        well.id,
        tankNumber,
        latest.timestamp || latest.createdAt
      );

      if (previous) {
        const daysDiff = calculateDaysDifference(
          latest.timestamp || latest.createdAt,
          previous.timestamp || previous.createdAt
        );
        const previousBarrels = calculateBarrels(previous.level, tankFactor);
        const rate = calculateRate(barrels, previousBarrels, daysDiff);
        if (rate !== null && rate > 0) {
          totalRate += rate;
        }
      }
    }
  });

  return totalRate;
}

/**
 * Calculate total oil inventory (barrels) across all wells for a specific date
 * Uses the nearest gauging on or before the specified date
 */
export function calculateTotalOilInventory(
  wells: Well[],
  gaugings: TankGauging[],
  date: string | null
): number {
  let totalBarrels = 0;

  wells.forEach((well) => {
    const tankFactor = getTankFactor(well);
    if (tankFactor <= 0) return;

    ["Tank 1", "Tank 2", "Tank 3"].forEach((tankNumber) => {
      let latest: TankGauging | null = null;

      if (date) {
        // Get gauging for specific date (use nearest on or before that date)
        const dateGaugings = gaugings.filter((g) => {
          if (g.wellId !== well.id || g.tankNumber !== tankNumber) return false;
          const gaugeDate = new Date(g.timestamp || g.createdAt);
          const gaugeDateKey = format(gaugeDate, "yyyy-MM-dd");
          return gaugeDateKey <= date;
        });

        if (dateGaugings.length > 0) {
          latest = dateGaugings.sort(
            (a, b) =>
              new Date(b.timestamp || b.createdAt).getTime() -
              new Date(a.timestamp || a.createdAt).getTime()
          )[0];
        }
      } else {
        latest = getLatestGauging(gaugings, well.id, tankNumber);
      }

      if (latest) {
        const barrels = calculateBarrels(latest.level, tankFactor);
        totalBarrels += barrels;
      }
    });
  });

  return totalBarrels;
}

/**
 * Calculate total oil rate across all wells for a specific date
 */
export function calculateOilRateTotal(
  wells: Well[],
  gaugings: TankGauging[],
  date: string | null
): number {
  let total = 0;
  wells.forEach((well) => {
    total += calculateWellOilRate(well, gaugings, date);
  });
  return total;
}

/**
 * Calculate average oil rate using inventory change method
 * (Total Inventory at End - Total Inventory at Start) / Days
 * This gives an overall production rate for the period
 */
export function calculateOilRateFromInventoryChange(
  wells: Well[],
  gaugings: TankGauging[],
  startDate: Date,
  endDate: Date
): number {
  const startDateKey = format(startDate, "yyyy-MM-dd");
  const endDateKey = format(endDate, "yyyy-MM-dd");

  const inventoryAtStart = calculateTotalOilInventory(wells, gaugings, startDateKey);
  const inventoryAtEnd = calculateTotalOilInventory(wells, gaugings, endDateKey);

  // Calculate days difference (inclusive, so add 1)
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay) + 1);

  // Calculate inventory change (positive = inventory increased = production)
  const inventoryChange = inventoryAtEnd - inventoryAtStart;
  
  // Return the average rate
  // Note: This assumes inventory increases. If oil is picked up, inventory decreases
  // and we'd need to account for that separately
  return inventoryChange / daysDiff;
}

/**
 * Calculate total gas rate across all wells for a specific date
 */
export function calculateGasRateTotal(
  wells: Well[],
  readings: MeterReading[],
  date: string | null
): number {
  let total = 0;

  wells.forEach((well) => {
    let gasRateReadings = readings.filter((r) => {
      if (r.wellId !== well.id) return false;
      // Match "Gas Rate" case-insensitively, but exclude "Instant Gas Rate"
      const meterType = r.meterType || "";
      const meterTypeLower = meterType.toLowerCase();
      return (
        meterTypeLower === "gas rate" &&
        !meterTypeLower.includes("instant")
      );
    });

    if (date) {
      gasRateReadings = gasRateReadings.filter((r) => {
        // Try multiple ways to extract the date
        const timestampStr = r.timestamp || r.createdAt || "";
        
        // Method 1: If timestamp is a string with T, extract date part directly
        if (typeof timestampStr === "string" && timestampStr.includes("T")) {
          const datePart = timestampStr.split("T")[0];
          if (datePart === date) return true;
        }
        
        // Method 2: Parse as Date and format
        try {
          const readingDate = new Date(timestampStr);
          // Check if date is valid
          if (!isNaN(readingDate.getTime())) {
            const readingDateKey = format(readingDate, "yyyy-MM-dd");
            if (readingDateKey === date) return true;
            
            // Also try with UTC to avoid timezone issues
            const utcYear = readingDate.getUTCFullYear();
            const utcMonth = String(readingDate.getUTCMonth() + 1).padStart(2, "0");
            const utcDay = String(readingDate.getUTCDate()).padStart(2, "0");
            const utcDateKey = `${utcYear}-${utcMonth}-${utcDay}`;
            if (utcDateKey === date) return true;
          }
        } catch (e) {
          // Date parsing failed, continue to next method
        }
        
        // Method 3: If timestamp is just a date string (YYYY-MM-DD)
        if (typeof timestampStr === "string" && timestampStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          const datePart = timestampStr.substring(0, 10);
          if (datePart === date) return true;
        }
        
        return false;
      });
    }

    if (gasRateReadings.length > 0) {
      // Use latest reading for the date
      gasRateReadings.sort(
        (a, b) =>
          new Date(b.timestamp || b.createdAt).getTime() -
          new Date(a.timestamp || a.createdAt).getTime()
      );
      total += gasRateReadings[0].value || 0;
    }
  });

  return total;
}

/**
 * Calculate BOE (Barrel of Oil Equivalent)
 * BOE = Oil Rate + (Gas Rate / 6)
 */
export function calculateBOE(oilRate: number, gasRate: number): number {
  return oilRate + gasRate / 6;
}

/**
 * Get count of wells online (with data from today)
 */
export function getWellsOnline(
  wells: Well[],
  gaugings: TankGauging[],
  readings: MeterReading[]
): { count: number; percentage: number } {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const onlineWellIds = new Set<string>();

  // Check tank gaugings from today
  gaugings.forEach((g) => {
    const gaugeDate = new Date(g.timestamp || g.createdAt);
    const gaugeDateKey = format(gaugeDate, "yyyy-MM-dd");
    if (gaugeDateKey === todayKey) {
      onlineWellIds.add(g.wellId);
    }
  });

  // Check meter readings from today
  readings.forEach((r) => {
    const readingDate = new Date(r.timestamp || r.createdAt);
    const readingDateKey = format(readingDate, "yyyy-MM-dd");
    if (readingDateKey === todayKey) {
      onlineWellIds.add(r.wellId);
    }
  });

  const count = onlineWellIds.size;
  const percentage = wells.length > 0 ? (count / wells.length) * 100 : 0;

  return { count, percentage };
}

/**
 * Calculate monthly average of daily values
 */
export function calculateMonthlyAverage(
  values: number[],
  startDate: Date,
  endDate: Date
): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Get daily production data for the current month (up to today)
 */
export function getDailyProductionData(
  wells: Well[],
  gaugings: TankGauging[],
  readings: MeterReading[],
  startDate: Date,
  endDate: Date
): Array<{ date: string; oilRate: number; gasRate: number; boe: number; wellCount: number; wellPercentage: number }> {
  const dailyData: Record<
    string,
    { oilRate: number; gasRate: number; wellIds: Set<string> }
  > = {};

  // First, collect ALL dates that have actual data (readings or gaugings)
  // Don't filter by month yet - we'll include dates up to endDate (today)
  const datesWithData = new Set<string>();
  
  // Collect dates from readings (no month filter)
  readings.forEach((r) => {
    const timestampStr = r.timestamp || r.createdAt || "";
    if (timestampStr) {
      let dateKey = "";
      if (typeof timestampStr === "string" && timestampStr.includes("T")) {
        dateKey = timestampStr.split("T")[0];
      } else {
        try {
          dateKey = format(new Date(timestampStr), "yyyy-MM-dd");
        } catch {
          // Skip invalid dates
        }
      }
      if (dateKey) {
        datesWithData.add(dateKey);
      }
    }
  });
  
  // Collect dates from gaugings (no month filter)
  gaugings.forEach((g) => {
    const timestampStr = g.timestamp || g.createdAt || "";
    if (timestampStr) {
      let dateKey = "";
      if (typeof timestampStr === "string" && timestampStr.includes("T")) {
        dateKey = timestampStr.split("T")[0];
      } else {
        try {
          dateKey = format(new Date(timestampStr), "yyyy-MM-dd");
        } catch {
          // Skip invalid dates
        }
      }
      if (dateKey) {
        datesWithData.add(dateKey);
      }
    }
  });
  
  // Get all unique dates from start of month to today
  const currentDate = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Create entries for all dates in current month range
  while (currentDate <= today && currentDate <= endDate) {
    const dateKey = format(currentDate, "yyyy-MM-dd");
    dailyData[dateKey] = {
      oilRate: 0,
      gasRate: 0,
      wellIds: new Set<string>(),
    };
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Also add any dates with data, regardless of whether they're in the current month
  // This ensures we include all dates that have actual data
  datesWithData.forEach((dateKey) => {
    if (!dailyData[dateKey]) {
      try {
        const dateObj = new Date(dateKey + "T00:00:00");
        // Include all dates that have data, even if they're outside the current month range
        // This allows showing data from any date that has readings or gaugings
        dailyData[dateKey] = {
          oilRate: 0,
          gasRate: 0,
          wellIds: new Set<string>(),
        };
      } catch {
        // Skip invalid dates
      }
    }
  });

  // Process tank gaugings for oil rates
  gaugings.forEach((g) => {
    // Extract date key using same logic as date collection
    const timestampStr = g.timestamp || g.createdAt || "";
    if (timestampStr) {
      let dateKey = "";
      if (typeof timestampStr === "string" && timestampStr.includes("T")) {
        dateKey = timestampStr.split("T")[0];
      } else {
        try {
          dateKey = format(new Date(timestampStr), "yyyy-MM-dd");
        } catch {
          // Skip invalid dates
        }
      }
      // Only process if this date is in dailyData (which includes dates up to endDate)
      if (dateKey && dailyData[dateKey]) {
        dailyData[dateKey].wellIds.add(g.wellId);
      }
    }
  });

  // Process meter readings for gas rates and well tracking
  readings.forEach((r) => {
    // Extract date key using same logic as calculateGasRateTotal
    const timestampStr = r.timestamp || r.createdAt || "";
    if (timestampStr) {
      let dateKey = "";
      
      if (typeof timestampStr === "string" && timestampStr.includes("T")) {
        dateKey = timestampStr.split("T")[0];
      } else {
        try {
          dateKey = format(new Date(timestampStr), "yyyy-MM-dd");
        } catch {
          // Skip invalid dates
        }
      }
      
      // Only process if this date is in dailyData (which includes dates up to endDate)
      if (dateKey && dailyData[dateKey]) {
        dailyData[dateKey].wellIds.add(r.wellId);
      }
    }
  });

  // Calculate oil rates and gas rates per date
  // Note: We pass all readings/gaugings to the calculation functions, which will filter by date internally
  Object.keys(dailyData).forEach((dateKey) => {
    dailyData[dateKey].oilRate = calculateOilRateTotal(wells, gaugings, dateKey);
    const gasRate = calculateGasRateTotal(wells, readings, dateKey);
    dailyData[dateKey].gasRate = gasRate;
    
    // Debug for December 9th specifically (disabled to reduce console noise)
    // Uncomment if needed for debugging
    // if (process.env.NODE_ENV === "development" && dateKey === "2025-12-09") {
    //   const gasReadingsForDate = readings.filter((r) => {
    //     if (r.wellId && !wells.find((w: any) => w.id === r.wellId)) return false;
    //     const meterType = r.meterType || "";
    //     const meterTypeLower = meterType.toLowerCase();
    //     const isGasRate = meterTypeLower === "gas rate" && !meterTypeLower.includes("instant");
    //     
    //     if (!isGasRate) return false;
    //     
    //     const timestampStr = r.timestamp || r.createdAt || "";
    //     if (typeof timestampStr === "string" && timestampStr.includes("T")) {
    //       return timestampStr.split("T")[0] === dateKey;
    //     }
    //     try {
    //       return format(new Date(timestampStr), "yyyy-MM-dd") === dateKey;
    //     } catch {
    //       return false;
    //     }
    //   });
    //   console.log(`Dec 9th debug - Found ${gasReadingsForDate.length} gas rate readings:`, gasReadingsForDate.map(r => ({
    //     wellId: r.wellId,
    //     meterType: r.meterType,
    //     value: r.value,
    //     timestamp: r.timestamp,
    //     createdAt: r.createdAt
    //   })));
    //   console.log(`Dec 9th debug - Calculated gas rate: ${gasRate}`);
    // }
  });
  
  // Debug: Log if we have readings for dates not in dailyData (disabled to reduce console noise)
  // Uncomment if needed for debugging
  // if (process.env.NODE_ENV === "development") {
  //   const allReadingDates = new Set<string>();
  //   readings.forEach((r) => {
  //     const timestampStr = r.timestamp || r.createdAt || "";
  //     if (timestampStr) {
  //       let dateKey = "";
  //       if (typeof timestampStr === "string" && timestampStr.includes("T")) {
  //         dateKey = timestampStr.split("T")[0];
  //       } else {
  //         try {
  //           dateKey = format(new Date(timestampStr), "yyyy-MM-dd");
  //         } catch {
  //           // Skip invalid dates
  //         }
  //       }
  //       if (dateKey && !dailyData[dateKey]) {
  //         allReadingDates.add(dateKey);
  //       }
  //     }
  //   });
  //   if (allReadingDates.size > 0) {
  //     console.log("Readings found for dates not in dailyData:", Array.from(allReadingDates).sort());
  //   }
  // }

  // Convert to array format
  return Object.keys(dailyData)
    .sort()
    .map((dateKey) => {
      const data = dailyData[dateKey];
      const wellCount = data.wellIds.size;
      const wellPercentage = wells.length > 0 ? (wellCount / wells.length) * 100 : 0;
      return {
        date: dateKey,
        oilRate: data.oilRate,
        gasRate: data.gasRate,
        boe: calculateBOE(data.oilRate, data.gasRate),
        wellCount: wellCount,
        wellPercentage: wellPercentage,
      };
    });
}

