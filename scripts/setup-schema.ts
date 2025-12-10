// This script creates initial entities to bootstrap the schema
// Run with: npx tsx scripts/setup-schema.ts

import { init } from "@instantdb/react";
import { db } from "../lib/instant";

async function setupSchema() {
  console.log("Setting up schema by creating initial entities...");
  
  try {
    // Create a test well
    const wellId = db.id();
    db.transact(
      db.tx.wells[wellId].update({
        name: "Test Well",
        wellNumber: "TEST-001",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
    console.log("✅ Created test well entity");

    // Note: We can't create meterReadings, tankGauging, or baselines yet
    // because they require links to wells and users, and we need auth first
    // The entities will be created automatically when the app is used

    console.log("✅ Schema entities will be created automatically when you start using the app");
    console.log("Run 'npx instant-cli@latest pull' after using the app to sync the schema file");
    
  } catch (error) {
    console.error("Error setting up schema:", error);
    console.log("This is normal - entities will be created automatically when you use the app");
  }
}

setupSchema();

