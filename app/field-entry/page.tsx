"use client";

import { useState, useMemo, useEffect } from "react";
import { id } from "@instantdb/react";
import { db } from "@/lib/instant";
import { useRouter } from "next/navigation";

type WellEntry = {
  wellId: string;
  tank1Feet?: string;
  tank1Inches?: string;
  tank2Feet?: string;
  tank2Inches?: string;
  tank3Feet?: string;
  tank3Inches?: string;
  gasRate?: string;
  instantGasRate?: string;
  tubingPressure?: string;
  casingPressure?: string;
  linePressure?: string;
  comment?: string;
};

export default function FieldEntryPage() {
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

  const { data: gaugingsData } = db.useQuery({
    tankGauging: {},
  });

  const { data: readingsData } = db.useQuery({
    meterReadings: {},
  });

  // Query for shared field entry settings
  const { data: settingsData } = db.useQuery({
    fieldEntrySettings: {},
  });

  const wellsRaw = wellsData?.wells;
  const wells = wellsRaw
    ? Array.isArray(wellsRaw)
      ? wellsRaw
      : Object.values(wellsRaw)
    : [];

  const gaugingsRaw = gaugingsData?.tankGauging;
  const gaugings = gaugingsRaw
    ? Array.isArray(gaugingsRaw)
      ? gaugingsRaw
      : Object.values(gaugingsRaw)
    : [];

  const readingsRaw = readingsData?.meterReadings;
  const readings = readingsRaw
    ? Array.isArray(readingsRaw)
      ? readingsRaw
      : Object.values(readingsRaw)
    : [];

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<WellEntry[]>(
    wells.length > 0 ? wells.map((w: any) => ({ wellId: w.id })) : []
  );
  const [submitting, setSubmitting] = useState(false);
  const [expandedWells, setExpandedWells] = useState<Set<string>>(new Set());
  const [selectedWellIds, setSelectedWellIds] = useState<Set<string>>(new Set());
  const [showWellSelector, setShowWellSelector] = useState(false);
  const [savingWellId, setSavingWellId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Extract settings from InstantDB
  const settingsRaw = settingsData?.fieldEntrySettings;
  const settings = settingsRaw
    ? Array.isArray(settingsRaw)
      ? (settingsRaw[0] as any) // Get first (should only be one)
      : (Object.values(settingsRaw)[0] as any) // Get first value if object
    : null;

  // Load selected wells from InstantDB (shared across all users)
  useMemo(() => {
    if (wells.length > 0) {
      if (settings?.selectedWellIds) {
        try {
          const parsed = Array.isArray(settings.selectedWellIds) 
            ? settings.selectedWellIds 
            : JSON.parse(settings.selectedWellIds as any);
          setSelectedWellIds(new Set(parsed));
        } catch {
          // If parsing fails, default to all wells
          setSelectedWellIds(new Set(wells.map((w: any) => w.id)));
        }
      } else {
        // Default to all wells if no settings exist
        setSelectedWellIds(new Set(wells.map((w: any) => w.id)));
      }
      
      // Initialize entries
      if (entries.length === 0) {
        setEntries(wells.map((w: any) => ({ wellId: w.id })));
      }
    }
  }, [wells, entries.length, settings]);

  // Create initial settings if they don't exist
  useEffect(() => {
    if (wells.length > 0 && !settings && userId && !savingSettings) {
      const allWellIds = wells.map((w: any) => w.id);
      const now = new Date().toISOString();
      
      setSavingSettings(true);
      db.transact(
        db.tx.fieldEntrySettings["field-entry-settings-shared"].update({
          selectedWellIds: allWellIds,
          updatedAt: now,
          updatedBy: userId,
        })
      ).catch((error: any) => {
        console.error("Error creating initial settings:", error);
      }).finally(() => {
        setSavingSettings(false);
      });
    }
  }, [wells.length, settings, userId, savingSettings]);

  if (!userId) {
    router.push("/login");
    return null;
  }

  const toggleWell = (wellId: string) => {
    const newExpanded = new Set(expandedWells);
    if (newExpanded.has(wellId)) {
      newExpanded.delete(wellId);
    } else {
      newExpanded.add(wellId);
    }
    setExpandedWells(newExpanded);
  };

  // Save selected wells to InstantDB (shared across all users)
  const saveSelectedWells = async (wellIds: Set<string>) => {
    if (!userId || savingSettings) return;
    
    setSavingSettings(true);
    try {
      const wellIdsArray = Array.from(wellIds);
      const now = new Date().toISOString();
      const settingsId = settings?.id || "field-entry-settings-shared";
      
      await db.transact(
        db.tx.fieldEntrySettings[settingsId].update({
          selectedWellIds: wellIdsArray,
          updatedAt: now,
          updatedBy: userId,
        })
      );
    } catch (error: any) {
      console.error("Error saving selected wells:", error);
      // Still update local state even if save fails
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleWellSelection = async (wellId: string) => {
    const newSelected = new Set(selectedWellIds);
    if (newSelected.has(wellId)) {
      newSelected.delete(wellId);
    } else {
      newSelected.add(wellId);
    }
    setSelectedWellIds(newSelected);
    // Save to InstantDB (shared)
    await saveSelectedWells(newSelected);
  };

  const selectAllWells = async () => {
    const allIds = new Set(wells.map((w: any) => w.id));
    setSelectedWellIds(allIds);
    await saveSelectedWells(allIds);
  };

  const deselectAllWells = async () => {
    const emptySet = new Set<string>();
    setSelectedWellIds(emptySet);
    await saveSelectedWells(emptySet);
  };

  // Filter wells based on selection
  const displayedWells = wells.filter((w: any) => selectedWellIds.has(w.id));

  const updateEntry = (wellId: string, field: keyof WellEntry, value: string) => {
    setEntries(entries.map(entry => 
      entry.wellId === wellId ? { ...entry, [field]: value } : entry
    ));
  };

  const hasAnyData = (entry: WellEntry) => {
    return Boolean(
      entry.tank1Feet || entry.tank1Inches ||
      entry.tank2Feet || entry.tank2Inches ||
      entry.tank3Feet || entry.tank3Inches ||
      entry.gasRate || entry.instantGasRate ||
      entry.tubingPressure || entry.casingPressure || entry.linePressure ||
      entry.comment
    );
  };

  const checkExistingData = (wellId: string, dateToCheck: string) => {
    const dateKey = dateToCheck.split('T')[0];
    
    // Check for existing gaugings
    const existingGaugings = gaugings.filter((g: any) => {
      if (g.wellId !== wellId) return false;
      const gaugingDateKey = (g.timestamp || g.createdAt || '').split('T')[0];
      return gaugingDateKey === dateKey;
    });

    // Check for existing readings
    const existingReadings = readings.filter((r: any) => {
      if (r.wellId !== wellId) return false;
      const readingDateKey = (r.timestamp || r.createdAt || '').split('T')[0];
      return readingDateKey === dateKey;
    });

    return {
      hasExisting: existingGaugings.length > 0 || existingReadings.length > 0,
      gaugings: existingGaugings,
      readings: existingReadings
    };
  };

  const saveWellData = async (wellId: string) => {
    if (!userId) return;

    setSavingWellId(wellId);
    const entry = entries.find(e => e.wellId === wellId);
    if (!entry || !hasAnyData(entry)) {
      alert("No data to save for this well.");
      setSavingWellId(null);
      return;
    }

    const timestamp = new Date(`${date}T12:00:00Z`).toISOString();
    
    // Check for existing data
    const existing = checkExistingData(wellId, timestamp);
    if (existing.hasExisting) {
      const wellName = getWellName(wellId);
      const confirmed = confirm(
        `Data already exists for ${wellName} on ${date}.\n\n` +
        `Existing: ${existing.gaugings.length} tank reading(s), ${existing.readings.length} meter reading(s)\n\n` +
        `Do you want to REPLACE the existing data with new data?`
      );
      
      if (!confirmed) {
        setSavingWellId(null);
        return;
      }
    }

    const transactions: any[] = [];
    const now = new Date().toISOString();
    const metadata = entry.comment ? { comment: entry.comment } : undefined;

    try {
      // Delete existing data first
      if (existing.hasExisting) {
        existing.gaugings.forEach((g: any) => {
          transactions.push(db.tx.tankGauging[g.id].delete());
        });
        existing.readings.forEach((r: any) => {
          transactions.push(db.tx.meterReadings[r.id].delete());
        });
      }

      // Tank 1
      if (entry.tank1Feet || entry.tank1Inches) {
        const feet = parseFloat(entry.tank1Feet || "0");
        const inches = parseFloat(entry.tank1Inches || "0");
        const level = feet + inches / 12;
        transactions.push(
          db.tx.tankGauging[id()].update({
            wellId: entry.wellId,
            level,
            timestamp,
            tankNumber: "Tank 1",
            userId,
            metadata,
            createdAt: now,
          })
        );
      }

      // Tank 2
      if (entry.tank2Feet || entry.tank2Inches) {
        const feet = parseFloat(entry.tank2Feet || "0");
        const inches = parseFloat(entry.tank2Inches || "0");
        const level = feet + inches / 12;
        transactions.push(
          db.tx.tankGauging[id()].update({
            wellId: entry.wellId,
            level,
            timestamp,
            tankNumber: "Tank 2",
            userId,
            metadata,
            createdAt: now,
          })
        );
      }

      // Tank 3
      if (entry.tank3Feet || entry.tank3Inches) {
        const feet = parseFloat(entry.tank3Feet || "0");
        const inches = parseFloat(entry.tank3Inches || "0");
        const level = feet + inches / 12;
        transactions.push(
          db.tx.tankGauging[id()].update({
            wellId: entry.wellId,
            level,
            timestamp,
            tankNumber: "Tank 3",
            userId,
            metadata,
            createdAt: now,
          })
        );
      }

      // Gas Rate
      if (entry.gasRate) {
        transactions.push(
          db.tx.meterReadings[id()].update({
            wellId: entry.wellId,
            value: parseFloat(entry.gasRate),
            timestamp,
            meterType: "Gas Rate",
            unit: "MCF",
            userId,
            createdAt: now,
          })
        );
      }

      // Instant Gas Rate
      if (entry.instantGasRate) {
        transactions.push(
          db.tx.meterReadings[id()].update({
            wellId: entry.wellId,
            value: parseFloat(entry.instantGasRate),
            timestamp,
            meterType: "Instant Gas Rate",
            unit: "MCF",
            userId,
            createdAt: now,
          })
        );
      }

      // Tubing Pressure
      if (entry.tubingPressure) {
        transactions.push(
          db.tx.meterReadings[id()].update({
            wellId: entry.wellId,
            value: parseFloat(entry.tubingPressure),
            timestamp,
            meterType: "Tubing Pressure",
            unit: "PSI",
            userId,
            createdAt: now,
          })
        );
      }

      // Casing Pressure
      if (entry.casingPressure) {
        transactions.push(
          db.tx.meterReadings[id()].update({
            wellId: entry.wellId,
            value: parseFloat(entry.casingPressure),
            timestamp,
            meterType: "Casing Pressure",
            unit: "PSI",
            userId,
            createdAt: now,
          })
        );
      }

      // Line Pressure
      if (entry.linePressure) {
        transactions.push(
          db.tx.meterReadings[id()].update({
            wellId: entry.wellId,
            value: parseFloat(entry.linePressure),
            timestamp,
            meterType: "Line Pressure",
            unit: "PSI",
            userId,
            createdAt: now,
          })
        );
      }

      if (transactions.length > 0) {
        await db.transact(transactions);
        alert(`Saved ${transactions.length} readings for this well!`);
        // Clear this well's entry
        setEntries(entries.map(e => 
          e.wellId === wellId ? { wellId } : e
        ));
        // Collapse the well
        const newExpanded = new Set(expandedWells);
        newExpanded.delete(wellId);
        setExpandedWells(newExpanded);
      }
    } catch (error: any) {
      alert(`Error saving data: ${error.message}`);
    } finally {
      setSavingWellId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    // Check which wells have data to save
    const wellsToSave = entries.filter(entry => entry.wellId && hasAnyData(entry));
    if (wellsToSave.length === 0) {
      alert("No data to save. Please enter at least one reading.");
      return;
    }

    // Check for existing data for any of the wells
    const timestamp = new Date(`${date}T12:00:00Z`).toISOString();
    const wellsWithExisting = wellsToSave.filter(entry => {
      const existing = checkExistingData(entry.wellId, timestamp);
      return existing.hasExisting;
    });

    if (wellsWithExisting.length > 0) {
      const wellNames = wellsWithExisting.map(entry => getWellName(entry.wellId)).join(', ');
      const confirmed = confirm(
        `Existing data found for ${wellsWithExisting.length} well(s) on ${date}:\n\n` +
        `${wellNames}\n\n` +
        `Do you want to REPLACE all existing data with new data?`
      );
      
      if (!confirmed) {
        return;
      }
    }

    setSubmitting(true);
    const transactions: any[] = [];
    const now = new Date().toISOString();

    try {
      // First, delete all existing data for wells we're saving
      wellsToSave.forEach((entry) => {
        const existing = checkExistingData(entry.wellId, timestamp);
        if (existing.hasExisting) {
          existing.gaugings.forEach((g: any) => {
            transactions.push(db.tx.tankGauging[g.id].delete());
          });
          existing.readings.forEach((r: any) => {
            transactions.push(db.tx.meterReadings[r.id].delete());
          });
        }
      });

      // Then add new data
      entries.forEach((entry) => {
        if (!entry.wellId || !hasAnyData(entry)) return;

        const metadata = entry.comment ? { comment: entry.comment } : undefined;

        // Tank 1
        if (entry.tank1Feet || entry.tank1Inches) {
          const feet = parseFloat(entry.tank1Feet || "0");
          const inches = parseFloat(entry.tank1Inches || "0");
          const level = feet + inches / 12;
          transactions.push(
            db.tx.tankGauging[id()].update({
              wellId: entry.wellId,
              level,
              timestamp,
              tankNumber: "Tank 1",
              userId,
              metadata,
              createdAt: now,
            })
          );
        }

        // Tank 2
        if (entry.tank2Feet || entry.tank2Inches) {
          const feet = parseFloat(entry.tank2Feet || "0");
          const inches = parseFloat(entry.tank2Inches || "0");
          const level = feet + inches / 12;
          transactions.push(
            db.tx.tankGauging[id()].update({
              wellId: entry.wellId,
              level,
              timestamp,
              tankNumber: "Tank 2",
              userId,
              metadata,
              createdAt: now,
            })
          );
        }

        // Tank 3
        if (entry.tank3Feet || entry.tank3Inches) {
          const feet = parseFloat(entry.tank3Feet || "0");
          const inches = parseFloat(entry.tank3Inches || "0");
          const level = feet + inches / 12;
          transactions.push(
            db.tx.tankGauging[id()].update({
              wellId: entry.wellId,
              level,
              timestamp,
              tankNumber: "Tank 3",
              userId,
              metadata,
              createdAt: now,
            })
          );
        }

        // Gas Rate
        if (entry.gasRate) {
          transactions.push(
            db.tx.meterReadings[id()].update({
              wellId: entry.wellId,
              value: parseFloat(entry.gasRate),
              timestamp,
              meterType: "Gas Rate",
              unit: "MCF",
              userId,
              createdAt: now,
            })
          );
        }

        // Instant Gas Rate
        if (entry.instantGasRate) {
          transactions.push(
            db.tx.meterReadings[id()].update({
              wellId: entry.wellId,
              value: parseFloat(entry.instantGasRate),
              timestamp,
              meterType: "Instant Gas Rate",
              unit: "MCF",
              userId,
              createdAt: now,
            })
          );
        }

        // Tubing Pressure
        if (entry.tubingPressure) {
          transactions.push(
            db.tx.meterReadings[id()].update({
              wellId: entry.wellId,
              value: parseFloat(entry.tubingPressure),
              timestamp,
              meterType: "Tubing Pressure",
              unit: "PSI",
              userId,
              createdAt: now,
            })
          );
        }

        // Casing Pressure
        if (entry.casingPressure) {
          transactions.push(
            db.tx.meterReadings[id()].update({
              wellId: entry.wellId,
              value: parseFloat(entry.casingPressure),
              timestamp,
              meterType: "Casing Pressure",
              unit: "PSI",
              userId,
              createdAt: now,
            })
          );
        }

        // Line Pressure
        if (entry.linePressure) {
          transactions.push(
            db.tx.meterReadings[id()].update({
              wellId: entry.wellId,
              value: parseFloat(entry.linePressure),
              timestamp,
              meterType: "Line Pressure",
              unit: "PSI",
              userId,
              createdAt: now,
            })
          );
        }
      });

      if (transactions.length > 0) {
        await db.transact(transactions);
        alert(`Successfully saved ${transactions.length} readings!`);
        // Clear entries
        setEntries(wells.map((w: any) => ({ wellId: w.id })));
        setExpandedWells(new Set());
      } else {
        alert("No data to save. Please enter at least one reading.");
      }
    } catch (error: any) {
      alert(`Error saving data: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getWellName = (wellId: string) => {
    const well = wells.find((w: any) => w.id === wellId);
    return well ? `${(well as any).wellNumber} - ${(well as any).name}` : "Unknown";
  };

  return (
    <div className="pb-20">
      {/* Custom styles to hide number input arrows */}
      <style jsx>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      
      {/* Header - Sticky */}
      <div className="sticky top-16 z-10 bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-tepui-gray">Field Data Entry</h1>
              <p className="text-sm text-gray-600 mt-1">
                {displayedWells.length} of {wells.length} wells shown
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWellSelector(!showWellSelector)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue"
            >
              <svg className="h-5 w-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Select Wells
            </button>
          </div>
          
          {/* Well Selector Dropdown */}
          {showWellSelector && (
            <div className="mt-4 border border-gray-200 rounded-lg bg-gray-50 p-3 max-h-60 overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Select wells to display:</span>
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={selectAllWells}
                    className="text-xs text-tepui-blue hover:text-blue-700 font-medium"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllWells}
                    className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {wells.map((well: any) => (
                  <label key={well.id} className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedWellIds.has(well.id)}
                      onChange={() => toggleWellSelection(well.id)}
                      className="rounded border-gray-300 text-tepui-blue focus:ring-tepui-blue"
                    />
                    <span className="text-sm text-gray-900">
                      {well.wellNumber} - {well.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Date Picker */}
          <div className="mt-4">
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue text-base p-3 border"
            />
          </div>
        </div>
      </div>

      {/* Table View */}
      <form onSubmit={handleSubmit} className="p-4">
        {wells.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">No active wells found</p>
          </div>
        ) : displayedWells.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-2">No wells selected</p>
            <button
              type="button"
              onClick={() => setShowWellSelector(true)}
              className="text-tepui-blue hover:text-blue-700 font-medium text-sm"
            >
              Select wells to display
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                      Well Name
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider" colSpan={2}>
                      Tank 1
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider" colSpan={2}>
                      Tank 2
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider" colSpan={2}>
                      Tank 3
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Gas Rate
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Instant Gas
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tubing PSI
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Casing PSI
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Line PSI
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Comments
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider sticky right-0 bg-gray-50 z-10">
                      Action
                    </th>
                  </tr>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-1 text-left text-xs font-medium text-gray-600 sticky left-0 bg-gray-100 z-10"></th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600">Ft</th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600">In</th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600">Ft</th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600">In</th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600">Ft</th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600">In</th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600">MCF</th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600">MCF</th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600"></th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600"></th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600"></th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600"></th>
                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-600 sticky right-0 bg-gray-100 z-10"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayedWells.map((well: any) => {
                    const entry: WellEntry = entries.find(e => e.wellId === well.id) || { wellId: well.id };
                    const hasData = hasAnyData(entry);

                    return (
                      <tr key={well.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          {well.name}
                        </td>
                        {/* Tank 1 */}
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            placeholder="0"
                            value={entry.tank1Feet || ""}
                            onChange={(e) => updateEntry(well.id, "tank1Feet", e.target.value)}
                            className="w-16 border-gray-300 rounded text-sm p-1 text-center focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="11.75"
                            placeholder="0"
                            value={entry.tank1Inches || ""}
                            onChange={(e) => updateEntry(well.id, "tank1Inches", e.target.value)}
                            className="w-16 border-gray-300 rounded text-sm p-1 text-center focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        {/* Tank 2 */}
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            placeholder="0"
                            value={entry.tank2Feet || ""}
                            onChange={(e) => updateEntry(well.id, "tank2Feet", e.target.value)}
                            className="w-16 border-gray-300 rounded text-sm p-1 text-center focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="11.75"
                            placeholder="0"
                            value={entry.tank2Inches || ""}
                            onChange={(e) => updateEntry(well.id, "tank2Inches", e.target.value)}
                            className="w-16 border-gray-300 rounded text-sm p-1 text-center focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        {/* Tank 3 */}
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            placeholder="0"
                            value={entry.tank3Feet || ""}
                            onChange={(e) => updateEntry(well.id, "tank3Feet", e.target.value)}
                            className="w-16 border-gray-300 rounded text-sm p-1 text-center focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="11.75"
                            placeholder="0"
                            value={entry.tank3Inches || ""}
                            onChange={(e) => updateEntry(well.id, "tank3Inches", e.target.value)}
                            className="w-16 border-gray-300 rounded text-sm p-1 text-center focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        {/* Gas Rate */}
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="0"
                            value={entry.gasRate || ""}
                            onChange={(e) => updateEntry(well.id, "gasRate", e.target.value)}
                            className="w-20 border-gray-300 rounded text-sm p-1 text-center focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        {/* Instant Gas Rate */}
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="0"
                            value={entry.instantGasRate || ""}
                            onChange={(e) => updateEntry(well.id, "instantGasRate", e.target.value)}
                            className="w-20 border-gray-300 rounded text-sm p-1 text-center focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        {/* Tubing Pressure */}
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="0"
                            value={entry.tubingPressure || ""}
                            onChange={(e) => updateEntry(well.id, "tubingPressure", e.target.value)}
                            className="w-20 border-gray-300 rounded text-sm p-1 text-center focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        {/* Casing Pressure */}
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="0"
                            value={entry.casingPressure || ""}
                            onChange={(e) => updateEntry(well.id, "casingPressure", e.target.value)}
                            className="w-20 border-gray-300 rounded text-sm p-1 text-center focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        {/* Line Pressure */}
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="0"
                            value={entry.linePressure || ""}
                            onChange={(e) => updateEntry(well.id, "linePressure", e.target.value)}
                            className="w-20 border-gray-300 rounded text-sm p-1 text-center focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        {/* Comments */}
                        <td className="px-1 py-2">
                          <input
                            type="text"
                            placeholder="Notes..."
                            value={entry.comment || ""}
                            onChange={(e) => updateEntry(well.id, "comment", e.target.value)}
                            className="w-32 border-gray-300 rounded text-sm p-1 focus:ring-tepui-blue focus:border-tepui-blue"
                          />
                        </td>
                        {/* Save Button */}
                        <td className="px-3 py-2 whitespace-nowrap text-center sticky right-0 bg-white">
                          <button
                            type="button"
                            onClick={() => saveWellData(well.id)}
                            disabled={savingWellId === well.id || !hasData}
                            className="inline-flex items-center justify-center px-4 py-2 border-2 border-tepui-blue rounded-md text-sm font-semibold text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue disabled:opacity-50 disabled:cursor-not-allowed shadow-sm min-w-[80px]"
                          >
                            {savingWellId === well.id ? (
                              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <>
                                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Save
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Submit Button - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving All...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save All Wells
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

