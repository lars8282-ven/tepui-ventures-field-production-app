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

interface RunTicket {
  id: string;
  date: string;
  estimatedNetOil: number;
  createdAt?: string;
}

interface RunTicketsVolumeChartProps {
  runTickets: RunTicket[];
}

interface ChartDataPoint {
  date: string;
  cumulative: number;
  daily: number;
}

export function RunTicketsVolumeChart({
  runTickets,
}: RunTicketsVolumeChartProps) {
  const chartData = useMemo(() => {
    if (runTickets.length === 0) {
      return [];
    }

    // Group tickets by date and calculate daily totals
    const dailyTotals: Record<string, number> = {};
    
    runTickets.forEach((ticket) => {
      const dateKey = ticket.date ? ticket.date.split("T")[0] : "";
      if (dateKey) {
        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + (ticket.estimatedNetOil || 0);
      }
    });

    // Sort dates chronologically
    const sortedDates = Object.keys(dailyTotals).sort();

    // Calculate cumulative totals and build chart data
    let cumulative = 0;
    const data: ChartDataPoint[] = sortedDates.map((date) => {
      const daily = dailyTotals[date];
      cumulative += daily;
      return {
        date,
        cumulative,
        daily,
      };
    });

    return data;
  }, [runTickets]);

  if (runTickets.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <p className="text-gray-600">No run ticket data available for chart.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Total Volume Sold Over Time
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Cumulative and daily volume totals in barrels
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              if (typeof value === "string" && value.includes("-")) {
                const [year, month, day] = value.split("-");
                const monthNames = [
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ];
                return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}`;
              }
              return value;
            }}
          />
          <YAxis label={{ value: "Barrels (Bbls)", angle: -90, position: "insideLeft" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
            labelFormatter={(value) => {
              if (typeof value === "string" && value.includes("-")) {
                const [year, month, day] = value.split("-");
                const monthNames = [
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ];
                return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
              }
              return value;
            }}
            formatter={(value: any, name: string) => [
              `${Number(value).toFixed(2)} bbls`,
              name === "cumulative" ? "Cumulative Total" : "Daily Total",
            ]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="#00BFFF"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Cumulative Total"
          />
          <Line
            type="monotone"
            dataKey="daily"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="Daily Total"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

