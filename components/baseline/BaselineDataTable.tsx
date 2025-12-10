"use client";

import { format } from "date-fns";

interface BaselineDataTableProps {
  rawData?: any[];
  prices?: Record<string, any>;
  assumptions?: Record<string, any>;
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

export function BaselineDataTable({
  rawData,
  prices,
  assumptions,
  structuredData,
}: BaselineDataTableProps) {
  // Helper to format date for display
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  // Helper to format number
  const formatNumber = (value: number) => {
    if (value === 0) return "-";
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    });
  };

  // If we have structured data, display it in Excel-like format
  // Prioritize structuredData over rawData
  if (structuredData) {
    const { dates, prices: pricesData, pdpAssumptions, pdsiAssumptions, pdpCalculations, pdsiCalculations, other, cashFlows, irr, netFcf } = structuredData;

    // If dates array is empty, we can't display the table properly
    if (!dates || dates.length === 0) {
      return (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-600">Structured data is available but dates are missing. Please re-import the file.</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Prices Section */}
        {pricesData.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Prices</h3>
              <p className="mt-1 text-sm text-gray-600">Input assumptions for prices</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                      Item
                    </th>
                    {dates.map((date) => (
                      <th
                        key={date}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]"
                      >
                        {formatDate(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pricesData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                        {row.label}
                      </td>
                      {dates.map((date) => (
                        <td
                          key={date}
                          className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 text-right"
                        >
                          {formatNumber(row.values[date] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PDP Assumptions Section */}
        {pdpAssumptions.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-blue-50 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">PDP Assumptions</h3>
              <p className="mt-1 text-sm text-gray-600">Input assumptions for Proved Developed Producing</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                      Item
                    </th>
                    {dates.map((date) => (
                      <th
                        key={date}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]"
                      >
                        {formatDate(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pdpAssumptions.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                        {row.label}
                      </td>
                      {dates.map((date) => (
                        <td
                          key={date}
                          className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 text-right"
                        >
                          {formatNumber(row.values[date] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PDSI Assumptions Section */}
        {pdsiAssumptions.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-green-50 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">PDSI Assumptions</h3>
              <p className="mt-1 text-sm text-gray-600">Input assumptions for Proved Developed Shut-In</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                      Item
                    </th>
                    {dates.map((date) => (
                      <th
                        key={date}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]"
                      >
                        {formatDate(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pdsiAssumptions.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                        {row.label}
                      </td>
                      {dates.map((date) => (
                        <td
                          key={date}
                          className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 text-right"
                        >
                          {formatNumber(row.values[date] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PDP Calculations Section */}
        {pdpCalculations.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-blue-100 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">PDP Calculations</h3>
              <p className="mt-1 text-sm text-gray-600">Calculated values for Proved Developed Producing</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                      Item
                    </th>
                    {dates.map((date) => (
                      <th
                        key={date}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]"
                      >
                        {formatDate(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pdpCalculations.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                        {row.label}
                      </td>
                      {dates.map((date) => (
                        <td
                          key={date}
                          className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 text-right"
                        >
                          {formatNumber(row.values[date] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PDSI Calculations Section */}
        {pdsiCalculations.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-green-100 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">PDSI Calculations</h3>
              <p className="mt-1 text-sm text-gray-600">Calculated values for Proved Developed Shut-In</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                      Item
                    </th>
                    {dates.map((date) => (
                      <th
                        key={date}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]"
                      >
                        {formatDate(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pdsiCalculations.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                        {row.label}
                      </td>
                      {dates.map((date) => (
                        <td
                          key={date}
                          className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 text-right"
                        >
                          {formatNumber(row.values[date] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Other Section */}
        {other.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Other</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                      Item
                    </th>
                    {dates.map((date) => (
                      <th
                        key={date}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]"
                      >
                        {formatDate(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {other.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                        {row.label}
                      </td>
                      {dates.map((date) => (
                        <td
                          key={date}
                          className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 text-right"
                        >
                          {formatNumber(row.values[date] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Total Cash Flows Section */}
        {cashFlows.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-yellow-50 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Total Cash Flows</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                      Item
                    </th>
                    {dates.map((date) => (
                      <th
                        key={date}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]"
                      >
                        {formatDate(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cashFlows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                        {row.label}
                      </td>
                      {dates.map((date) => (
                        <td
                          key={date}
                          className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 text-right"
                        >
                          {formatNumber(row.values[date] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary Metrics */}
        {(irr !== undefined || netFcf !== undefined) && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Summary Metrics</h3>
            </div>
            <div className="px-4 py-5 sm:px-6">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {irr !== undefined && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">IRR</dt>
                    <dd className="mt-1 text-lg font-semibold text-gray-900">
                      {(irr * 100).toFixed(2)}%
                    </dd>
                  </div>
                )}
                {netFcf !== undefined && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Net FCF</dt>
                    <dd className="mt-1 text-lg font-semibold text-gray-900">
                      ${netFcf.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Don't show rawData if structuredData exists (even if dates is empty)
  // Only show rawData as a last resort if structuredData doesn't exist at all
  if (!structuredData && rawData && rawData.length > 0) {
    const headers = Object.keys(rawData[0]);

    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium text-gray-900">Baseline Data</h3>
          <p className="mt-1 text-sm text-gray-600">
            Complete baseline underwriting data from Excel file
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rawData.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {headers.map((header) => {
                    const value = row[header];
                    const displayValue =
                      value === null || value === undefined
                        ? "-"
                        : typeof value === "number"
                        ? value.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : String(value);
                    return (
                      <td
                        key={header}
                        className="px-4 py-3 whitespace-nowrap text-sm text-gray-600"
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Otherwise, display prices and assumptions in a structured format
  return (
    <div className="space-y-6">
      {prices && Object.keys(prices).length > 0 && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900">Prices</h3>
          </div>
          <div className="border-t border-gray-200">
            <dl>
              {Object.entries(prices).map(([key, value]) => (
                <div
                  key={key}
                  className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6"
                >
                  <dt className="text-sm font-medium text-gray-500">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {typeof value === "number"
                      ? value.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {assumptions && Object.keys(assumptions).length > 0 && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900">Assumptions</h3>
          </div>
          <div className="border-t border-gray-200">
            <dl>
              {Object.entries(assumptions).map(([key, value]) => (
                <div
                  key={key}
                  className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6"
                >
                  <dt className="text-sm font-medium text-gray-500">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {typeof value === "number"
                      ? value.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        }) + (key.toLowerCase().includes("rate") || key.toLowerCase().includes("interest") ? "%" : "")
                      : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {(!prices || Object.keys(prices).length === 0) &&
        (!assumptions || Object.keys(assumptions).length === 0) &&
        (!rawData || rawData.length === 0) && (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <p className="text-gray-600">No baseline data available.</p>
          </div>
        )}
    </div>
  );
}

