"use client";

import { useState, useMemo } from "react";
import { id } from "@instantdb/react";
import { db } from "@/lib/instant";
import { formatDate } from "@/lib/utils";
import { format, subDays } from "date-fns";
import Link from "next/link";

type VisibleColumns = {
  wellNumber: boolean;
  name: boolean;
  location: boolean;
  liftType: boolean;
  county: boolean;
  state: boolean;
  status: boolean;
  api10: boolean;
  api14Alt: boolean;
  tankFactor: boolean;
  wi: boolean;
  nri: boolean;
  swd: boolean;
  sec: boolean;
  twn: boolean;
  rng: boolean;
  leaseDescription: boolean;
  oilRate: boolean;
  gasRate: boolean;
  waterRate: boolean;
};

export default function WellsPage() {
  const { data, isLoading, error } = db.useQuery({
    wells: {},
  });
  
  const { data: readingsData } = db.useQuery({
    meterReadings: {},
  });
  
  const { data: gaugingsData } = db.useQuery({
    tankGauging: {},
  });
  
  const [showForm, setShowForm] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    wellNumber: "",
    location: "",
    status: "active" as "active" | "inactive",
  });
  
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    wellNumber: true,
    name: true,
    location: true,
    liftType: true,
    county: false,
    state: false,
    status: true,
    api10: false,
    api14Alt: false,
    tankFactor: false,
    wi: false,
    nri: false,
    swd: false,
    sec: false,
    twn: false,
    rng: false,
    leaseDescription: false,
    oilRate: false,
    gasRate: false,
    waterRate: false,
  });
  const [selectedWells, setSelectedWells] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    db.transact(
      db.tx.wells[id()].update({
        name: formData.name,
        wellNumber: formData.wellNumber,
        location: formData.location || undefined,
        status: formData.status,
        createdAt: now,
        updatedAt: now,
      })
    );
    setFormData({ name: "", wellNumber: "", location: "", status: "active" });
    setShowForm(false);
  };

  // InstantDB returns data as { wells: { [id]: well, ... } } - an object with IDs as keys
  // Convert to array for easier iteration
  const wellsRaw = data?.wells;
  const wells = wellsRaw 
    ? Array.isArray(wellsRaw) 
      ? wellsRaw 
      : Object.values(wellsRaw)
    : [];

  // Extract readings and gaugings
  const readingsRaw = readingsData?.meterReadings;
  const readings = readingsRaw
    ? Array.isArray(readingsRaw)
      ? readingsRaw
      : Object.values(readingsRaw)
    : [];

  const gaugingsRaw = gaugingsData?.tankGauging;
  const gaugings = gaugingsRaw
    ? Array.isArray(gaugingsRaw)
      ? gaugingsRaw
      : Object.values(gaugingsRaw)
    : [];

  // Get yesterday's date key (yyyy-MM-dd)
  const yesterdayKey = useMemo(() => {
    return format(subDays(new Date(), 1), "yyyy-MM-dd");
  }, []);

  const handleDeleteWell = async (wellId: string) => {
    if (!confirm("Are you sure you want to delete this well? This action cannot be undone.")) {
      return;
    }
    try {
      db.transact(db.tx.wells[wellId].delete());
      setShowDeleteConfirm(null);
    } catch (error) {
      alert("Error deleting well: " + (error as Error).message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedWells.size === 0) return;
    const count = selectedWells.size;
    if (!confirm(`Are you sure you want to delete ${count} ${count === 1 ? 'well' : 'wells'}? This action cannot be undone.`)) {
      return;
    }
    try {
      const deleteTransactions = Array.from(selectedWells).map(wellId => 
        db.tx.wells[wellId].delete()
      );
      db.transact(deleteTransactions);
      setSelectedWells(new Set());
    } catch (error) {
      alert("Error deleting wells: " + (error as Error).message);
    }
  };

  const toggleWellSelection = (wellId: string) => {
    const newSelected = new Set(selectedWells);
    if (newSelected.has(wellId)) {
      newSelected.delete(wellId);
    } else {
      newSelected.add(wellId);
    }
    setSelectedWells(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedWells.size === wells.length) {
      setSelectedWells(new Set());
    } else {
      setSelectedWells(new Set(wells.map((w: any) => w.id)));
    }
  };

  // Calculate well status based on yesterday's data
  const wellStatuses = useMemo(() => {
    const statuses: Record<string, "active" | "inactive"> = {};
    
    wells.forEach((well: any) => {
      // Check if well has any readings from yesterday (gas rate, instant gas rate)
      const hasReading = readings.some((r: any) => {
        if (r.wellId !== well.id) return false;
        const readingDate = new Date(r.timestamp || r.createdAt);
        const readingDateKey = format(readingDate, "yyyy-MM-dd");
        return readingDateKey === yesterdayKey && r.value > 0;
      });

      // Check if well has any gaugings from yesterday
      const hasGauging = gaugings.some((g: any) => {
        if (g.wellId !== well.id) return false;
        const gaugeDate = new Date(g.timestamp || g.createdAt);
        const gaugeDateKey = format(gaugeDate, "yyyy-MM-dd");
        return gaugeDateKey === yesterdayKey;
      });

      // Well is active if it had either a reading or gauging yesterday
      statuses[well.id] = hasReading || hasGauging ? "active" : "inactive";
    });

    return statuses;
  }, [wells, readings, gaugings, yesterdayKey]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-tepui-gray">Wells</h1>
          <p className="mt-2 text-gray-600">
            {wells.length} {wells.length === 1 ? "well" : "wells"} total
          </p>
        </div>
        <div className="flex space-x-3">
          {selectedWells.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Delete Selected ({selectedWells.size})
            </button>
          )}
          <button
            onClick={() => setShowColumnSelector(!showColumnSelector)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Customize Columns
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue"
          >
            {showForm ? "Cancel" : "Add Well"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Add New Well
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Well Name
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="wellNumber"
                  className="block text-sm font-medium text-gray-700"
                >
                  Well Number
                </label>
                <input
                  type="text"
                  id="wellNumber"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.wellNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, wellNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-medium text-gray-700"
                >
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-gray-700"
                >
                  Status
                </label>
                <select
                  id="status"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as "active" | "inactive",
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700"
              >
                Save Well
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading wells...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700">Error loading wells: {String(error)}</p>
        </div>
      ) : wells.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-600 mb-4">No wells found.</p>
          <p className="text-sm text-gray-500">
            If you just imported wells, try refreshing the page.
          </p>
        </div>
      ) : (
        <>
          {showColumnSelector && (
            <div className="mb-4 bg-white shadow rounded-lg p-4">
              <h3 className="text-sm font-semibold text-tepui-gray mb-3">
                Show/Hide Columns
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {Object.entries(visibleColumns).map(([key, value]) => (
                  <label
                    key={key}
                    className="flex items-center space-x-2 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) =>
                        setVisibleColumns({
                          ...visibleColumns,
                          [key]: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300 text-tepui-blue focus:ring-tepui-blue"
                    />
                    <span className="capitalize">
                      {key
                        .replace(/([A-Z])/g, " $1")
                        .trim()
                        .replace(/Rate/g, " Rate")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={wells.length > 0 && selectedWells.size === wells.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-tepui-blue focus:ring-tepui-blue"
                      />
                    </th>
                    {visibleColumns.wellNumber && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        API 14
                      </th>
                    )}
                    {visibleColumns.name && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Well Name
                      </th>
                    )}
                    {visibleColumns.location && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Location
                      </th>
                    )}
                    {visibleColumns.liftType && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Lift Type
                      </th>
                    )}
                    {visibleColumns.county && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        County
                      </th>
                    )}
                    {visibleColumns.state && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        State
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                    )}
                    {visibleColumns.api10 && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        API 10
                      </th>
                    )}
                    {visibleColumns.api14Alt && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        API 14 ALT
                      </th>
                    )}
                    {visibleColumns.tankFactor && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Tank Factor
                      </th>
                    )}
                    {visibleColumns.wi && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        WI
                      </th>
                    )}
                    {visibleColumns.nri && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        NRI
                      </th>
                    )}
                    {visibleColumns.swd && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        SWD
                      </th>
                    )}
                    {visibleColumns.sec && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Section
                      </th>
                    )}
                    {visibleColumns.twn && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Township
                      </th>
                    )}
                    {visibleColumns.rng && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Range
                      </th>
                    )}
                    {visibleColumns.leaseDescription && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Lease Description
                      </th>
                    )}
                    {visibleColumns.oilRate && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Oil (BOPD)
                      </th>
                    )}
                    {visibleColumns.gasRate && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Gas (MCFD)
                      </th>
                    )}
                    {visibleColumns.waterRate && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Water (BWPD)
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky right-0 bg-gray-50">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {wells.map((well: any) => {
                    const metadata = (well.metadata as any) || {};
                    const isSelected = selectedWells.has(well.id);
                    return (
                      <tr
                        key={well.id}
                        className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleWellSelection(well.id)}
                            className="rounded border-gray-300 text-tepui-blue focus:ring-tepui-blue"
                          />
                        </td>
                        {visibleColumns.wellNumber && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-tepui-gray">
                            {well.wellNumber}
                          </td>
                        )}
                        {visibleColumns.name && (
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {well.name}
                          </td>
                        )}
                        {visibleColumns.location && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {well.location || metadata.location || "-"}
                          </td>
                        )}
                        {visibleColumns.liftType && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.liftType || "-"}
                          </td>
                        )}
                        {visibleColumns.county && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.county || "-"}
                          </td>
                        )}
                        {visibleColumns.state && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.state || "-"}
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                (wellStatuses[well.id] || "inactive") === "active"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {wellStatuses[well.id] || "inactive"}
                            </span>
                          </td>
                        )}
                        {visibleColumns.api10 && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.api10 || "-"}
                          </td>
                        )}
                        {visibleColumns.api14Alt && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.api14Alt || "-"}
                          </td>
                        )}
                        {visibleColumns.tankFactor && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.tankFactor || "-"}
                          </td>
                        )}
                        {visibleColumns.wi && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.wi || "-"}
                          </td>
                        )}
                        {visibleColumns.nri && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.nri || "-"}
                          </td>
                        )}
                        {visibleColumns.swd && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.swd || "-"}
                          </td>
                        )}
                        {visibleColumns.sec && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.sec || "-"}
                          </td>
                        )}
                        {visibleColumns.twn && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.twn || "-"}
                          </td>
                        )}
                        {visibleColumns.rng && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.rng || "-"}
                          </td>
                        )}
                        {visibleColumns.leaseDescription && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.leaseDescription || "-"}
                          </td>
                        )}
                        {visibleColumns.oilRate && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.potentialOilProductionRate || "-"}
                          </td>
                        )}
                        {visibleColumns.gasRate && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.potentialGasProductionRate || "-"}
                          </td>
                        )}
                        {visibleColumns.waterRate && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {metadata.potentialWaterProductionRate || "-"}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium sticky right-0 bg-white">
                          <div className="flex items-center space-x-3">
                            <Link
                              href={`/wells/${well.id}`}
                              className="text-tepui-blue hover:text-blue-700 font-semibold"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => handleDeleteWell(well.id)}
                              className="text-red-400 hover:text-red-600 font-semibold"
                              title="Delete well"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
