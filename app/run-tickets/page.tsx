"use client";

import { useState, useRef, useEffect } from "react";
import { id } from "@instantdb/react";
import { db } from "@/lib/instant";
import { useRouter } from "next/navigation";
import { RunTicketsVolumeChart } from "@/components/charts/RunTicketsVolumeChart";
import { format } from "date-fns";
import { dateToCSTTimestamp } from "@/lib/utils";

interface RunTicketFormData {
  wellId: string;
  date: string;
  ticketNumber: string;
  tank: string;
  bsWPercent: string;
  splitLoad: string;
  oilFeet: string;
  oilInches: string;
  estimatedNetOil: string;
  notes: string;
}

export default function RunTicketsPage() {
  const router = useRouter();
  const { user: authUser } = db.useAuth();
  const userId = authUser?.id;

  const { data: wellsData } = db.useQuery({
    wells: {
      $: {
        where: { status: "active" },
      },
    },
  });

  const { data: runTicketsData } = db.useQuery({
    runTickets: {},
  });

  const wellsRaw = wellsData?.wells;
  const wells = wellsRaw
    ? Array.isArray(wellsRaw)
      ? wellsRaw
      : Object.values(wellsRaw)
    : [];

  const runTicketsRaw = runTicketsData?.runTickets;
  const runTicketsUnsorted = runTicketsRaw
    ? Array.isArray(runTicketsRaw)
      ? runTicketsRaw
      : Object.values(runTicketsRaw)
    : [];

  // Sort run tickets by date descending (most recent first)
  const runTickets = [...runTicketsUnsorted].sort((a: any, b: any) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA; // Descending order
  });

  // Debug: Log run tickets data
  if (runTickets.length > 0) {
    console.log("Run tickets loaded:", runTickets.length, runTickets);
  }

  const [showForm, setShowForm] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [wellSearchQuery, setWellSearchQuery] = useState("");
  const [showWellDropdown, setShowWellDropdown] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const wellDropdownRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<RunTicketFormData>({
    wellId: "",
    date: new Date().toISOString().slice(0, 10),
    ticketNumber: "",
    tank: "",
    bsWPercent: "",
    splitLoad: "no",
    oilFeet: "",
    oilInches: "",
    estimatedNetOil: "",
    notes: "",
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wellDropdownRef.current &&
        !wellDropdownRef.current.contains(event.target as Node)
      ) {
        setShowWellDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!userId) {
    router.push("/login");
    return null;
  }

  // Filter wells based on search query
  const filteredWells = wells.filter((well: any) => {
    const searchLower = wellSearchQuery.toLowerCase();
    const wellName = (well as any)?.name?.toLowerCase() || "";
    return wellName.includes(searchLower);
  });

  // Get the selected well's display name
  const selectedWellName = formData.wellId
    ? (() => {
        const well = wells.find((w: any) => w.id === formData.wellId);
        return well ? (well as any).name : "";
      })()
    : "";

  const handleWellSelect = (wellId: string, wellName: string) => {
    setFormData({ ...formData, wellId });
    setWellSearchQuery(wellName);
    setShowWellDropdown(false);
  };

  const resetForm = () => {
    setFormData({
      wellId: "",
      date: new Date().toISOString().slice(0, 10),
      ticketNumber: "",
      tank: "",
      bsWPercent: "",
      splitLoad: "no",
      oilFeet: "",
      oilInches: "",
      estimatedNetOil: "",
      notes: "",
    });
    setWellSearchQuery("");
    setEditingTicketId(null);
    setShowForm(false);
  };

  const handleEdit = (ticket: any) => {
    const wellId = ticket.wellId || "";
    const well = wells.find((w: any) => w.id === wellId);
    const wellName = well ? (well as any).name : "";
    
    setFormData({
      wellId: wellId,
      date: ticket.date ? ticket.date.split("T")[0] : new Date().toISOString().slice(0, 10),
      ticketNumber: ticket.ticketNumber || "",
      tank: ticket.tank || "",
      bsWPercent: ticket.bsWPercent?.toString() || "",
      splitLoad: ticket.splitLoad ? "yes" : "no",
      oilFeet: ticket.oilFeet?.toString() || "",
      oilInches: ticket.oilInches?.toString() || "",
      estimatedNetOil: ticket.estimatedNetOil?.toString() || "",
      notes: ticket.notes || "",
    });
    setWellSearchQuery(wellName);
    setEditingTicketId(ticket.id);
    setShowForm(true);
  };

  const handleDelete = async (ticketId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this run ticket?"
    );
    if (!confirmed) return;

    try {
      await db.transact(db.tx.runTickets[ticketId].delete());
    } catch (error: any) {
      alert(`Error deleting run ticket: ${error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      alert("You must be logged in to save run tickets.");
      return;
    }

    // Validate required fields
    if (!formData.wellId) {
      alert("Please select a well.");
      return;
    }
    if (!formData.date) {
      alert("Please select a date.");
      return;
    }
    if (!formData.ticketNumber.trim()) {
      alert("Please enter a ticket number.");
      return;
    }
    if (!formData.tank) {
      alert("Please select a tank.");
      return;
    }

    setSubmitting(true);
    try {
      const ticketData = {
        wellId: formData.wellId,
        date: dateToCSTTimestamp(formData.date),
        ticketNumber: formData.ticketNumber.trim(),
        tank: formData.tank,
        bsWPercent: formData.bsWPercent ? parseFloat(formData.bsWPercent) : 0,
        splitLoad: formData.splitLoad === "yes",
        oilFeet: formData.oilFeet ? parseFloat(formData.oilFeet) : 0,
        oilInches: formData.oilInches ? parseFloat(formData.oilInches) : 0,
        estimatedNetOil: formData.estimatedNetOil
          ? parseFloat(formData.estimatedNetOil)
          : 0,
        notes: formData.notes || undefined,
        userId: userId,
        createdAt: new Date().toISOString(),
      };

      if (editingTicketId) {
        // Update existing ticket
        await db.transact(
          db.tx.runTickets[editingTicketId].update(ticketData)
        );
        alert("Run ticket updated successfully!");
      } else {
        // Create new ticket
        const newTicketId = id();
        await db.transact(db.tx.runTickets[newTicketId].update(ticketData));
        console.log("Run ticket saved with ID:", newTicketId);
        alert("Run ticket saved successfully!");
      }

      resetForm();
      
      // Force a small delay to allow InstantDB to sync
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error("Error saving run ticket:", error);
      alert(`Error saving run ticket: ${error.message || "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getWellName = (wellId: string) => {
    const well = wells.find((w: any) => w.id === wellId);
    return well ? (well as any).name : "Unknown";
  };

  const formatDate = (dateString: string) => {
    try {
      const date = dateString.includes("T")
        ? dateString.split("T")[0]
        : dateString;
      return format(new Date(date), "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-tepui-gray">Run Tickets</h1>
          <p className="mt-2 text-gray-600">
            Enter and track oil sales from tanks
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue"
        >
          New Sale
        </button>
      </div>

      {showForm && (
        <div className="mb-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {editingTicketId ? "Edit Run Ticket" : "New Run Ticket Sale"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative" ref={wellDropdownRef}>
                <label
                  htmlFor="wellId"
                  className="block text-sm font-medium text-gray-700"
                >
                  Well Name *
                </label>
                <input
                  type="text"
                  id="wellId"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  placeholder="Type to search wells..."
                  value={wellSearchQuery}
                  onChange={(e) => {
                    setWellSearchQuery(e.target.value);
                    setShowWellDropdown(true);
                    if (e.target.value === "") {
                      setFormData({ ...formData, wellId: "" });
                    }
                  }}
                  onFocus={() => setShowWellDropdown(true)}
                  autoComplete="off"
                  style={{
                    borderColor: !formData.wellId ? "#ef4444" : undefined,
                  }}
                />
                {showWellDropdown && filteredWells.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredWells.map((well: any) => (
                      <div
                        key={well.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() =>
                          handleWellSelect(
                            well.id,
                            well.name
                          )
                        }
                      >
                        {well.name}
                      </div>
                    ))}
                  </div>
                )}
                {showWellDropdown &&
                  wellSearchQuery &&
                  filteredWells.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4 text-sm text-gray-500">
                      No wells found
                    </div>
                  )}
              </div>

              <div>
                <label
                  htmlFor="date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Date *
                </label>
                <input
                  type="date"
                  id="date"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="ticketNumber"
                  className="block text-sm font-medium text-gray-700"
                >
                  Ticket # *
                </label>
                <input
                  type="text"
                  id="ticketNumber"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.ticketNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, ticketNumber: e.target.value })
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="tank"
                  className="block text-sm font-medium text-gray-700"
                >
                  Tank *
                </label>
                <select
                  id="tank"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.tank}
                  onChange={(e) =>
                    setFormData({ ...formData, tank: e.target.value })
                  }
                >
                  <option value="">Select tank</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="bsWPercent"
                  className="block text-sm font-medium text-gray-700"
                >
                  BS&W % *
                </label>
                <input
                  type="number"
                  id="bsWPercent"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.bsWPercent}
                  onChange={(e) =>
                    setFormData({ ...formData, bsWPercent: e.target.value })
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="splitLoad"
                  className="block text-sm font-medium text-gray-700"
                >
                  Split Load *
                </label>
                <select
                  id="splitLoad"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.splitLoad}
                  onChange={(e) =>
                    setFormData({ ...formData, splitLoad: e.target.value })
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="oilFeet"
                  className="block text-sm font-medium text-gray-700"
                >
                  Oil (ft) *
                </label>
                <input
                  type="number"
                  id="oilFeet"
                  step="1"
                  min="0"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.oilFeet}
                  onChange={(e) =>
                    setFormData({ ...formData, oilFeet: e.target.value })
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="oilInches"
                  className="block text-sm font-medium text-gray-700"
                >
                  Oil (in) *
                </label>
                <input
                  type="number"
                  id="oilInches"
                  step="0.25"
                  min="0"
                  max="11.75"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.oilInches}
                  onChange={(e) =>
                    setFormData({ ...formData, oilInches: e.target.value })
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="estimatedNetOil"
                  className="block text-sm font-medium text-gray-700"
                >
                  Estimated Net Oil (Bbls) *
                </label>
                <input
                  type="number"
                  id="estimatedNetOil"
                  step="0.01"
                  min="0"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.estimatedNetOil}
                  onChange={(e) =>
                    setFormData({ ...formData, estimatedNetOil: e.target.value })
                  }
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-gray-700"
                >
                  Notes
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? "Saving..."
                  : editingTicketId
                  ? "Update"
                  : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Run Tickets</h2>
          {runTickets.length > 10 && (
            <button
              onClick={() => setShowAllTickets(!showAllTickets)}
              className="text-sm text-tepui-blue hover:text-blue-700 font-medium"
            >
              {showAllTickets ? "Show Last 10" : `Show All (${runTickets.length})`}
            </button>
          )}
        </div>
        {runTickets.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">
              No run tickets found. Create your first run ticket sale.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Well Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticket #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    BS&W %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Split Load
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Oil (ft)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Oil (in)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Est. Net Oil (Bbls)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showAllTickets ? runTickets : runTickets.slice(0, 10)).map((ticket: any) => (
                  <tr key={ticket.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {getWellName(ticket.wellId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(ticket.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.ticketNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.tank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.bsWPercent?.toFixed(2) || "0.00"}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.splitLoad ? "Yes" : "No"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.oilFeet || "0"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.oilInches || "0"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.estimatedNetOil?.toFixed(2) || "0.00"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {ticket.notes || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(ticket)}
                        className="text-tepui-blue hover:text-blue-700 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(ticket.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {runTickets.length > 0 && (
        <div className="mb-8">
          <RunTicketsVolumeChart runTickets={runTickets as any} />
        </div>
      )}
    </div>
  );
}

