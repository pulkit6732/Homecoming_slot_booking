# Google Apps Script Backend Deployment Guide

Project: GITAM Interview Portal (Homecoming Slot Booking)  
Timezone: Asia/Kolkata (Indian Standard Time - IST)  
Zero emojis per specification.

---

## 1. Overview
The Google Apps Script backend acts as the single authoritative server for slot reservations, concurrency management, and administrator review actions.
It interacts directly with Google Sheets across 3 designated tabs:
1. `Student Database` (Master source of truth)
2. `Approved` (Synchronized approval records)
3. `Rejected` (Synchronized rejection records)

---

## 2. Step-by-Step Deployment

### Step 1: Create the Google Spreadsheet
1. Create a new Google Spreadsheet in Google Drive.
2. In Spreadsheet Settings (`File` > `Settings`):
   - Set Locale to `India`.
   - Set Time Zone to `(GMT+05:30) India Standard Time (Kolkata)`.
3. Create three tabs with exact names:
   - `Student Database`
   - `Approved`
   - `Rejected`
4. Set the header row in `Student Database` (Row 1):
   `StudentID`, `FullName`, `Email`, `PhoneNumber`, `RollNumber`, `Department`, `YearOfStudy`, `CGPA`, `Attendance`, `InterviewDate`, `InterviewSlot`, `InterviewStart`, `InterviewEnd`, `BookingID`, `BookingRequestID`, `BookingStatus`, `BookingTimestamp`, `ApprovalStatus`, `DecisionBy`, `DecisionTimestamp`, `RejectionReason`, `ReviewFlagStatus`, `FlaggedBy`, `FlaggedAt`, `FlagReason`, `FlagClearedBy`, `FlagClearedAt`

### Step 2: Create the Apps Script Project
1. In the Google Spreadsheet, click **Extensions** > **Apps Script**.
   *(Alternatively, create a standalone project at script.google.com and provide SPREADSHEET_ID in Script Properties).*
2. Name the project `GITAM-Interview-Backend`.

### Step 3: Add Source Files
Copy the code from the local `apps-script/src/` folder into corresponding script files in the Apps Script editor:
- `Config.gs`: Application constants, eligible dates, slot rules.
- `Response.gs`: Standardized JSON responses and error envelopes.
- `Auth.gs`: Supabase identity JWT validation and role checks.
- `ScheduleService.gs`: Central 216-slot schedule generator.
- `SheetsRepository.gs`: Data access layer for the 3 spreadsheet tabs.
- `BookingService.gs`: LockService concurrency locking and idempotency.
- `AdminService.gs`: Schedule querying, summary metrics, and review actions.
- `Code.gs`: Web App entry points (`doGet` and `doPost`).

### Step 4: Configure Script Properties
1. In Apps Script, open **Project Settings** (gear icon on the left panel).
2. Scroll to **Script Properties** and click **Edit script properties**.
3. Add the following key-value pairs:
   - `SUPABASE_JWT_SECRET`: The JWT Secret from your Supabase Dashboard (`Project Settings` > `API` > `JWT Secret`).
   - `ADMIN_EMAILS`: Comma-separated admin emails (e.g. `admin@gitam.in,112525884+pulkit6732@users.noreply.github.com`).
   - `SPREADSHEET_ID`: (Only needed if running as a standalone script).

### Step 5: Deploy the Web App
1. Click **Deploy** > **New deployment**.
2. Select type: **Web app**.
3. Configure settings:
   - **Description**: `GITAM Interview Portal Production API`
   - **Execute as**: `Me (your-email@example.com)`
   - **Who has access**: `Anyone`
4. Click **Deploy**.
5. Copy the generated **Web App URL** (format: `https://script.google.com/macros/s/.../exec`).

### Step 6: Connect to Frontend
1. Open the project's `.env` (or configure in Netlify environment variables):
   ```
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
   ```
2. Re-build or reload the React frontend. The application will automatically route requests through the live Apps Script backend while falling back safely to local verified storage if offline.

---

## 3. Server-Side Token Validation Explained
- Supabase Auth issues an HMAC-SHA256 signed JWT upon user authentication.
- Apps Script validates the token server-side via `Utilities.computeHmacSha256Signature`:
  1. Signature verification against `SUPABASE_JWT_SECRET`.
  2. Expiry check against UTC timestamp.
  3. Extraction of verified email address.
  4. Lookup of verified email in `Student Database` to resolve canonical `StudentID`.
- Arbitrary client-supplied `StudentID`, email, or role claims are never trusted.
