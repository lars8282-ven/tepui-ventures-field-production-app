"use client";

import { useState, useMemo } from "react";
import { id } from "@instantdb/react";
import { db } from "@/lib/instant";
import { formatDateTime } from "@/lib/utils";

type ComparisonMethod = "percentage" | "absolute" | "custom";

export default function AnalyticsPage() {
  const { data: wellsData } = db.useQuery({
    wells: {
      $: {
        where: { status: "active" },
      },
    },
  });
  const { data: readingsData } = db.useQuery({ meterReadings: {} });
  const { data: gaugingData } = db.useQuery({ tankGauging: {} });
  const { data: baselinesData, isLoading } = db.useQuery({ baselines: {} });

  const [showBaselineForm, setShowBaselineForm] = useState(false);
  const [baselineFormData, setBaselineFormData] = useState({
    wellId: "",
    type: "meter" as "meter" | "tank" | "field",
    targetValue: "",
    metricName: "",
    period: "daily" as "daily" | "weekly" | "monthly",
    startDate: "",
    endDate: "",
  });

  const [comparisonMethod, setComparisonMethod] =
    useState<ComparisonMethod>("percentage");
  const [selectedWell, setSelectedWell] = useState<string>("all");

  const wells = wellsData?.wells || [];
  const readings = readingsData?.meterReadings || [];
  const gaugings = gaugingData?.tankGauging || [];
  const baselines = baselinesData?.baselines || [];

  const handleBaselineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    db.transact(
      db.tx.baselines[id()].update({
        wellId: baselineFormData.wellId,
        type: baselineFormData.type,
        targetValue: parseFloat(baselineFormData.targetValue),
        metricName: baselineFormData.metricName,
        period: baselineFormData.period,
        startDate: baselineFormData.startDate || undefined,
        endDate: baselineFormData.endDate || undefined,
        createdAt: now,
        updatedAt: now,
      })
    );
    setBaselineFormData({
      wellId: "",
      type: "meter",
      targetValue: "",
      metricName: "",
      period: "daily",
      startDate: "",
      endDate: "",
    });
    setShowBaselineForm(false);
  };

  const calculateComparison = (
    actual: number,
    baseline: number,
    method: ComparisonMethod
  ): number => {
    switch (method) {
      case "percentage":
        return baseline !== 0 ? ((actual - baseline) / baseline) * 100 : 0;
      case "absolute":
        return actual - baseline;
      case "custom":
        return actual / baseline;
      default:
        return 0;
    }
  };

  const statistics = useMemo(() => {
    const filteredReadings =
      selectedWell === "all"
        ? readings
        : readings.filter((r: any) => r.wellId === selectedWell);

    const filteredGaugings =
      selectedWell === "all"
        ? gaugings
        : gaugings.filter((g: any) => g.wellId === selectedWell);

    const wellBaselines =
      selectedWell === "all"
        ? baselines
        : baselines.filter((b: any) => b.wellId === selectedWell);

    const comparisons = wellBaselines.map((baseline: any) => {
      let actual = 0;
      let count = 0;

      if (baseline.type === "meter") {
        const relevantReadings = filteredReadings.filter(
          (r: any) => r.meterType === baseline.metricName || baseline.metricName === ""
        );
        if (relevantReadings.length > 0) {
          actual =
            relevantReadings.reduce((sum: number, r: any) => sum + r.value, 0) /
            relevantReadings.length;
          count = relevantReadings.length;
        }
      } else if (baseline.type === "tank") {
        const relevantGaugings = filteredGaugings.filter(
          (g: any) => g.tankNumber === baseline.metricName || baseline.metricName === ""
        );
        if (relevantGaugings.length > 0) {
          actual =
            relevantGaugings.reduce((sum: number, g: any) => sum + g.level, 0) /
            relevantGaugings.length;
          count = relevantGaugings.length;
        }
      }

      const comparison = calculateComparison(
        actual,
        baseline.targetValue,
        comparisonMethod
      );

      return {
        baseline,
        actual,
        comparison,
        count,
        wellName:
          wells.find((w: any) => w.id === baseline.wellId)?.name || "Unknown",
      };
    });

    return {
      totalReadings: filteredReadings.length,
      totalGaugings: filteredGaugings.length,
      comparisons,
    };
  }, [readings, gaugings, baselines, wells, selectedWell, comparisonMethod]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="mt-2 text-gray-600">
              Statistics and baseline comparisons
            </p>
          </div>
          <button
            onClick={() => setShowBaselineForm(!showBaselineForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700"
          >
            {showBaselineForm ? "Cancel" : "Add Baseline"}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label
              htmlFor="well-filter"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Filter by Well
            </label>
            <select
              id="well-filter"
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
              value={selectedWell}
              onChange={(e) => setSelectedWell(e.target.value)}
            >
              <option value="all">All Wells</option>
              {wells.map((well: any) => (
                <option key={well.id} value={well.id}>
                  {well.wellNumber} - {well.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label
              htmlFor="comparison-method"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Comparison Method
            </label>
            <select
              id="comparison-method"
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
              value={comparisonMethod}
              onChange={(e) =>
                setComparisonMethod(e.target.value as ComparisonMethod)
              }
            >
              <option value="percentage">Percentage Difference</option>
              <option value="absolute">Absolute Difference</option>
              <option value="custom">Custom (Ratio)</option>
            </select>
          </div>
        </div>
      </div>

      {showBaselineForm && (
        <div className="mb-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Add Baseline
          </h2>
          <form onSubmit={handleBaselineSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="baseline-wellId"
                  className="block text-sm font-medium text-gray-700"
                >
                  Well *
                </label>
                <select
                  id="baseline-wellId"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={baselineFormData.wellId}
                  onChange={(e) =>
                    setBaselineFormData({
                      ...baselineFormData,
                      wellId: e.target.value,
                    })
                  }
                >
                  <option value="">Select a well</option>
                  {wells.map((well: any) => (
                    <option key={well.id} value={well.id}>
                      {well.wellNumber} - {well.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="baseline-type"
                  className="block text-sm font-medium text-gray-700"
                >
                  Type *
                </label>
                <select
                  id="baseline-type"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={baselineFormData.type}
                  onChange={(e) =>
                    setBaselineFormData({
                      ...baselineFormData,
                      type: e.target.value as "meter" | "tank" | "field",
                    })
                  }
                >
                  <option value="meter">Meter</option>
                  <option value="tank">Tank</option>
                  <option value="field">Field</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="baseline-metricName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Metric Name *
                </label>
                <input
                  type="text"
                  id="baseline-metricName"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  placeholder="e.g., Flow meter, Tank 1"
                  value={baselineFormData.metricName}
                  onChange={(e) =>
                    setBaselineFormData({
                      ...baselineFormData,
                      metricName: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="baseline-targetValue"
                  className="block text-sm font-medium text-gray-700"
                >
                  Target Value *
                </label>
                <input
                  type="number"
                  id="baseline-targetValue"
                  step="0.01"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={baselineFormData.targetValue}
                  onChange={(e) =>
                    setBaselineFormData({
                      ...baselineFormData,
                      targetValue: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="baseline-period"
                  className="block text-sm font-medium text-gray-700"
                >
                  Period *
                </label>
                <select
                  id="baseline-period"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={baselineFormData.period}
                  onChange={(e) =>
                    setBaselineFormData({
                      ...baselineFormData,
                      period: e.target.value as "daily" | "weekly" | "monthly",
                    })
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="baseline-startDate"
                  className="block text-sm font-medium text-gray-700"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  id="baseline-startDate"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={baselineFormData.startDate}
                  onChange={(e) =>
                    setBaselineFormData({
                      ...baselineFormData,
                      startDate: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="baseline-endDate"
                  className="block text-sm font-medium text-gray-700"
                >
                  End Date
                </label>
                <input
                  type="date"
                  id="baseline-endDate"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={baselineFormData.endDate}
                  onChange={(e) =>
                    setBaselineFormData({
                      ...baselineFormData,
                      endDate: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700"
              >
                Save Baseline
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Readings
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {statistics.totalReadings}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Gaugings
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {statistics.totalGaugings}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      ) : statistics.comparisons.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-600">
            No baseline comparisons available. Add a baseline to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Baseline Comparisons
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Well
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Baseline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actual
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comparison
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Samples
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statistics.comparisons.map((comp, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {comp.wellName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {comp.baseline.metricName} ({comp.baseline.type})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {comp.baseline.targetValue}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {comp.actual > 0 ? comp.actual.toFixed(2) : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {comp.actual > 0 ? (
                        <span
                          className={`font-medium ${
                            comparisonMethod === "percentage"
                              ? comp.comparison > 0
                                ? "text-green-600"
                                : comp.comparison < 0
                                ? "text-red-600"
                                : "text-gray-600"
                              : comparisonMethod === "absolute"
                              ? comp.comparison > 0
                                ? "text-green-600"
                                : comp.comparison < 0
                                ? "text-red-600"
                                : "text-gray-600"
                              : "text-gray-600"
                          }`}
                        >
                          {comparisonMethod === "percentage"
                            ? `${comp.comparison > 0 ? "+" : ""}${comp.comparison.toFixed(2)}%`
                            : comparisonMethod === "absolute"
                            ? `${comp.comparison > 0 ? "+" : ""}${comp.comparison.toFixed(2)}`
                            : comp.comparison.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {comp.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
