import { init } from "@instantdb/react";
import rules from "../instant.perms";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "";

if (!APP_ID) {
  console.warn(
    "NEXT_PUBLIC_INSTANT_APP_ID is not set. Please configure it in .env.local"
  );
}

// Initialize without schema - InstantDB will auto-create entities
export const db = init({
  appId: APP_ID,
  rules,
});

// Export a type placeholder for now
export type Schema = any;
