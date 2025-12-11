"use client";

import { useMemo } from "react";
import { format } from "date-fns";

interface Well {
  id: string;
  name: string;
  wellNumber: string;
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

interface GasSummaryTableProps {
  wells: Well[];
  readings: MeterReading[];
  selectedDate?: string | null;
}

interface GasData {
  gasRate: { value: number; timestamp: string; rate: number | null };
  instantGasRate: { value: number; timestamp: string; rate: number | null };
}

export function GasSummaryTable({
  wells,
  readings,
  selectedDate = null,
}: GasSummaryTableProps) {
  // Process data: Get readings for each well (by date if specified)
  const gasData = useMemo(() => {
    const data: Record<string, GasData> = {};

    wells.forEach((well) => {
      const wellId = well.id;

      // Get ALL Gas Rate readings for this well (needed to find previous day)
      const allGasRateReadings = readings.filter(
        (r) =>
          r.wellId === wellId &&
          (r.meterType === "Gas Rate" || r.meterType === "gas rate")
      );

      // Get ALL Instant Gas Rate readings for this well (needed to find previous day)
      const allInstantGasRateReadings = readings.filter(
        (r) =>
          r.wellId === wellId &&
          (r.meterType === "Instant Gas Rate" ||
            r.meterType === "instant gas rate")
      );

      // Helper function to find reading from exactly one day before a given date
      const findPreviousDayReading = (readingsList: any[], referenceDate: Date): any | null => {
        const previousDay = new Date(referenceDate);
        previousDay.setDate(previousDay.getDate() - 1);
        const previousDayKey = format(previousDay, "yyyy-MM-dd");
        
        // Find reading from the previous day
        return readingsList.find((r) => {
          // Extract date key directly from ISO string to avoid timezone issues
          const timestampStr = r.timestamp || r.createdAt || "";
          let readingDateKey = "";
          if (typeof timestampStr === "string" && timestampStr.includes("T")) {
            readingDateKey = timestampStr.split("T")[0];
          } else {
            try {
              readingDateKey = format(new Date(timestampStr), "yyyy-MM-dd");
            } catch {
              return false;
            }
          }
          return readingDateKey === previousDayKey;
        }) || null;
      };

      // Get the latest reading (filtered by date if specified, otherwise most recent)
      let latestGasRate: any = null;
      if (selectedDate) {
        // If date is selected, get the reading from that specific date
        latestGasRate = allGasRateReadings
          .filter((r) => {
            // Extract date key directly from ISO string to avoid timezone issues
            const timestampStr = r.timestamp || r.createdAt || "";
            let readingDateKey = "";
            if (typeof timestampStr === "string" && timestampStr.includes("T")) {
              readingDateKey = timestampStr.split("T")[0];
            } else {
              try {
                readingDateKey = format(new Date(timestampStr), "yyyy-MM-dd");
              } catch {
                return false;
              }
            }
            return readingDateKey === selectedDate;
          })
          .sort((a, b) =>
            new Date(b.timestamp || b.createdAt).getTime() -
            new Date(a.timestamp || a.createdAt).getTime()
          )[0];
      } else {
        // Otherwise, get the most recent reading
        latestGasRate = allGasRateReadings.sort(
          (a, b) =>
            new Date(b.timestamp || b.createdAt).getTime() -
            new Date(a.timestamp || a.createdAt).getTime()
        )[0];
      }

      // Find the reading from exactly one day before the latest reading
      const previousGasRate = latestGasRate
        ? findPreviousDayReading(allGasRateReadings, new Date(latestGasRate.timestamp || latestGasRate.createdAt))
        : null;

      let gasRateRate: number | null = null;
      if (latestGasRate && previousGasRate) {
        // Calculate change in rate from previous day
        gasRateRate = latestGasRate.value - previousGasRate.value;
      }

      // Get the latest Instant Gas Rate reading
      let latestInstantGasRate: any = null;
      if (selectedDate) {
        // If date is selected, get the reading from that specific date
        latestInstantGasRate = allInstantGasRateReadings
          .filter((r) => {
            // Extract date key directly from ISO string to avoid timezone issues
            const timestampStr = r.timestamp || r.createdAt || "";
            let readingDateKey = "";
            if (typeof timestampStr === "string" && timestampStr.includes("T")) {
              readingDateKey = timestampStr.split("T")[0];
            } else {
              try {
                readingDateKey = format(new Date(timestampStr), "yyyy-MM-dd");
              } catch {
                return false;
              }
            }
            return readingDateKey === selectedDate;
          })
          .sort((a, b) =>
            new Date(b.timestamp || b.createdAt).getTime() -
            new Date(a.timestamp || a.createdAt).getTime()
          )[0];
      } else {
        // Otherwise, get the most recent reading
        latestInstantGasRate = allInstantGasRateReadings.sort(
          (a, b) =>
            new Date(b.timestamp || b.createdAt).getTime() -
            new Date(a.timestamp || a.createdAt).getTime()
        )[0];
      }

      // Find the reading from exactly one day before the latest reading
      const previousInstantGasRate = latestInstantGasRate
        ? findPreviousDayReading(allInstantGasRateReadings, new Date(latestInstantGasRate.timestamp || latestInstantGasRate.createdAt))
        : null;

      let instantGasRateRate: number | null = null;
      if (latestInstantGasRate && previousInstantGasRate) {
        // Calculate change in rate from previous day
        instantGasRateRate = latestInstantGasRate.value - previousInstantGasRate.value;
      }

      data[wellId] = {
        gasRate: {
          value: latestGasRate?.value || 0,
          timestamp: latestGasRate?.timestamp || latestGasRate?.createdAt || "",
          rate: gasRateRate,
        },
        instantGasRate: {
          value: latestInstantGasRate?.value || 0,
          timestamp:
            latestInstantGasRate?.timestamp || latestInstantGasRate?.createdAt || "",
          rate: instantGasRateRate,
        },
      };
    });

    return data;
  }, [wells, readings, selectedDate]);

  // Calculate totals
  const totals = useMemo(() => {
    let gasRateTotal = 0;
    let instantGasRateTotal = 0;

    Object.values(gasData).forEach((wellData) => {
      gasRateTotal += wellData.gasRate.value || 0;
      instantGasRateTotal += wellData.instantGasRate.value || 0;
    });

    return {
      gasRate: gasRateTotal,
      instantGasRate: instantGasRateTotal,
    };
  }, [gasData]);

  // Filter wells that have at least one rate > 0
  const wellsWithData = useMemo(() => {
    return wells.filter((well) => {
      const data = gasData[well.id];
      return (data?.gasRate.value || 0) > 0 || (data?.instantGasRate.value || 0) > 0;
    });
  }, [wells, gasData]);

  if (wells.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <p className="text-gray-600">No active wells found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Gas Summary</h2>
        <p className="mt-1 text-sm text-gray-600">
          Current gas rates and production rates per well
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Well
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200">
                Gas Rate (MCF/day)
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Instant Gas Rate (MCF/day)
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {wellsWithData.map((well) => {
              const data = gasData[well.id];
              const gasRateData = data?.gasRate || { value: 0, timestamp: "", rate: null };
              const instantGasRateData = data?.instantGasRate || { value: 0, timestamp: "", rate: null };

              return (
                <tr key={well.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{well.name}</div>
                    <div className="text-xs text-gray-500">{well.wellNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-l border-gray-200">
                    <div className="font-semibold text-gray-900">
                      {gasRateData.value > 0 ? `${gasRateData.value.toFixed(1)} MCF/day` : "-"}
                    </div>
                    {gasRateData.rate !== null && (
                      <div className="text-xs text-gray-600 mt-1">
                        {gasRateData.rate > 0 ? "+" : ""}
                        {gasRateData.rate.toFixed(2)} MCF/day change
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <div className="font-semibold text-gray-900">
                      {instantGasRateData.value > 0 ? `${instantGasRateData.value.toFixed(1)} MCF/day` : "-"}
                    </div>
                    {instantGasRateData.rate !== null && (
                      <div className="text-xs text-gray-600 mt-1">
                        {instantGasRateData.rate > 0 ? "+" : ""}
                        {instantGasRateData.rate.toFixed(2)} MCF/day change
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Totals Row */}
            <tr className="bg-gray-100 border-t-2 border-gray-300">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                Total
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center border-l border-gray-200 bg-gray-50">
                {totals.gasRate.toFixed(1)} MCF/day
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center bg-gray-50">
                {totals.instantGasRate.toFixed(1)} MCF/day
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

