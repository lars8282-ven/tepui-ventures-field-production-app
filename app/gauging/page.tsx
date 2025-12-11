"use client";

import { useState } from "react";
import { id } from "@instantdb/react";
import { db } from "@/lib/instant";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default function GaugingPage() {
  const { user: authUser } = db.useAuth();
  const userId = authUser?.id;
  const { data: wellsData } = db.useQuery({
    wells: {
      $: {
        where: { status: "active" },
      },
    },
  });
  const { data: gaugingData, isLoading } = db.useQuery({
    tankGauging: {
      $: {
        order: { createdAt: "desc" },
      },
    },
  } as any);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    wellId: "",
    level: "",
    timestamp: new Date().toISOString().slice(0, 16),
    tankNumber: "",
  });

  const wellsRaw = wellsData?.wells;
  const wells = wellsRaw
    ? Array.isArray(wellsRaw)
      ? wellsRaw
      : Object.values(wellsRaw)
    : [];
  
  const gaugingsRaw = gaugingData?.tankGauging;
  const gaugings = gaugingsRaw
    ? Array.isArray(gaugingsRaw)
      ? gaugingsRaw
      : Object.values(gaugingsRaw)
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !formData.wellId) return;

    db.transact(
      db.tx.tankGauging[id()].update({
        wellId: formData.wellId,
        level: parseFloat(formData.level),
        timestamp: new Date(formData.timestamp).toISOString(),
        tankNumber: formData.tankNumber || undefined,
        userId: userId,
        createdAt: new Date().toISOString(),
      })
    );
    setFormData({
      wellId: "",
      level: "",
      timestamp: new Date().toISOString().slice(0, 16),
      tankNumber: "",
    });
    setShowForm(false);
  };

  const getWellName = (wellId: string) => {
    const well = wells.find((w: any) => w.id === wellId);
    return well ? `${(well as any).wellNumber} - ${(well as any).name}` : "Unknown";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-tepui-gray">Tank Gauging</h1>
          <p className="mt-2 text-gray-600">Track tank levels by well</p>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/gauging/daily-entry"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue"
          >
            Daily Entry
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue"
          >
            {showForm ? "Cancel" : "Add Single Gauging"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Add Tank Gauging
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="wellId"
                  className="block text-sm font-medium text-gray-700"
                >
                  Well *
                </label>
                <select
                  id="wellId"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.wellId}
                  onChange={(e) =>
                    setFormData({ ...formData, wellId: e.target.value })
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
                  htmlFor="level"
                  className="block text-sm font-medium text-gray-700"
                >
                  Tank Level (%) *
                </label>
                <input
                  type="number"
                  id="level"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.level}
                  onChange={(e) =>
                    setFormData({ ...formData, level: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="tankNumber"
                  className="block text-sm font-medium text-gray-700"
                >
                  Tank Number
                </label>
                <input
                  type="text"
                  id="tankNumber"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  placeholder="e.g., Tank 1, Tank A"
                  value={formData.tankNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, tankNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="timestamp"
                  className="block text-sm font-medium text-gray-700"
                >
                  Timestamp *
                </label>
                <input
                  type="datetime-local"
                  id="timestamp"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.timestamp}
                  onChange={(e) =>
                    setFormData({ ...formData, timestamp: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700"
              >
                Save Gauging
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading gauging data...</p>
        </div>
      ) : gaugings.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-600">
            No gauging data found. Add your first tank gauging.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Well
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tank Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {gaugings.map((gauging: any) => (
                  <tr key={gauging.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {getWellName(gauging.wellId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {gauging.level}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {gauging.tankNumber || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(gauging.timestamp)}
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
