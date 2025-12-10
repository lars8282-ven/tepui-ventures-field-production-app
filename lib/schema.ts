// This file is kept for backwards compatibility
// Schema types will be generated after entities are created in InstantDB

export type Schema = any;

// Legacy type definitions for reference
export type LegacySchema = {
  wells: {
    id: string;
    name: string;
    wellNumber: string;
    location?: string;
    status: "active" | "inactive";
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  };
  meterReadings: {
    id: string;
    wellId: string;
    value: number;
    timestamp: string;
    meterType?: string;
    unit: string;
    userId: string;
    metadata?: Record<string, any>;
    createdAt: string;
  };
  tankGauging: {
    id: string;
    wellId: string;
    level: number;
    timestamp: string;
    tankNumber?: string;
    userId: string;
    metadata?: Record<string, any>;
    createdAt: string;
  };
  baselines: {
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
  };
  users: {
    id: string;
    email: string;
    name: string;
    role: "admin" | "operator" | "viewer";
    createdAt: string;
  };
};
