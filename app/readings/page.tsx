"use client";

import { useState } from "react";
import { id } from "@instantdb/react";
import { db } from "@/lib/instant";
import { formatDateTime } from "@/lib/utils";

export default function ReadingsPage() {
  const { user: authUser } = db.useAuth();
  const userId = authUser?.id;
  const { data: wellsData } = db.useQuery({
    wells: {
      $: {
        where: { status: "active" },
      },
    },
  });
  const { data: readingsData, isLoading } = db.useQuery({
    meterReadings: {
      $: {
        order: { createdAt: "desc" },
      },
    },
  } as any);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    wellId: "",
    value: "",
    timestamp: new Date().toISOString().slice(0, 16),
    meterType: "",
    unit: "bbl",
  });

  const wells = wellsData?.wells || [];
  const readings = readingsData?.meterReadings || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !formData.wellId) return;

    db.transact(
      db.tx.meterReadings[id()].update({
        wellId: formData.wellId,
        value: parseFloat(formData.value),
        timestamp: new Date(formData.timestamp).toISOString(),
        meterType: formData.meterType || undefined,
        unit: formData.unit,
        userId: userId,
        createdAt: new Date().toISOString(),
      })
    );
    setFormData({
      wellId: "",
      value: "",
      timestamp: new Date().toISOString().slice(0, 16),
      meterType: "",
      unit: "bbl",
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
          <h1 className="text-3xl font-bold text-gray-900">Meter Readings</h1>
          <p className="mt-2 text-gray-600">Track meter readings by well</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue"
        >
          {showForm ? "Cancel" : "Add Reading"}
        </button>
      </div>

      {showForm && (
        <div className="mb-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Add Meter Reading
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
                  htmlFor="value"
                  className="block text-sm font-medium text-gray-700"
                >
                  Reading Value *
                </label>
                <input
                  type="number"
                  id="value"
                  step="0.01"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.value}
                  onChange={(e) =>
                    setFormData({ ...formData, value: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="unit"
                  className="block text-sm font-medium text-gray-700"
                >
                  Unit *
                </label>
                <select
                  id="unit"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                >
                  <option value="bbl">bbl</option>
                  <option value="MCF">MCF</option>
                  <option value="gpm">gpm</option>
                  <option value="psi">psi</option>
                  <option value="F">F</option>
                </select>
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
              <div className="sm:col-span-2">
                <label
                  htmlFor="meterType"
                  className="block text-sm font-medium text-gray-700"
                >
                  Meter Type
                </label>
                <input
                  type="text"
                  id="meterType"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  placeholder="e.g., Flow meter, Pressure gauge"
                  value={formData.meterType}
                  onChange={(e) =>
                    setFormData({ ...formData, meterType: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700"
              >
                Save Reading
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading readings...</p>
        </div>
      ) : readings.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-600">
            No readings found. Add your first reading.
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
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {readings.map((reading: any) => (
                  <tr key={reading.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {getWellName(reading.wellId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reading.value} {reading.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reading.meterType || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(reading.timestamp)}
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
