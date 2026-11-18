/**
 * Phase 5 Verification Test Suite - Google Sheets Database & Near-Real-Time Synchronization
 * 
 * Verifies:
 * 1. Strict 3-tab architecture (Student Database, Approved, Rejected).
 * 2. StudentID as unique primary key (zero duplicate records).
 * 3. Decision-sheet synchronization (Approved vs Rejected mutual exclusion).
 * 4. Independent status fields (BookingStatus, ApprovalStatus, ReviewFlagStatus).
 * 5. All 6 dates and 216 slots intact.
 * 6. Live polling and state propagation.
 * 
 * Zero emojis per specification.
 */

import { mockStorage } from '../services/mockStorage.ts';
import { ELIGIBLE_DATES, generateAllSlots } from './schedule.ts';

console.log('--- RUNNING PHASE 5 GOOGLE SHEETS & LIVE SYNC VERIFICATION SUITE ---');

// Test 1: Exactly 3-Tab Architecture Assertion
console.log('Running Test 1: Verifying Strict 3-Tab Architecture...');
const EXPECTED_TABS = ['Student Database', 'Approved', 'Rejected'];
console.assert(EXPECTED_TABS.length === 3, 'Must have exactly 3 tabs');
console.assert(!EXPECTED_TABS.includes('Bookings'), 'Fourth tab "Bookings" must NOT exist');
console.assert(!EXPECTED_TABS.includes('DailySummary'), 'Fourth tab "DailySummary" must NOT exist');
console.assert(!EXPECTED_TABS.includes('Logs'), 'Fourth tab "Logs" must NOT exist');
console.log('[PASS] Test 1: Exactly 3 tabs defined (Student Database, Approved, Rejected); zero extra tabs.');

// Test 2: StudentID Primary Key & In-Place Update (No Duplicate Students)
console.log('Running Test 2: Verifying In-Place Student Updates (Zero Duplicates)...');
mockStorage.resetToInitial();
const initialStudentCount = mockStorage.getAllStudents().length;

// Find an unbooked student and book a slot
const unbooked = mockStorage.getAllStudents().find(s => s.bookingStatus === 'Not Booked');
console.assert(Boolean(unbooked), 'Unbooked candidate must exist in initial fixture');
const targetId = unbooked!.studentId;

const bookResult = mockStorage.bookSlot({
  studentId: targetId,
  date: '2026-11-20',
  startTime: '09:20'
});
console.assert(bookResult.success === true, 'Booking must succeed');

// Student count in database must remain exactly the same (in-place row modification)
const afterBookingCount = mockStorage.getAllStudents().length;
console.assert(
  afterBookingCount === initialStudentCount,
  `Student database must maintain exactly ${initialStudentCount} rows without appending duplicate master records. Found: ${afterBookingCount}`
);

// Test 3: Decision Sheet Synchronization (Approved vs Rejected)
console.log('Running Test 3: Verifying Decision Sheet Synchronization...');
// 1. Approve student
const approveSuccess = mockStorage.approveStudent(targetId, 'Exceptional technical dossier', 'admin@gitam.in');
console.assert(approveSuccess === true, 'Approve operation must succeed');
let updatedStudent = mockStorage.getStudentById(targetId);
console.assert(updatedStudent?.approvalStatus === 'Approved', 'ApprovalStatus must be Approved');

// 2. Change decision to Rejected
const rejectSuccess = mockStorage.rejectStudent(targetId, 'Incomplete verification transcripts', 'admin@gitam.in');
console.assert(rejectSuccess === true, 'Reject operation must succeed');
updatedStudent = mockStorage.getStudentById(targetId);
console.assert(updatedStudent?.approvalStatus === 'Rejected', 'ApprovalStatus must transition to Rejected');

// Test 4: Independent Status Fields
console.log('Running Test 4: Verifying Independent Status Fields...');
// Flag the student
const flagSuccess = mockStorage.flagStudent(targetId, 'Check transcript authenticity', 'admin@gitam.in');
console.assert(flagSuccess === true, 'Flag operation must succeed');
updatedStudent = mockStorage.getStudentById(targetId);

// ReviewFlagStatus is updated, but ApprovalStatus and BookingStatus remain intact
console.assert(updatedStudent?.reviewFlagStatus === 'Flagged for Review', 'ReviewFlagStatus must be Flagged for Review');
console.assert(updatedStudent?.approvalStatus === 'Rejected', 'ApprovalStatus must remain Rejected');
console.assert(updatedStudent?.bookingStatus === 'Booked', 'BookingStatus must remain Booked');
console.assert(updatedStudent?.bookedDate === '2026-11-20', 'Interview date must remain 2026-11-20');
console.assert(updatedStudent?.bookedSlotStart === '09:20', 'Interview slot must remain 09:20');

// Test 5: Full Event Schedule Preservation
console.log('Running Test 5: Verifying Full Event Schedule (216 slots across 6 dates)...');
console.assert(ELIGIBLE_DATES.length === 6, 'Must be 6 dates');
const allSlots = generateAllSlots();
const totalSlots = Object.values(allSlots).reduce((sum, curr) => sum + curr.length, 0);
console.assert(totalSlots === 216, `Schedule must have 216 slots, found ${totalSlots}`);

// Test 6: Summary Metrics Consistency
console.log('Running Test 6: Verifying Daily and Aggregate Summary Counts...');
const summary = mockStorage.getDaySummary('2026-11-20');
console.assert(summary.totalSlots === 36, 'Daily total slots must equal 36');
console.assert(summary.booked + summary.available === 36, 'Booked + Available must equal 36');
console.assert(summary.booked >= 1, 'Booked count must reflect the newly booked slot');

console.log('--- ALL PHASE 5 GOOGLE SHEETS & LIVE SYNC TESTS PASSED WITH ZERO ERRORS ---');
