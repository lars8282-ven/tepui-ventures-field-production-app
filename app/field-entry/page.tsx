"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { id } from "@instantdb/react";
import { db } from "@/lib/instant";
import { useRouter } from "next/navigation";
import { getTodayCST, dateToCSTTimestamp, timestampToDateString } from "@/lib/utils";
import { format } from "date-fns";

interface FieldEntryFormData {
  wellId: string;
  date: string;
  tank1Inches: string;
  tank2Inches: string;
  tank3Inches: string;
  gasRate: string;
  instantGasRate: string;
  tubingPressure: string;
  casingPressure: string;
  linePressure: string;
  comment: string;
}

interface GroupedEntry {
  wellId: string;
  wellName: string;
  date: string;
  dateKey: string;
  tank1?: number; // Total inches
  tank2?: number; // Total inches
  tank3?: number; // Total inches
  gasRate?: number;
  instantGasRate?: number;
  tubingPressure?: number;
  casingPressure?: number;
  linePressure?: number;
  comment?: string;
  recordIds: {
    tankGauging: string[];
    meterReadings: string[];
  };
}

interface EditingCell {
  entryKey: string;
  field: string;
  value: string;
}

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

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GroupedEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [wellSearchQuery, setWellSearchQuery] = useState("");
  const [showWellDropdown, setShowWellDropdown] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("");
  const wellDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<FieldEntryFormData>(() => {
    // Use a safe default that works in both SSR and client
    let defaultDate = "";
    if (typeof window !== "undefined") {
      try {
        defaultDate = getTodayCST();
      } catch (error) {
        defaultDate = new Date().toISOString().slice(0, 10);
      }
    } else {
      defaultDate = new Date().toISOString().slice(0, 10);
    }
    return {
      wellId: "",
      date: defaultDate,
      tank1Inches: "",
      tank2Inches: "",
      tank3Inches: "",
      gasRate: "",
      instantGasRate: "",
      tubingPressure: "",
      casingPressure: "",
      linePressure: "",
      comment: "",
    };
  });

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

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

  // Ensure we have arrays even if data is undefined
  const safeWells = Array.isArray(wells) ? wells : [];
  const safeGaugings = Array.isArray(gaugings) ? gaugings : [];
  const safeReadings = Array.isArray(readings) ? readings : [];

  // Group entries by well and date
  const groupedEntries = useMemo(() => {
    const entriesMap = new Map<string, GroupedEntry>();

    // Process tank gaugings
    safeGaugings.forEach((gauging: any) => {
      if (!gauging || !gauging.wellId || !gauging.timestamp) return;
      
      let dateKey = "";
      try {
        dateKey = timestampToDateString(gauging.timestamp);
      } catch (error) {
        console.error("Error parsing gauging timestamp:", error, gauging);
        return;
      }
      const key = `${gauging.wellId}_${dateKey}`;
      
      if (!entriesMap.has(key)) {
        const well = safeWells.find((w: any) => w.id === gauging.wellId) as any;
        entriesMap.set(key, {
          wellId: gauging.wellId,
          wellName: well?.name || "Unknown",
          date: gauging.timestamp,
          dateKey,
          recordIds: {
            tankGauging: [],
            meterReadings: [],
          },
        });
      }

      const entry = entriesMap.get(key)!;
      entry.recordIds.tankGauging.push(gauging.id);

      if (gauging.tankNumber === "Tank 1" || gauging.tankNumber === "1") {
        const level = gauging.level || 0;
        const totalInches = level * 12; // Convert to total inches
        entry.tank1 = totalInches;
      } else if (gauging.tankNumber === "Tank 2" || gauging.tankNumber === "2") {
        const level = gauging.level || 0;
        const totalInches = level * 12; // Convert to total inches
        entry.tank2 = totalInches;
      } else if (gauging.tankNumber === "Tank 3" || gauging.tankNumber === "3") {
        const level = gauging.level || 0;
        const totalInches = level * 12; // Convert to total inches
        entry.tank3 = totalInches;
      }

      // Get comment from metadata if available
      if (gauging.metadata?.comment && !entry.comment) {
        entry.comment = gauging.metadata.comment;
      }
    });

    // Process meter readings
    safeReadings.forEach((reading: any) => {
      if (!reading || !reading.wellId || !reading.timestamp) return;
      
      let dateKey = "";
      try {
        dateKey = timestampToDateString(reading.timestamp);
      } catch (error) {
        console.error("Error parsing reading timestamp:", error, reading);
        return;
      }
      const key = `${reading.wellId}_${dateKey}`;
      
      if (!entriesMap.has(key)) {
        const well = safeWells.find((w: any) => w.id === reading.wellId) as any;
        entriesMap.set(key, {
          wellId: reading.wellId,
          wellName: well?.name || "Unknown",
          date: reading.timestamp,
          dateKey,
          recordIds: {
            tankGauging: [],
            meterReadings: [],
          },
        });
      }

      const entry = entriesMap.get(key)!;
      entry.recordIds.meterReadings.push(reading.id);

      const meterType = reading.meterType || "";
      if (meterType === "Gas Rate" || meterType === "gas rate") {
        entry.gasRate = reading.value;
      } else if (meterType === "Instant Gas Rate" || meterType === "instant gas rate") {
        entry.instantGasRate = reading.value;
      } else if (meterType === "Tubing Pressure" || meterType === "tubing pressure") {
        entry.tubingPressure = reading.value;
      } else if (meterType === "Casing Pressure" || meterType === "casing pressure") {
        entry.casingPressure = reading.value;
      } else if (meterType === "Line Pressure" || meterType === "line pressure") {
        entry.linePressure = reading.value;
      }

      // Get comment from metadata if available
      if (reading.metadata?.comment && !entry.comment) {
        entry.comment = reading.metadata.comment;
      }
    });

    // Convert map to array and sort by date (newest first)
    return Array.from(entriesMap.values()).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [safeGaugings, safeReadings, safeWells]);

  // Filter entries by date if selected
  const filteredEntries = useMemo(() => {
    if (!selectedDateFilter) return groupedEntries;
    return groupedEntries.filter((entry) => entry.dateKey === selectedDateFilter);
  }, [groupedEntries, selectedDateFilter]);

  // Get available dates for filter
  const availableDates = useMemo(() => {
    const dateSet = new Set<string>();
    groupedEntries.forEach((entry) => {
      dateSet.add(entry.dateKey);
    });
    return Array.from(dateSet).sort().reverse();
  }, [groupedEntries]);

  // Filter wells based on search query
  const filteredWells = useMemo(() => {
    return safeWells.filter((well: any) => {
      if (!well) return false;
      const searchLower = wellSearchQuery.toLowerCase();
      const wellName = (well as any)?.name?.toLowerCase() || "";
      return wellName.includes(searchLower);
    });
  }, [safeWells, wellSearchQuery]);

  if (!userId) {
    router.push("/login");
    return null;
  }

  // Get the selected well's display name
  const selectedWellName = formData.wellId
    ? (() => {
        const well = safeWells.find((w: any) => w.id === formData.wellId);
        return well ? (well as any).name : "";
      })()
    : "";

  const handleWellSelect = (wellId: string, wellName: string) => {
    setFormData({ ...formData, wellId });
    setWellSearchQuery(wellName);
    setShowWellDropdown(false);
  };

  const resetForm = () => {
    let defaultDate = "";
    if (typeof window !== "undefined") {
      try {
        defaultDate = getTodayCST();
      } catch (error) {
        defaultDate = new Date().toISOString().slice(0, 10);
      }
    } else {
      defaultDate = new Date().toISOString().slice(0, 10);
    }
    setFormData({
      wellId: "",
      date: defaultDate,
      tank1Inches: "",
      tank2Inches: "",
      tank3Inches: "",
      gasRate: "",
      instantGasRate: "",
      tubingPressure: "",
      casingPressure: "",
      linePressure: "",
      comment: "",
    });
    setWellSearchQuery("");
    setEditingEntry(null);
    setShowForm(false);
  };

  // Inline editing functions
  const startEditing = (entry: GroupedEntry, field: string) => {
    const entryKey = `${entry.wellId}_${entry.dateKey}`;
    let value = "";
    
    if (field.startsWith("tank")) {
      const tankNum = field.replace("tank", "");
      const tankValue = entry[`tank${tankNum}` as keyof GroupedEntry] as number | undefined;
      value = tankValue?.toFixed(2) || "";
    } else {
      const fieldValue = entry[field as keyof GroupedEntry];
      value = fieldValue?.toString() || "";
    }
    
    setEditingCell({ entryKey, field, value });
  };

  const cancelEditing = () => {
    setEditingCell(null);
  };

  const saveCellEdit = async (entry: GroupedEntry, field: string, newValue: string) => {
    if (!userId) return;
    
    setEditingCell(null);
    
    // Parse the new value
    const numValue = parseFloat(newValue);
    if (isNaN(numValue) && newValue.trim() !== "") {
      alert("Please enter a valid number");
      return;
    }

    const timestamp = dateToCSTTimestamp(entry.dateKey);
    const now = new Date().toISOString();
    const transactions: any[] = [];
    const metadata = entry.comment ? { comment: entry.comment } : undefined;

    // Handle tank updates
    if (field.startsWith("tank")) {
      const tankNum = field.replace("tank", "");
      const tankNumber = `Tank ${tankNum}`;
      
        // Delete existing tank gauging for this tank
        const existingGauging = safeGaugings.find(
          (g: any) =>
            (g as any).wellId === entry.wellId &&
            (g as any).tankNumber === tankNumber &&
            timestampToDateString((g as any).timestamp) === entry.dateKey
        ) as any;
      
      if (existingGauging) {
        transactions.push(db.tx.tankGauging[existingGauging.id].delete());
      }
      
      // Create new tank gauging if value provided
      if (newValue.trim() !== "" && !isNaN(numValue)) {
        const level = numValue / 12; // Convert inches to feet
        transactions.push(
          db.tx.tankGauging[id()].update({
            wellId: entry.wellId,
            level,
            timestamp,
            tankNumber,
            userId,
            metadata,
            createdAt: now,
          })
        );
      }
    } else {
      // Handle meter reading updates
      let meterType = "";
      let unit = "";
      
      if (field === "gasRate") {
        meterType = "Gas Rate";
        unit = "MCF";
      } else if (field === "instantGasRate") {
        meterType = "Instant Gas Rate";
        unit = "MCF";
      } else if (field === "tubingPressure") {
        meterType = "Tubing Pressure";
        unit = "PSI";
      } else if (field === "casingPressure") {
        meterType = "Casing Pressure";
        unit = "PSI";
      } else if (field === "linePressure") {
        meterType = "Line Pressure";
        unit = "PSI";
      }
      
      if (meterType) {
        // Delete existing reading
        const existingReading = safeReadings.find(
          (r: any) =>
            (r as any).wellId === entry.wellId &&
            (r as any).meterType === meterType &&
            timestampToDateString((r as any).timestamp) === entry.dateKey
        ) as any;
        
        if (existingReading) {
          transactions.push(db.tx.meterReadings[existingReading.id].delete());
        }
        
        // Create new reading if value provided
        if (newValue.trim() !== "" && !isNaN(numValue)) {
          transactions.push(
            db.tx.meterReadings[id()].update({
              wellId: entry.wellId,
              value: numValue,
              timestamp,
              meterType,
              unit,
              userId,
              metadata: field.includes("Pressure") ? metadata : undefined,
              createdAt: now,
            })
          );
        }
      } else if (field === "comment") {
        // Update comment in all related records
        const allRecordIds = [
          ...entry.recordIds.tankGauging,
          ...entry.recordIds.meterReadings,
        ];
        
        allRecordIds.forEach((recordId) => {
          // Update tank gauging metadata
          const gauging = safeGaugings.find((g: any) => (g as any).id === recordId) as any;
          if (gauging) {
            transactions.push(
              db.tx.tankGauging[recordId].update({
                metadata: newValue.trim() ? { comment: newValue.trim() } : undefined,
              })
            );
          }
          
          // Update meter reading metadata (only for pressures)
          const reading = safeReadings.find((r: any) => (r as any).id === recordId) as any;
          if (reading && (reading as any).meterType?.includes("Pressure")) {
            transactions.push(
              db.tx.meterReadings[recordId].update({
                metadata: newValue.trim() ? { comment: newValue.trim() } : undefined,
              })
            );
          }
        });
      }
    }

    if (transactions.length > 0) {
      try {
        await db.transact(transactions);
      } catch (error: any) {
        alert(`Error updating field: ${error.message}`);
      }
    }
  };

  const handleDelete = async (entry: GroupedEntry) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the field entry for ${entry.wellName} on ${format(new Date(entry.date), "MMM d, yyyy")}?`
    );
    if (!confirmed) return;

    try {
      const transactions: any[] = [];
      
      // Delete all tank gauging records
      entry.recordIds.tankGauging.forEach((id) => {
        transactions.push(db.tx.tankGauging[id].delete());
      });
      
      // Delete all meter reading records
      entry.recordIds.meterReadings.forEach((id) => {
        transactions.push(db.tx.meterReadings[id].delete());
      });

      if (transactions.length > 0) {
        await db.transact(transactions);
      }
    } catch (error: any) {
      alert(`Error deleting entry: ${error.message}`);
    }
  };

  const checkExistingData = (wellId: string, dateKey: string): boolean => {
    return groupedEntries.some(
      (entry) => entry.wellId === wellId && entry.dateKey === dateKey
    );
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (!userId) {
      alert("You must be logged in to save field entries.");
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

    // Check if we have any data to save
    const hasData =
      formData.tank1Inches ||
      formData.tank2Inches ||
      formData.tank3Inches ||
      formData.gasRate ||
      formData.instantGasRate ||
      formData.tubingPressure ||
      formData.casingPressure ||
      formData.linePressure ||
      formData.comment;

    if (!hasData) {
      alert("Please enter at least one field value.");
      return;
    }

    // Check for existing data (unless we're editing this exact entry)
    const dateKey = formData.date;
    const isEditing = editingEntry !== null;
    const isOverriding = checkExistingData(formData.wellId, dateKey);
    
    if (isOverriding && (!isEditing || editingEntry.dateKey !== dateKey || editingEntry.wellId !== formData.wellId)) {
      const well = safeWells.find((w: any) => w.id === formData.wellId) as any;
      const wellName = well?.name || "Unknown";
      const confirmed = window.confirm(
        `Data already exists for ${wellName} on ${format(new Date(dateKey + "T00:00:00"), "MMM d, yyyy")}.\n\nDo you want to REPLACE the existing data with new data?`
      );
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      const timestamp = dateToCSTTimestamp(formData.date);
      const now = new Date().toISOString();
      const transactions: any[] = [];

      // If editing, delete existing records first
      if (isEditing && editingEntry) {
        editingEntry.recordIds.tankGauging.forEach((id) => {
          transactions.push(db.tx.tankGauging[id].delete());
        });
        editingEntry.recordIds.meterReadings.forEach((id) => {
          transactions.push(db.tx.meterReadings[id].delete());
        });
      } else if (isOverriding) {
        // Delete existing records for this well/date
        const existingEntry = groupedEntries.find(
          (e) => e.wellId === formData.wellId && e.dateKey === dateKey
        );
        if (existingEntry) {
          existingEntry.recordIds.tankGauging.forEach((id) => {
            transactions.push(db.tx.tankGauging[id].delete());
          });
          existingEntry.recordIds.meterReadings.forEach((id) => {
            transactions.push(db.tx.meterReadings[id].delete());
          });
        }
      }

      const metadata = formData.comment ? { comment: formData.comment } : undefined;

      // Create tank gauging records (convert inches to level)
      if (formData.tank1Inches) {
        const totalInches = parseFloat(formData.tank1Inches);
        const level = totalInches / 12; // Convert inches to feet
        transactions.push(
          db.tx.tankGauging[id()].update({
            wellId: formData.wellId,
            level,
            timestamp,
            tankNumber: "Tank 1",
            userId,
            metadata,
            createdAt: now,
          })
        );
      }

      if (formData.tank2Inches) {
        const totalInches = parseFloat(formData.tank2Inches);
        const level = totalInches / 12; // Convert inches to feet
        transactions.push(
          db.tx.tankGauging[id()].update({
            wellId: formData.wellId,
            level,
            timestamp,
            tankNumber: "Tank 2",
            userId,
            metadata,
            createdAt: now,
          })
        );
      }

      if (formData.tank3Inches) {
        const totalInches = parseFloat(formData.tank3Inches);
        const level = totalInches / 12; // Convert inches to feet
        transactions.push(
          db.tx.tankGauging[id()].update({
            wellId: formData.wellId,
            level,
            timestamp,
            tankNumber: "Tank 3",
            userId,
            metadata,
            createdAt: now,
          })
        );
      }

      // Create meter reading records
      if (formData.gasRate) {
        transactions.push(
          db.tx.meterReadings[id()].update({
            wellId: formData.wellId,
            value: parseFloat(formData.gasRate),
            timestamp,
            meterType: "Gas Rate",
            unit: "MCF",
            userId,
            createdAt: now,
          })
        );
      }

      if (formData.instantGasRate) {
        transactions.push(
          db.tx.meterReadings[id()].update({
            wellId: formData.wellId,
            value: parseFloat(formData.instantGasRate),
            timestamp,
            meterType: "Instant Gas Rate",
            unit: "MCF",
            userId,
            createdAt: now,
          })
        );
      }

      if (formData.tubingPressure) {
        transactions.push(
          db.tx.meterReadings[id()].update({
            wellId: formData.wellId,
            value: parseFloat(formData.tubingPressure),
            timestamp,
            meterType: "Tubing Pressure",
            unit: "PSI",
            userId,
            metadata,
            createdAt: now,
          })
        );
      }

      if (formData.casingPressure) {
        transactions.push(
          db.tx.meterReadings[id()].update({
            wellId: formData.wellId,
            value: parseFloat(formData.casingPressure),
            timestamp,
            meterType: "Casing Pressure",
            unit: "PSI",
            userId,
            metadata,
            createdAt: now,
          })
        );
      }

      if (formData.linePressure) {
        transactions.push(
          db.tx.meterReadings[id()].update({
            wellId: formData.wellId,
            value: parseFloat(formData.linePressure),
            timestamp,
            meterType: "Line Pressure",
            unit: "PSI",
            userId,
            metadata,
            createdAt: now,
          })
        );
      }

      if (transactions.length > 0) {
        await db.transact(transactions);
        alert(isEditing ? "Field entry updated successfully!" : "Field entry saved successfully!");
        resetForm();
      } else {
        alert("No data to save. Please enter at least one field value.");
      }
    } catch (error: any) {
      console.error("Error saving field entry:", error);
      alert(`Error saving field entry: ${error.message || "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-tepui-gray">Field Data Entry</h1>
          <p className="mt-2 text-gray-600">
            Enter and track daily field data for wells
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-tepui-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tepui-blue"
        >
          New Entry
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-base font-medium text-gray-900">Field Entries</h2>
          <div className="flex items-center gap-3">
            <label htmlFor="date-filter" className="text-xs text-gray-700">
              Filter by Date:
            </label>
            <select
              id="date-filter"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="block border-gray-300 rounded-md shadow-sm focus:ring-tepui-blue focus:border-tepui-blue text-sm p-1.5 border"
            >
              <option value="">All Dates</option>
              {availableDates.map((date) => (
                <option key={date} value={date}>
                  {format(new Date(date + "T00:00:00"), "MMM d, yyyy")}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filteredEntries.length === 0 && !showForm ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-600">
              {selectedDateFilter
                ? "No field entries found for the selected date."
                : "No field entries found. Create your first field entry."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-20">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 top-0 bg-gray-50 z-30 border-r border-gray-200">
                    Well Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-[140px] top-0 bg-gray-50 z-30 border-r border-gray-200">
                    Date
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-[220px] top-0 bg-gray-50 z-30 border-r border-gray-200">
                    Tank 1<br/><span className="text-[10px] font-normal">(in)</span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-[300px] top-0 bg-gray-50 z-30 border-r border-gray-200">
                    Tank 2<br/><span className="text-[10px] font-normal">(in)</span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-[380px] top-0 bg-gray-50 z-30 border-r border-gray-200">
                    Tank 3<br/><span className="text-[10px] font-normal">(in)</span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-[460px] top-0 bg-gray-50 z-30 border-r border-gray-200">
                    Gas Rate<br/><span className="text-[10px] font-normal">(MCF)</span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-[540px] top-0 bg-gray-50 z-30 border-r border-gray-200">
                    Instant Gas<br/><span className="text-[10px] font-normal">(MCF)</span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tubing<br/><span className="text-[10px] font-normal">(PSI)</span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Casing<br/><span className="text-[10px] font-normal">(PSI)</span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Line<br/><span className="text-[10px] font-normal">(PSI)</span>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                    Comments
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 top-0 bg-gray-50 z-30 border-l border-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {showForm && (
                  <tr className="bg-blue-50 border-b-2 border-tepui-blue">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium sticky left-0 bg-blue-50 z-10 border-r border-gray-200">
                      <div className="relative" ref={wellDropdownRef}>
                        <input
                          type="text"
                          required
                          className="w-full border-gray-300 rounded px-2 py-1 text-sm border"
                          placeholder="Well..."
                          value={wellSearchQuery}
                          onChange={(e) => {
                            setWellSearchQuery(e.target.value);
                            setShowWellDropdown(true);
                            if (e.target.value === "") {
                              setFormData({ ...formData, wellId: "" });
                            }
                          }}
                          onFocus={() => setShowWellDropdown(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSubmit(e as any);
                            }
                          }}
                          autoComplete="off"
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
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm sticky left-[140px] bg-blue-50 z-10 border-r border-gray-200">
                      <input
                        type="date"
                        required
                        className="w-full border-gray-300 rounded px-2 py-1 text-sm border"
                        value={formData.date}
                        onChange={(e) =>
                          setFormData({ ...formData, date: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-center sticky left-[220px] bg-blue-50 z-10 border-r border-gray-200">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        className="w-20 text-center border-gray-300 rounded px-1 py-1 text-sm border"
                        value={formData.tank1Inches}
                        onChange={(e) =>
                          setFormData({ ...formData, tank1Inches: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-center sticky left-[300px] bg-blue-50 z-10 border-r border-gray-200">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        className="w-20 text-center border-gray-300 rounded px-1 py-1 text-sm border"
                        value={formData.tank2Inches}
                        onChange={(e) =>
                          setFormData({ ...formData, tank2Inches: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-center sticky left-[380px] bg-blue-50 z-10 border-r border-gray-200">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        className="w-20 text-center border-gray-300 rounded px-1 py-1 text-sm border"
                        value={formData.tank3Inches}
                        onChange={(e) =>
                          setFormData({ ...formData, tank3Inches: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-center sticky left-[460px] bg-blue-50 z-10 border-r border-gray-200">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="w-20 text-center border-gray-300 rounded px-1 py-1 text-sm border"
                        value={formData.gasRate}
                        onChange={(e) =>
                          setFormData({ ...formData, gasRate: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-center sticky left-[540px] bg-blue-50 z-10 border-r border-gray-200">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="w-20 text-center border-gray-300 rounded px-1 py-1 text-sm border"
                        value={formData.instantGasRate}
                        onChange={(e) =>
                          setFormData({ ...formData, instantGasRate: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="w-20 text-center border-gray-300 rounded px-1 py-1 text-sm border"
                        value={formData.tubingPressure}
                        onChange={(e) =>
                          setFormData({ ...formData, tubingPressure: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="w-20 text-center border-gray-300 rounded px-1 py-1 text-sm border"
                        value={formData.casingPressure}
                        onChange={(e) =>
                          setFormData({ ...formData, casingPressure: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="w-20 text-center border-gray-300 rounded px-1 py-1 text-sm border"
                        value={formData.linePressure}
                        onChange={(e) =>
                          setFormData({ ...formData, linePressure: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 text-sm min-w-[200px]">
                      <input
                        type="text"
                        className="w-full border-gray-300 rounded px-2 py-1 text-sm border"
                        placeholder="Comments..."
                        value={formData.comment}
                        onChange={(e) =>
                          setFormData({ ...formData, comment: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium sticky right-0 bg-blue-50 z-10 border-l border-gray-200">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={submitting}
                          className="text-tepui-blue hover:text-blue-700 text-sm disabled:opacity-50"
                        >
                          {submitting ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={resetForm}
                          className="text-gray-500 hover:text-gray-700 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {filteredEntries.map((entry, index) => {
                  const entryKey = `${entry.wellId}_${entry.dateKey}`;
                  const isEditingTank1 = editingCell?.entryKey === entryKey && editingCell?.field === "tank1";
                  const isEditingTank2 = editingCell?.entryKey === entryKey && editingCell?.field === "tank2";
                  const isEditingTank3 = editingCell?.entryKey === entryKey && editingCell?.field === "tank3";
                  const isEditingGasRate = editingCell?.entryKey === entryKey && editingCell?.field === "gasRate";
                  const isEditingInstantGas = editingCell?.entryKey === entryKey && editingCell?.field === "instantGasRate";
                  const isEditingTubing = editingCell?.entryKey === entryKey && editingCell?.field === "tubingPressure";
                  const isEditingCasing = editingCell?.entryKey === entryKey && editingCell?.field === "casingPressure";
                  const isEditingLine = editingCell?.entryKey === entryKey && editingCell?.field === "linePressure";
                  const isEditingComment = editingCell?.entryKey === entryKey && editingCell?.field === "comment";

                  return (
                    <tr key={entryKey} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200">
                        {entry.wellName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 sticky left-[140px] bg-white z-10 border-r border-gray-200">
                        {format(new Date(entry.date), "MMM d, yyyy")}
                      </td>
                      <td 
                        className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900 sticky left-[220px] bg-white z-10 border-r border-gray-200 cursor-pointer"
                        onClick={() => !isEditingTank1 && startEditing(entry, "tank1")}
                      >
                        {isEditingTank1 ? (
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            className="w-20 text-center border border-tepui-blue rounded px-1 py-0.5 text-sm"
                            value={editingCell?.value || ""}
                            autoFocus
                            onBlur={() => {
                              if (editingCell) {
                                saveCellEdit(entry, "tank1", editingCell.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingCell) {
                                  saveCellEdit(entry, "tank1", editingCell.value);
                                }
                              } else if (e.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            onChange={(e) => setEditingCell({ ...editingCell!, value: e.target.value })}
                          />
                        ) : (
                          entry.tank1 ? Math.round(entry.tank1) : "-"
                        )}
                      </td>
                      <td 
                        className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900 sticky left-[300px] bg-white z-10 border-r border-gray-200 cursor-pointer"
                        onClick={() => !isEditingTank2 && startEditing(entry, "tank2")}
                      >
                        {isEditingTank2 ? (
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            className="w-20 text-center border border-tepui-blue rounded px-1 py-0.5 text-sm"
                            value={editingCell?.value || ""}
                            autoFocus
                            onBlur={() => {
                              if (editingCell) {
                                saveCellEdit(entry, "tank2", editingCell.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingCell) {
                                  saveCellEdit(entry, "tank2", editingCell.value);
                                }
                              } else if (e.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            onChange={(e) => setEditingCell({ ...editingCell!, value: e.target.value })}
                          />
                        ) : (
                          entry.tank2 ? Math.round(entry.tank2) : "-"
                        )}
                      </td>
                      <td 
                        className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900 sticky left-[380px] bg-white z-10 border-r border-gray-200 cursor-pointer"
                        onClick={() => !isEditingTank3 && startEditing(entry, "tank3")}
                      >
                        {isEditingTank3 ? (
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            className="w-20 text-center border border-tepui-blue rounded px-1 py-0.5 text-sm"
                            value={editingCell?.value || ""}
                            autoFocus
                            onBlur={() => {
                              if (editingCell) {
                                saveCellEdit(entry, "tank3", editingCell.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingCell) {
                                  saveCellEdit(entry, "tank3", editingCell.value);
                                }
                              } else if (e.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            onChange={(e) => setEditingCell({ ...editingCell!, value: e.target.value })}
                          />
                        ) : (
                          entry.tank3 ? Math.round(entry.tank3) : "-"
                        )}
                      </td>
                      <td 
                        className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900 sticky left-[460px] bg-white z-10 border-r border-gray-200 cursor-pointer"
                        onClick={() => !isEditingGasRate && startEditing(entry, "gasRate")}
                      >
                        {isEditingGasRate ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            className="w-20 text-center border border-tepui-blue rounded px-1 py-0.5 text-sm"
                            value={editingCell?.value || ""}
                            autoFocus
                            onBlur={() => {
                              if (editingCell) {
                                saveCellEdit(entry, "gasRate", editingCell.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingCell) {
                                  saveCellEdit(entry, "gasRate", editingCell.value);
                                }
                              } else if (e.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            onChange={(e) => setEditingCell({ ...editingCell!, value: e.target.value })}
                          />
                        ) : (
                          entry.gasRate ? Math.round(entry.gasRate) : "-"
                        )}
                      </td>
                      <td 
                        className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900 sticky left-[540px] bg-white z-10 border-r border-gray-200 cursor-pointer"
                        onClick={() => !isEditingInstantGas && startEditing(entry, "instantGasRate")}
                      >
                        {isEditingInstantGas ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            className="w-20 text-center border border-tepui-blue rounded px-1 py-0.5 text-sm"
                            value={editingCell?.value || ""}
                            autoFocus
                            onBlur={() => {
                              if (editingCell) {
                                saveCellEdit(entry, "instantGasRate", editingCell.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingCell) {
                                  saveCellEdit(entry, "instantGasRate", editingCell.value);
                                }
                              } else if (e.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            onChange={(e) => setEditingCell({ ...editingCell!, value: e.target.value })}
                          />
                        ) : (
                          entry.instantGasRate ? Math.round(entry.instantGasRate) : "-"
                        )}
                      </td>
                      <td 
                        className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900 cursor-pointer"
                        onClick={() => !isEditingTubing && startEditing(entry, "tubingPressure")}
                      >
                        {isEditingTubing ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            className="w-20 text-center border border-tepui-blue rounded px-1 py-0.5 text-sm"
                            value={editingCell?.value || ""}
                            autoFocus
                            onBlur={() => {
                              if (editingCell) {
                                saveCellEdit(entry, "tubingPressure", editingCell.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingCell) {
                                  saveCellEdit(entry, "tubingPressure", editingCell.value);
                                }
                              } else if (e.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            onChange={(e) => setEditingCell({ ...editingCell!, value: e.target.value })}
                          />
                        ) : (
                          entry.tubingPressure ? Math.round(entry.tubingPressure) : "-"
                        )}
                      </td>
                      <td 
                        className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900 cursor-pointer"
                        onClick={() => !isEditingCasing && startEditing(entry, "casingPressure")}
                      >
                        {isEditingCasing ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            className="w-20 text-center border border-tepui-blue rounded px-1 py-0.5 text-sm"
                            value={editingCell?.value || ""}
                            autoFocus
                            onBlur={() => {
                              if (editingCell) {
                                saveCellEdit(entry, "casingPressure", editingCell.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingCell) {
                                  saveCellEdit(entry, "casingPressure", editingCell.value);
                                }
                              } else if (e.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            onChange={(e) => setEditingCell({ ...editingCell!, value: e.target.value })}
                          />
                        ) : (
                          entry.casingPressure ? Math.round(entry.casingPressure) : "-"
                        )}
                      </td>
                      <td 
                        className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900 cursor-pointer"
                        onClick={() => !isEditingLine && startEditing(entry, "linePressure")}
                      >
                        {isEditingLine ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            className="w-20 text-center border border-tepui-blue rounded px-1 py-0.5 text-sm"
                            value={editingCell?.value || ""}
                            autoFocus
                            onBlur={() => {
                              if (editingCell) {
                                saveCellEdit(entry, "linePressure", editingCell.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingCell) {
                                  saveCellEdit(entry, "linePressure", editingCell.value);
                                }
                              } else if (e.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            onChange={(e) => setEditingCell({ ...editingCell!, value: e.target.value })}
                          />
                        ) : (
                          entry.linePressure ? Math.round(entry.linePressure) : "-"
                        )}
                      </td>
                      <td 
                        className="px-3 py-3 text-sm text-gray-500 min-w-[200px] cursor-pointer"
                        onClick={() => !isEditingComment && startEditing(entry, "comment")}
                      >
                        {isEditingComment ? (
                          <input
                            type="text"
                            className="w-full border border-tepui-blue rounded px-1 py-0.5 text-sm"
                            value={editingCell?.value || ""}
                            autoFocus
                            onBlur={() => {
                              if (editingCell) {
                                saveCellEdit(entry, "comment", editingCell.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingCell) {
                                  saveCellEdit(entry, "comment", editingCell.value);
                                }
                              } else if (e.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            onChange={(e) => setEditingCell({ ...editingCell!, value: e.target.value })}
                          />
                        ) : (
                          entry.comment || "-"
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium sticky right-0 bg-white z-10 border-l border-gray-200">
                        <button
                          onClick={() => handleDelete(entry)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
