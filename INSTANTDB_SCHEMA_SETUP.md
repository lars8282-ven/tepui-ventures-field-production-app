# InstantDB Schema Manual Setup Guide

## Access Your Dashboard
1. Go to https://instantdb.com/dashboard
2. Sign in with your account
3. Select your app (App ID: f9eab271-a9fe-45dc-a367-a42eeee71b91)

## Create Tables

### 1. Table: `wells`
Create a table named `wells` with these fields:
- `name` - Type: **string** (required)
- `wellNumber` - Type: **string** (required)
- `location` - Type: **string** (optional)
- `status` - Type: **string** (required)
- `metadata` - Type: **json** (optional)
- `createdAt` - Type: **datetime** (required)
- `updatedAt` - Type: **datetime** (required)

### 2. Table: `meterReadings`
Create a table named `meterReadings` with these fields:
- `wellId` - Type: **id** (required) - Reference to `wells` table
- `value` - Type: **number** (required)
- `timestamp` - Type: **datetime** (required)
- `meterType` - Type: **string** (optional)
- `unit` - Type: **string** (required)
- `userId` - Type: **id** (required) - Reference to `users` table
- `metadata` - Type: **json** (optional)
- `createdAt` - Type: **datetime** (required)

### 3. Table: `tankGauging`
Create a table named `tankGauging` with these fields:
- `wellId` - Type: **id** (required) - Reference to `wells` table
- `level` - Type: **number** (required)
- `timestamp` - Type: **datetime** (required)
- `tankNumber` - Type: **string** (optional)
- `userId` - Type: **id** (required) - Reference to `users` table
- `metadata` - Type: **json** (optional)
- `createdAt` - Type: **datetime** (required)

### 4. Table: `baselines`
Create a table named `baselines` with these fields:
- `wellId` - Type: **id** (required) - Reference to `wells` table
- `type` - Type: **string** (required)
- `targetValue` - Type: **number** (required)
- `metricName` - Type: **string** (required)
- `period` - Type: **string** (required)
- `startDate` - Type: **datetime** (optional)
- `endDate` - Type: **datetime** (optional)
- `metadata` - Type: **json** (optional)
- `createdAt` - Type: **datetime** (required)
- `updatedAt` - Type: **datetime** (required)

### 5. Table: `users`
Create a table named `users` with these fields:
- `email` - Type: **string** (required)
- `name` - Type: **string** (required)
- `role` - Type: **string** (required)
- `createdAt` - Type: **datetime** (required)

## Important Notes:
- Make sure to set up the **id** type fields as references to the correct tables:
  - `meterReadings.wellId` → references `wells`
  - `meterReadings.userId` → references `users`
  - `tankGauging.wellId` → references `wells`
  - `tankGauging.userId` → references `users`
  - `baselines.wellId` → references `wells`

## After Setup:
Once all tables are created in the dashboard, you can verify by running:
```bash
npx instant-cli@latest pull
```

This will download the schema from InstantDB and update your local `instant.schema.ts` file to match what's in the dashboard.

