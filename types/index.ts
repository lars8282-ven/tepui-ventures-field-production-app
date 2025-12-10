export interface Well {
  id: string;
  name: string;
  wellNumber: string;
  location?: string;
  status: "active" | "inactive";
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface MeterReading {
  id: string;
  wellId: string;
  value: number;
  timestamp: string;
  meterType?: string;
  unit: string;
  userId: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface TankGauging {
  id: string;
  wellId: string;
  level: number;
  timestamp: string;
  tankNumber?: string;
  userId: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Baseline {
  id: string;
  wellId: string;
  type: "meter" | "tank" | "field";
  targetValue: number;
  metricName: string;
  period: "daily" | "weekly" | "monthly";
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "operator" | "viewer";
  createdAt: string;
}

export type ComparisonMethod = "percentage" | "absolute" | "custom";

export interface BaselineUnderwriting {
  id: string;
  prices?: Record<string, any>;
  assumptions?: Record<string, any>;
  productionForecast?: Array<{
    period: string | number;
    pdp: number;
    pdsi: number;
    [key: string]: any;
  }>;
  revenueCostForecast?: Array<{
    period: string | number;
    revenue?: number;
    operatingCosts?: number;
    capitalCosts?: number;
    netRevenue?: number;
    [key: string]: any;
  }>;
  rawData?: any[];
  structuredData?: {
    prices: Array<{ label: string; values: Record<string, number> }>;
    pdpAssumptions: Array<{ label: string; values: Record<string, number> }>;
    pdsiAssumptions: Array<{ label: string; values: Record<string, number> }>;
    pdpCalculations: Array<{ label: string; values: Record<string, number> }>;
    pdsiCalculations: Array<{ label: string; values: Record<string, number> }>;
    other: Array<{ label: string; values: Record<string, number> }>;
    cashFlows: Array<{ label: string; values: Record<string, number> }>;
    irr?: number;
    netFcf?: number;
    dates: string[];
  };
  createdAt: string;
  updatedAt: string;
}