import * as XLSX from "xlsx";
import { id } from "@instantdb/react";
import { db } from "./instant";

export interface GaugingRow {
  wellNumber: string; // API 14 or well identifier
  date: string; // Date from sheet name or row
  tank?: string; // Tank number (1, 2, 3, etc.)
  oilFeet?: number; // Oil measurement in feet
  oilInches?: number; // Oil measurement in inches
  gasRate?: number; // Gas Rate
  instantGasRate?: number; // Instant Gas Rate
  tubingPressure?: number; // Tubing Pressure
  casingPressure?: number; // Casing Pressure
  linePressure?: number; // Line Pressure
  comment?: string; // Comments/Issues
  metadata?: Record<string, any>; // Any other fields
}

export interface ParsedGaugingSheet {
  sheetName: string;
  date: Date | null;
  rows: GaugingRow[];
}

export interface GaugingImportResult {
  success: boolean;
  imported: {
    tankGaugings: number;
    meterReadings: number;
  };
  errors: Array<{ sheet: string; row: number; error: string }>;
  skipped: number;
}

/**
 * Parse Excel file with multiple sheets (one per day)
 * Each sheet represents daily gauging data
 */
export function parseGaugingLog(file: File): Promise<ParsedGaugingSheet[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        if (!e.target?.result) {
          reject(new Error("Failed to read file - no data received"));
          return;
        }

        const resultSize = e.target.result instanceof ArrayBuffer 
          ? e.target.result.byteLength 
          : (typeof e.target.result === 'string' ? e.target.result.length : 0);
        console.log("File read successfully, size:", resultSize);
        
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        console.log("Reading workbook...");
        const workbook = XLSX.read(data, { type: "array" });

        console.log("Workbook sheets:", workbook.SheetNames);

        if (workbook.SheetNames.length === 0) {
          reject(new Error("File has no sheets"));
          return;
        }

        const parsedSheets: ParsedGaugingSheet[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          try {
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
              console.warn(`Sheet "${sheetName}" is empty or invalid`);
              return;
            }

            console.log(`Processing sheet: ${sheetName}`);
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
              defval: "",
              raw: false,
            }) as any[][];

            console.log(`Sheet "${sheetName}" has ${jsonData.length} rows`);

            if (jsonData.length < 2) {
              console.warn(`Sheet "${sheetName}" has less than 2 rows, skipping`);
              return;
            }

          // Try to extract date from sheet name
          // Format can be "MMDDYY" (e.g., "112225" = November 22, 2025) 
          // or "MMDYY" (e.g., "12125" = December 1, 2025) - single digit day, 2 digit month
          let sheetDate: Date | null = null;
          try {
            const dateStr = sheetName.trim();
            
            // Try MMDDYY format (6 digits: 112225 = 11/22/25)
            if (/^\d{6}$/.test(dateStr)) {
              const month = parseInt(dateStr.substring(0, 2)) - 1;
              const day = parseInt(dateStr.substring(2, 4));
              const year = 2000 + parseInt(dateStr.substring(4, 6));
              sheetDate = new Date(year, month, day);
              if (!isNaN(sheetDate.getTime())) {
                console.log(`Parsed date from sheet name "${sheetName}": ${sheetDate.toLocaleDateString()}`);
              }
            }
            // Try MMDYY format (5 digits: 12125 = 12/1/25) - when day is single digit but month is 2 digits
            // Format: MM-D-YY (month 2 digits, day 1 digit, year 2 digits)
            else if (/^\d{5}$/.test(dateStr)) {
              const month = parseInt(dateStr.substring(0, 2)) - 1;
              const day = parseInt(dateStr.substring(2, 3));
              const year = 2000 + parseInt(dateStr.substring(3, 5));
              sheetDate = new Date(year, month, day);
              if (!isNaN(sheetDate.getTime())) {
                console.log(`Parsed date from sheet name "${sheetName}" (MMDYY format): ${sheetDate.toLocaleDateString()}`);
              }
            }
            // If custom formats didn't work, try standard date parsing
            if (!sheetDate || isNaN(sheetDate.getTime())) {
              sheetDate = new Date(dateStr);
              if (isNaN(sheetDate.getTime())) {
                // Try parsing as "MM/DD/YYYY" or "M/D/YYYY"
                const parts = dateStr.split(/[\/\-]/);
                if (parts.length === 3) {
                  const month = parseInt(parts[0]) - 1;
                  const day = parseInt(parts[1]);
                  const year = parseInt(parts[2]);
                  sheetDate = new Date(year, month, day);
                }
              }
            }
            
            if (isNaN(sheetDate.getTime())) {
              sheetDate = null;
            }
          } catch {
            sheetDate = null;
          }

          // Extract headers (first row)
          const headers = jsonData[0].map((h: any) =>
            String(h).toLowerCase().trim()
          ) as string[];

          // Get original headers for error messages (preserve case)
          const originalHeaders = jsonData[0].map((h: any) =>
            String(h || "").trim()
          ) as string[];

          // Find column indices - flexible matching
          const wellNumberIndex = headers.findIndex((h) => {
            const lower = h.toLowerCase();
            return (
              lower.includes("api") ||
              lower.includes("well") ||
              lower.includes("wellnumber") ||
              lower.includes("well_id") ||
              lower.includes("well#") ||
              lower === "api" ||
              lower.startsWith("api") ||
              lower.endsWith("api")
            );
          });

          // Check if well number column was found - this is required
          if (wellNumberIndex === -1) {
            throw new Error(
              `Sheet "${sheetName}": Could not find a well identifier column. ` +
              `Found columns: ${originalHeaders.join(", ") || "none"}. ` +
              `Please ensure your file has a column containing "API", "Well Number", or similar.`
            );
          }

          const tankColumnIndex = headers.findIndex((h) => {
            const lower = h.toLowerCase().trim();
            return (
              lower === "tank" ||
              lower.includes("tank") ||
              lower.includes("tank number") ||
              lower.includes("tank#")
            );
          });

          const oilFeetIndex = headers.findIndex((h) => {
            const lower = h.toLowerCase().trim();
            return (
              lower.includes("oil (ft)") ||
              lower.includes("oil(ft)") ||
              lower.includes("oil ft") ||
              lower.includes("oil feet") ||
              (lower.includes("ft") && lower.includes("oil"))
            );
          });

          const oilInchesIndex = headers.findIndex((h) => {
            const lower = h.toLowerCase().trim();
            return (
              lower.includes("oil (in)") ||
              lower.includes("oil(in)") ||
              lower.includes("oil in") ||
              lower.includes("oil inches") ||
              (lower.includes("in") && lower.includes("oil"))
            );
          });

          const gasRateIndex = headers.findIndex((h) => {
            const lower = h.toLowerCase().trim();
            return (
              lower.includes("gas rate") ||
              lower.includes("gasrate") ||
              (lower.includes("gas") && lower.includes("rate") && !lower.includes("instant"))
            );
          });

          const instantGasRateIndex = headers.findIndex((h) => {
            const lower = h.toLowerCase().trim();
            return (
              lower.includes("instant gas rate") ||
              lower.includes("instantgasrate") ||
              (lower.includes("instant") && lower.includes("gas"))
            );
          });

          const tubingPressureIndex = headers.findIndex((h) => {
            const lower = h.toLowerCase().trim();
            return (
              lower.includes("tubing pressure") ||
              lower.includes("tubingpressure") ||
              (lower.includes("tubing") && lower.includes("pressure"))
            );
          });

          const casingPressureIndex = headers.findIndex((h) => {
            const lower = h.toLowerCase().trim();
            return (
              lower.includes("casing pressure") ||
              lower.includes("casingpressure") ||
              (lower.includes("casing") && lower.includes("pressure"))
            );
          });

          const linePressureIndex = headers.findIndex((h) => {
            const lower = h.toLowerCase().trim();
            return (
              lower.includes("line pressure") ||
              lower.includes("linepressure") ||
              (lower.includes("line") && lower.includes("pressure"))
            );
          });

          const commentIndex = headers.findIndex((h) => {
            const lower = h.toLowerCase().trim();
            return (
              lower.includes("comment") ||
              lower.includes("comments") ||
              lower.includes("note") ||
              lower.includes("notes") ||
              lower.includes("remarks") ||
              lower.includes("remark") ||
              lower.includes("issues") ||
              lower.includes("issue")
            );
          });

          const dateIndex = headers.findIndex((h) => {
            const lower = h.toLowerCase().trim();
            return (
              lower.includes("date") ||
              lower.includes("timestamp") ||
              lower.includes("time") ||
              lower.includes("datetime")
            );
          });
          
          console.log(`Sheet "${sheetName}": Column indices - Well: ${wellNumberIndex}, Tank: ${tankColumnIndex}, Oil (ft): ${oilFeetIndex}, Oil (in): ${oilInchesIndex}, Gas Rate: ${gasRateIndex}, Instant Gas Rate: ${instantGasRateIndex}, Tubing Pressure: ${tubingPressureIndex}, Casing Pressure: ${casingPressureIndex}, Line Pressure: ${linePressureIndex}, Comments: ${commentIndex}`);

          // Note: wellNumberIndex check is already done above with error thrown

          const rows: GaugingRow[] = [];

          // Process data rows
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            const wellNumber = String(row[wellNumberIndex] || "").trim();

            if (!wellNumber || wellNumber === "") {
              continue; // Skip rows without well number
            }

            // Try to get date from row if not in sheet name
            let rowDate = sheetDate;
            if (!rowDate && dateIndex !== -1 && row[dateIndex]) {
              try {
                rowDate = new Date(String(row[dateIndex]));
                if (isNaN(rowDate.getTime())) {
                  rowDate = sheetDate;
                }
              } catch {
                rowDate = sheetDate;
              }
            }

            // Get tank number from Tank column
            const tankNumberStr = tankColumnIndex !== -1 && row[tankColumnIndex]
              ? String(row[tankColumnIndex]).trim()
              : undefined;
            
            // Parse oil measurements (feet and inches)
            const oilFeet = oilFeetIndex !== -1 && row[oilFeetIndex]
              ? parseFloat(String(row[oilFeetIndex]).replace(/,/g, ""))
              : undefined;
            const oilInches = oilInchesIndex !== -1 && row[oilInchesIndex]
              ? parseFloat(String(row[oilInchesIndex]).replace(/,/g, ""))
              : undefined;
            
            // Parse gas rates
            const gasRate = gasRateIndex !== -1 && row[gasRateIndex]
              ? parseFloat(String(row[gasRateIndex]).replace(/,/g, ""))
              : undefined;
            const instantGasRate = instantGasRateIndex !== -1 && row[instantGasRateIndex]
              ? parseFloat(String(row[instantGasRateIndex]).replace(/,/g, ""))
              : undefined;
            
            // Parse pressure measurements
            const tubingPressure = tubingPressureIndex !== -1 && row[tubingPressureIndex]
              ? parseFloat(String(row[tubingPressureIndex]).replace(/,/g, ""))
              : undefined;
            const casingPressure = casingPressureIndex !== -1 && row[casingPressureIndex]
              ? parseFloat(String(row[casingPressureIndex]).replace(/,/g, ""))
              : undefined;
            const linePressure = linePressureIndex !== -1 && row[linePressureIndex]
              ? parseFloat(String(row[linePressureIndex]).replace(/,/g, ""))
              : undefined;

            // Get comment
            const comment =
              commentIndex !== -1 && row[commentIndex]
                ? String(row[commentIndex]).trim()
                : undefined;

            // Collect any other metadata
            const metadata: Record<string, any> = {};
            headers.forEach((header, idx) => {
              const isMapped =
                idx === wellNumberIndex ||
                idx === tankColumnIndex ||
                idx === oilFeetIndex ||
                idx === oilInchesIndex ||
                idx === gasRateIndex ||
                idx === instantGasRateIndex ||
                idx === tubingPressureIndex ||
                idx === casingPressureIndex ||
                idx === linePressureIndex ||
                idx === commentIndex ||
                idx === dateIndex;

              if (!isMapped && row[idx] !== undefined && row[idx] !== "") {
                metadata[header] = row[idx];
              }
            });

            rows.push({
              wellNumber,
              date: rowDate ? rowDate.toISOString() : sheetName,
              tank: tankNumberStr,
              oilFeet: oilFeet !== undefined && !isNaN(oilFeet) ? oilFeet : undefined,
              oilInches: oilInches !== undefined && !isNaN(oilInches) ? oilInches : undefined,
              gasRate: gasRate !== undefined && !isNaN(gasRate) ? gasRate : undefined,
              instantGasRate: instantGasRate !== undefined && !isNaN(instantGasRate) ? instantGasRate : undefined,
              tubingPressure: tubingPressure !== undefined && !isNaN(tubingPressure) ? tubingPressure : undefined,
              casingPressure: casingPressure !== undefined && !isNaN(casingPressure) ? casingPressure : undefined,
              linePressure: linePressure !== undefined && !isNaN(linePressure) ? linePressure : undefined,
              comment,
              metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            });
          }

            if (rows.length > 0) {
              console.log(`Sheet "${sheetName}" parsed successfully with ${rows.length} rows`);
              parsedSheets.push({
                sheetName,
                date: sheetDate,
                rows,
              });
            } else {
              console.warn(`Sheet "${sheetName}" has no valid rows after parsing`);
            }
          } catch (sheetError: any) {
            console.error(`Error processing sheet "${sheetName}":`, sheetError);
            // Continue processing other sheets even if one fails
          }
        });

        console.log(`Total parsed sheets: ${parsedSheets.length}`);

        if (parsedSheets.length === 0) {
          reject(new Error("No valid data found in any sheet. Please check that your file has sheets with well number/API columns and data rows."));
          return;
        }

        resolve(parsedSheets);
      } catch (error: any) {
        console.error("Error parsing file:", error);
        reject(new Error(`Error parsing Excel file: ${error.message || "Unknown error"}`));
      }
    };

    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      reject(new Error("Failed to read file. Please make sure the file is not corrupted."));
    };

    try {
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      reject(new Error(`Failed to read file: ${error.message || "Unknown error"}`));
    }
  });
}

/**
 * Import gauging data into InstantDB
 * Creates tankGauging entries for oil tank strappings
 * Creates meterReadings entries for gas readings
 * 
 * Note: wellsData should be passed from the calling component using db.useQuery
 */
export async function importGaugingData(
  parsedSheets: ParsedGaugingSheet[],
  userId: string,
  wellsData: any,
  existingGaugingData?: any,
  existingReadingsData?: any
): Promise<GaugingImportResult> {
  const result: GaugingImportResult = {
    success: true,
    imported: {
      tankGaugings: 0,
      meterReadings: 0,
    },
    errors: [],
    skipped: 0,
  };

  // Extract wells from the data structure
  const wells = wellsData?.wells
    ? Array.isArray(wellsData.wells)
      ? wellsData.wells
      : Object.values(wellsData.wells)
    : [];

  // Extract existing gauging and readings data
  const existingGaugings = existingGaugingData?.tankGauging
    ? Array.isArray(existingGaugingData.tankGauging)
      ? existingGaugingData.tankGauging
      : Object.values(existingGaugingData.tankGauging)
    : [];

  const existingReadings = existingReadingsData?.meterReadings
    ? Array.isArray(existingReadingsData.meterReadings)
      ? existingReadingsData.meterReadings
      : Object.values(existingReadingsData.meterReadings)
    : [];

  // Collect all dates that will be imported (for potential future use)
  // Note: We'll handle date extraction per row to handle different date formats

  // Create maps for matching wells by various identifiers (case-insensitive)
  const wellNumberMap = new Map<string, string>(); // API numbers
  const wellNameMap = new Map<string, string>(); // Well names (Well Name #1)
  const wellName2Map = new Map<string, string>(); // Well Name #2 from metadata
  const wellNameNormalizedMap = new Map<string, string>(); // Normalized well names (no spaces/special chars)
  
  wells.forEach((well: any) => {
    // Match by well number (API)
    if (well.wellNumber) {
      wellNumberMap.set(well.wellNumber.toLowerCase(), well.id);
      // Also try without any formatting
      wellNumberMap.set(well.wellNumber.replace(/[-\s]/g, "").toLowerCase(), well.id);
    }
    
    // Match by well name (Well Name #1)
    if (well.name) {
      const nameLower = well.name.toLowerCase();
      wellNameMap.set(nameLower, well.id);
      // Normalized name (remove extra spaces)
      const normalizedName = well.name.replace(/\s+/g, " ").trim().toLowerCase();
      wellNameMap.set(normalizedName, well.id);
      // Normalized name (no spaces/dashes)
      const noSpacesName = well.name.replace(/[-\s]/g, "").toLowerCase();
      wellNameNormalizedMap.set(noSpacesName, well.id);
    }
    
    // Also check metadata for API numbers and Well Name #2
    if (well.metadata) {
      const metadata = well.metadata as any;
      
      // Match by API numbers
      if (metadata.api14) {
        wellNumberMap.set(String(metadata.api14).toLowerCase(), well.id);
        wellNumberMap.set(String(metadata.api14).replace(/[-\s]/g, "").toLowerCase(), well.id);
      }
      if (metadata.api10) {
        wellNumberMap.set(String(metadata.api10).toLowerCase(), well.id);
        wellNumberMap.set(String(metadata.api10).replace(/[-\s]/g, "").toLowerCase(), well.id);
      }
      if (metadata.api14Alt) {
        wellNumberMap.set(String(metadata.api14Alt).toLowerCase(), well.id);
        wellNumberMap.set(String(metadata.api14Alt).replace(/[-\s]/g, "").toLowerCase(), well.id);
      }
      
      // Match by Well Name #2 (alternative well name)
      if (metadata.wellName2) {
        const name2Lower = String(metadata.wellName2).toLowerCase();
        wellName2Map.set(name2Lower, well.id);
        // Normalized name #2 (remove extra spaces)
        const normalizedName2 = String(metadata.wellName2).replace(/\s+/g, " ").trim().toLowerCase();
        wellName2Map.set(normalizedName2, well.id);
        // Normalized name #2 (no spaces/dashes)
        const noSpacesName2 = String(metadata.wellName2).replace(/[-\s]/g, "").toLowerCase();
        wellNameNormalizedMap.set(noSpacesName2, well.id);
      }
    }
  });

  const transactions: any[] = [];
  const now = new Date().toISOString();

  // Track which entries we've already deleted to avoid duplicate deletions
  const deletedTankGaugings = new Set<string>();
  const deletedMeterReadings = new Set<string>();

  parsedSheets.forEach((sheet) => {
    sheet.rows.forEach((row, rowIndex) => {
      try {
        // Find matching well - try multiple matching strategies
        const wellIdentifier = row.wellNumber.trim();
        const wellIdentifierLower = wellIdentifier.toLowerCase();
        const wellIdentifierNormalized = wellIdentifierLower.replace(/[-\s]/g, "");
        const wellIdentifierTrimmed = wellIdentifierLower.replace(/\s+/g, " ").trim();
        
        // Try matching by (in order of preference):
        // 1. Exact well number (API) - case insensitive
        // 2. Normalized well number (no spaces/dashes)
        // 3. Well Name #1 (exact) - case insensitive
        // 4. Well Name #1 (normalized spaces)
        // 5. Well Name #2 from metadata (exact) - case insensitive
        // 6. Well Name #2 from metadata (normalized spaces)
        // 7. Normalized well name (no spaces/dashes) - matches either name
        let wellId =
          wellNumberMap.get(wellIdentifierLower) ||
          wellNumberMap.get(wellIdentifierNormalized) ||
          wellNameMap.get(wellIdentifierLower) ||
          wellNameMap.get(wellIdentifierTrimmed) ||
          wellName2Map.get(wellIdentifierLower) ||
          wellName2Map.get(wellIdentifierTrimmed) ||
          wellNameNormalizedMap.get(wellIdentifierNormalized);

        if (!wellId) {
          result.errors.push({
            sheet: sheet.sheetName,
            row: rowIndex + 2, // +2 because row 1 is header, row 2 is first data row
            error: `Well "${row.wellNumber}" not found in database. Tried matching by API number, Well Name #1, and Well Name #2. Please ensure the well exists in the Wells page.`,
          });
          result.skipped++;
          return;
        }

        // row.date is a string (ISO string or sheet name)
        const timestamp = row.date ? new Date(row.date).toISOString() : now;
        const dateOnly = timestamp.split("T")[0]; // YYYY-MM-DD

        // Prepare common metadata
        const commonMetadata: Record<string, any> = {
          ...(row.comment ? { comment: row.comment } : {}),
          ...(row.metadata || {}),
          importSource: "gauging_log",
          sheetName: sheet.sheetName,
        };

        // Create tank gauging entry if we have tank strapping data (tank number + oil measurements)
        if (row.tank && (row.oilFeet !== undefined || row.oilInches !== undefined)) {
          // Convert feet and inches to total inches
          let tankLevel: number | undefined = undefined;
          if (row.oilFeet !== undefined && !isNaN(row.oilFeet)) {
            if (row.oilInches !== undefined && !isNaN(row.oilInches)) {
              // Convert to total inches: (feet * 12) + inches
              tankLevel = (row.oilFeet * 12) + row.oilInches;
            } else {
              // Only feet provided, convert to inches
              tankLevel = row.oilFeet * 12;
            }
          } else if (row.oilInches !== undefined && !isNaN(row.oilInches)) {
            // Only inches provided
            tankLevel = row.oilInches;
          }

          if (tankLevel !== undefined) {
            const tankNumber = row.tank.toString().trim();
            const tankNumberFormatted = `Tank ${tankNumber}`;
            
            // Delete existing tank gauging entries for this well, date, and tank
            const deleteKey = `${wellId}-${dateOnly}-${tankNumberFormatted}`;
            if (!deletedTankGaugings.has(deleteKey)) {
              existingGaugings
                .filter((g: any) => {
                  const gDateOnly = g.timestamp ? g.timestamp.split("T")[0] : "";
                  return (
                    g.wellId === wellId &&
                    gDateOnly === dateOnly &&
                    g.tankNumber === tankNumberFormatted
                  );
                })
                .forEach((g: any) => {
                  if (g.id) {
                    transactions.push(db.tx.tankGauging[g.id].delete());
                  }
                });
              deletedTankGaugings.add(deleteKey);
            }

            transactions.push(
              db.tx.tankGauging[id()].update({
                wellId,
                level: tankLevel,
                timestamp,
                tankNumber: tankNumberFormatted,
                userId,
                metadata: {
                  ...commonMetadata,
                  oilFeet: row.oilFeet,
                  oilInches: row.oilInches,
                },
                createdAt: now,
              })
            );
            result.imported.tankGaugings++;
          }
        }

        // Helper function to delete existing meter readings and create new ones
        const deleteAndCreateMeterReading = (
          value: number,
          meterType: string,
          unit: string
        ) => {
          const deleteKey = `${wellId}-${dateOnly}-${meterType}`;
          if (!deletedMeterReadings.has(deleteKey)) {
            existingReadings
              .filter((r: any) => {
                const rDateOnly = r.timestamp ? r.timestamp.split("T")[0] : "";
                return (
                  r.wellId === wellId &&
                  rDateOnly === dateOnly &&
                  r.meterType === meterType
                );
              })
              .forEach((r: any) => {
                if (r.id) {
                  transactions.push(db.tx.meterReadings[r.id].delete());
                }
              });
            deletedMeterReadings.add(deleteKey);
          }

          transactions.push(
            db.tx.meterReadings[id()].update({
              wellId,
              value,
              timestamp,
              meterType,
              unit,
              userId,
              metadata: commonMetadata,
              createdAt: now,
            })
          );
          result.imported.meterReadings++;
        };

        // Create meter reading entry for Gas Rate
        if (row.gasRate !== undefined && row.gasRate !== null && !isNaN(row.gasRate)) {
          deleteAndCreateMeterReading(row.gasRate, "Gas Rate", "MCF");
        }

        // Create meter reading entry for Instant Gas Rate
        if (row.instantGasRate !== undefined && row.instantGasRate !== null && !isNaN(row.instantGasRate)) {
          deleteAndCreateMeterReading(row.instantGasRate, "Instant Gas Rate", "MCF");
        }

        // Create meter reading entry for Tubing Pressure
        if (row.tubingPressure !== undefined && row.tubingPressure !== null && !isNaN(row.tubingPressure)) {
          deleteAndCreateMeterReading(row.tubingPressure, "Tubing Pressure", "PSI");
        }

        // Create meter reading entry for Casing Pressure
        if (row.casingPressure !== undefined && row.casingPressure !== null && !isNaN(row.casingPressure)) {
          deleteAndCreateMeterReading(row.casingPressure, "Casing Pressure", "PSI");
        }

        // Create meter reading entry for Line Pressure
        if (row.linePressure !== undefined && row.linePressure !== null && !isNaN(row.linePressure)) {
          deleteAndCreateMeterReading(row.linePressure, "Line Pressure", "PSI");
        }
      } catch (error: any) {
        result.success = false;
        result.errors.push({
          sheet: sheet.sheetName,
          row: rowIndex + 2,
          error: error.message || "Unknown error",
        });
        result.skipped++;
      }
    });
  });

  // Execute all transactions
  if (transactions.length > 0) {
    try {
      // Batch transactions in chunks of 100 to avoid overwhelming the system
      const chunkSize = 100;
      for (let i = 0; i < transactions.length; i += chunkSize) {
        const chunk = transactions.slice(i, i + chunkSize);
        await db.transact(chunk);
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push({
        sheet: "General",
        row: -1,
        error: `Failed to commit transactions: ${error.message || "Unknown error"}`,
      });
    }
  }

  return result;
}

