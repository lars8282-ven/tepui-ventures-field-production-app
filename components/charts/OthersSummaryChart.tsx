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

interface OthersSummaryChartProps {
  wells: Well[];
  readings: MeterReading[];
}

interface ChartDataPoint {
  date: string;
  wellCount: number;
  avgTubingPressure: number;
  avgCasingPressure: number;
  avgLinePressure: number;
}

export function OthersSummaryChart({
  wells,
  readings,
}: OthersSummaryChartProps) {
  // Process data for chart
  const chartData = useMemo(() => {
    // Filter pressure readings
    const pressureReadings = readings.filter(
      (r) =>
        r.meterType === "Tubing Pressure" ||
        r.meterType === "tubing pressure" ||
        r.meterType === "Casing Pressure" ||
        r.meterType === "casing pressure" ||
        r.meterType === "Line Pressure" ||
        r.meterType === "line pressure"
    );

    // Group readings by date and well (day-level aggregation)
    // First, get the latest reading per well per date per pressure type
    const dataByDate: Record<
      string,
      Record<
        string,
        {
          tubingPressure: { value: number; timestamp: number };
          casingPressure: { value: number; timestamp: number };
          linePressure: { value: number; timestamp: number };
        }
      >
    > = {};

    pressureReadings.forEach((reading) => {
      const date = new Date(reading.timestamp || reading.createdAt);
      const dateKey = format(date, "yyyy-MM-dd");
      const wellId = reading.wellId;
      const timestamp = new Date(reading.timestamp || reading.createdAt).getTime();
      const meterType = reading.meterType || "";

      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = {};
      }
      if (!dataByDate[dateKey][wellId]) {
        dataByDate[dateKey][wellId] = {
          tubingPressure: { value: 0, timestamp: 0 },
          casingPressure: { value: 0, timestamp: 0 },
          linePressure: { value: 0, timestamp: 0 },
        };
      }

      const wellData = dataByDate[dateKey][wellId];

      if (meterType === "Tubing Pressure" || meterType === "tubing pressure") {
        if (
          !wellData.tubingPressure.value ||
          timestamp > wellData.tubingPressure.timestamp
        ) {
          wellData.tubingPressure = { value: reading.value, timestamp };
        }
      } else if (
        meterType === "Casing Pressure" ||
        meterType === "casing pressure"
      ) {
        if (
          !wellData.casingPressure.value ||
          timestamp > wellData.casingPressure.timestamp
        ) {
          wellData.casingPressure = { value: reading.value, timestamp };
        }
      } else if (meterType === "Line Pressure" || meterType === "line pressure") {
        if (
          !wellData.linePressure.value ||
          timestamp > wellData.linePressure.timestamp
        ) {
          wellData.linePressure = { value: reading.value, timestamp };
        }
      }
    });

    // Convert to array format and calculate averages per well, then overall
    const dates = Object.keys(dataByDate).sort();
    const data: ChartDataPoint[] = dates.map((date) => {
      const dateData = dataByDate[date];
      const wellIds = Object.keys(dateData);
      
      // Count wells with any pressure reading
      const wellCount = wellIds.length;

      // Calculate averages across wells (only count wells that have that specific pressure type)
      let tubingSum = 0;
      let casingSum = 0;
      let lineSum = 0;
      let tubingCount = 0;
      let casingCount = 0;
      let lineCount = 0;

      wellIds.forEach((wellId) => {
        const wellData = dateData[wellId];
        if (wellData.tubingPressure.value > 0) {
          tubingSum += wellData.tubingPressure.value;
          tubingCount++;
        }
        if (wellData.casingPressure.value > 0) {
          casingSum += wellData.casingPressure.value;
          casingCount++;
        }
        if (wellData.linePressure.value > 0) {
          lineSum += wellData.linePressure.value;
          lineCount++;
        }
      });

      const avgTubing = tubingCount > 0 ? tubingSum / tubingCount : 0;
      const avgCasing = casingCount > 0 ? casingSum / casingCount : 0;
      const avgLine = lineCount > 0 ? lineSum / lineCount : 0;

      return {
        date,
        wellCount: wellCount,
        avgTubingPressure: avgTubing,
        avgCasingPressure: avgCasing,
        avgLinePressure: avgLine,
      };
    });

    return data;
  }, [readings, wells]);

  if (readings.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <p className="text-gray-600">No pressure data available for chart.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Wells Running and Average Pressures Over Time
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Left axis: Number of wells with pressure readings. Right axis: Average pressure values (PSI).
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => format(new Date(value), "MMM d")}
          />
          <YAxis
            yAxisId="left"
            label={{ value: "Number of Wells", angle: -90, position: "insideLeft" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ value: "Average Pressure (PSI)", angle: 90, position: "insideRight" }}
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
              return [`${Number(value).toFixed(1)} PSI`, name];
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="wellCount"
            stroke="#00BFFF"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Wells Running"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgTubingPressure"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Avg Tubing Pressure"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgCasingPressure"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Avg Casing Pressure"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgLinePressure"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Avg Line Pressure"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

