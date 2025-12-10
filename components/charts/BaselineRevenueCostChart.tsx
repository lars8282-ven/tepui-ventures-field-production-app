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

interface RevenueCostDataPoint {
  period: string | number;
  revenue?: number;
  operatingCosts?: number;
  capitalCosts?: number;
  netRevenue?: number;
}

interface BaselineRevenueCostChartProps {
  data: RevenueCostDataPoint[];
}

export function BaselineRevenueCostChart({ data }: BaselineRevenueCostChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <p className="text-gray-600">No revenue/cost forecast data available.</p>
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map((d) => ({
    period: String(d.period),
    Revenue: d.revenue || 0,
    "Operating Costs": d.operatingCosts || 0,
    "Capital Costs": d.capitalCosts || 0,
    "Net Revenue": d.netRevenue || 0,
  }));

  // Determine which series have data
  const hasRevenue = data.some((d) => d.revenue !== undefined && d.revenue !== 0);
  const hasOpCosts = data.some((d) => d.operatingCosts !== undefined && d.operatingCosts !== 0);
  const hasCapCosts = data.some((d) => d.capitalCosts !== undefined && d.capitalCosts !== 0);
  const hasNetRev = data.some((d) => d.netRevenue !== undefined && d.netRevenue !== 0);

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Revenue and Cost Structure
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Revenue and cost breakdown over time
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="period" 
            label={{ value: "Period", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            label={{ value: "Amount ($)", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
            formatter={(value: any, name: string) => {
              const numValue = typeof value === "number" ? value : parseFloat(value) || 0;
              const formattedValue = numValue.toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              });
              return [formattedValue, name];
            }}
          />
          <Legend />
          {hasRevenue && (
            <Line
              type="monotone"
              dataKey="Revenue"
              stroke="#10B981"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
          {hasOpCosts && (
            <Line
              type="monotone"
              dataKey="Operating Costs"
              stroke="#EF4444"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
          {hasCapCosts && (
            <Line
              type="monotone"
              dataKey="Capital Costs"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
          {hasNetRev && (
            <Line
              type="monotone"
              dataKey="Net Revenue"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

