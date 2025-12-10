import * as XLSX from "xlsx";
import { id } from "@instantdb/react";
import { db } from "./instant";

export interface BaselinePrices {
  oilPrice?: number;
  gasPrice?: number;
  nglPrice?: number;
  [key: string]: any;
}

export interface BaselineAssumptions {
  discountRate?: number;
  escalation?: number;
  workingInterest?: number;
  netRevenueInterest?: number;
  [key: string]: any;
}

export interface ProductionForecast {
  period: string | number; // Month, Year, or period number
  pdp: number; // Proved Developed Producing
  pdsi: number; // Proved Developed Shut-In
  [key: string]: any;
}

export interface RevenueCostForecast {
  period: string | number;
  revenue?: number;
  operatingCosts?: number;
  capitalCosts?: number;
  netRevenue?: number;
  [key: string]: any;
}

export interface ParsedBaselineData {
  prices: BaselinePrices;
  assumptions: BaselineAssumptions;
  productionForecast: ProductionForecast[];
  revenueCostForecast: RevenueCostForecast[];
  rawData?: any; // Store raw Excel data for table display
  structuredData?: {
    prices: Array<{ label: string; values: Record<string, number> }>;
    pdpAssumptions: Array<{ label: string; values: Record<string, number> }>;
    pdsiAssumptions: Array<{ label: string; values: Record<string, number> }>;
    pdpCalculations: Array<{ label: string; values: Record<string, number> }>;
    pdsiCalculations: Array<{ label: string; values: Record<string, number> }>;
    other: Array<{ label: string; values: Record<string, number> }>;
    cashFlows: Array<{ label: string; values: Record<string, number> }>;
    irr?: number;
    netFcf?: number;
    dates: string[];
  };
}

export interface BaselineImportResult {
  success: boolean;
  data?: ParsedBaselineData;
  error?: string;
}

/**
 * Parse Baseline Underwriting Excel file
 * Attempts to intelligently parse the Excel structure
 */
export function parseBaselineFile(file: File): Promise<ParsedBaselineData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (!result) {
          reject(new Error("Failed to read file"));
          return;
        }

        // Handle both .xlsx and .xlsm files
        const data = new Uint8Array(result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        if (workbook.SheetNames.length === 0) {
          reject(new Error("Excel file has no sheets"));
          return;
        }

        // Get the first sheet (or look for a sheet with "baseline" in the name)
        let sheetName = workbook.SheetNames[0];
        const baselineSheet = workbook.SheetNames.find(
          (name) => name.toLowerCase().includes("baseline") || 
                     name.toLowerCase().includes("underwriting")
        );
        if (baselineSheet) {
          sheetName = baselineSheet;
        }

        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        }) as any[][];

        // Also get raw data for table display
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        }) as any[];

        if (jsonData.length < 2) {
          reject(new Error("Excel file must have at least a header row and one data row"));
          return;
        }

        // Parse the data
        const parsed = parseBaselineData(jsonData, rawData);
        resolve(parsed);
      } catch (error: any) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse baseline data from Excel rows
 * Structure:
 * - Column A (index 0): Row labels/names
 * - Columns B+ (index 1+): Monthly data
 * - Row 2 (index 1): Contains dates (repeating)
 * - Prices: rows 2-5 (indices 1-4)
 * - PDP assumptions: rows 9-28 (indices 8-27)
 * - PDSI assumptions: rows 30-49 (indices 29-48)
 * - PDP calculations: rows 53-68 (indices 52-67)
 * - PDSI calculations: rows 70-85 (indices 69-84)
 * - Other: rows 87-89 (indices 86-88)
 * - Total Cash Flows: rows 92-93 (indices 91-92)
 * - IRR: row 98 (index 97)
 * - Net FCF: row 99 (index 98)
 */
function parseBaselineData(
  jsonData: any[][],
  rawData: any[]
): ParsedBaselineData {
  const prices: BaselinePrices = {};
  const assumptions: BaselineAssumptions = {};
  const productionForecast: ProductionForecast[] = [];
  const revenueCostForecast: RevenueCostForecast[] = [];

  // Helper to parse date from cell value
  const parseDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    
    // Handle Excel date serial numbers (days since 1900-01-01)
    if (typeof value === "number") {
      // Excel epoch is December 30, 1899
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      // Validate the date is reasonable (between 1900 and 2100)
      if (date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
        return date;
      }
      return null;
    }
    
    const dateStr = String(value).trim();
    if (!dateStr || dateStr === "" || dateStr.toLowerCase() === "null" || dateStr.toLowerCase() === "undefined") {
      return null;
    }
    
    // Try parsing as date string
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      // Validate the date is reasonable
      if (parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
        return parsed;
      }
    }
    
    return null;
  };

  // Helper to parse numeric value
  const parseNumber = (value: any): number => {
    if (typeof value === "number") return isNaN(value) ? 0 : value;
    if (!value) return 0;
    const num = parseFloat(String(value));
    return isNaN(num) ? 0 : num;
  };

  // Extract dates from row 2 (index 1) - this is the master date row
  // All sections should align to these dates
  // Dates start at column C (index 2), column B (index 1) is typically empty
  const dateRow = jsonData[1] || []; // Row 2 (0-indexed = 1)
  const dates: (Date | null)[] = [];
  
  // Start from column C (index 2) to get dates
  // Continue until we find consecutive empty cells or reach a reasonable limit (e.g., 200 columns)
  let consecutiveEmpty = 0;
  for (let col = 2; col < dateRow.length && col < 200; col++) {
    const cellValue = dateRow[col];
    
    // Skip if cell is empty or undefined
    if (cellValue === "" || cellValue === null || cellValue === undefined) {
      consecutiveEmpty++;
      // If we've found some dates and hit 3 consecutive empty cells, stop
      if (dates.length > 0 && consecutiveEmpty >= 3) break;
      dates.push(null);
      continue;
    }
    
    consecutiveEmpty = 0; // Reset counter when we find a value
    const date = parseDate(cellValue);
    dates.push(date);
    
    // If we can't parse a date but we have valid dates already, continue (might be a label)
    // Only stop if we've parsed many dates and suddenly can't parse anymore
    if (!date && dates.length > 10) {
      // Check if the last few were valid dates
      const recentDates = dates.slice(-5).filter(d => d !== null);
      if (recentDates.length === 0) break; // No valid dates in recent columns
    }
  }
  
  // Filter out null dates at the end
  while (dates.length > 0 && dates[dates.length - 1] === null) {
    dates.pop();
  }
  
  // Filter out null dates in the middle - keep only valid dates
  // This ensures all sections use the same date array
  const validDates = dates.filter((d): d is Date => d !== null);

  // Parse Prices section: rows 2-5 (indices 1-4)
  // Row 2 (index 1) has dates, so skip it - rows 3-5 (indices 2-4) have price data
  for (let rowIdx = 2; rowIdx <= 4; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    const row = jsonData[rowIdx];
    const rowLabel = String(row[0] || "").trim(); // Column A
    
    if (!rowLabel) continue;
    
    // Store price values by date
    // Data starts at column C (index 2), so col-2 maps to dates[col-2]
    for (let col = 2; col < row.length && col - 2 < dates.length; col++) {
      const date = dates[col - 2];
      if (date) {
        const value = parseNumber(row[col]);
        if (value !== 0) {
          // Store with date key
          const dateKey = date.toISOString().split("T")[0];
          if (!prices[dateKey]) {
            prices[dateKey] = {};
          }
          prices[dateKey][rowLabel] = value;
        }
      }
    }
    
    // Also store as a general price entry
    if (rowLabel) {
      prices[rowLabel] = parseNumber(row[1] || 0);
    }
  }

  // Parse PDP assumptions: rows 9-28 (indices 8-27)
  const pdpAssumptions: Record<string, any> = {};
  for (let rowIdx = 8; rowIdx <= 27; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    const row = jsonData[rowIdx];
    const rowLabel = String(row[0] || "").trim();
    
    if (!rowLabel) continue;
    
    // Store assumption values by date
    // Data starts at column C (index 2), so col-2 maps to dates[col-2]
    const assumptionData: Record<string, number> = {};
    for (let col = 2; col < row.length && col - 2 < dates.length; col++) {
      const date = dates[col - 2];
      if (date) {
        const value = parseNumber(row[col]);
        const dateKey = date.toISOString().split("T")[0];
        assumptionData[dateKey] = value;
      }
    }
    
    pdpAssumptions[rowLabel] = assumptionData;
  }

  // Parse PDSI assumptions: rows 30-49 (indices 29-48)
  // Row 30 (index 29) has dates, so skip it - rows 31-49 (indices 30-48) have assumption data
  const pdsiAssumptions: Record<string, any> = {};
  for (let rowIdx = 29; rowIdx <= 48; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    if (rowIdx === 29) continue; // Skip row 30 (index 29) which contains dates
    const row = jsonData[rowIdx];
    const rowLabel = String(row[0] || "").trim();
    
    if (!rowLabel) continue;
    
    // Store assumption values by date
    // Data starts at column C (index 2), so col-2 maps to dates[col-2]
    const assumptionData: Record<string, number> = {};
    for (let col = 2; col < row.length && col - 2 < dates.length; col++) {
      const date = dates[col - 2];
      if (date) {
        const value = parseNumber(row[col]);
        const dateKey = date.toISOString().split("T")[0];
        assumptionData[dateKey] = value;
      }
    }
    
    pdsiAssumptions[rowLabel] = assumptionData;
  }

  // Parse PDP calculations: rows 53-68 (indices 52-67)
  // Look for production data (Oil, Gas, BOE) in these rows
  const pdpCalculations: Record<string, Record<string, number>> = {};
  for (let rowIdx = 52; rowIdx <= 67; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    const row = jsonData[rowIdx];
    const rowLabel = String(row[0] || "").trim();
    
    if (!rowLabel) continue;
    
    const calcData: Record<string, number> = {};
    // Data starts at column C (index 2), so col-2 maps to dates[col-2]
    for (let col = 2; col < row.length && col - 2 < dates.length; col++) {
      const date = dates[col - 2];
      if (date) {
        const value = parseNumber(row[col]);
        const dateKey = date.toISOString().split("T")[0];
        calcData[dateKey] = value;
      }
    }
    
    pdpCalculations[rowLabel] = calcData;
  }

  // Parse PDSI calculations: rows 70-85 (indices 69-84)
  const pdsiCalculations: Record<string, Record<string, number>> = {};
  for (let rowIdx = 69; rowIdx <= 84; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    const row = jsonData[rowIdx];
    const rowLabel = String(row[0] || "").trim();
    
    if (!rowLabel) continue;
    
    const calcData: Record<string, number> = {};
    // Data starts at column C (index 2), so col-2 maps to dates[col-2]
    for (let col = 2; col < row.length && col - 2 < dates.length; col++) {
      const date = dates[col - 2];
      if (date) {
        const value = parseNumber(row[col]);
        const dateKey = date.toISOString().split("T")[0];
        calcData[dateKey] = value;
      }
    }
    
    pdsiCalculations[rowLabel] = calcData;
  }

  // Parse Total Cash Flows: rows 92-93 (indices 91-92)
  for (let rowIdx = 91; rowIdx <= 92; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    const row = jsonData[rowIdx];
    const rowLabel = String(row[0] || "").trim();
    
    if (!rowLabel) continue;
    
    // Data starts at column C (index 2), so col-2 maps to dates[col-2]
    for (let col = 2; col < row.length && col - 2 < dates.length; col++) {
      const date = dates[col - 2];
      if (date) {
        const value = parseNumber(row[col]);
        if (value !== 0) {
          const dateKey = date.toISOString().split("T")[0];
          
          // Find or create revenue/cost entry for this date
          let revCost = revenueCostForecast.find(r => String(r.period) === dateKey);
          if (!revCost) {
            revCost = { period: dateKey };
            revenueCostForecast.push(revCost);
          }
          
          const rowLabelLower = rowLabel.toLowerCase();
          if (rowLabelLower.includes("revenue")) {
            revCost.revenue = (revCost.revenue || 0) + value;
          } else if (rowLabelLower.includes("cost") || rowLabelLower.includes("expense")) {
            revCost.operatingCosts = (revCost.operatingCosts || 0) + value;
          } else if (rowLabelLower.includes("net")) {
            revCost.netRevenue = value;
          }
        }
      }
    }
  }

  // Store structured data in assumptions
  assumptions.pdpAssumptions = pdpAssumptions;
  assumptions.pdsiAssumptions = pdsiAssumptions;
  assumptions.pdpCalculations = pdpCalculations;
  assumptions.pdsiCalculations = pdsiCalculations;

  // Sort forecasts by date
  productionForecast.sort((a, b) => {
    const dateA = new Date(String(a.period));
    const dateB = new Date(String(b.period));
    return dateA.getTime() - dateB.getTime();
  });

  revenueCostForecast.sort((a, b) => {
    const dateA = new Date(String(a.period));
    const dateB = new Date(String(b.period));
    return dateA.getTime() - dateB.getTime();
  });

  // Build structured data for table display
  // Use the same date array for all sections to ensure alignment
  // Extract dates from row 2 (index 1) - this is the master date row
  const dateKeys: string[] = [];
  
  if (validDates.length > 0) {
    // Use actual dates - only include valid dates (skip nulls)
    // This ensures all sections have the same date columns and align properly
    dateKeys.push(...validDates.map(d => d.toISOString().split("T")[0]));
  } else {
    // If no dates found, don't create column indices - just use empty array
    // The table will handle this gracefully
  }
  
  // Now we need to map data columns to these date keys
  // Column C (index 2) in Excel maps to dateKeys[0], Column D (index 3) maps to dateKeys[1], etc.
  // But we need to account for the fact that dates array might have nulls that we filtered out
  // So we need to create a mapping: Excel column index -> dateKey index
  const columnToDateKeyMap: Map<number, string> = new Map();
  let dateKeyIndex = 0;
  for (let col = 2; col < dates.length + 2 && dateKeyIndex < dateKeys.length; col++) {
    const date = dates[col - 2];
    if (date) {
      columnToDateKeyMap.set(col, dateKeys[dateKeyIndex]);
      dateKeyIndex++;
    }
  }

  // Extract prices (rows 2-5, indices 1-4)
  // Skip row 2 (index 1) which contains dates
  const pricesData: Array<{ label: string; values: Record<string, number> }> = [];
  for (let rowIdx = 1; rowIdx <= 4; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    if (rowIdx === 1) continue; // Skip row 2 (index 1) which contains dates
    const row = jsonData[rowIdx];
    const label = String(row[0] || "").trim();
    if (!label) continue;
    
    const values: Record<string, number> = {};
    // Data starts at column C (index 2)
    // Use the column-to-dateKey mapping to ensure alignment
    for (let col = 2; col < row.length; col++) {
      const dateKey = columnToDateKeyMap.get(col);
      if (dateKey) {
        values[dateKey] = parseNumber(row[col]);
      }
    }
    pricesData.push({ label, values });
  }

  // Extract PDP assumptions (rows 9-28, indices 8-27)
  // Skip row 9 (index 8) which contains dates
  const pdpAssumptionsData: Array<{ label: string; values: Record<string, number> }> = [];
  for (let rowIdx = 8; rowIdx <= 27; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    if (rowIdx === 8) continue; // Skip row 9 (index 8) which contains dates
    const row = jsonData[rowIdx];
    const label = String(row[0] || "").trim();
    if (!label) continue;
    
    const values: Record<string, number> = {};
    // Data starts at column C (index 2)
    // Use the column-to-dateKey mapping to ensure alignment
    for (let col = 2; col < row.length; col++) {
      const dateKey = columnToDateKeyMap.get(col);
      if (dateKey) {
        values[dateKey] = parseNumber(row[col]);
      }
    }
    pdpAssumptionsData.push({ label, values });
  }

  // Extract PDSI assumptions (rows 30-49, indices 29-48)
  // Skip row 30 (index 29) which contains dates
  const pdsiAssumptionsData: Array<{ label: string; values: Record<string, number> }> = [];
  for (let rowIdx = 29; rowIdx <= 48; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    if (rowIdx === 29) continue; // Skip row 30 (index 29) which contains dates
    const row = jsonData[rowIdx];
    const label = String(row[0] || "").trim();
    if (!label) continue;
    
    const values: Record<string, number> = {};
    // Data starts at column C (index 2)
    // Use the column-to-dateKey mapping to ensure alignment
    for (let col = 2; col < row.length; col++) {
      const dateKey = columnToDateKeyMap.get(col);
      if (dateKey) {
        values[dateKey] = parseNumber(row[col]);
      }
    }
    pdsiAssumptionsData.push({ label, values });
  }

  // Extract PDP calculations (rows 53-68, indices 52-67)
  const pdpCalculationsData: Array<{ label: string; values: Record<string, number> }> = [];
  for (let rowIdx = 52; rowIdx <= 67; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    const row = jsonData[rowIdx];
    const label = String(row[0] || "").trim();
    if (!label) continue;
    
    const values: Record<string, number> = {};
    // Data starts at column C (index 2)
    // Use the column-to-dateKey mapping to ensure alignment
    for (let col = 2; col < row.length; col++) {
      const dateKey = columnToDateKeyMap.get(col);
      if (dateKey) {
        values[dateKey] = parseNumber(row[col]);
      }
    }
    pdpCalculationsData.push({ label, values });
  }

  // Extract PDSI calculations (rows 70-85, indices 69-84)
  const pdsiCalculationsData: Array<{ label: string; values: Record<string, number> }> = [];
  for (let rowIdx = 69; rowIdx <= 84; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    const row = jsonData[rowIdx];
    const label = String(row[0] || "").trim();
    if (!label) continue;
    
    const values: Record<string, number> = {};
    // Data starts at column C (index 2)
    // Use the column-to-dateKey mapping to ensure alignment
    for (let col = 2; col < row.length; col++) {
      const dateKey = columnToDateKeyMap.get(col);
      if (dateKey) {
        values[dateKey] = parseNumber(row[col]);
      }
    }
    pdsiCalculationsData.push({ label, values });
  }

  // Extract Other (rows 87-89, indices 86-88)
  const otherData: Array<{ label: string; values: Record<string, number> }> = [];
  for (let rowIdx = 86; rowIdx <= 88; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    const row = jsonData[rowIdx];
    const label = String(row[0] || "").trim();
    if (!label) continue;
    
    const values: Record<string, number> = {};
    // Data starts at column C (index 2)
    // Use the column-to-dateKey mapping to ensure alignment
    for (let col = 2; col < row.length; col++) {
      const dateKey = columnToDateKeyMap.get(col);
      if (dateKey) {
        values[dateKey] = parseNumber(row[col]);
      }
    }
    otherData.push({ label, values });
  }

  // Extract Total Cash Flows (rows 92-93, indices 91-92)
  const cashFlowsData: Array<{ label: string; values: Record<string, number> }> = [];
  for (let rowIdx = 91; rowIdx <= 92; rowIdx++) {
    if (rowIdx >= jsonData.length) break;
    const row = jsonData[rowIdx];
    const label = String(row[0] || "").trim();
    if (!label) continue;
    
    const values: Record<string, number> = {};
    // Data starts at column C (index 2)
    // Use the column-to-dateKey mapping to ensure alignment
    for (let col = 2; col < row.length; col++) {
      const dateKey = columnToDateKeyMap.get(col);
      if (dateKey) {
        values[dateKey] = parseNumber(row[col]);
      }
    }
    cashFlowsData.push({ label, values });
  }

  // Extract IRR (row 98, index 97)
  let irr: number | undefined;
  if (jsonData.length > 97) {
    const irrRow = jsonData[97];
    irr = parseNumber(irrRow[1] || irrRow[2] || 0);
    if (irr === 0) irr = undefined;
  }

  // Extract Net FCF (row 99, index 98)
  let netFcf: number | undefined;
  if (jsonData.length > 98) {
    const netFcfRow = jsonData[98];
    netFcf = parseNumber(netFcfRow[1] || netFcfRow[2] || 0);
    if (netFcf === 0) netFcf = undefined;
  }

  return {
    prices,
    assumptions,
    productionForecast,
    revenueCostForecast,
    rawData,
    structuredData: {
      prices: pricesData,
      pdpAssumptions: pdpAssumptionsData,
      pdsiAssumptions: pdsiAssumptionsData,
      pdpCalculations: pdpCalculationsData,
      pdsiCalculations: pdsiCalculationsData,
      other: otherData,
      cashFlows: cashFlowsData,
      irr,
      netFcf,
      dates: dateKeys,
    },
  };
}

/**
 * Import baseline data into InstantDB
 * This will delete all existing baseline data and replace it with the new import
 */
export async function importBaselineData(
  data: ParsedBaselineData,
  existingBaselineData?: any
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const now = new Date().toISOString();
    const transactions: any[] = [];

    // Delete all existing baseline data first
    if (existingBaselineData) {
      const existingBaselines = existingBaselineData.baselineUnderwriting
        ? Array.isArray(existingBaselineData.baselineUnderwriting)
          ? existingBaselineData.baselineUnderwriting
          : Object.values(existingBaselineData.baselineUnderwriting)
        : [];

      // Delete all existing baseline records
      existingBaselines.forEach((baseline: any) => {
        if (baseline.id) {
          transactions.push(db.tx.baselineUnderwriting[baseline.id].delete());
        }
      });
    }

    // Create new baseline record
    const baselineId = id();
    transactions.push(
      db.tx.baselineUnderwriting[baselineId].update({
        prices: data.prices,
        assumptions: data.assumptions,
        productionForecast: data.productionForecast,
        revenueCostForecast: data.revenueCostForecast,
        rawData: data.rawData,
        structuredData: data.structuredData,
        createdAt: now,
        updatedAt: now,
      })
    );

    // Execute all transactions
    if (transactions.length > 0) {
      db.transact(transactions);
    }

    return { success: true, id: baselineId };
  } catch (error: any) {
    return { success: false, error: error.message || "Unknown error" };
  }
}

