"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseExcelFile, importWells, extractHeaders, type ImportResult } from "@/lib/excel-import";
import { parseGaugingLog, importGaugingData, type ParsedGaugingSheet, type GaugingImportResult } from "@/lib/gauging-import";
import { parseBaselineFile, importBaselineData } from "@/lib/baseline-import";
import { db } from "@/lib/instant";

export default function ImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: authUser } = db.useAuth();
  const userId = authUser?.id;
  
  // Get initial tab from URL parameter, default to "wells"
  const initialTab = (searchParams?.get("tab") as "wells" | "gauging" | "baseline") || "wells";
  const [activeTab, setActiveTab] = useState<"wells" | "gauging" | "baseline">(initialTab);
  
  // Update tab when URL parameter changes
  useEffect(() => {
    const tab = searchParams?.get("tab") as "wells" | "gauging" | "baseline";
    if (tab && ["wells", "gauging", "baseline"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  
  // Wells import state
  const [wellsFile, setWellsFile] = useState<File | null>(null);
  const [wellsLoading, setWellsLoading] = useState(false);
  const [wellsPreview, setWellsPreview] = useState<any[]>([]);
  const [wellsResult, setWellsResult] = useState<ImportResult | null>(null);
  const [wellsStep, setWellsStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<"skip" | "update" | "add-only">("skip");
  const [duplicateCount, setDuplicateCount] = useState(0);
  
  // Gauging import state
  const [gaugingFile, setGaugingFile] = useState<File | null>(null);
  const [gaugingLoading, setGaugingLoading] = useState(false);
  const [gaugingPreview, setGaugingPreview] = useState<ParsedGaugingSheet[]>([]);
  const [gaugingResult, setGaugingResult] = useState<GaugingImportResult | null>(null);
  const [gaugingError, setGaugingError] = useState<string | null>(null);
  const [gaugingStep, setGaugingStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  
  // Baseline import state
  const [baselineFile, setBaselineFile] = useState<File | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const [baselineSuccess, setBaselineSuccess] = useState(false);

  // Query existing gauging and readings data for duplicate checking
  const { data: existingGaugingData } = db.useQuery({
    tankGauging: {},
  });
  const { data: existingReadingsData } = db.useQuery({
    meterReadings: {},
  });
  const [baselineStep, setBaselineStep] = useState<"upload" | "importing" | "complete">("upload");
  
  // Query existing baseline data for deletion
  const { data: existingBaselineData } = db.useQuery({
    baselineUnderwriting: {},
  });
  
  // Query existing wells to check for duplicates and for gauging import
  const { data: existingWellsData } = db.useQuery({
    wells: {},
  });

  if (!userId) {
    router.push("/login");
    return null;
  }

  // ========== Wells Import Handlers ==========
  const handleWellsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert("Please upload a valid Excel file (.xlsx, .xls, or .csv)");
      return;
    }

    setWellsFile(selectedFile);
    setWellsResult(null);
    setWellsStep("preview");

    try {
      // Extract headers first
      const headers = await extractHeaders(selectedFile);
      setDetectedHeaders(headers);
      
      // Then parse the file for preview
      const wells = await parseExcelFile(selectedFile);
      setWellsPreview(wells.slice(0, 10)); // Show first 10 rows as preview
      
      // Check for duplicates with existing wells
      if (existingWellsData) {
        const existingWells = existingWellsData.wells
          ? Array.isArray(existingWellsData.wells)
            ? existingWellsData.wells
            : Object.values(existingWellsData.wells)
          : [];
        
        const existingWellNumbers = new Set(
          existingWells.map((w: any) => w.wellNumber?.toLowerCase().trim()).filter(Boolean)
        );
        
        const duplicates = wells.filter((w) => 
          existingWellNumbers.has(w.wellNumber.toLowerCase().trim())
        );
        
        setDuplicateCount(duplicates.length);
      }
    } catch (error: any) {
      alert(`Error parsing file: ${error.message}`);
      setWellsFile(null);
      setWellsStep("upload");
      setDetectedHeaders([]);
      setDuplicateCount(0);
    }
  };

  const handleWellsImport = async () => {
    if (!wellsFile) return;

    setWellsStep("importing");
    setWellsLoading(true);
    setWellsResult(null);

    try {
      const wells = await parseExcelFile(wellsFile);
      const importResult = await importWells(wells, existingWellsData, importMode);
      setWellsResult(importResult);
      setWellsStep("complete");
    } catch (error: any) {
      setWellsResult({
        success: false,
        imported: 0,
        updated: 0,
        errors: [{ row: 0, error: error.message || "Import failed" }],
        skipped: 0,
      });
      setWellsStep("complete");
    } finally {
      setWellsLoading(false);
    }
  };

  const handleWellsReset = () => {
    setWellsFile(null);
    setWellsPreview([]);
    setWellsResult(null);
    setDetectedHeaders([]);
    setDuplicateCount(0);
    setImportMode("skip");
    setWellsStep("upload");
  };

  // ========== Gauging Import Handlers ==========
  const handleGaugingFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      console.log("No file selected");
      return;
    }

    console.log("File selected:", selectedFile.name, selectedFile.type, selectedFile.size);

    // Validate file type - be more permissive
    const isExcelFile = selectedFile.name.match(/\.(xlsx|xls)$/i);
    const isValidType = selectedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                        selectedFile.type === "application/vnd.ms-excel" ||
                        selectedFile.type === "application/octet-stream" ||
                        isExcelFile;

    if (!isValidType) {
      const errorMsg = `Please upload a valid Excel file (.xlsx or .xls). File type: ${selectedFile.type || "unknown"}`;
      console.error(errorMsg);
      alert(errorMsg);
      return;
    }

    setGaugingFile(selectedFile);
    setGaugingResult(null);
    setGaugingError(null);
    setGaugingLoading(true);

    try {
      console.log("Starting to parse file...");
      const parsedSheets = await parseGaugingLog(selectedFile);
      console.log("Parsed sheets:", parsedSheets.length, parsedSheets);
      
      if (parsedSheets.length === 0) {
        throw new Error("No valid data found in the file. Please check that your file has sheets with well data.");
      }
      
      setGaugingPreview(parsedSheets); // Show all sheets, not just first 5
      setGaugingStep("preview");
    } catch (error: any) {
      console.error("Error parsing file:", error);
      const errorMsg = error.message || "Unknown error occurred while parsing the file";
      setGaugingError(errorMsg);
      alert(`Error parsing file: ${errorMsg}`);
      setGaugingFile(null);
      setGaugingPreview([]);
      setGaugingStep("upload");
    } finally {
      setGaugingLoading(false);
    }
  };

  const handleGaugingImport = async () => {
    if (!gaugingFile || !userId || !existingWellsData) return;

    setGaugingStep("importing");
    setGaugingLoading(true);
    setGaugingResult(null);

    try {
      const parsedSheets = await parseGaugingLog(gaugingFile);
      const importResult = await importGaugingData(
        parsedSheets,
        userId,
        existingWellsData,
        existingGaugingData,
        existingReadingsData
      );
      setGaugingResult(importResult);
      setGaugingStep("complete");
    } catch (error: any) {
      setGaugingResult({
        success: false,
        imported: {
          tankGaugings: 0,
          meterReadings: 0,
        },
        errors: [{ sheet: "General", row: 0, error: error.message || "Import failed" }],
        skipped: 0,
      });
      setGaugingStep("complete");
    } finally {
      setGaugingLoading(false);
    }
  };

  const handleGaugingReset = () => {
    setGaugingFile(null);
    setGaugingPreview([]);
    setGaugingResult(null);
    setGaugingError(null);
    setGaugingStep("upload");
  };

  // ========== Baseline Import Handlers ==========
  const handleBaselineFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "application/vnd.ms-excel.sheet.macroEnabled.12", // .xlsm
    ];
    const isValidType =
      validTypes.includes(selectedFile.type) ||
      selectedFile.name.match(/\.(xlsx|xls|xlsm)$/i);

    if (!isValidType) {
      setBaselineError(
        "Please upload a valid Excel file (.xlsx, .xls, or .xlsm). File type: " +
          (selectedFile.type || "unknown")
      );
      return;
    }

    setBaselineFile(selectedFile);
    setBaselineError(null);
    setBaselineSuccess(false);
  };

  const handleBaselineImport = async () => {
    if (!baselineFile) return;

    setBaselineStep("importing");
    setBaselineLoading(true);
    setBaselineError(null);
    setBaselineSuccess(false);

    try {
      // Parse the Excel file
      const parsedData = await parseBaselineFile(baselineFile);
      
      // Import into database (will delete existing data first)
      const result = await importBaselineData(parsedData, existingBaselineData);
      
      if (result.success) {
        setBaselineSuccess(true);
        setBaselineStep("complete");
      } else {
        setBaselineError(result.error || "Failed to import baseline data");
        setBaselineStep("complete");
      }
    } catch (err: any) {
      setBaselineError(err.message || "Error parsing Excel file");
      setBaselineStep("complete");
    } finally {
      setBaselineLoading(false);
    }
  };

  const handleBaselineReset = () => {
    setBaselineFile(null);
    setBaselineError(null);
    setBaselineSuccess(false);
    setBaselineStep("upload");
    // Reset file input
    const fileInput = document.getElementById("baseline-file-upload") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-tepui-gray">Import Data</h1>
        <p className="mt-2 text-gray-600">
          Import wells, gauging log, or baseline underwriting data from Excel files
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("wells")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "wells"
                ? "border-tepui-blue text-tepui-gray"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Import Wells
          </button>
          <button
            onClick={() => setActiveTab("gauging")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "gauging"
                ? "border-tepui-blue text-tepui-gray"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Import Gauging Log
          </button>
          <button
            onClick={() => setActiveTab("baseline")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "baseline"
                ? "border-tepui-blue text-tepui-gray"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Import Baseline
          </button>
        </nav>
      </div>

      {/* Wells Import Tab */}
      {activeTab === "wells" && (
        <div className="space-y-6">
      {/* File Format Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-tepui-gray mb-2">
              Excel File Format for Wells
        </h3>
        <p className="text-sm text-gray-700 mb-2">
          Your Excel/CSV file should have the following required columns:
        </p>
        <ul className="text-sm text-gray-700 list-disc list-inside space-y-1 mb-3">
          <li>
            <strong>Well Name #1</strong> or <strong>Well Name #2</strong> (required) - The
            name of the well
          </li>
          <li>
            <strong>API 14</strong>, <strong>API 10</strong>, or <strong>API 14 ALT</strong> (required) - Unique identifier
          </li>
        </ul>
        <p className="text-sm text-gray-700 mb-2">
          Optional columns that will be mapped:
        </p>
        <ul className="text-sm text-gray-700 list-disc list-inside space-y-1 mb-3">
          <li><strong>Location</strong> - Well location/area</li>
          <li><strong>Tank Factor</strong> - Tank factor value</li>
          <li><strong>Lift Type</strong> - Type of lift (ESP, PUMPING UNIT, etc.)</li>
          <li><strong>WI, NRI</strong> - Working Interest, Net Revenue Interest</li>
          <li><strong>SEC, TWN, RNG</strong> - Section, Township, Range</li>
          <li><strong>County, State</strong> - Geographic information</li>
          <li><strong>Lease Description</strong> - Lease details</li>
          <li><strong>Gross Acres</strong> - Acreage</li>
          <li><strong>Potential Production Rates</strong> - Oil, Gas, Water rates</li>
          <li>Any additional columns will be stored as metadata</li>
        </ul>
      </div>

      {/* Upload Step */}
          {wellsStep === "upload" && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex text-sm text-gray-600">
                <label
                      htmlFor="wells-file-upload"
                  className="relative cursor-pointer bg-white rounded-md font-semibold text-tepui-blue hover:text-blue-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-tepui-blue"
                >
                  <span>Upload a file</span>
                  <input
                        id="wells-file-upload"
                        name="wells-file-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="sr-only"
                        onChange={handleWellsFileChange}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">
                Excel files (.xlsx, .xls) or CSV files
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Step */}
          {wellsStep === "preview" && wellsPreview.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-tepui-gray mb-4">
                Preview ({wellsPreview.length} of {wellsPreview.length} rows shown)
          </h2>
              
              {/* Detected Headers */}
              {detectedHeaders.length > 0 && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-tepui-gray mb-2">
                    Detected Column Headers (Row A):
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {detectedHeaders.map((header, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {header}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-3">
                    Total: {detectedHeaders.length} columns detected
                  </p>
                </div>
              )}
              
              <p className="text-sm text-gray-600 mb-4">
                All columns from your Excel file will be imported. Unmapped columns will be stored in the well metadata.
              </p>

              {/* Duplicate Warning and Mode Selection */}
              {duplicateCount > 0 && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-yellow-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-yellow-800 mb-2">
                        {duplicateCount} {duplicateCount === 1 ? 'well' : 'wells'} from this file already exist in the database
                      </h3>
                      <p className="text-sm text-yellow-700 mb-3">
                        Choose how to handle existing wells:
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="importMode"
                            value="skip"
                            checked={importMode === "skip"}
                            onChange={(e) => setImportMode(e.target.value as any)}
                            className="mr-2 text-tepui-blue focus:ring-tepui-blue"
                          />
                          <span className="text-sm text-yellow-800">
                            <strong>Skip duplicates</strong> - Don&apos;t import existing wells (recommended)
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="importMode"
                            value="update"
                            checked={importMode === "update"}
                            onChange={(e) => setImportMode(e.target.value as any)}
                            className="mr-2 text-tepui-blue focus:ring-tepui-blue"
                          />
                          <span className="text-sm text-yellow-800">
                            <strong>Update existing</strong> - Update existing wells with new data from file
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="importMode"
                            value="add-only"
                            checked={importMode === "add-only"}
                            onChange={(e) => setImportMode(e.target.value as any)}
                            className="mr-2 text-tepui-blue focus:ring-tepui-blue"
                          />
                          <span className="text-sm text-yellow-800">
                            <strong>Add new only</strong> - Import only wells that don&apos;t exist (skips duplicates)
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Well Number
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Metadata Fields
                      </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                    {wellsPreview.map((well, idx) => {
                      const metadataKeys = well.metadata ? Object.keys(well.metadata).slice(0, 5) : [];
                      const metadataCount = well.metadata ? Object.keys(well.metadata).length : 0;
                      return (
                  <tr key={idx}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {well.name}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {well.wellNumber}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {well.location || "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {well.status || "active"}
                    </td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {metadataCount > 0 ? (
                              <div>
                                <div className="text-xs text-gray-600 mb-1">
                                  {metadataKeys.join(", ")}
                                  {metadataCount > 5 && ` + ${metadataCount - 5} more`}
                                </div>
                                <div className="text-xs text-gray-400">
                                  ({metadataCount} total metadata fields)
                                </div>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                  </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex space-x-3">
            <button
                  onClick={handleWellsImport}
                  disabled={wellsLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue disabled:opacity-50"
            >
              Import Wells
            </button>
            <button
                  onClick={handleWellsReset}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Importing Step */}
          {wellsStep === "importing" && (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tepui-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Importing wells...</p>
        </div>
      )}

      {/* Results Step */}
          {wellsStep === "complete" && wellsResult && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-tepui-gray mb-4">
            Import Results
          </h2>
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg ${
                    wellsResult.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                      {wellsResult.success ? (
                    <svg
                      className="h-5 w-5 text-green-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-red-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h3
                    className={`text-sm font-semibold ${
                          wellsResult.success ? "text-green-800" : "text-red-800"
                    }`}
                  >
                        {wellsResult.success
                      ? "Import completed successfully"
                      : "Import completed with errors"}
                  </h3>
                  <div className="mt-2 text-sm text-gray-700">
                    <p>
                          <strong>{wellsResult.imported}</strong> wells imported
                        </p>
                        {wellsResult.updated > 0 && (
                          <p>
                            <strong>{wellsResult.updated}</strong> wells updated
                          </p>
                        )}
                        {wellsResult.skipped > 0 && (
                          <p>
                            <strong>{wellsResult.skipped}</strong> wells skipped
                      </p>
                    )}
                        {wellsResult.errors.length > 0 && (
                      <p>
                            <strong>{wellsResult.errors.length}</strong> errors
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

                {wellsResult.errors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Errors:
                </h3>
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                          Row
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                          Error
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                          {wellsResult.errors.map((error, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                            {error.row}
                          </td>
                          <td className="px-3 py-2 text-sm text-red-600">
                            {error.error}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => router.push("/wells")}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-tepui-blue hover:bg-blue-700"
              >
                View Wells
              </button>
              <button
                    onClick={handleWellsReset}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Import Another File
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gauging Import Tab */}
      {activeTab === "gauging" && (
        <div className="space-y-6">
          {/* File Format Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-tepui-gray mb-2">
              Excel File Format for Gauging Log
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              Your Excel file should have:
            </p>
            <ul className="text-sm text-gray-700 list-disc list-inside space-y-1 mb-3">
              <li><strong>Multiple sheets</strong> - One sheet per day (sheet name in format &quot;MMDDYY&quot; or &quot;MMDYY&quot;, e.g., &quot;112225&quot; = Nov 22, 2025, &quot;12125&quot; = Dec 1, 2025)</li>
              <li><strong>Well Number/API</strong> column - To match wells in the system (matches by API number, Well Name #1, or Well Name #2)</li>
              <li><strong>Tank</strong> column - Which tank number is being strapped (1, 2, 3, etc.)</li>
              <li><strong>Oil (ft)</strong> column - Feet measurement for the strapped tank</li>
              <li><strong>Oil (in)</strong> column - Inches measurement for the strapped tank (stored as total inches)</li>
              <li><strong>Gas Rate</strong> column - Gas rate measurement (MCF)</li>
              <li><strong>Instant Gas Rate</strong> column - Instant gas rate measurement (MCF)</li>
              <li><strong>Tubing Pressure</strong> column - Tubing pressure (PSI)</li>
              <li><strong>Casing Pressure</strong> column - Casing pressure (PSI)</li>
              <li><strong>Line Pressure</strong> column - Line pressure (PSI)</li>
              <li><strong>Comments/Issues</strong> column - Optional notes or issues</li>
            </ul>
            <p className="text-sm text-gray-700">
              Column names are flexible - the system will match common variations. Each row can contain tank strapping, gas rates, pressures, and comments.
            </p>
          </div>

          {/* Upload Step */}
          {gaugingStep === "upload" && (
            <div className="bg-white shadow rounded-lg p-6">
              {gaugingError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{gaugingError}</p>
                </div>
              )}
              {gaugingLoading && (
                <div className="mb-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tepui-blue mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Processing file...</p>
                </div>
              )}
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="gauging-file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-semibold text-tepui-blue hover:text-blue-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-tepui-blue"
                    >
                      <span>Upload a file</span>
                      <input
                        id="gauging-file-upload"
                        name="gauging-file-upload"
                        type="file"
                        accept=".xlsx,.xls"
                        className="sr-only"
                        onChange={handleGaugingFileChange}
                        disabled={gaugingLoading}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    Excel files (.xlsx, .xls) with multiple sheets
                  </p>
                  {gaugingFile && (
                    <p className="text-xs text-tepui-blue mt-2">
                      Selected: {gaugingFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {gaugingStep === "preview" && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-tepui-gray mb-4">
                Preview ({gaugingPreview.length} sheets found)
              </h2>
              {gaugingPreview.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    No data found in the file. Please check that your file has sheets with well data.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                {gaugingPreview.map((sheet, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Sheet: {sheet.sheetName}
                      </h3>
                      {sheet.date && (
                        <span className="text-xs text-gray-500">
                          {new Date(sheet.date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      {sheet.rows.length} rows found
                    </p>
                    {sheet.rows.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700">
                                Well
                              </th>
                              <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700">
                                Tank
                              </th>
                              <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700">
                                Oil (in)
                              </th>
                              <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700">
                                Gas Rate
                              </th>
                              <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700">
                                Pressures
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {sheet.rows.slice(0, 5).map((row, rowIdx) => {
                              // Calculate total inches from feet and inches
                              let totalInches: number | undefined = undefined;
                              if (row.oilFeet !== undefined || row.oilInches !== undefined) {
                                const feet = row.oilFeet || 0;
                                const inches = row.oilInches || 0;
                                totalInches = (feet * 12) + inches;
                              }
                              
                              const pressures = [];
                              if (row.tubingPressure !== undefined) pressures.push(`Tub: ${row.tubingPressure}`);
                              if (row.casingPressure !== undefined) pressures.push(`Cas: ${row.casingPressure}`);
                              if (row.linePressure !== undefined) pressures.push(`Line: ${row.linePressure}`);
                              
                              return (
                                <tr key={rowIdx}>
                                  <td className="px-2 py-1 text-xs text-gray-900">
                                    {row.wellNumber}
                                  </td>
                                  <td className="px-2 py-1 text-xs text-gray-600">
                                    {row.tank || "-"}
                                  </td>
                                  <td className="px-2 py-1 text-xs text-gray-600">
                                    {totalInches !== undefined ? `${totalInches.toFixed(1)} in` : "-"}
                                  </td>
                                  <td className="px-2 py-1 text-xs text-gray-600">
                                    {row.gasRate !== undefined ? `${row.gasRate} MCF` : 
                                     row.instantGasRate !== undefined ? `Instant: ${row.instantGasRate} MCF` : "-"}
                                  </td>
                                  <td className="px-2 py-1 text-xs text-gray-600">
                                    {pressures.length > 0 ? pressures.join(", ") : "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {sheet.rows.length > 5 && (
                          <p className="text-xs text-gray-500 mt-2">
                            ... and {sheet.rows.length - 5} more rows
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                </div>
              )}
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={handleGaugingImport}
                  disabled={gaugingLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue disabled:opacity-50"
                >
                  Import Gauging Data
                </button>
                <button
                  onClick={handleGaugingReset}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Importing Step */}
          {gaugingStep === "importing" && (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tepui-blue mx-auto"></div>
              <p className="mt-4 text-gray-600">Importing gauging data...</p>
            </div>
          )}

          {/* Results Step */}
          {gaugingStep === "complete" && gaugingResult && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-tepui-gray mb-4">
                Import Results
              </h2>
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-lg ${
                    gaugingResult.success
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {gaugingResult.success ? (
                        <svg
                          className="h-5 w-5 text-green-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5 text-red-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <h3
                        className={`text-sm font-semibold ${
                          gaugingResult.success ? "text-green-800" : "text-red-800"
                        }`}
                      >
                        {gaugingResult.success
                          ? "Import completed successfully"
                          : "Import completed with errors"}
                      </h3>
                      <div className="mt-2 text-sm text-gray-700">
                        <p>
                          <strong>{gaugingResult.imported.tankGaugings}</strong> tank gaugings imported
                        </p>
                        <p>
                          <strong>{gaugingResult.imported.meterReadings}</strong> gas meter readings imported
                        </p>
                        {gaugingResult.skipped > 0 && (
                          <p>
                            <strong>{gaugingResult.skipped}</strong> rows skipped
                          </p>
                        )}
                        {gaugingResult.errors.length > 0 && (
                          <p>
                            <strong>{gaugingResult.errors.length}</strong> errors
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {gaugingResult.errors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Errors:
                    </h3>
                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                              Sheet
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                              Row
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                              Error
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {gaugingResult.errors.map((error, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {error.sheet}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {error.row}
                              </td>
                              <td className="px-3 py-2 text-sm text-red-600">
                                {error.error}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={() => router.push("/gauging")}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-tepui-blue hover:bg-blue-700"
                  >
                    View Gauging Data
                  </button>
                  <button
                    onClick={handleGaugingReset}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Import Another File
              </button>
            </div>
          </div>
            </div>
          )}
        </div>
      )}

      {/* Baseline Import Tab */}
      {activeTab === "baseline" && (
        <div className="space-y-6">
          {/* File Format Instructions */}
          <div className="space-y-4">
            {existingBaselineData?.baselineUnderwriting && 
             (Array.isArray(existingBaselineData.baselineUnderwriting) 
               ? existingBaselineData.baselineUnderwriting.length > 0
               : Object.keys(existingBaselineData.baselineUnderwriting).length > 0) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-yellow-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                      Existing Baseline Data Will Be Replaced
                    </h3>
                    <p className="text-sm text-yellow-700">
                      Importing a new baseline file will delete all existing baseline data and replace it with the new import. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-tepui-gray mb-2">
                Excel File Format for Baseline Underwriting
              </h3>
            <p className="text-sm text-gray-700 mb-2">
              Your Excel file should contain:
            </p>
            <ul className="text-sm text-gray-700 list-disc list-inside space-y-1 mb-3">
              <li><strong>Prices</strong> - Oil price, gas price, NGL price, etc.</li>
              <li><strong>Assumptions</strong> - Discount rate, escalation, working interest, net revenue interest, etc.</li>
              <li><strong>Production Forecast</strong> - PDP (Proved Developed Producing) and PDSI (Proved Developed Shut-In) production over time</li>
              <li><strong>Revenue and Cost Structure</strong> - Revenue, operating costs, capital costs, and net revenue over time</li>
            </ul>
            <p className="text-sm text-gray-700">
              The system will automatically detect and parse these sections from your Excel file.
            </p>
            </div>
          </div>

          {/* Upload Step */}
          {baselineStep === "upload" && (
            <div className="bg-white shadow rounded-lg p-6">
              {baselineError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{baselineError}</p>
                </div>
              )}
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="baseline-file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-semibold text-tepui-blue hover:text-blue-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-tepui-blue"
                    >
                      <span>Upload a file</span>
                      <input
                        id="baseline-file-upload"
                        name="baseline-file-upload"
                        type="file"
                        accept=".xlsx,.xls,.xlsm"
                        className="sr-only"
                        onChange={handleBaselineFileChange}
                        disabled={baselineLoading}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    Excel files (.xlsx, .xls, .xlsm)
                  </p>
                  {baselineFile && (
                    <p className="text-xs text-tepui-blue mt-2">
                      Selected: {baselineFile.name}
                    </p>
                  )}
                </div>
              </div>
              {baselineFile && (
                <div className="mt-6 flex space-x-3">
                  <button
                    onClick={handleBaselineImport}
                    disabled={baselineLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue disabled:opacity-50"
                  >
                    {baselineLoading ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Importing...
                      </>
                    ) : (
                      "Import Baseline Data"
                    )}
                  </button>
                  <button
                    onClick={handleBaselineReset}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Importing Step */}
          {baselineStep === "importing" && (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tepui-blue mx-auto"></div>
              <p className="mt-4 text-gray-600">Importing baseline data...</p>
            </div>
          )}

          {/* Results Step */}
          {baselineStep === "complete" && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-tepui-gray mb-4">
                Import Results
              </h2>
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-lg ${
                    baselineSuccess
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {baselineSuccess ? (
                        <svg
                          className="h-5 w-5 text-green-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5 text-red-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <h3
                        className={`text-sm font-semibold ${
                          baselineSuccess ? "text-green-800" : "text-red-800"
                        }`}
                      >
                        {baselineSuccess
                          ? "Baseline data imported successfully"
                          : "Import failed"}
                      </h3>
                      {baselineError && (
                        <p className="mt-2 text-sm text-red-700">{baselineError}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => router.push("/baseline")}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-tepui-blue hover:bg-blue-700"
                  >
                    View Baseline Data
                  </button>
                  <button
                    onClick={handleBaselineReset}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Import Another File
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
