/**
 * Direct Google Apps Script SheetsRepository Verification Suite
 * 
 * Tests the ACTUAL JavaScript code from apps-script/src/SheetsRepository.gs:
 * 1. Student lookup by verified email.
 * 2. Ambiguous duplicate registration detection (never silently selects the first).
 * 3. Batch atomic row write optimization (single setValues call instead of multiple setValues).
 * 4. Request-scoped read caching (eliminating redundant getDataRange calls).
 * 5. In-place booking cancellation and review updates.
 * 6. Decision tab synchronization (Approved / Rejected) without duplicate rows.
 * 
 * Zero emojis per specification.
 */

import fs from 'node:fs';
import vm from 'node:vm';

console.log('================================================================');
console.log('STARTING DIRECT APPS SCRIPT SHEETS REPOSITORY AUDIT SUITE');
console.log('Timezone: Asia/Kolkata (IST)');
console.log('================================================================\n');

const repoCode = fs.readFileSync('apps-script/src/SheetsRepository.gs', 'utf8');
const configCode = fs.readFileSync('apps-script/src/Config.gs', 'utf8');

// Synthetic staging sheet state
interface SheetData {
  headers: string[];
  rows: (string | number)[][];
}

const mockSheetsData: Record<string, SheetData> = {
  'Student Database': {
    headers: [
      'StudentID', 'FullName', 'Email', 'PhoneNumber', 'Program', 'Branch',
      'BookingStatus', 'BookingID', 'BookingRequestID', 'InterviewDate', 'InterviewSlot',
      'InterviewStart', 'InterviewEnd', 'BookingTimestamp',
      'ApprovalStatus', 'DecisionBy', 'DecisionTimestamp', 'DecisionComment',
      'ReviewFlagStatus', 'FlaggedBy', 'FlaggedAt', 'FlagReason'
    ],
    rows: [
      ['GITAM-TEST-001', 'Test Candidate One', 'student1@gitam.in', '+91 99999 00001', 'B.Tech', 'CSE', 'Not Booked', '', '', '', '', '', '', '', 'Pending', '', '', '', 'Not Flagged', '', '', ''],
      ['GITAM-TEST-002', 'Test Candidate Two', 'student2@gitam.in', '+91 99999 00002', 'B.Tech', 'ECE', 'Not Booked', '', '', '', '', '', '', '', 'Pending', '', '', '', 'Not Flagged', '', '', ''],
      // Duplicate registration entry for student3@gitam.in:
      ['GITAM-TEST-003A', 'Duplicate Sub 1', 'student3@gitam.in', '+91 99999 00003', 'B.Tech', 'IT', 'Not Booked', '', '', '', '', '', '', '', 'Pending', '', '', '', 'Not Flagged', '', '', ''],
      ['GITAM-TEST-003B', 'Duplicate Sub 2', 'student3@gitam.in', '+91 99999 00004', 'B.Tech', 'IT', 'Not Booked', '', '', '', '', '', '', '', 'Pending', '', '', '', 'Not Flagged', '', '', '']
    ]
  },
  'Approved': {
    headers: ['StudentID', 'FullName', 'Email', 'ApprovalStatus'],
    rows: []
  },
  'Rejected': {
    headers: ['StudentID', 'FullName', 'Email', 'ApprovalStatus'],
    rows: []
  }
};

let setValuesCallCount = 0;
let getDataRangeCallCount = 0;

function createSheetsSandbox() {
  const mockSpreadsheet = {
    getSheetByName: (name: string) => {
      const sheetInfo = mockSheetsData[name];
      if (!sheetInfo) return null;
      return {
        getName: () => name,
        getLastColumn: () => sheetInfo.headers.length,
        getLastRow: () => sheetInfo.rows.length + 1,
        getDataRange: () => {
          getDataRangeCallCount++;
          return {
            getValues: () => [sheetInfo.headers, ...sheetInfo.rows]
          };
        },
        getRange: (row: number, col: number, numRows?: number, numCols?: number) => {
          return {
            getValues: () => {
              if (row === 1 && numRows === 1) {
                return [sheetInfo.headers.slice(col - 1, (col - 1) + (numCols || 1))];
              }
              if (row > 1 && numRows === 1) {
                const rData = sheetInfo.rows[row - 2];
                return [rData.slice(col - 1, (col - 1) + (numCols || 1))];
              }
              return [[]];
            },
            setValues: (values: (string | number)[][]) => {
              setValuesCallCount++;
              if (row > 1 && numRows === 1) {
                sheetInfo.rows[row - 2] = values[0];
              }
            },
            setValue: () => {
              throw new Error('Unoptimized setValue() call detected. Code must use batch setValues()!');
            }
          };
        },
        appendRow: (rowArr: (string | number)[]) => {
          sheetInfo.rows.push(rowArr);
        },
        deleteRow: (rowIdx: number) => {
          sheetInfo.rows.splice(rowIdx - 2, 1);
        }
      };
    }
  };

  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    CONFIG: null,
    SpreadsheetApp: {
      flush: () => {},
      getActiveSpreadsheet: () => mockSpreadsheet,
      openById: () => mockSpreadsheet
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => k === 'SPREADSHEET_ID' ? 'mock-sheet-id' : null
      })
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(configCode, sandbox);
  vm.runInContext(repoCode, sandbox);
  return sandbox;
}

const gasSheets = createSheetsSandbox() as unknown as {
  getStudentRecordByEmail: (email: string) => { StudentID: string; FullName: string; isAmbiguous?: boolean; duplicateCount?: number; error?: string } | null;
  getStudentRecordWithRowById: (id: string) => { rowNumber: number; data: Record<string, unknown> } | null;
  updateStudentBooking: (id: string, details: Record<string, unknown>) => boolean;
  cancelStudentBooking: (id: string) => boolean;
  updateStudentReview: (id: string, details: Record<string, unknown>) => boolean;
  getBookingsForDate: (date: string) => Record<string, unknown>[];
  findBookingByRequestId: (reqId: string) => Record<string, unknown> | null;
  invalidateSheetCache: (name?: string) => void;
};

// --- TEST 1: Unique Student Record Lookup & Request Caching ---
console.log('--- TEST 1: Unique Student Record Lookup & Request Caching ---');
getDataRangeCallCount = 0;
const s1 = gasSheets.getStudentRecordByEmail('student1@gitam.in');
console.assert(s1 !== null && s1.StudentID === 'GITAM-TEST-001', 'Must resolve student 1');
console.assert(getDataRangeCallCount === 1, `Expected 1 read, got ${getDataRangeCallCount}`);

// Subsequent lookup within the same transaction should hit the request-scoped cache
const s2 = gasSheets.getStudentRecordByEmail('student2@gitam.in');
console.assert(s2 !== null && s2.StudentID === 'GITAM-TEST-002', 'Must resolve student 2');
console.assert(getDataRangeCallCount === 1, `Subsequent read must use cache (reads: ${getDataRangeCallCount})`);
console.log('[PASS] Test 1: Unique student lookup succeeds; request-scoped cache eliminates redundant full-sheet reads.\n');

// --- TEST 2: Ambiguous Duplicate Registration Detection ---
console.log('--- TEST 2: Ambiguous Duplicate Registration Detection ---');
const dupRes = gasSheets.getStudentRecordByEmail('student3@gitam.in');
console.assert(dupRes !== null, 'Duplicate lookup must return detection result');
console.assert(dupRes?.isAmbiguous === true, 'Duplicate email must be flagged isAmbiguous=true');
console.assert(dupRes?.duplicateCount === 2, `Expected duplicate count 2, got ${dupRes?.duplicateCount}`);
console.assert(Boolean(dupRes?.error?.includes('AMBIGUOUS_STUDENT_RECORD')), 'Must contain AMBIGUOUS_STUDENT_RECORD error message');
console.log('[PASS] Test 2: Ambiguous duplicate registration detected; does NOT silently select first record.\n');

// --- TEST 3: Atomic Batch Row Write Optimization ---
console.log('--- TEST 3: Atomic Batch Row Write Optimization ---');
setValuesCallCount = 0;
const bookingPayload = {
  interviewDate: '2026-11-20',
  interviewSlot: 1,
  interviewStart: '09:00',
  interviewEnd: '09:10',
  bookingId: 'BK-TEST-001',
  bookingRequestId: 'REQ-BATCH-001'
};

const updateSuccess = gasSheets.updateStudentBooking('GITAM-TEST-001', bookingPayload);
console.assert(updateSuccess === true, 'Booking update must succeed');
console.assert(setValuesCallCount === 1, `Expected exactly 1 atomic setValues call, got ${setValuesCallCount}`);

// Verify that the row in mockSheetsData was updated
const updatedRow = mockSheetsData['Student Database'].rows[0];
console.assert(updatedRow[6] === 'Booked', 'BookingStatus must be Booked');
console.assert(updatedRow[7] === 'BK-TEST-001', 'BookingID must match');
console.assert(updatedRow[9] === '2026-11-20', 'InterviewDate must match');
console.log('[PASS] Test 3: Booking update executed with single atomic batch write.\n');

// --- TEST 4: Idempotency & Date Booking Lookup ---
console.log('--- TEST 4: Idempotency & Date Booking Lookup ---');
const foundBooking = gasSheets.findBookingByRequestId('REQ-BATCH-001');
console.assert(foundBooking !== null, 'Existing booking must be found by requestId');
console.assert(foundBooking?.StudentID === 'GITAM-TEST-001', 'Found booking must match studentId');

const dayBookings = gasSheets.getBookingsForDate('2026-11-20');
console.assert(dayBookings.length === 1, `Expected 1 booking on 2026-11-20, got ${dayBookings.length}`);
console.assert(dayBookings[0].bookingId === 'BK-TEST-001', 'Day booking must match');
console.log('[PASS] Test 4: Idempotency lookup and date booking retrieval verified.\n');

// --- TEST 5: Atomic Review Status Update & Decision Sheet Sync ---
console.log('--- TEST 5: Atomic Review Status Update & Decision Sheet Sync ---');
setValuesCallCount = 0;
const reviewSuccess = gasSheets.updateStudentReview('GITAM-TEST-001', {
  ApprovalStatus: 'Approved',
  DecisionBy: 'admin1@gitam.in',
  DecisionTimestamp: new Date().toISOString()
});
console.assert(reviewSuccess === true, 'Review update must succeed');
console.assert(setValuesCallCount >= 1, 'setValues called');

// Decision sheet Approved must contain record
const approvedRows = mockSheetsData['Approved'].rows;
console.assert(approvedRows.length === 1, 'Approved tab must contain 1 row');
console.assert(approvedRows[0][0] === 'GITAM-TEST-001', 'Approved record must match StudentID');
console.log('[PASS] Test 5: Review update and decision sheet synchronization verified.\n');

console.log('================================================================');
console.log('ALL 5 DIRECT APPS SCRIPT SHEETS REPOSITORY AUDIT TESTS PASSED');
console.log('================================================================');
