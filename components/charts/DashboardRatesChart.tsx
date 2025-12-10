"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

interface ChartDataPoint {
  date: string;
  oilRate: number;
  gasRate: number;
  boe: number;
}

interface BaselineDataPoint {
  date: string;
  oilRate: number;
  gasRate: number;
  boe: number;
}

interface DashboardRatesChartProps {
  data: ChartDataPoint[];
  baselineData?: BaselineDataPoint[];
}

export function DashboardRatesChart({ data, baselineData = [] }: DashboardRatesChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <p className="text-gray-600">No rate data available for chart.</p>
      </div>
    );
  }

  // Merge baseline data with chart data
  // Sort by date to ensure proper ordering
  // Use useMemo to create a new array reference when data changes
  const chartDataWithBaseline = useMemo(() => {
    const sortedData = [...data].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    
    return sortedData.map((point) => {
      const baseline = baselineData.find((b) => b.date === point.date);
      return {
        ...point,
        baselineOilRate: baseline && baseline.oilRate > 0 ? baseline.oilRate : null,
        baselineGasRate: baseline && baseline.gasRate > 0 ? baseline.gasRate : null,
        baselineBOE: baseline && baseline.boe > 0 ? baseline.boe : null,
      };
    });
  }, [data, baselineData]);

  // Check if we have any baseline data to display
  const hasBaselineData = chartDataWithBaseline.some(
    (d) => d.baselineOilRate !== null || d.baselineGasRate !== null || d.baselineBOE !== null
  );
  
  // Debug: Log data for Dec 9th
  if (process.env.NODE_ENV === "development") {
    const dec9Data = chartDataWithBaseline.find((d) => d.date === "2025-12-09");
    if (dec9Data) {
      console.log("Chart component - Dec 9th data received - date:", dec9Data.date, "gasRate:", dec9Data.gasRate, "oilRate:", dec9Data.oilRate, "boe:", dec9Data.boe);
      const dec9Raw = data.find((d) => d.date === "2025-12-09");
      if (dec9Raw) {
        console.log("Chart component - Dec 9th raw data - date:", dec9Raw.date, "gasRate:", dec9Raw.gasRate, "oilRate:", dec9Raw.oilRate, "boe:", dec9Raw.boe);
      }
      // Log all dates to see the full range
      const allDates = chartDataWithBaseline.map(d => d.date).sort();
      console.log("Chart component - All dates in chart (total:", allDates.length, "):", allDates);
      const dec9Index = allDates.indexOf("2025-12-09");
      console.log("Chart component - Dec 9th index in sorted array:", dec9Index, "out of", allDates.length);
    } else {
      console.log("Chart component - Dec 9th NOT FOUND in chartDataWithBaseline. Total entries:", chartDataWithBaseline.length);
      console.log("Chart component - Available dates (first 5, last 5):", [
        ...chartDataWithBaseline.slice(0, 5).map(d => d.date),
        "...",
        ...chartDataWithBaseline.slice(-5).map(d => d.date)
      ]);
      const dec9InData = data.find((d) => d.date === "2025-12-09");
      console.log("Chart component - Dec 9th in raw data prop:", dec9InData ? `YES - gasRate: ${dec9InData.gasRate}` : "NO");
    }
  }
  
  // Use a key based on data hash to force re-render when data changes
  // Include a hash of the last few data points to detect value changes
  const dataHash = chartDataWithBaseline.length > 0
    ? chartDataWithBaseline.slice(-5).map(d => `${d.date}:${d.gasRate}:${d.oilRate}`).join('|')
    : 'empty';
  const chartKey = `chart-${chartDataWithBaseline.length}-${dataHash.substring(0, 50)}`;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Production Rates Over Time
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Daily totals for Oil Rate, Gas Rate, and BOE
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart key={chartKey} data={chartDataWithBaseline} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            type="category"
            tickFormatter={(value) => {
              try {
                return format(new Date(value), "MMM d");
              } catch {
                return String(value);
              }
            }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            yAxisId="left"
            label={{ value: "Oil Rate / BOE (bbls/day)", angle: -90, position: "insideLeft" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ value: "Gas Rate (MCF/day)", angle: 90, position: "insideRight" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
            labelFormatter={(value) => {
              try {
                // Value might be a timestamp or date string
                const date = typeof value === 'number' ? new Date(value) : new Date(value);
                return format(date, "MMM d, yyyy");
              } catch {
                return String(value);
              }
            }}
            formatter={(value: any, name: string) => {
              if (name === "oilRate") {
                return [`${Number(value).toFixed(2)} bbls/day`, "Oil Rate"];
              }
              if (name === "gasRate") {
                return [`${Number(value).toFixed(1)} MCF/day`, "Gas Rate"];
              }
              if (name === "boe") {
                return [`${Number(value).toFixed(2)} BOE/day`, "BOE"];
              }
              if (name === "baselineOilRate") {
                return [`${Number(value).toFixed(2)} bbls/day`, "Baseline Oil Rate"];
              }
              if (name === "baselineGasRate") {
                return [`${Number(value).toFixed(1)} MCF/day`, "Baseline Gas Rate"];
              }
              if (name === "baselineBOE") {
                return [`${Number(value).toFixed(2)} BOE/day`, "Baseline BOE"];
              }
              return [value, name];
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="oilRate"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="Oil Rate (bbls/day)"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="gasRate"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="Gas Rate (MCF/day)"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="boe"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="BOE (bbls/day)"
          />
          {hasBaselineData && (
            <>
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="baselineOilRate"
                stroke="#6B7280"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="Baseline Oil Rate"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="baselineGasRate"
                stroke="#6B7280"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="Baseline Gas Rate"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="baselineBOE"
                stroke="#6B7280"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="Baseline BOE"
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

