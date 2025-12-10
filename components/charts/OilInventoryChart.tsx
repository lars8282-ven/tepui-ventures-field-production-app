"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { calculateBarrels, getTankFactor, type TankGauging } from "@/lib/calculations";
import { format } from "date-fns";

interface Well {
  id: string;
  name: string;
  wellNumber: string;
  metadata?: {
    tankFactor?: number | string;
    [key: string]: any;
  };
}

interface OilInventoryChartProps {
  wells: Well[];
  gaugings: TankGauging[];
}

interface ChartDataPoint {
  date: string;
  total: number;
}

export function OilInventoryChart({
  wells,
  gaugings,
}: OilInventoryChartProps) {
  // Process data for chart - calculate combined total for all wells and all tanks
  const chartData = useMemo(() => {
    // First, group gaugings by date (day-level aggregation) and well/tank
    const dataByDate: Record<
      string,
      Record<string, Record<string, number>>
    > = {};

    gaugings.forEach((gauging) => {
      const wellId = gauging.wellId;
      const tankNumber = gauging.tankNumber || "Unknown";
      const date = new Date(gauging.timestamp || gauging.createdAt);
      const dateKey = format(date, "yyyy-MM-dd");

      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = {};
      }
      if (!dataByDate[dateKey][wellId]) {
        dataByDate[dateKey][wellId] = {};
      }

      const well = wells.find((w) => w.id === wellId);
      const tankFactor = well ? getTankFactor(well) : 0;
      const barrels = calculateBarrels(gauging.level, tankFactor);

      // Store the maximum value for this well/tank/date combination
      if (
        !dataByDate[dateKey][wellId][tankNumber] ||
        barrels > dataByDate[dateKey][wellId][tankNumber]
      ) {
        dataByDate[dateKey][wellId][tankNumber] = barrels;
      }
    });

    // Convert to array format and calculate total for each date with forward-filling
    // Build last known values as we iterate through dates chronologically
    const lastKnownValues: Record<string, Record<string, number>> = {};
    
    // Initialize last known values structure
    wells.forEach((well) => {
      lastKnownValues[well.id] = {};
    });

    const dates = Object.keys(dataByDate).sort();
    const data: ChartDataPoint[] = dates.map((date) => {
      const dateData = dataByDate[date];
      let total = 0;

      // Sum all barrels across all wells and all tanks for this date
      // Use forward-filled values (last known) if no data for this date
      wells.forEach((well) => {
        ["Tank 1", "Tank 2", "Tank 3"].forEach((tankNumber) => {
          // If we have data for this date, use it and update last known
          if (dateData[well.id]?.[tankNumber] !== undefined) {
            const value = dateData[well.id][tankNumber];
            lastKnownValues[well.id][tankNumber] = value;
            total += value;
          } else {
            // Forward-fill: use last known value (or 0 if never seen)
            const value = lastKnownValues[well.id]?.[tankNumber] ?? 0;
            total += value;
          }
        });
      });

      return {
        date,
        total: total,
      };
    });

    return data;
  }, [gaugings, wells]);

  if (gaugings.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <p className="text-gray-600">No gauging data available for chart.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Combined Total Oil Inventory Over Time
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Total barrels across all wells and all tanks
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => format(new Date(value), "MMM d")}
          />
          <YAxis label={{ value: "Barrels", angle: -90, position: "insideLeft" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
            labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")}
            formatter={(value: any) => [`${Number(value).toFixed(1)} bbls`, "Total"]}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#00BFFF"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Total Inventory"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

