"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/instant";
import { BaselineProductionChart } from "@/components/charts/BaselineProductionChart";
import { BaselineDataTable } from "@/components/baseline/BaselineDataTable";

export default function BaselinePage() {
  const router = useRouter();
  const { user: authUser } = db.useAuth();
  const userId = authUser?.id;

  // Query baseline data
  const { data: baselineData, isLoading: isLoadingBaseline } = db.useQuery({
    baselineUnderwriting: {},
  });

  if (!userId) {
    router.push("/login");
    return null;
  }

  // Extract baseline data
  const baselineRaw = baselineData?.baselineUnderwriting;
  const baselines = baselineRaw
    ? Array.isArray(baselineRaw)
      ? baselineRaw
      : Object.values(baselineRaw)
    : [];

  // Get the most recent baseline (or first one if multiple)
  const currentBaseline = baselines.length > 0 ? baselines[0] : null;

  // Prepare chart data
  const productionData = useMemo(() => {
    if (!currentBaseline?.productionForecast) return [];
    return currentBaseline.productionForecast;
  }, [currentBaseline]);


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-tepui-gray">Baseline Underwriting</h1>
          <p className="mt-2 text-gray-600">
            Investment assumptions, prices, and production forecasts
          </p>
        </div>
        <Link
          href="/import?tab=baseline"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700"
        >
          Import Baseline Data
        </Link>
      </div>

      {/* Info message if no data */}
      {!currentBaseline && (
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-blue-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-blue-800 mb-1">
                No baseline data available
              </h3>
              <p className="text-sm text-blue-700">
                Import the Baseline Underwriting Excel file from the{" "}
                <Link href="/import?tab=baseline" className="underline font-medium">
                  Import page
                </Link>{" "}
                to view prices, assumptions, and forecasts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Data info if exists */}
      {currentBaseline && (
        <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            Baseline data loaded. Last updated:{" "}
            <span className="font-medium">
              {new Date(currentBaseline.updatedAt).toLocaleDateString()}
            </span>
            {" "}•{" "}
            <Link href="/import?tab=baseline" className="text-tepui-blue hover:text-blue-700 underline">
              Re-import data
            </Link>
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoadingBaseline && !currentBaseline && (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading baseline data...</p>
        </div>
      )}

      {/* Charts Section */}
      {currentBaseline && (
        <div className="space-y-6 mb-8">
          {currentBaseline.structuredData && (
            <BaselineProductionChart 
              data={productionData} 
              structuredData={currentBaseline.structuredData}
            />
          )}
        </div>
      )}

      {/* Data Table Section */}
      {currentBaseline && (
        <BaselineDataTable
          rawData={currentBaseline.rawData}
          prices={currentBaseline.prices}
          assumptions={currentBaseline.assumptions}
          structuredData={currentBaseline.structuredData}
        />
      )}

    </div>
  );
}

