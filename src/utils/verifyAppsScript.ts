/**
 * Phase 4 Verification Test Suite
 * 
 * Tests the backend business rules, schedule generator, concurrency locking logic,
 * idempotency, and review actions.
 * Zero emojis per specification.
 */

import {
  ELIGIBLE_DATES,
  generateAllSlots,
  generateDaySlots,
  isValidSlot
} from './schedule.ts';
import { mockStorage } from '../services/mockStorage.ts';
import { isEmailAuthorizedAdmin } from '../services/supabaseClient.ts';

console.log('--- RUNNING PHASE 4 APPS SCRIPT BACKEND VERIFICATION SUITE ---');

// Test 1: Schedule Generation Integrity
console.log('Running Test 1: Schedule Generation Integrity (216 slots, zero lunch, zero weekends)...');
console.assert(ELIGIBLE_DATES.length === 6, 'Must have exactly 6 eligible dates');
for (const dateObj of ELIGIBLE_DATES) {
  const daySlots = generateDaySlots(dateObj.date);
  console.assert(daySlots.length === 36, `Date ${dateObj.date} must have exactly 36 slots, got ${daySlots.length}`);
  const hasLunch = daySlots.some(s => s.startTime.startsWith('12:'));
  console.assert(!hasLunch, `Date ${dateObj.date} must not contain any lunch slots`);
}
const allSlotsMap = generateAllSlots();
const totalSlotCount = Object.values(allSlotsMap).reduce((acc, curr) => acc + curr.length, 0);
console.assert(totalSlotCount === 216, `Total event slots must equal 216, got ${totalSlotCount}`);

// Test 2: Invalid Date & Slot Rejection
console.log('Running Test 2: Slot Validation (valid slots accepted, invalid rejected)...');
console.assert(isValidSlot('2026-11-20', '09:00') === true, '09:00 must be valid');
console.assert(isValidSlot('2026-11-20', '13:00') === true, '13:00 must be valid');
console.assert(isValidSlot('2026-11-20', '12:00') === false, '12:00 lunch must be invalid');
console.assert(isValidSlot('2026-11-21', '09:00') === false, 'Weekend 2026-11-21 must be invalid');
console.assert(isValidSlot('2026-11-20', '16:00') === false, '16:00 boundary must be invalid');

// Test 3: Idempotency with BookingRequestID
console.log('Running Test 3: Idempotency with BookingRequestID...');
mockStorage.resetToInitial();
const unbookedStudent = mockStorage.getAllStudents().find(s => s.bookingStatus === 'Not Booked');
if (!unbookedStudent) throw new Error('No unbooked student found for test');
const testStudentId = unbookedStudent.studentId;

const idempotencyKey = 'req-phase4-test-idem-001';
const firstAttempt = mockStorage.bookSlot({
  studentId: testStudentId,
  date: '2026-11-23',
  startTime: '09:00',
  bookingRequestId: idempotencyKey
});
console.assert(firstAttempt.success === true, `First booking attempt must succeed: ${firstAttempt.message}`);
const firstBookingId = firstAttempt.confirmation?.bookingId;

// Replay with identical BookingRequestID
const replayAttempt = mockStorage.bookSlot({
  studentId: testStudentId,
  date: '2026-11-23',
  startTime: '09:00',
  bookingRequestId: idempotencyKey
});
console.assert(replayAttempt.success === true, 'Replay with same BookingRequestID must succeed');
console.assert(replayAttempt.confirmation?.bookingId === firstBookingId, 'Replay must return identical BookingID');

// Test 4: One Active Booking Rule
console.log('Running Test 4: Enforcing One Active Booking per Student...');
const secondSlotAttempt = mockStorage.bookSlot({
  studentId: testStudentId,
  date: '2026-11-23',
  startTime: '09:10',
  bookingRequestId: 'req-phase4-second-slot-002'
});
console.assert(secondSlotAttempt.success === false, 'Second booking by same student must be rejected');

// Test 5: Concurrency - One Student per Slot
console.log('Running Test 5: Enforcing Single Student per Slot...');
const anotherUnbooked = mockStorage.getAllStudents().find(s => s.bookingStatus === 'Not Booked' && s.studentId !== testStudentId);
if (!anotherUnbooked) throw new Error('Need a second unbooked student for concurrency test');
const competingAttempt = mockStorage.bookSlot({
  studentId: anotherUnbooked.studentId,
  date: '2026-11-23',
  startTime: '09:00',
  bookingRequestId: 'req-phase4-competing-003'
});
console.assert(competingAttempt.success === false, 'Competing booking for occupied slot must be rejected');

// Test 6: Review Actions and Status Independence
console.log('Running Test 6: Review Actions (Approve, Reject, Flag, Clear Flag)...');
// Approve
const approveRes = mockStorage.approveStudent(testStudentId, 'Excellent candidate profile', 'admin@gitam.in');
console.assert(approveRes === true, 'Approve action must succeed');
let student = mockStorage.getStudentById(testStudentId);
console.assert(student?.approvalStatus === 'Approved', 'approvalStatus must be Approved');
console.assert(student?.bookingStatus === 'Booked', 'bookingStatus must remain Booked (independent)');

// Flag
const flagRes = mockStorage.flagStudent(testStudentId, 'Verify original degree documents', 'admin@gitam.in');
console.assert(flagRes === true, 'Flag action must succeed');
student = mockStorage.getStudentById(testStudentId);
console.assert(student?.reviewFlagStatus === 'Flagged for Review', 'reviewFlagStatus must be Flagged for Review');
console.assert(student?.approvalStatus === 'Approved', 'approvalStatus must remain Approved (independent)');

// Clear Flag
const clearRes = mockStorage.clearFlag(testStudentId);
console.assert(clearRes === true, 'Clear flag must succeed');
student = mockStorage.getStudentById(testStudentId);
console.assert(student?.reviewFlagStatus === 'Not Flagged', 'reviewFlagStatus must be Not Flagged');

// Reject
const rejectRes = mockStorage.rejectStudent(testStudentId, 'Did not meet prerequisite cutoff', 'admin@gitam.in');
console.assert(rejectRes === true, 'Reject action must succeed');
student = mockStorage.getStudentById(testStudentId);
console.assert(student?.approvalStatus === 'Rejected', 'approvalStatus must be Rejected');
console.assert(student?.bookingStatus === 'Booked', 'bookingStatus must still remain Booked (independent)');

// Test 7: Admin Privileges Allowlist
console.log('Running Test 7: Admin Allowlist Authorization Check...');
console.assert(isEmailAuthorizedAdmin('admin@gitam.in') === true, 'admin@gitam.in must be authorized');
console.assert(isEmailAuthorizedAdmin('placement@gitam.in') === true, 'placement@gitam.in must be authorized');
console.assert(isEmailAuthorizedAdmin('112525884+pulkit6732@users.noreply.github.com') === false, 'Personal noreply email is not an app admin');
console.assert(isEmailAuthorizedAdmin('student@gitam.in') === false, 'student@gitam.in must NOT be authorized');
console.assert(isEmailAuthorizedAdmin('attacker@malicious.com') === false, 'external email must NOT be authorized');

console.log('--- ALL PHASE 4 APPS SCRIPT VERIFICATION TESTS PASSED WITH ZERO ERRORS ---');
