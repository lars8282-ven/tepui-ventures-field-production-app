"use client";

import { useMemo } from "react";
import {
  calculateBarrels,
  calculateRate,
  calculateDaysDifference,
  getLatestGauging,
  getGaugingByDate,
  getPreviousGauging,
  getTankFactor,
  getTankColorClass,
  type TankGauging,
} from "@/lib/calculations";

interface Well {
  id: string;
  name: string;
  wellNumber: string;
  metadata?: {
    tankFactor?: number | string;
    [key: string]: any;
  };
}

interface OilInventoryTableProps {
  wells: Well[];
  gaugings: TankGauging[];
  selectedDate?: string | null;
}

interface TankData {
  barrels: number;
  rate: number | null;
  timestamp: string | null;
}

export function OilInventoryTable({
  wells,
  gaugings,
  selectedDate = null,
}: OilInventoryTableProps) {
  // Process data: Get gauging for each well/tank combination (by date if specified)
  const inventoryData = useMemo(() => {
    const data: Record<
      string,
      Record<string, TankData>
    > = {};

    wells.forEach((well) => {
      const wellId = well.id;
      data[wellId] = {};

      // Process each tank (Tank 1, 2, 3)
      ["Tank 1", "Tank 2", "Tank 3"].forEach((tankNumber) => {
        // Use date-specific function if date is selected, otherwise use latest
        const latest = selectedDate
          ? getGaugingByDate(gaugings, wellId, tankNumber, selectedDate)
          : getLatestGauging(gaugings, wellId, tankNumber);
        const tankFactor = getTankFactor(well);

        if (latest && tankFactor > 0) {
          const barrels = calculateBarrels(latest.level, tankFactor);
          // For rate calculation, still use previous gauging (before the selected date if applicable)
          const previous = getPreviousGauging(
            gaugings,
            wellId,
            tankNumber,
            latest.timestamp || latest.createdAt
          );

          let rate: number | null = null;
          if (previous) {
            const daysDiff = calculateDaysDifference(
              latest.timestamp || latest.createdAt,
              previous.timestamp || previous.createdAt
            );
            const previousBarrels = calculateBarrels(
              previous.level,
              tankFactor
            );
            rate = calculateRate(barrels, previousBarrels, daysDiff);
          }

          data[wellId][tankNumber] = {
            barrels,
            rate,
            timestamp: latest.timestamp || latest.createdAt,
          };
        } else {
          data[wellId][tankNumber] = {
            barrels: 0,
            rate: null,
            timestamp: null,
          };
        }
      });
    });

    return data;
  }, [wells, gaugings, selectedDate]);

  // Calculate totals for each tank across all wells
  const tankTotals = useMemo(() => {
    const totals: Record<string, number> = {
      "Tank 1": 0,
      "Tank 2": 0,
      "Tank 3": 0,
    };

    Object.values(inventoryData).forEach((wellData) => {
      ["Tank 1", "Tank 2", "Tank 3"].forEach((tankNumber) => {
        totals[tankNumber] += wellData[tankNumber]?.barrels || 0;
      });
    });

    return totals;
  }, [inventoryData]);

  const grandTotal = useMemo(() => {
    return tankTotals["Tank 1"] + tankTotals["Tank 2"] + tankTotals["Tank 3"];
  }, [tankTotals]);

  // Determine which tanks have inventory (at least one well with > 0 barrels)
  const tanksWithInventory = useMemo(() => {
    const tanks: string[] = [];
    ["Tank 1", "Tank 2", "Tank 3"].forEach((tankNumber) => {
      if (tankTotals[tankNumber] > 0) {
        tanks.push(tankNumber);
      }
    });
    return tanks;
  }, [tankTotals]);

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
        <h2 className="text-lg font-semibold text-gray-900">Oil Inventory</h2>
        <p className="mt-1 text-sm text-gray-600">
          Current tank levels in barrels. Green indicates ready for pickup (≥130 bbls).
          {tanksWithInventory.length < 3 && (
            <span className="ml-2 text-xs text-gray-500">
              (Showing only tanks with inventory)
            </span>
          )}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Well
              </th>
              {tanksWithInventory.map((tankNumber, index) => (
                <th
                  key={tankNumber}
                  className={`px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    index === 0 ? "border-l border-gray-200" : ""
                  }`}
                >
                  {tankNumber}
                </th>
              ))}
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200 bg-gray-100">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {wells.map((well) => {
              const wellData = inventoryData[well.id] || {};
              const wellTotal = tanksWithInventory.reduce((sum, tankNumber) => {
                return sum + (wellData[tankNumber]?.barrels || 0);
              }, 0);

              // Only show wells that have inventory in at least one tank
              if (wellTotal === 0) return null;

              return (
                <tr key={well.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{well.name}</div>
                    <div className="text-xs text-gray-500">{well.wellNumber}</div>
                  </td>
                  {tanksWithInventory.map((tankNumber, index) => {
                    const tankData = wellData[tankNumber] || { barrels: 0, rate: null };
                    return (
                      <td
                        key={tankNumber}
                        className={`px-6 py-4 whitespace-nowrap text-sm text-center ${
                          index === 0 ? "border-l border-gray-200" : ""
                        } ${getTankColorClass(tankData.barrels)}`}
                      >
                        <div className="font-semibold">
                          {tankData.barrels > 0 ? `${tankData.barrels.toFixed(1)} bbls` : "-"}
                        </div>
                        {tankData.rate !== null && (
                          <div className="text-xs mt-1 opacity-75">
                            {tankData.rate > 0 ? "+" : ""}
                            {tankData.rate.toFixed(2)} bbls/day
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-center border-l border-gray-200 bg-gray-50 ${getTankColorClass(wellTotal)}`}>
                    {wellTotal.toFixed(1)} bbls
                  </td>
                </tr>
              );
            })}
            {/* Totals Row */}
            <tr className="bg-gray-100 border-t-2 border-gray-300">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                Total
              </td>
              {tanksWithInventory.map((tankNumber, index) => (
                <td
                  key={tankNumber}
                  className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-center ${
                    index === 0 ? "border-l border-gray-200" : ""
                  } bg-gray-50`}
                >
                  {tankTotals[tankNumber].toFixed(1)} bbls
                </td>
              ))}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center border-l border-gray-200 bg-tepui-blue bg-opacity-10">
                {grandTotal.toFixed(1)} bbls
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

