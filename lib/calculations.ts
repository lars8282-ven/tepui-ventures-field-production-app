/**
 * Utility functions for oil and gas production calculations
 */

export interface TankGauging {
  id: string;
  wellId: string;
  level: number; // in inches
  timestamp: string;
  tankNumber?: string;
  userId: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

/**
 * Calculate barrels from inches using tank factor
 */
export function calculateBarrels(inches: number, tankFactor: number): number {
  if (!tankFactor || tankFactor <= 0) return 0;
  return inches * tankFactor;
}

/**
 * Calculate production rate (barrels per day)
 */
export function calculateRate(
  current: number,
  previous: number,
  daysDiff: number
): number | null {
  if (!previous || daysDiff <= 0) return null;
  const rate = (current - previous) / daysDiff;
  // Round to 1 decimal place to avoid floating point precision issues
  return Math.round(rate * 10) / 10;
}

/**
 * Calculate days difference between two timestamps
 */
export function calculateDaysDifference(
  currentTimestamp: string,
  previousTimestamp: string
): number {
  const current = new Date(currentTimestamp).getTime();
  const previous = new Date(previousTimestamp).getTime();
  const diffMs = current - previous;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.abs(diffDays);
}

/**
 * Get the latest tank gauging for a specific well and tank
 */
export function getLatestGauging(
  gaugings: TankGauging[],
  wellId: string,
  tankNumber: string
): TankGauging | null {
  const filtered = gaugings
    .filter(
      (g) => g.wellId === wellId && g.tankNumber === tankNumber
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp || b.createdAt).getTime() -
        new Date(a.timestamp || a.createdAt).getTime()
    );

  return filtered.length > 0 ? filtered[0] : null;
}

/**
 * Get tank gauging for a specific well, tank, and date (or latest if date is null)
 */
export function getGaugingByDate(
  gaugings: TankGauging[],
  wellId: string,
  tankNumber: string,
  date: string | null
): TankGauging | null {
  let filtered = gaugings.filter(
    (g) => g.wellId === wellId && g.tankNumber === tankNumber
  );

  // If date is specified, filter by that date
  if (date) {
    filtered = filtered.filter((g) => {
      const gaugeDate = new Date(g.timestamp || g.createdAt);
      const gaugeDateKey = gaugeDate.toISOString().split("T")[0]; // yyyy-MM-dd
      return gaugeDateKey === date;
    });
  }

  // Sort by timestamp descending
  filtered.sort(
    (a, b) =>
      new Date(b.timestamp || b.createdAt).getTime() -
      new Date(a.timestamp || a.createdAt).getTime()
  );

  return filtered.length > 0 ? filtered[0] : null;
}

/**
 * Get the previous tank gauging (before the latest one) for a specific well and tank
 */
export function getPreviousGauging(
  gaugings: TankGauging[],
  wellId: string,
  tankNumber: string,
  latestTimestamp: string
): TankGauging | null {
  const filtered = gaugings
    .filter(
      (g) =>
        g.wellId === wellId &&
        g.tankNumber === tankNumber &&
        (new Date(g.timestamp || g.createdAt).getTime() <
          new Date(latestTimestamp).getTime())
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp || b.createdAt).getTime() -
        new Date(a.timestamp || a.createdAt).getTime()
    );

  return filtered.length > 0 ? filtered[0] : null;
}

/**
 * Get tank factor from well metadata
 */
export function getTankFactor(well: any): number {
  if (!well?.metadata?.tankFactor) return 0;
  const factor = parseFloat(String(well.metadata.tankFactor));
  return isNaN(factor) ? 0 : factor;
}

/**
 * Check if tank is ready for pickup (>130 bbls)
 */
export function isReadyForPickup(barrels: number): boolean {
  return barrels >= 130;
}

/**
 * Get color class for tank based on barrel amount
 */
export function getTankColorClass(barrels: number): string {
  if (barrels >= 130) {
    return "bg-green-50 text-green-800 border-green-200"; // Ready for pickup
  } else if (barrels >= 100) {
    return "bg-yellow-50 text-yellow-800 border-yellow-200"; // Approaching threshold
  }
  return "bg-white text-gray-900 border-gray-200"; // Default
}

