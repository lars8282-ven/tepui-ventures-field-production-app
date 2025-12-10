"use client";

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
  wellCount: number;
  wellPercentage: number;
}

interface DashboardWellsChartProps {
  data: ChartDataPoint[];
}

export function DashboardWellsChart({ data }: DashboardWellsChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <p className="text-gray-600">No well data available for chart.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Wells Running Over Time
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Number of wells with data per day
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => format(new Date(value), "MMM d")}
          />
          <YAxis
            yAxisId="left"
            label={{ value: "Number of Wells", angle: -90, position: "insideLeft" }}
            domain={[0, "dataMax + 1"]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ value: "Percentage (%)", angle: 90, position: "insideRight" }}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
            labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")}
            formatter={(value: any, name: string) => {
              if (name === "wellCount") {
                return [`${Number(value).toFixed(0)} wells`, "Wells Running"];
              }
              if (name === "wellPercentage") {
                return [`${Number(value).toFixed(1)}%`, "Percentage Online"];
              }
              return [value, name];
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="wellCount"
            stroke="#2C2C2C"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Wells Running"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="wellPercentage"
            stroke="#00BFFF"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Percentage Online (%)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

