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
import { format, addMonths, parseISO, getDaysInMonth } from "date-fns";

interface ProductionDataPoint {
  period: string | number;
  pdp: number;
  pdsi: number;
  [key: string]: any;
}

interface BaselineProductionChartProps {
  data: ProductionDataPoint[];
  structuredData?: {
    pdpAssumptions: Array<{ label: string; values: Record<string, number> }>;
    pdsiAssumptions: Array<{ label: string; values: Record<string, number> }>;
    pdpCalculations: Array<{ label: string; values: Record<string, number> }>;
    pdsiCalculations: Array<{ label: string; values: Record<string, number> }>;
    dates: string[];
  };
}

// Helper function to get days in month for a date string
function getDaysInMonthForDate(dateStr: string): number {
  try {
    const date = parseISO(dateStr);
    return getDaysInMonth(date);
  } catch {
    return 30; // Default fallback
  }
}

// Convert monthly value to daily rate
// Oil: MBbl/month -> Bbl/day (multiply by 1000, divide by days)
// Gas: MMcf/month -> Mcf/day (multiply by 1000, divide by days)
function convertToDailyRate(monthlyValue: number, dateStr: string, isOil: boolean): number {
  if (monthlyValue === 0) return 0;
  const daysInMonth = getDaysInMonthForDate(dateStr);
  // Monthly values are in MBbl or MMcf, convert to Bbl or Mcf, then divide by days
  const dailyRate = (monthlyValue * 1000) / daysInMonth;
  return dailyRate;
}

export function BaselineProductionChart({ data, structuredData }: BaselineProductionChartProps) {
  // Extract Gross Oil and Gas data from structured assumptions (exclude BOE)
  let pdpData: any[] = [];
  let pdsiData: any[] = [];
  let totalData: any[] = [];
  
  if (structuredData) {
    const { pdpAssumptions, pdsiAssumptions, dates } = structuredData;
    
    // Find Gross production rows in assumptions
    const findRow = (searchTerms: string[], assumptions: Array<{ label: string; values: Record<string, number> }>) => {
      return assumptions.find(c => {
        const lowerLabel = c.label.toLowerCase();
        return searchTerms.some(term => lowerLabel.includes(term.toLowerCase()));
      });
    };
    
    // Find PDP Gross production rows (Oil and Gas only)
    const pdpOil = findRow(["gross prod oil", "gross oil", "gross prod"], pdpAssumptions) ||
                   pdpAssumptions.find(c => c.label.toLowerCase().includes("oil") && c.label.toLowerCase().includes("gross"));
    const pdpGas = findRow(["gross sales gas", "gross gas", "gross sales"], pdpAssumptions) ||
                   pdpAssumptions.find(c => c.label.toLowerCase().includes("gas") && c.label.toLowerCase().includes("gross"));
    
    // Find PDSI Gross production rows (Oil and Gas only)
    const pdsiOil = findRow(["gross prod oil", "gross oil", "gross prod"], pdsiAssumptions) ||
                    pdsiAssumptions.find(c => c.label.toLowerCase().includes("oil") && c.label.toLowerCase().includes("gross"));
    const pdsiGas = findRow(["gross sales gas", "gross gas", "gross sales"], pdsiAssumptions) ||
                    pdsiAssumptions.find(c => c.label.toLowerCase().includes("gas") && c.label.toLowerCase().includes("gross"));
    
    // Build chart data by date, filtering to next year (12 months from first date)
    if (dates && dates.length > 0) {
      const sortedDates = [...dates].sort();
      const firstDate = parseISO(sortedDates[0]);
      const oneYearLater = addMonths(firstDate, 12);
      
      // Filter dates to next year only
      const filteredDates = sortedDates.filter(dateStr => {
        try {
          const date = parseISO(dateStr);
          return date >= firstDate && date <= oneYearLater;
        } catch {
          return false;
        }
      });
      
      // Build PDP data with daily rates
      pdpData = filteredDates.map(date => {
        const pdpOilMonthly = pdpOil?.values[date] || 0;
        const pdpGasMonthly = pdpGas?.values[date] || 0;
        
        return {
          period: date,
          "PDP Oil": convertToDailyRate(pdpOilMonthly, date, true),
          "PDP Gas": convertToDailyRate(pdpGasMonthly, date, false),
        };
      });
      
      // Build PDSI data with daily rates
      pdsiData = filteredDates.map(date => {
        const pdsiOilMonthly = pdsiOil?.values[date] || 0;
        const pdsiGasMonthly = pdsiGas?.values[date] || 0;
        
        return {
          period: date,
          "PDSI Oil": convertToDailyRate(pdsiOilMonthly, date, true),
          "PDSI Gas": convertToDailyRate(pdsiGasMonthly, date, false),
        };
      });
      
      // Build Total data (PDP + PDSI) with daily rates
      totalData = filteredDates.map(date => {
        const pdpOilMonthly = pdpOil?.values[date] || 0;
        const pdpGasMonthly = pdpGas?.values[date] || 0;
        const pdsiOilMonthly = pdsiOil?.values[date] || 0;
        const pdsiGasMonthly = pdsiGas?.values[date] || 0;
        
        return {
          period: date,
          "Total Oil": convertToDailyRate(pdpOilMonthly + pdsiOilMonthly, date, true),
          "Total Gas": convertToDailyRate(pdpGasMonthly + pdsiGasMonthly, date, false),
        };
      });
    }
  } else if (data && data.length > 0) {
    // Fallback to simple data structure
    pdpData = data.map((d) => {
      const dateStr = String(d.period);
      return {
        period: dateStr,
        "PDP Oil": convertToDailyRate(d.oilPdp || 0, dateStr, true),
        "PDP Gas": convertToDailyRate(d.gasPdp || 0, dateStr, false),
      };
    });
    
    pdsiData = data.map((d) => {
      const dateStr = String(d.period);
      return {
        period: dateStr,
        "PDSI Oil": convertToDailyRate(d.oilPdsi || 0, dateStr, true),
        "PDSI Gas": convertToDailyRate(d.gasPdsi || 0, dateStr, false),
      };
    });
    
    totalData = data.map((d) => {
      const dateStr = String(d.period);
      return {
        period: dateStr,
        "Total Oil": convertToDailyRate((d.oilPdp || 0) + (d.oilPdsi || 0), dateStr, true),
        "Total Gas": convertToDailyRate((d.gasPdp || 0) + (d.gasPdsi || 0), dateStr, false),
      };
    });
  }
  
  // Calculate global domains for synchronized axes across all three charts
  const allOilValues: number[] = [];
  [...pdpData, ...pdsiData, ...totalData].forEach((item) => {
    Object.keys(item).forEach(key => {
      if (key.includes("Oil") && typeof item[key] === "number" && !isNaN(item[key]) && isFinite(item[key])) {
        allOilValues.push(item[key]);
      }
    });
  });
  
  const allGasValues: number[] = [];
  [...pdpData, ...pdsiData, ...totalData].forEach((item) => {
    Object.keys(item).forEach(key => {
      if (key.includes("Gas") && typeof item[key] === "number" && !isNaN(item[key]) && isFinite(item[key])) {
        allGasValues.push(item[key]);
      }
    });
  });
  
  // Calculate domains with 10% padding
  const finalOilDomain: [number, number] = allOilValues.length > 0
    ? (() => {
        const min = Math.min(...allOilValues);
        const max = Math.max(...allOilValues);
        const padding = (max - min) * 0.1 || max * 0.1;
        return [Math.max(0, min - padding), max + padding];
      })()
    : [0, 100];
  
  const finalGasDomain: [number, number] = allGasValues.length > 0
    ? (() => {
        const min = Math.min(...allGasValues);
        const max = Math.max(...allGasValues);
        const padding = (max - min) * 0.1 || max * 0.1;
        return [Math.max(0, min - padding), max + padding];
      })()
    : [0, 1000];

  if ((!pdpData || pdpData.length === 0) && (!pdsiData || pdsiData.length === 0) && (!totalData || totalData.length === 0)) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <p className="text-gray-600">No production forecast data available.</p>
        {structuredData && (
          <p className="text-sm text-gray-500 mt-2">
            Debug: Found {structuredData.pdpAssumptions?.length || 0} PDP assumptions and {structuredData.pdsiAssumptions?.length || 0} PDSI assumptions.
            {structuredData.dates && ` Dates: ${structuredData.dates.length} found.`}
          </p>
        )}
      </div>
    );
  }

  // Helper component for rendering a single chart
  const renderChart = (chartData: any[], title: string, oilKey: string, gasKey: string) => {
    return (
      <div className="bg-white shadow rounded-lg p-4 flex-1">
        <div className="mb-2">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-xs text-gray-600">Daily rates</p>
        </div>
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="period" 
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => {
                try {
                  return format(parseISO(value), "MMM yyyy");
                } catch {
                  return String(value);
                }
              }}
              label={{ value: "Period", position: "insideBottom", offset: -5, style: { fontSize: 11 } }}
            />
            <YAxis 
              yAxisId="oil"
              domain={finalOilDomain}
              tick={{ fontSize: 11 }}
              label={{ value: "Oil (Bbl/day)", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
              tickFormatter={(value) => {
                if (typeof value === "number") {
                  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
                }
                return String(value);
              }}
            />
            <YAxis 
              yAxisId="gas"
              orientation="right"
              domain={finalGasDomain}
              tick={{ fontSize: 11 }}
              label={{ value: "Gas (Mcf/day)", angle: 90, position: "insideRight", style: { fontSize: 11 } }}
              tickFormatter={(value) => {
                if (typeof value === "number") {
                  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
                }
                return String(value);
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "12px",
              }}
              labelFormatter={(value) => {
                try {
                  return format(parseISO(value), "MMM d, yyyy");
                } catch {
                  return String(value);
                }
              }}
              formatter={(value: any, name: string) => {
                if (typeof value === "number") {
                  const unit = name.includes("Oil") ? " Bbl/day" : " Mcf/day";
                  return [value.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + unit, name];
                }
                return [String(value), name];
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }}
              iconSize={12}
            />
            <Line 
              type="monotone" 
              dataKey={oilKey} 
              yAxisId="oil"
              stroke="#10B981" 
              strokeWidth={2} 
              dot={{ r: 3 }} 
            />
            <Line 
              type="monotone" 
              dataKey={gasKey} 
              yAxisId="gas"
              stroke="#EF4444" 
              strokeWidth={2} 
              dot={{ r: 3 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Gross Production Forecast (Next Year - Daily Rates)
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          PDP, PDSI, and Total Gross Oil and Gas production over the next 12 months
        </p>
      </div>
      <div className="flex flex-col lg:flex-row gap-4 w-full">
        {renderChart(pdpData, "PDP Gross Production", "PDP Oil", "PDP Gas")}
        {renderChart(pdsiData, "PDSI Gross Production", "PDSI Oil", "PDSI Gas")}
        {renderChart(totalData, "Total Gross Production", "Total Oil", "Total Gas")}
      </div>
    </div>
  );
}

