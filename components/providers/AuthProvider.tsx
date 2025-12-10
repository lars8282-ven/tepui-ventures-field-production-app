"use client";

import { db } from "@/lib/instant";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Access auth state - this subscribes to auth changes
  db.useAuth();
  return <>{children}</>;
}
