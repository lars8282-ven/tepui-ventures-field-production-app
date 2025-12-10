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

interface GasRateChartProps {
  wells: Well[];
  readings: MeterReading[];
}

interface ChartDataPoint {
  date: string;
  totalGasRate: number;
  totalInstantGasRate: number;
}

export function GasRateChart({ wells, readings }: GasRateChartProps) {
  // Process data for chart - calculate separate totals for Gas Rate and Instant Gas Rate
  const chartData = useMemo(() => {
    // Group readings by date (day-level aggregation) and well
    const dataByDate: Record<
      string,
      Record<string, { gasRate: number; instantGasRate: number; timestamp: number }>
    > = {};

    readings.forEach((reading) => {
      const wellId = reading.wellId;
      const meterType = reading.meterType || "";
      const date = new Date(reading.timestamp || reading.createdAt);
      const dateKey = format(date, "yyyy-MM-dd");

      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = {};
      }
      if (!dataByDate[dateKey][wellId]) {
        dataByDate[dateKey][wellId] = {
          gasRate: 0,
          instantGasRate: 0,
          timestamp: new Date(reading.timestamp || reading.createdAt).getTime(),
        };
      }

      // Store the latest value for this well/date/meterType combination
      const currentTimestamp = new Date(
        reading.timestamp || reading.createdAt
      ).getTime();
      const existing = dataByDate[dateKey][wellId];

      if (
        (meterType === "Gas Rate" || meterType === "gas rate") &&
        (currentTimestamp >= existing.timestamp || existing.gasRate === 0)
      ) {
        existing.gasRate = reading.value;
        if (currentTimestamp > existing.timestamp) {
          existing.timestamp = currentTimestamp;
        }
      } else if (
        (meterType === "Instant Gas Rate" || meterType === "instant gas rate") &&
        (currentTimestamp >= existing.timestamp || existing.instantGasRate === 0)
      ) {
        existing.instantGasRate = reading.value;
        if (currentTimestamp > existing.timestamp) {
          existing.timestamp = currentTimestamp;
        }
      }
    });

    // Build last known values for forward-filling
    const lastKnownValues: Record<string, { gasRate: number; instantGasRate: number }> = {};
    wells.forEach((well) => {
      lastKnownValues[well.id] = { gasRate: 0, instantGasRate: 0 };
    });

    // Convert to array format and calculate totals for each date with forward-filling
    const dates = Object.keys(dataByDate).sort();
    const data: ChartDataPoint[] = dates.map((date) => {
      const dateData = dataByDate[date];
      let totalGasRate = 0;
      let totalInstantGasRate = 0;

      // Sum all rates across all wells for this date (separate totals)
      // Use forward-filled values (last known) if no data for this date
      wells.forEach((well) => {
        const dateWellData = dateData[well.id];
        let gasRate = 0;
        let instantGasRate = 0;

        if (dateWellData) {
          gasRate = dateWellData.gasRate || lastKnownValues[well.id]?.gasRate || 0;
          instantGasRate = dateWellData.instantGasRate || lastKnownValues[well.id]?.instantGasRate || 0;
          
          // Update last known if we have actual data
          if (dateWellData.gasRate > 0) {
            lastKnownValues[well.id].gasRate = dateWellData.gasRate;
          }
          if (dateWellData.instantGasRate > 0) {
            lastKnownValues[well.id].instantGasRate = dateWellData.instantGasRate;
          }
        } else {
          // Forward-fill: use last known values
          gasRate = lastKnownValues[well.id]?.gasRate || 0;
          instantGasRate = lastKnownValues[well.id]?.instantGasRate || 0;
        }

        // Add to separate totals
        totalGasRate += gasRate;
        totalInstantGasRate += instantGasRate;
      });

      return {
        date,
        totalGasRate: totalGasRate,
        totalInstantGasRate: totalInstantGasRate,
      };
    });

    return data;
  }, [readings, wells]);

  if (readings.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <p className="text-gray-600">No gas rate data available for chart.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Total Gas Rates Over Time
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Combined totals for Gas Rate and Instant Gas Rate across all wells
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => format(new Date(value), "MMM d")}
          />
          <YAxis label={{ value: "Gas Rate (MCF)", angle: -90, position: "insideLeft" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
            labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")}
            formatter={(value: any, name: string) => [
              `${Number(value).toFixed(1)} MCF`,
              name === "totalGasRate" ? "Gas Rate" : "Instant Gas Rate",
            ]}
          />
          <Line
            type="monotone"
            dataKey="totalGasRate"
            stroke="#00BFFF"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Gas Rate"
          />
          <Line
            type="monotone"
            dataKey="totalInstantGasRate"
            stroke="#2C2C2C"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Instant Gas Rate"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

