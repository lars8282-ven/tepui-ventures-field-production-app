# Field Entry Shared Well Selection

## Overview
The Field Entry page now stores well selections in InstantDB instead of localStorage, making the selection **shared across all users**. When one user selects or deselects wells, all other users will see the same selection.

## Implementation Details

### Database Entity
- **Entity Name**: `fieldEntrySettings`
- **Record ID**: `field-entry-settings-shared` (single shared record)
- **Fields**:
  - `selectedWellIds`: Array of well IDs (string[])
  - `updatedAt`: Timestamp of last update
  - `updatedBy`: User ID who made the last update

### How It Works
1. On page load, the app queries InstantDB for the shared settings
2. If settings exist, it loads the selected well IDs
3. If no settings exist, it defaults to all wells and creates the initial record
4. When a user toggles well selection, it immediately saves to InstantDB
5. All users see the same selection in real-time (via InstantDB's real-time sync)

### Benefits
- ✅ Shared selection across all users
- ✅ Real-time updates (changes appear immediately for all users)
- ✅ Persistent across browser sessions
- ✅ No need for localStorage

### Database Setup
The `fieldEntrySettings` entity will be auto-created by InstantDB when first used. No manual setup required.

If you need to manually create it in the InstantDB dashboard:
- Table name: `fieldEntrySettings`
- Fields:
  - `selectedWellIds` - Type: **json** (stores array of strings)
  - `updatedAt` - Type: **datetime**
  - `updatedBy` - Type: **id** (references users)

