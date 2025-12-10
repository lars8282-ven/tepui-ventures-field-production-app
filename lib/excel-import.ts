import * as XLSX from "xlsx";
import { id } from "@instantdb/react";
import { db } from "./instant";

export interface WellImportRow {
  name: string;
  wellNumber: string;
  location?: string;
  status?: "active" | "inactive";
  metadata?: {
    api10?: string;
    api14?: string;
    api14Alt?: string;
    wellName2?: string;
    tankFactor?: number | string;
    liftType?: string;
    wi?: number | string;
    nri?: number | string;
    surface?: string;
    swd?: string;
    sec?: number | string;
    twn?: number | string;
    rng?: number | string;
    county?: string;
    state?: string;
    leaseDescription?: string;
    grossAcres?: number | string;
    potentialOilProductionRate?: number | string;
    potentialGasProductionRate?: number | string;
    potentialWaterProductionRate?: number | string;
    operator?: string;
    field?: string;
    formation?: string;
    reservoir?: string;
    payZone?: string;
    wellType?: string;
    wellboreType?: string;
    spudDate?: string | number;
    completionDate?: string | number;
    firstProductionDate?: string | number;
    totalDepth?: number | string;
    tvd?: number | string;
    md?: number | string;
    permitNumber?: string;
    permitDate?: string | number;
    currentStatus?: string;
    wellboreStatus?: string;
    [key: string]: any;
  };
}

export interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  errors: Array<{ row: number; error: string }>;
  skipped: number;
}

export type ImportMode = "skip" | "update" | "add-only";

/**
 * Extract headers from Excel file
 */
export function extractHeaders(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (!result) {
          reject(new Error("Failed to read file"));
          return;
        }

        let workbook: XLSX.WorkBook;
        
        // Handle CSV files differently
        if (isCSV) {
          const text = typeof result === 'string' ? result : new TextDecoder().decode(result as ArrayBuffer);
          workbook = XLSX.read(text, { type: "string" });
        } else {
          // Handle Excel files (.xlsx, .xls)
          const data = result instanceof ArrayBuffer 
            ? new Uint8Array(result) 
            : new Uint8Array(result as ArrayBuffer);
          workbook = XLSX.read(data, { type: "array" });
        }

        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        }) as any[][];

        if (jsonData.length < 1) {
          reject(new Error("Excel file must have at least a header row"));
          return;
        }

        // Extract headers (first row) - keep original case
        const headers = jsonData[0].map((h: any) => String(h || "").trim()).filter(h => h !== "");

        resolve(headers);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    // Use readAsText for CSV, readAsArrayBuffer for Excel
    if (isCSV) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

/**
 * Parse Excel file and extract well data
 * Expected columns: name, wellNumber, location (optional), status (optional)
 */
export function parseExcelFile(file: File): Promise<WellImportRow[]> {
  return new Promise((resolve, reject) => {
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (!result) {
          reject(new Error("Failed to read file"));
          return;
        }

        let workbook: XLSX.WorkBook;
        
        // Handle CSV files differently
        if (isCSV) {
          const text = typeof result === 'string' ? result : new TextDecoder().decode(result as ArrayBuffer);
          workbook = XLSX.read(text, { type: "string" });
        } else {
          // Handle Excel files (.xlsx, .xls)
          const data = result instanceof ArrayBuffer 
            ? new Uint8Array(result) 
            : new Uint8Array(result as ArrayBuffer);
          workbook = XLSX.read(data, { type: "array" });
        }

        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        }) as any[][];

        if (jsonData.length < 2) {
          reject(new Error("Excel file must have at least a header row and one data row"));
          return;
        }

        // Extract headers (first row)
        const headers = jsonData[0].map((h: any) =>
          String(h).toLowerCase().trim()
        ) as string[];

        // Find column indices - handle multiple possible column names
        const nameIndex = headers.findIndex((h) => {
          const lower = h.toLowerCase();
          return (
            ["well name #1", "wellname #1", "well_name #1", "name"].includes(lower) ||
            lower.includes("well name") && lower.includes("#1")
          );
        });
        const name2Index = headers.findIndex((h) => {
          const lower = h.toLowerCase();
          return (
            ["well name #2", "wellname #2", "well_name #2"].includes(lower) ||
            (lower.includes("well name") && lower.includes("#2"))
          );
        });
        
        // Try API 14 first, then API 10, then API 14 ALT as well number
        const wellNumberIndex = headers.findIndex((h) =>
          ["api 14", "api14"].includes(h.toLowerCase())
        ) !== -1
          ? headers.findIndex((h) => ["api 14", "api14"].includes(h.toLowerCase()))
          : headers.findIndex((h) => ["api 10", "api10"].includes(h.toLowerCase())) !== -1
          ? headers.findIndex((h) => ["api 10", "api10"].includes(h.toLowerCase()))
          : headers.findIndex((h) => ["api 14 alt", "api14 alt", "api14alt"].includes(h.toLowerCase()));

        const locationIndex = headers.findIndex((h) =>
          ["location", "loc"].includes(h.toLowerCase())
        );
        const statusIndex = headers.findIndex((h) =>
          ["status"].includes(h.toLowerCase())
        );

        // Use Well Name #1 if available, otherwise Well Name #2
        const finalNameIndex = nameIndex !== -1 ? nameIndex : name2Index !== -1 ? name2Index : -1;

        if (finalNameIndex === -1 || wellNumberIndex === -1) {
          reject(
            new Error(
              "Excel file must have 'Well Name #1' (or 'Well Name #2') and 'API 14' (or 'API 10') columns"
            )
          );
          return;
        }

        // Extract data rows
        const wells: WellImportRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          // Get name from Well Name #1 or fallback to Well Name #2
          const name1 = nameIndex >= 0 ? String(row[nameIndex] || "").trim() : "";
          const name2 = name2Index >= 0 ? String(row[name2Index] || "").trim() : "";
          const name = name1 || name2;
          
          const wellNumber = String(row[wellNumberIndex] || "").trim();

          if (!name || !wellNumber) {
            continue; // Skip empty rows
          }

          const location = locationIndex >= 0 ? String(row[locationIndex] || "").trim() : undefined;
          const statusRaw = statusIndex >= 0 ? String(row[statusIndex] || "").trim().toLowerCase() : undefined;
          const status = statusRaw === "inactive" ? "inactive" : "active";

          // Map specific columns to structured metadata
          const metadata: Record<string, any> = {};
          
          // Find all column indices for metadata
          const api10Idx = headers.findIndex((h) => ["api 10", "api10"].includes(h.toLowerCase()));
          const api14Idx = headers.findIndex((h) => ["api 14", "api14"].includes(h.toLowerCase()));
          const api14AltIdx = headers.findIndex((h) => ["api 14 alt", "api14 alt", "api14alt"].includes(h.toLowerCase()));
          const tankFactorIdx = headers.findIndex((h) => ["tank factor", "tankfactor"].includes(h.toLowerCase()));
          const liftTypeIdx = headers.findIndex((h) => ["lift type", "lifttype"].includes(h.toLowerCase()));
          const wiIdx = headers.findIndex((h) => ["wi"].includes(h.toLowerCase()));
          const nriIdx = headers.findIndex((h) => ["nri"].includes(h.toLowerCase()));
          const surfaceIdx = headers.findIndex((h) => ["surface"].includes(h.toLowerCase()));
          const swdIdx = headers.findIndex((h) => ["swd"].includes(h.toLowerCase()));
          const secIdx = headers.findIndex((h) => ["sec"].includes(h.toLowerCase()));
          const twnIdx = headers.findIndex((h) => ["twn"].includes(h.toLowerCase()));
          const rngIdx = headers.findIndex((h) => ["rng"].includes(h.toLowerCase()));
          const countyIdx = headers.findIndex((h) => ["county"].includes(h.toLowerCase()));
          const stateIdx = headers.findIndex((h) => ["state"].includes(h.toLowerCase()));
          const leaseDescIdx = headers.findIndex((h) => 
            ["lease description", "leasedescription"].includes(h.toLowerCase())
          );
          const grossAcresIdx = headers.findIndex((h) => 
            ["gross acres", "grossacres"].includes(h.toLowerCase())
          );
          const oilRateIdx = headers.findIndex((h) => 
            h.toLowerCase().includes("potential oil") || h.toLowerCase().includes("oil production")
          );
          const gasRateIdx = headers.findIndex((h) => 
            h.toLowerCase().includes("potential gas") || h.toLowerCase().includes("gas production")
          );
          const waterRateIdx = headers.findIndex((h) => 
            h.toLowerCase().includes("potential water") || h.toLowerCase().includes("water production")
          );
          const operatorIdx = headers.findIndex((h) => 
            ["operator"].includes(h.toLowerCase())
          );
          const fieldIdx = headers.findIndex((h) => 
            ["field"].includes(h.toLowerCase())
          );
          const formationIdx = headers.findIndex((h) => 
            ["formation"].includes(h.toLowerCase())
          );
          const reservoirIdx = headers.findIndex((h) => 
            ["reservoir"].includes(h.toLowerCase())
          );
          const payZoneIdx = headers.findIndex((h) => 
            ["pay zone", "payzone", "pay_zone"].includes(h.toLowerCase())
          );
          const wellTypeIdx = headers.findIndex((h) => 
            ["well type", "welltype", "well_type"].includes(h.toLowerCase())
          );
          const wellboreTypeIdx = headers.findIndex((h) => 
            ["wellbore type", "wellboretype", "wellbore_type"].includes(h.toLowerCase())
          );
          const spudDateIdx = headers.findIndex((h) => 
            ["spud date", "spuddate", "spud_date"].includes(h.toLowerCase())
          );
          const completionDateIdx = headers.findIndex((h) => 
            ["completion date", "completiondate", "completion_date"].includes(h.toLowerCase())
          );
          const firstProductionDateIdx = headers.findIndex((h) => 
            ["first production date", "firstproductiondate", "first_production_date", "first production", "firstprod"].includes(h.toLowerCase())
          );
          const totalDepthIdx = headers.findIndex((h) => 
            ["total depth", "totaldepth", "total_depth", "td"].includes(h.toLowerCase())
          );
          const tvdIdx = headers.findIndex((h) => 
            ["tvd", "true vertical depth"].includes(h.toLowerCase())
          );
          const mdIdx = headers.findIndex((h) => 
            ["md", "measured depth"].includes(h.toLowerCase())
          );
          const permitNumberIdx = headers.findIndex((h) => 
            ["permit number", "permitnumber", "permit_number", "permit"].includes(h.toLowerCase())
          );
          const permitDateIdx = headers.findIndex((h) => 
            ["permit date", "permitdate", "permit_date"].includes(h.toLowerCase())
          );
          const currentStatusIdx = headers.findIndex((h) => 
            ["current status", "currentstatus", "current_status"].includes(h.toLowerCase())
          );
          const wellboreStatusIdx = headers.findIndex((h) => 
            ["wellbore status", "wellborestatus", "wellbore_status"].includes(h.toLowerCase())
          );

          // Add structured metadata
          if (api10Idx >= 0 && row[api10Idx]) metadata.api10 = String(row[api10Idx]).trim();
          if (api14Idx >= 0 && row[api14Idx]) metadata.api14 = String(row[api14Idx]).trim();
          if (api14AltIdx >= 0 && row[api14AltIdx]) metadata.api14Alt = String(row[api14AltIdx]).trim();
          if (name2Index >= 0 && row[name2Index]) metadata.wellName2 = String(row[name2Index]).trim();
          if (tankFactorIdx >= 0 && row[tankFactorIdx] !== undefined) metadata.tankFactor = row[tankFactorIdx];
          if (liftTypeIdx >= 0 && row[liftTypeIdx]) metadata.liftType = String(row[liftTypeIdx]).trim();
          if (wiIdx >= 0 && row[wiIdx] !== undefined) metadata.wi = row[wiIdx];
          if (nriIdx >= 0 && row[nriIdx] !== undefined) metadata.nri = row[nriIdx];
          if (surfaceIdx >= 0 && row[surfaceIdx]) metadata.surface = String(row[surfaceIdx]).trim();
          if (swdIdx >= 0 && row[swdIdx]) metadata.swd = String(row[swdIdx]).trim();
          if (secIdx >= 0 && row[secIdx] !== undefined) metadata.sec = row[secIdx];
          if (twnIdx >= 0 && row[twnIdx] !== undefined) metadata.twn = row[twnIdx];
          if (rngIdx >= 0 && row[rngIdx] !== undefined) metadata.rng = row[rngIdx];
          if (countyIdx >= 0 && row[countyIdx]) metadata.county = String(row[countyIdx]).trim();
          if (stateIdx >= 0 && row[stateIdx]) metadata.state = String(row[stateIdx]).trim();
          if (leaseDescIdx >= 0 && row[leaseDescIdx]) metadata.leaseDescription = String(row[leaseDescIdx]).trim();
          if (grossAcresIdx >= 0 && row[grossAcresIdx] !== undefined) metadata.grossAcres = row[grossAcresIdx];
          if (oilRateIdx >= 0 && row[oilRateIdx] !== undefined) metadata.potentialOilProductionRate = row[oilRateIdx];
          if (gasRateIdx >= 0 && row[gasRateIdx] !== undefined) metadata.potentialGasProductionRate = row[gasRateIdx];
          if (waterRateIdx >= 0 && row[waterRateIdx] !== undefined) metadata.potentialWaterProductionRate = row[waterRateIdx];
          if (operatorIdx >= 0 && row[operatorIdx]) metadata.operator = String(row[operatorIdx]).trim();
          if (fieldIdx >= 0 && row[fieldIdx]) metadata.field = String(row[fieldIdx]).trim();
          if (formationIdx >= 0 && row[formationIdx]) metadata.formation = String(row[formationIdx]).trim();
          if (reservoirIdx >= 0 && row[reservoirIdx]) metadata.reservoir = String(row[reservoirIdx]).trim();
          if (payZoneIdx >= 0 && row[payZoneIdx]) metadata.payZone = String(row[payZoneIdx]).trim();
          if (wellTypeIdx >= 0 && row[wellTypeIdx]) metadata.wellType = String(row[wellTypeIdx]).trim();
          if (wellboreTypeIdx >= 0 && row[wellboreTypeIdx]) metadata.wellboreType = String(row[wellboreTypeIdx]).trim();
          if (spudDateIdx >= 0 && row[spudDateIdx] !== undefined) metadata.spudDate = row[spudDateIdx];
          if (completionDateIdx >= 0 && row[completionDateIdx] !== undefined) metadata.completionDate = row[completionDateIdx];
          if (firstProductionDateIdx >= 0 && row[firstProductionDateIdx] !== undefined) metadata.firstProductionDate = row[firstProductionDateIdx];
          if (totalDepthIdx >= 0 && row[totalDepthIdx] !== undefined) metadata.totalDepth = row[totalDepthIdx];
          if (tvdIdx >= 0 && row[tvdIdx] !== undefined) metadata.tvd = row[tvdIdx];
          if (mdIdx >= 0 && row[mdIdx] !== undefined) metadata.md = row[mdIdx];
          if (permitNumberIdx >= 0 && row[permitNumberIdx]) metadata.permitNumber = String(row[permitNumberIdx]).trim();
          if (permitDateIdx >= 0 && row[permitDateIdx] !== undefined) metadata.permitDate = row[permitDateIdx];
          if (currentStatusIdx >= 0 && row[currentStatusIdx]) metadata.currentStatus = String(row[currentStatusIdx]).trim();
          if (wellboreStatusIdx >= 0 && row[wellboreStatusIdx]) metadata.wellboreStatus = String(row[wellboreStatusIdx]).trim();

          // Collect any remaining unmapped fields
          headers.forEach((header, idx) => {
            const lowerHeader = header.toLowerCase();
            const isMapped =
              idx === finalNameIndex ||
              idx === name2Index ||
              idx === wellNumberIndex ||
              idx === locationIndex ||
              idx === statusIndex ||
              idx === api10Idx ||
              idx === api14Idx ||
              idx === api14AltIdx ||
              idx === tankFactorIdx ||
              idx === liftTypeIdx ||
              idx === wiIdx ||
              idx === nriIdx ||
              idx === surfaceIdx ||
              idx === swdIdx ||
              idx === secIdx ||
              idx === twnIdx ||
              idx === rngIdx ||
              idx === countyIdx ||
              idx === stateIdx ||
              idx === leaseDescIdx ||
              idx === grossAcresIdx ||
              idx === oilRateIdx ||
              idx === gasRateIdx ||
              idx === waterRateIdx ||
              idx === operatorIdx ||
              idx === fieldIdx ||
              idx === formationIdx ||
              idx === reservoirIdx ||
              idx === payZoneIdx ||
              idx === wellTypeIdx ||
              idx === wellboreTypeIdx ||
              idx === spudDateIdx ||
              idx === completionDateIdx ||
              idx === firstProductionDateIdx ||
              idx === totalDepthIdx ||
              idx === tvdIdx ||
              idx === mdIdx ||
              idx === permitNumberIdx ||
              idx === permitDateIdx ||
              idx === currentStatusIdx ||
              idx === wellboreStatusIdx;

            if (!isMapped && row[idx] !== undefined && row[idx] !== "" && row[idx] !== "-") {
              metadata[header] = row[idx];
            }
          });

          wells.push({
            name,
            wellNumber,
            location: location || undefined,
            status,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          });
        }

        resolve(wells);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    // Use readAsText for CSV, readAsArrayBuffer for Excel
    if (isCSV) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

/**
 * Import wells from parsed data into InstantDB
 */
export async function importWells(
  wells: WellImportRow[],
  existingWellsData?: any,
  mode: ImportMode = "skip"
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    updated: 0,
    errors: [],
    skipped: 0,
  };

  const now = new Date().toISOString();
  const transactions: any[] = [];

  // Build map of existing wells by wellNumber (case-insensitive)
  const existingWellsMap = new Map<string, any>();
  const existingWellNumbers = new Set<string>();
  
  if (existingWellsData) {
    const existingWells = existingWellsData.wells
      ? Array.isArray(existingWellsData.wells)
        ? existingWellsData.wells
        : Object.values(existingWellsData.wells)
      : [];
    
    existingWells.forEach((well: any) => {
      if (well.wellNumber) {
        const wellNumberLower = well.wellNumber.toLowerCase().trim();
        existingWellNumbers.add(wellNumberLower);
        existingWellsMap.set(wellNumberLower, well);
      }
    });
  }

  for (let i = 0; i < wells.length; i++) {
    const well = wells[i];
    const rowNum = i + 2; // +2 because row 1 is header, row 2 is first data row

    try {
      // Validate required fields
      if (!well.name || !well.wellNumber) {
        result.errors.push({
          row: rowNum,
          error: "Missing required fields: name and wellNumber",
        });
        result.skipped++;
        continue;
      }

      // Check for duplicates in import file (tracking set for this batch)
      const wellNumberLower = well.wellNumber.toLowerCase().trim();
      
      // Track all wells processed in this import (both new and existing)
      const importBatchSet = new Set<string>();
      
      // Check if well already exists in database
      const existingWell = existingWellsMap.get(wellNumberLower);
      
      if (existingWell) {
        // Well exists - handle based on mode
        if (mode === "skip") {
          result.errors.push({
            row: rowNum,
            error: `Well ${well.wellNumber} already exists - skipped`,
          });
          result.skipped++;
          continue;
        } else if (mode === "update") {
          // Update existing well
          const wellData: any = {
            name: well.name,
            wellNumber: well.wellNumber,
            status: well.status || existingWell.status || "active",
            updatedAt: now,
          };

          if (well.location) {
            wellData.location = well.location;
          } else if (existingWell.location) {
            wellData.location = existingWell.location;
          }

          // Merge metadata - new data takes precedence
          if (well.metadata && Object.keys(well.metadata).length > 0) {
            wellData.metadata = {
              ...(existingWell.metadata || {}),
              ...well.metadata,
            };
          } else if (existingWell.metadata) {
            wellData.metadata = existingWell.metadata;
          }

          // Update existing well
          transactions.push(db.tx.wells[existingWell.id].update(wellData));
          result.updated++;
          continue;
        }
        // mode === "add-only" - will fall through to create new one (shouldn't happen, but handle it)
      }

      // Create new well
      const wellData: any = {
        name: well.name,
        wellNumber: well.wellNumber,
        status: well.status || "active",
        createdAt: now,
        updatedAt: now,
      };

      if (well.location) {
        wellData.location = well.location;
      }

      // Add metadata if present
      if (well.metadata && Object.keys(well.metadata).length > 0) {
        wellData.metadata = well.metadata;
      }

      // Create transaction for new well
      const wellId = id();
      transactions.push(db.tx.wells[wellId].update(wellData));
    } catch (error: any) {
      result.errors.push({
        row: rowNum,
        error: error.message || "Unknown error",
      });
      result.skipped++;
    }
  }

  // Execute all transactions in batches
  if (transactions.length > 0) {
    try {
      // InstantDB can handle multiple transactions
      // We'll execute in batches of 50 to avoid overwhelming the system
      const batchSize = 50;
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        await db.transact(batch);
        result.imported += batch.length;
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push({
        row: 0,
        error: `Transaction error: ${error.message}`,
      });
    }
  }

  return result;
}

