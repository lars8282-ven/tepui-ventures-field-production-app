"use client";

import { useState, useMemo } from "react";
import { db } from "@/lib/instant";
import { OilInventoryTable } from "@/components/inventory/OilInventoryTable";
import { OilInventoryChart } from "@/components/charts/OilInventoryChart";
import { GasSummaryTable } from "@/components/inventory/GasSummaryTable";
import { GasRateChart } from "@/components/charts/GasRateChart";
import { OthersSummaryTable } from "@/components/inventory/OthersSummaryTable";
import { OthersSummaryChart } from "@/components/charts/OthersSummaryChart";
import { format } from "date-fns";

export default function SummaryPage() {
  const [activeTab, setActiveTab] = useState<"oil" | "gas" | "others">("oil");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Query all necessary data - get all wells to detect orphaned data
  const { data: wellsData } = db.useQuery({
    wells: {},
  });

  const { data: gaugingData } = db.useQuery({
    tankGauging: {},
  });

  const { data: readingsData } = db.useQuery({
    meterReadings: {},
  });

  // Extract data from InstantDB format (handles both array and object formats)
  const allWellsRaw = wellsData?.wells;
  const allWells = allWellsRaw
    ? Array.isArray(allWellsRaw)
      ? allWellsRaw
      : Object.values(allWellsRaw)
    : [];
  
  // Filter to only active wells for display
  const wells = allWells.filter((w: any) => w.status === "active");

  const gaugings = gaugingData?.tankGauging
    ? Array.isArray(gaugingData.tankGauging)
      ? gaugingData.tankGauging
      : Object.values(gaugingData.tankGauging)
    : [];

  const readings = readingsData?.meterReadings
    ? Array.isArray(readingsData.meterReadings)
      ? readingsData.meterReadings
      : Object.values(readingsData.meterReadings)
    : [];

  const [deletingOrphaned, setDeletingOrphaned] = useState(false);

  // Check for orphaned data (data linked to non-existent or inactive wells)
  const orphanedData = useMemo(() => {
    const wellIdSet = new Set(allWells.map((w: any) => w.id));
    const orphanedGaugings = gaugings.filter((g: any) => !wellIdSet.has(g.wellId));
    const orphanedReadings = readings.filter((r: any) => !wellIdSet.has(r.wellId));
    return {
      gaugings: orphanedGaugings,
      readings: orphanedReadings,
      total: orphanedGaugings.length + orphanedReadings.length,
    };
  }, [allWells, gaugings, readings]);

  const handleDeleteOrphanedData = async () => {
    if (!confirm(`Are you sure you want to delete ${orphanedData.total} orphaned records? This action cannot be undone.`)) {
      return;
    }

    setDeletingOrphaned(true);
    try {
      const transactions: any[] = [];

      // Delete orphaned gaugings
      orphanedData.gaugings.forEach((gauging: any) => {
        transactions.push(db.tx.tankGauging[gauging.id].delete());
      });

      // Delete orphaned readings
      orphanedData.readings.forEach((reading: any) => {
        transactions.push(db.tx.meterReadings[reading.id].delete());
      });

      // Execute deletions in batches
      if (transactions.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < transactions.length; i += chunkSize) {
          const chunk = transactions.slice(i, i + chunkSize);
          await db.transact(chunk);
        }
      }

      alert(`Successfully deleted ${orphanedData.total} orphaned records.`);
    } catch (error: any) {
      alert(`Error deleting orphaned data: ${error.message}`);
    } finally {
      setDeletingOrphaned(false);
    }
  };

  // Get available dates from gaugings and readings
  const availableDates = useMemo(() => {
    const dateSet = new Set<string>();

    // Add dates from tank gaugings
    gaugings.forEach((gauging: any) => {
      const date = new Date(gauging.timestamp || gauging.createdAt);
      const dateKey = format(date, "yyyy-MM-dd");
      dateSet.add(dateKey);
    });

    // Add dates from meter readings
    readings.forEach((reading: any) => {
      const date = new Date(reading.timestamp || reading.createdAt);
      const dateKey = format(date, "yyyy-MM-dd");
      dateSet.add(dateKey);
    });

    // Convert to array and sort (newest first)
    return Array.from(dateSet).sort().reverse();
  }, [gaugings, readings]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-tepui-gray">Summary & Inventory</h1>
        <p className="mt-2 text-gray-600">
          View current oil inventories, gas rates, and production statistics
        </p>
        {orphanedData.total > 0 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-yellow-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-800">
                  Orphaned Data Detected
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  {orphanedData.gaugings.length} orphaned tank gauging{orphanedData.gaugings.length !== 1 ? 's' : ''} and {orphanedData.readings.length} orphaned meter reading{orphanedData.readings.length !== 1 ? 's' : ''} found.
                  This data is linked to wells that no longer exist (possibly deleted duplicates).
                  You may need to re-import your gauging log file to restore this data.
                </p>
                <div className="mt-3">
                  <button
                    onClick={handleDeleteOrphanedData}
                    disabled={deletingOrphaned}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingOrphaned ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Orphaned Data
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="mt-4">
          <label htmlFor="date-select" className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Date (or leave blank for latest data):
          </label>
          <select
            id="date-select"
            value={selectedDate || ""}
            onChange={(e) => setSelectedDate(e.target.value || null)}
            className="block w-full sm:w-auto border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
          >
            <option value="">Latest Data</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {format(new Date(date + "T00:00:00"), "MMM d, yyyy")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("oil")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "oil"
                ? "border-tepui-blue text-tepui-gray"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Oil Inventory
          </button>
          <button
            onClick={() => setActiveTab("gas")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "gas"
                ? "border-tepui-blue text-tepui-gray"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Gas Summary
          </button>
          <button
            onClick={() => setActiveTab("others")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "others"
                ? "border-tepui-blue text-tepui-gray"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Others Summary
          </button>
        </nav>
      </div>

      {/* Oil Inventory Tab */}
      {activeTab === "oil" && (
        <div className="space-y-6">
          <OilInventoryTable wells={wells as any[]} gaugings={gaugings as any[]} selectedDate={selectedDate} />
          <OilInventoryChart wells={wells as any[]} gaugings={gaugings as any[]} />
        </div>
      )}

      {/* Gas Summary Tab */}
      {activeTab === "gas" && (
        <div className="space-y-6">
          <GasSummaryTable wells={wells as any[]} readings={readings as any[]} selectedDate={selectedDate} />
          <GasRateChart wells={wells as any[]} readings={readings as any[]} />
        </div>
      )}

      {/* Others Summary Tab */}
      {activeTab === "others" && (
        <div className="space-y-6">
          <OthersSummaryTable wells={wells as any[]} readings={readings as any[]} selectedDate={selectedDate} />
          <OthersSummaryChart wells={wells as any[]} readings={readings as any[]} />
        </div>
      )}
    </div>
  );
}

