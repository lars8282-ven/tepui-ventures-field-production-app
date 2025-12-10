"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseGaugingLog, importGaugingData, type ParsedGaugingSheet, type GaugingImportResult } from "@/lib/gauging-import";
import { db } from "@/lib/instant";

export default function ImportGaugingPage() {
  const router = useRouter();
  const { user: authUser } = db.useAuth();
  const userId = authUser?.id;
  const { data: wellsData } = db.useQuery({ wells: {} });
  
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ParsedGaugingSheet[]>([]);
  const [result, setResult] = useState<GaugingImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");

  if (!userId) {
    router.push("/login");
    return null;
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setFile(selectedFile);
    setResult(null);
    setError(null);
    setLoading(true);

    try {
      console.log("Starting to parse file...");
      const parsedSheets = await parseGaugingLog(selectedFile);
      console.log("Parsed sheets:", parsedSheets.length, parsedSheets);
      
      if (parsedSheets.length === 0) {
        throw new Error("No valid data found in the file. Please check that your file has sheets with well data.");
      }
      
      setPreview(parsedSheets); // Show all sheets, not just first 5
      setStep("preview");
    } catch (error: any) {
      console.error("Error parsing file:", error);
      const errorMsg = error.message || "Unknown error occurred while parsing the file";
      setError(errorMsg);
      alert(`Error parsing file: ${errorMsg}`);
      setFile(null);
      setPreview([]);
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !userId || !wellsData) return;

    setStep("importing");
    setLoading(true);
    setResult(null);

    try {
      const parsedSheets = await parseGaugingLog(file);
      const importResult = await importGaugingData(parsedSheets, userId, wellsData);
      setResult(importResult);
      setStep("complete");
    } catch (error: any) {
      setResult({
        success: false,
        imported: {
          tankGaugings: 0,
          meterReadings: 0,
        },
        errors: [{ sheet: "General", row: 0, error: error.message || "Import failed" }],
        skipped: 0,
      });
      setStep("complete");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setStep("upload");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-tepui-gray">Import Gauging Log</h1>
        <p className="mt-2 text-gray-600">
          Upload an Excel file with multiple sheets (one per day) containing tank strapping and gas meter readings
        </p>
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This page is for importing <strong>gauging log data</strong> (tank levels, gas rates, pressures). 
            To import <strong>well information</strong> (well names, API numbers, locations), use the <a href="/import" className="underline font-semibold">Import Wells</a> page instead.
          </p>
        </div>
      </div>

      {/* File Format Instructions */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-tepui-gray mb-2">
          Excel File Format
        </h3>
        <p className="text-sm text-gray-700 mb-2">
          Your Excel file should have:
        </p>
        <ul className="text-sm text-gray-700 list-disc list-inside space-y-1 mb-3">
          <li><strong>Multiple sheets</strong> - One sheet per day (sheet name in format "MMDDYY" or "MMDYY", e.g., "112225" = Nov 22, 2025, "12125" = Dec 1, 2025)</li>
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
      {step === "upload" && (
        <div className="bg-white shadow rounded-lg p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          {loading && (
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
                  htmlFor="file-upload"
                  className="relative cursor-pointer bg-white rounded-md font-semibold text-tepui-blue hover:text-blue-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-tepui-blue"
                >
                  <span>Upload a file</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">
                Excel files (.xlsx, .xls) with multiple sheets
              </p>
              {file && (
                <p className="text-xs text-tepui-blue mt-2">
                  Selected: {file.name}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === "preview" && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-tepui-gray mb-4">
            Preview ({preview.length} sheets found)
          </h2>
          {preview.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                No data found in the file. Please check that your file has sheets with well data.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
            {preview.map((sheet, idx) => (
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
              onClick={handleImport}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue disabled:opacity-50"
            >
              Import Gauging Data
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Importing Step */}
      {step === "importing" && (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tepui-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Importing gauging data...</p>
        </div>
      )}

      {/* Results Step */}
      {step === "complete" && result && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-tepui-gray mb-4">
            Import Results
          </h2>
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg ${
                result.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {result.success ? (
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
                      result.success ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {result.success
                      ? "Import completed successfully"
                      : "Import completed with errors"}
                  </h3>
                  <div className="mt-2 text-sm text-gray-700">
                    <p>
                      <strong>{result.imported.tankGaugings}</strong> tank gaugings imported
                    </p>
                    <p>
                      <strong>{result.imported.meterReadings}</strong> gas meter readings imported
                    </p>
                    {result.skipped > 0 && (
                      <p>
                        <strong>{result.skipped}</strong> rows skipped
                      </p>
                    )}
                    {result.errors.length > 0 && (
                      <p>
                        <strong>{result.errors.length}</strong> errors
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
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
                      {result.errors.map((error, idx) => (
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
                onClick={handleReset}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Import Another File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

