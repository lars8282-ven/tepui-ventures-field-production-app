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
  metadata?: Record<string, any>;
  createdAt: string;
}

interface OthersSummaryTableProps {
  wells: Well[];
  readings: MeterReading[];
  selectedDate?: string | null;
}

interface PressureData {
  tubingPressure: { value: number; timestamp: string };
  casingPressure: { value: number; timestamp: string };
  linePressure: { value: number; timestamp: string };
  comment: string | null;
}

// Get color class for line pressure (green = low/good, red = high/bad)
// Uses dynamic gradient based on min/max values in the data
function getLinePressureColorClass(value: number, min: number, max: number): string {
  if (value === 0 || max === min) return "bg-white text-gray-900";
  
  // Calculate position in range (0 = min, 1 = max)
  const position = (value - min) / (max - min);
  
  // Create gradient from green (0) to red (1)
  if (position <= 0.2) return "bg-green-100 text-green-800"; // Lowest 20% - green
  if (position <= 0.4) return "bg-green-50 text-green-700"; // Low - light green
  if (position <= 0.6) return "bg-yellow-50 text-yellow-700"; // Middle - yellow
  if (position <= 0.8) return "bg-orange-50 text-orange-700"; // High - orange
  return "bg-red-100 text-red-800"; // Highest - red
}

export function OthersSummaryTable({
  wells,
  readings,
  selectedDate = null,
}: OthersSummaryTableProps) {
  // Process data: Get latest readings for each well
  const pressureData = useMemo(() => {
    const data: Record<string, PressureData> = {};

    wells.forEach((well) => {
      const wellId = well.id;

      // Get latest Tubing Pressure reading
      let tubingReadings = readings.filter(
        (r) =>
          r.wellId === wellId &&
          (r.meterType === "Tubing Pressure" || r.meterType === "tubing pressure")
      );

      // Get latest Casing Pressure reading
      let casingReadings = readings.filter(
        (r) =>
          r.wellId === wellId &&
          (r.meterType === "Casing Pressure" || r.meterType === "casing pressure")
      );

      // Get latest Line Pressure reading
      let lineReadings = readings.filter(
        (r) =>
          r.wellId === wellId &&
          (r.meterType === "Line Pressure" || r.meterType === "line pressure")
      );

      // Filter by date if selected
      if (selectedDate) {
        tubingReadings = tubingReadings.filter((r) => {
          const readingDate = new Date(r.timestamp || r.createdAt);
          const readingDateKey = format(readingDate, "yyyy-MM-dd");
          return readingDateKey === selectedDate;
        });
        casingReadings = casingReadings.filter((r) => {
          const readingDate = new Date(r.timestamp || r.createdAt);
          const readingDateKey = format(readingDate, "yyyy-MM-dd");
          return readingDateKey === selectedDate;
        });
        lineReadings = lineReadings.filter((r) => {
          const readingDate = new Date(r.timestamp || r.createdAt);
          const readingDateKey = format(readingDate, "yyyy-MM-dd");
          return readingDateKey === selectedDate;
        });
      }

      // Sort by timestamp and get latest
      tubingReadings.sort(
        (a, b) =>
          new Date(b.timestamp || b.createdAt).getTime() -
          new Date(a.timestamp || a.createdAt).getTime()
      );
      casingReadings.sort(
        (a, b) =>
          new Date(b.timestamp || b.createdAt).getTime() -
          new Date(a.timestamp || a.createdAt).getTime()
      );
      lineReadings.sort(
        (a, b) =>
          new Date(b.timestamp || b.createdAt).getTime() -
          new Date(a.timestamp || a.createdAt).getTime()
      );

      const latestTubing = tubingReadings[0];
      const latestCasing = casingReadings[0];
      const latestLine = lineReadings[0];

      // Get comment from any of the latest readings (prefer line pressure if available)
      let comment: string | null = null;
      const readingWithComment = latestLine || latestTubing || latestCasing;
      if (readingWithComment?.metadata?.comment) {
        comment = readingWithComment.metadata.comment;
      }

      data[wellId] = {
        tubingPressure: {
          value: latestTubing?.value || 0,
          timestamp: latestTubing?.timestamp || latestTubing?.createdAt || "",
        },
        casingPressure: {
          value: latestCasing?.value || 0,
          timestamp: latestCasing?.timestamp || latestCasing?.createdAt || "",
        },
        linePressure: {
          value: latestLine?.value || 0,
          timestamp: latestLine?.timestamp || latestLine?.createdAt || "",
        },
        comment: comment,
      };
    });

    return data;
  }, [wells, readings, selectedDate]);

  // Calculate min/max for line pressure for gradient coloring
  const linePressureRange = useMemo(() => {
    const linePressures = Object.values(pressureData)
      .map((d) => d.linePressure.value)
      .filter((v) => v > 0);
    
    if (linePressures.length === 0) return { min: 0, max: 0 };
    
    return {
      min: Math.min(...linePressures),
      max: Math.max(...linePressures),
    };
  }, [pressureData]);

  // Calculate averages
  const averages = useMemo(() => {
    let tubingSum = 0;
    let casingSum = 0;
    let lineSum = 0;
    let tubingCount = 0;
    let casingCount = 0;
    let lineCount = 0;

    Object.values(pressureData).forEach((wellData) => {
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

    return {
      tubingPressure: tubingCount > 0 ? tubingSum / tubingCount : 0,
      casingPressure: casingCount > 0 ? casingSum / casingCount : 0,
      linePressure: lineCount > 0 ? lineSum / lineCount : 0,
    };
  }, [pressureData]);

  // Filter wells that have at least one pressure reading or comment
  const wellsWithData = useMemo(() => {
    return wells.filter((well) => {
      const data = pressureData[well.id];
      return (
        (data?.tubingPressure.value || 0) > 0 ||
        (data?.casingPressure.value || 0) > 0 ||
        (data?.linePressure.value || 0) > 0 ||
        data?.comment
      );
    });
  }, [wells, pressureData]);

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
        <h2 className="text-lg font-semibold text-gray-900">Others Summary</h2>
        <p className="mt-1 text-sm text-gray-600">
          Pressure readings and comments per well. Line pressure color coding: green (low/good) to red (high/bad).
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
                Tubing Pressure (PSI)
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Casing Pressure (PSI)
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Line Pressure (PSI)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200">
                Comments/Issues
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {wellsWithData.map((well) => {
              const data = pressureData[well.id];
              const tubingData = data?.tubingPressure || { value: 0, timestamp: "" };
              const casingData = data?.casingPressure || { value: 0, timestamp: "" };
              const lineData = data?.linePressure || { value: 0, timestamp: "" };
              const comment = data?.comment || null;

              return (
                <tr key={well.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{well.name}</div>
                    <div className="text-xs text-gray-500">{well.wellNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-l border-gray-200">
                    <div className="font-semibold text-gray-900">
                      {tubingData.value > 0 ? `${tubingData.value.toFixed(1)} PSI` : "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <div className="font-semibold text-gray-900">
                      {casingData.value > 0 ? `${casingData.value.toFixed(1)} PSI` : "-"}
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-center ${getLinePressureColorClass(lineData.value, linePressureRange.min, linePressureRange.max)}`}>
                    <div className="font-semibold">
                      {lineData.value > 0 ? `${lineData.value.toFixed(1)} PSI` : "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 border-l border-gray-200">
                    {comment ? (
                      <div className="max-w-md">{comment}</div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Averages Row */}
            <tr className="bg-gray-100 border-t-2 border-gray-300">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                Average
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center border-l border-gray-200 bg-gray-50">
                {averages.tubingPressure > 0 ? `${averages.tubingPressure.toFixed(1)} PSI` : "-"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center bg-gray-50">
                {averages.casingPressure > 0 ? `${averages.casingPressure.toFixed(1)} PSI` : "-"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center bg-gray-50">
                {averages.linePressure > 0 ? `${averages.linePressure.toFixed(1)} PSI` : "-"}
              </td>
              <td className="px-6 py-4 text-sm border-l border-gray-200"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

