# Step-by-Step: Creating Tables in InstantDB Dashboard

## Accessing Your Dashboard
1. Go to https://instantdb.com/dashboard
2. Sign in with your account
3. Find and click on your app (the one with App ID: f9eab271-a9fe-45dc-a367-a42eeee71b91)

## Creating Tables

### Step 1: Create the `wells` table

1. Look for a button or link that says **"Schema"**, **"Tables"**, **"Database"**, or **"Add Table"**
2. Click **"Add Table"** or **"Create Table"**
3. Name it: `wells` (lowercase, exactly as shown)
4. Click **"Create"** or **"Add"**
5. Now add each field one by one:

   **Field 1: `name`**
   - Click **"Add Field"** or **"Add Column"**
   - Field name: `name`
   - Field type: Select **"string"** or **"text"**
   - Required: ✅ Check/Enable
   - Click **"Save"** or **"Add"**

   **Field 2: `wellNumber`**
   - Click **"Add Field"**
   - Field name: `wellNumber` (camelCase, exactly as shown)
   - Field type: **"string"**
   - Required: ✅ Check/Enable
   - Click **"Save"**

   **Field 3: `location`**
   - Click **"Add Field"**
   - Field name: `location`
   - Field type: **"string"**
   - Required: ❌ Leave unchecked (this is optional)
   - Click **"Save"**

   **Field 4: `status`**
   - Click **"Add Field"**
   - Field name: `status`
   - Field type: **"string"**
   - Required: ✅ Check/Enable
   - Click **"Save"**

   **Field 5: `metadata`**
   - Click **"Add Field"**
   - Field name: `metadata`
   - Field type: **"json"** (if available) or **"object"**
   - Required: ❌ Leave unchecked (optional)
   - Click **"Save"**

   **Field 6: `createdAt`**
   - Click **"Add Field"**
   - Field name: `createdAt` (camelCase)
   - Field type: **"datetime"** or **"timestamp"**
   - Required: ✅ Check/Enable
   - Click **"Save"**

   **Field 7: `updatedAt`**
   - Click **"Add Field"**
   - Field name: `updatedAt` (camelCase)
   - Field type: **"datetime"** or **"timestamp"**
   - Required: ✅ Check/Enable
   - Click **"Save"**

---

### Step 2: Create the `users` table

1. Click **"Add Table"** again
2. Name it: `users` (lowercase)
3. Click **"Create"**
4. Add these fields:

   **Field 1: `email`**
   - Name: `email`
   - Type: **"string"**
   - Required: ✅

   **Field 2: `name`**
   - Name: `name`
   - Type: **"string"**
   - Required: ✅

   **Field 3: `role`**
   - Name: `role`
   - Type: **"string"**
   - Required: ✅

   **Field 4: `createdAt`**
   - Name: `createdAt`
   - Type: **"datetime"**
   - Required: ✅

---

### Step 3: Create the `meterReadings` table

1. Click **"Add Table"**
2. Name it: `meterReadings` (camelCase, exactly as shown)
3. Click **"Create"**
4. Add these fields:

   **Field 1: `wellId`**
   - Name: `wellId`
   - Type: **"id"** or **"reference"** or **"relation"**
   - Reference/Relation: Select **"wells"** table
   - Required: ✅

   **Field 2: `value`**
   - Name: `value`
   - Type: **"number"** or **"float"** or **"decimal"**
   - Required: ✅

   **Field 3: `timestamp`**
   - Name: `timestamp`
   - Type: **"datetime"**
   - Required: ✅

   **Field 4: `meterType`**
   - Name: `meterType`
   - Type: **"string"**
   - Required: ❌ (optional)

   **Field 5: `unit`**
   - Name: `unit`
   - Type: **"string"**
   - Required: ✅

   **Field 6: `userId`**
   - Name: `userId`
   - Type: **"id"** or **"reference"**
   - Reference: Select **"users"** table
   - Required: ✅

   **Field 7: `metadata`**
   - Name: `metadata`
   - Type: **"json"** or **"object"**
   - Required: ❌ (optional)

   **Field 8: `createdAt`**
   - Name: `createdAt`
   - Type: **"datetime"**
   - Required: ✅

---

### Step 4: Create the `tankGauging` table

1. Click **"Add Table"**
2. Name it: `tankGauging` (camelCase, exactly as shown)
3. Click **"Create"**
4. Add these fields:

   **Field 1: `wellId`**
   - Name: `wellId`
   - Type: **"id"** or **"reference"**
   - Reference: **"wells"** table
   - Required: ✅

   **Field 2: `level`**
   - Name: `level`
   - Type: **"number"**
   - Required: ✅

   **Field 3: `timestamp`**
   - Name: `timestamp`
   - Type: **"datetime"**
   - Required: ✅

   **Field 4: `tankNumber`**
   - Name: `tankNumber`
   - Type: **"string"**
   - Required: ❌ (optional)

   **Field 5: `userId`**
   - Name: `userId`
   - Type: **"id"** or **"reference"**
   - Reference: **"users"** table
   - Required: ✅

   **Field 6: `metadata`**
   - Name: `metadata`
   - Type: **"json"** or **"object"**
   - Required: ❌ (optional)

   **Field 7: `createdAt`**
   - Name: `createdAt`
   - Type: **"datetime"**
   - Required: ✅

---

### Step 5: Create the `baselines` table

1. Click **"Add Table"**
2. Name it: `baselines` (lowercase)
3. Click **"Create"**
4. Add these fields:

   **Field 1: `wellId`**
   - Name: `wellId`
   - Type: **"id"** or **"reference"**
   - Reference: **"wells"** table
   - Required: ✅

   **Field 2: `type`**
   - Name: `type`
   - Type: **"string"**
   - Required: ✅

   **Field 3: `targetValue`**
   - Name: `targetValue`
   - Type: **"number"**
   - Required: ✅

   **Field 4: `metricName`**
   - Name: `metricName`
   - Type: **"string"**
   - Required: ✅

   **Field 5: `period`**
   - Name: `period`
   - Type: **"string"**
   - Required: ✅

   **Field 6: `startDate`**
   - Name: `startDate`
   - Type: **"datetime"**
   - Required: ❌ (optional)

   **Field 7: `endDate`**
   - Name: `endDate`
   - Type: **"datetime"**
   - Required: ❌ (optional)

   **Field 8: `metadata`**
   - Name: `metadata`
   - Type: **"json"** or **"object"**
   - Required: ❌ (optional)

   **Field 9: `createdAt`**
   - Name: `createdAt`
   - Type: **"datetime"**
   - Required: ✅

   **Field 10: `updatedAt`**
   - Name: `updatedAt`
   - Type: **"datetime"**
   - Required: ✅

---

## Important Notes:

1. **Table Names**: Use exact casing:
   - `wells` (lowercase)
   - `meterReadings` (camelCase)
   - `tankGauging` (camelCase)
   - `baselines` (lowercase)
   - `users` (lowercase)

2. **Field Names**: Use exact casing as shown (camelCase for most fields)

3. **References/Relations**: When creating `id` type fields that reference other tables:
   - Look for options like "Reference", "Relation", or "Link to table"
   - Select the correct target table

4. **If you can't find certain field types**:
   - `datetime` might be called `timestamp` or `date`
   - `json` might be called `object` or `jsonb`
   - `id` for references might be called `reference` or `relation`

5. **Order matters**: Create `wells` and `users` tables FIRST, then create the other tables that reference them.

---

## After Creating All Tables:

Run this command to sync your local files:
```bash
npx instant-cli@latest pull
```

This will update your `instant.schema.ts` file to match what you created in the dashboard.

