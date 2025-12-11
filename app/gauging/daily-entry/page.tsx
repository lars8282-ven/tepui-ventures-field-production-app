"use client";

import { useState } from "react";
import { id } from "@instantdb/react";
import { db } from "@/lib/instant";
import { useRouter } from "next/navigation";

export default function DailyEntryPage() {
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

  const wellsRaw = wellsData?.wells;
  const wells = wellsRaw
    ? Array.isArray(wellsRaw)
      ? wellsRaw
      : Object.values(wellsRaw)
    : [];

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<
    Array<{
      wellId: string;
      tank1?: string;
      tank2?: string;
      tank3?: string;
      gas?: string;
      comment?: string;
    }>
  >([{ wellId: "" }]);

  const [submitting, setSubmitting] = useState(false);

  if (!userId) {
    router.push("/login");
    return null;
  }

  const addWellEntry = () => {
    setEntries([...entries, { wellId: "" }]);
  };

  const removeWellEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (
    index: number,
    field: string,
    value: string
  ) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setSubmitting(true);
    const transactions: any[] = [];
    // Use 12:00:00 UTC to ensure the date doesn't shift due to timezone
    const timestamp = new Date(`${date}T12:00:00Z`).toISOString();
    const now = new Date().toISOString();

    try {
      entries.forEach((entry) => {
        if (!entry.wellId) return;

        // Create tank gauging entries
        if (entry.tank1) {
          transactions.push(
            db.tx.tankGauging[id()].update({
              wellId: entry.wellId,
              level: parseFloat(entry.tank1),
              timestamp,
              tankNumber: "Tank 1",
              userId,
              metadata: entry.comment ? { comment: entry.comment } : undefined,
              createdAt: now,
            })
          );
        }
        if (entry.tank2) {
          transactions.push(
            db.tx.tankGauging[id()].update({
              wellId: entry.wellId,
              level: parseFloat(entry.tank2),
              timestamp,
              tankNumber: "Tank 2",
              userId,
              metadata: entry.comment ? { comment: entry.comment } : undefined,
              createdAt: now,
            })
          );
        }
        if (entry.tank3) {
          transactions.push(
            db.tx.tankGauging[id()].update({
              wellId: entry.wellId,
              level: parseFloat(entry.tank3),
              timestamp,
              tankNumber: "Tank 3",
              userId,
              metadata: entry.comment ? { comment: entry.comment } : undefined,
              createdAt: now,
            })
          );
        }

        // Create gas meter reading
        if (entry.gas) {
          transactions.push(
            db.tx.meterReadings[id()].update({
              wellId: entry.wellId,
              value: parseFloat(entry.gas),
              timestamp,
              meterType: "Gas",
              unit: "MCF",
              userId,
              metadata: entry.comment ? { comment: entry.comment } : undefined,
              createdAt: now,
            })
          );
        }
      });

      // Batch transactions
      if (transactions.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < transactions.length; i += chunkSize) {
          const chunk = transactions.slice(i, i + chunkSize);
          await db.transact(chunk);
        }
      }

      // Reset form
      setEntries([{ wellId: "" }]);
      setDate(new Date().toISOString().slice(0, 10));

      alert("Daily entry submitted successfully!");
      router.push("/gauging");
    } catch (error: any) {
      alert(`Error submitting entry: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-tepui-gray">Daily Field Entry</h1>
        <p className="mt-2 text-gray-600">
          Enter daily tank strapping and gas meter readings for multiple wells
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <label
            htmlFor="date"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Date *
          </label>
          <input
            type="date"
            id="date"
            required
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-6">
          {entries.map((entry, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 space-y-4"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-tepui-gray">
                  Well {index + 1}
                </h3>
                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWellEntry(index)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`well-${index}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Well *
                  </label>
                  <select
                    id={`well-${index}`}
                    required
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                    value={entry.wellId}
                    onChange={(e) =>
                      updateEntry(index, "wellId", e.target.value)
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
                    htmlFor={`gas-${index}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Gas Meter (MCF)
                  </label>
                  <input
                    type="number"
                    id={`gas-${index}`}
                    step="0.01"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                    placeholder="Gas reading"
                    value={entry.gas || ""}
                    onChange={(e) =>
                      updateEntry(index, "gas", e.target.value)
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor={`tank1-${index}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Tank 1 (Oil Strapped)
                  </label>
                  <input
                    type="number"
                    id={`tank1-${index}`}
                    step="0.01"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                    placeholder="Tank 1 level"
                    value={entry.tank1 || ""}
                    onChange={(e) =>
                      updateEntry(index, "tank1", e.target.value)
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor={`tank2-${index}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Tank 2 (Oil Strapped)
                  </label>
                  <input
                    type="number"
                    id={`tank2-${index}`}
                    step="0.01"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                    placeholder="Tank 2 level"
                    value={entry.tank2 || ""}
                    onChange={(e) =>
                      updateEntry(index, "tank2", e.target.value)
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor={`tank3-${index}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Tank 3 (Oil Strapped)
                  </label>
                  <input
                    type="number"
                    id={`tank3-${index}`}
                    step="0.01"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                    placeholder="Tank 3 level"
                    value={entry.tank3 || ""}
                    onChange={(e) =>
                      updateEntry(index, "tank3", e.target.value)
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor={`comment-${index}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Comments/Notes
                  </label>
                  <textarea
                    id={`comment-${index}`}
                    rows={2}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue sm:text-sm p-2 border"
                    placeholder="Any notes or comments for this well"
                    value={entry.comment || ""}
                    onChange={(e) =>
                      updateEntry(index, "comment", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex space-x-3">
          <button
            type="button"
            onClick={addWellEntry}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            + Add Another Well
          </button>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.push("/gauging")}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Daily Entry"}
          </button>
        </div>
      </form>
    </div>
  );
}

