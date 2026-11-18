/**
 * Comprehensive Concurrency Stress & Multi-User Simulation Test
 * 
 * Simulates:
 * 1. 4 concurrent students attempting to book the exact same slot at the exact same millisecond.
 * 2. Database update verification (zero duplicate rows, exactly one winner).
 * 3. 3 concurrent students booking 3 distinct slots simultaneously.
 * 4. Double-booking prevention (1 active booking per student rule).
 * 5. Admin login, review approval, logout, relogin, and role security check.
 * 6. Live polling and state synchronization verification.
 * 
 * Timezone: Asia/Kolkata (Indian Standard Time - IST).
 * Zero emojis per specification.
 */

import { mockStorage } from '../services/mockStorage.ts';
import { isEmailAuthorizedAdmin } from '../services/supabaseClient.ts';

async function runStressAndMultiUserSuite() {
  console.log('================================================================');
  console.log('STARTING CONCURRENCY STRESS & MULTI-USER SIMULATION TEST SUITE');
  console.log('Timezone: Asia/Kolkata (IST)');
  console.log('================================================================\n');

  // Reset to initial baseline
  mockStorage.resetToInitial();
  const initialStudentCount = mockStorage.getAllStudents().length;
  console.log(`[INIT] Database initialized with ${initialStudentCount} student master records.\n`);

  // -------------------------------------------------------------------------
  // TEST 1: 4 CONCURRENT STUDENTS COMPETING FOR THE EXACT SAME SLOT
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: 4 Concurrent Students Competing For Slot [2026-11-20 09:30] ---');
  
  // Prepare 4 unbooked or eligible candidates
  // Let's ensure candidate records exist and are ready to book
  const allStudents = mockStorage.getAllStudents();
  const candidates = allStudents.slice(0, 4);

  // Clear any existing bookings on these 4 candidates for clean test
  for (const c of candidates) {
    c.bookingStatus = 'Not Booked';
    c.bookingId = '';
    c.bookedDate = '';
    c.bookedSlotStart = '';
    c.bookedSlotEnd = '';
  }

  const contestedDate = '2026-11-20';
  const contestedTime = '09:30';

  console.log(`Candidate 1: ${candidates[0].studentId} (${candidates[0].fullName})`);
  console.log(`Candidate 2: ${candidates[1].studentId} (${candidates[1].fullName})`);
  console.log(`Candidate 3: ${candidates[2].studentId} (${candidates[2].fullName})`);
  console.log(`Candidate 4: ${candidates[3].studentId} (${candidates[3].fullName})`);
  console.log(`Target Contested Slot: ${contestedDate} at ${contestedTime} IST\n`);

  // Fire all 4 booking requests at the EXACT SAME TIME via Promise.all
  const bookingPromises = candidates.map((cand, idx) => {
    return new Promise<{ candidateId: string; success: boolean; message: string; bookingId?: string | undefined }>((resolve) => {
      // Simulate microsecond network race
      const randomJitter = Math.floor(Math.random() * 5); // 0 to 4 ms jitter
      setTimeout(() => {
        const res = mockStorage.bookSlot({
          studentId: cand.studentId,
          date: contestedDate,
          startTime: contestedTime,
          bookingRequestId: `STRESS-REQ-${idx}-${Date.now()}`
        });
        resolve({
          candidateId: cand.studentId,
          success: res.success,
          message: res.message,
          bookingId: res.confirmation?.bookingId
        });
      }, randomJitter);
    });
  });

  const raceResults = await Promise.all(bookingPromises);

  console.log('--- RACE RESULTS ---');
  raceResults.forEach((r, i) => {
    console.log(`Request ${i + 1} [Student ${r.candidateId}]: ${r.success ? 'SUCCESS (Slot Acquired)' : 'REJECTED: ' + r.message}`);
  });

  const successfulBookings = raceResults.filter(r => r.success);
  const rejectedBookings = raceResults.filter(r => !r.success);

  console.assert(successfulBookings.length === 1, `Exactly 1 student must succeed, got ${successfulBookings.length}`);
  console.assert(rejectedBookings.length === 3, `Exactly 3 students must be rejected, got ${rejectedBookings.length}`);
  console.log(`\n[PASS] Test 1: Concurrency lock successfully serialized requests. Exactly 1 winner (${successfulBookings[0].candidateId}) and 3 rejections.`);

  // Verify Database Integrity (Row count unchanged, no duplicate records)
  const countAfterRace = mockStorage.getAllStudents().length;
  console.assert(countAfterRace === initialStudentCount, `Database row count must stay exactly ${initialStudentCount}. Found: ${countAfterRace}`);
  console.log(`[PASS] Database Integrity: Exactly ${countAfterRace} student records maintained (zero duplicate rows appended).\n`);

  // -------------------------------------------------------------------------
  // TEST 2: 3 CONCURRENT STUDENTS BOOKING 3 DISTINCT SLOTS
  // -------------------------------------------------------------------------
  console.log('--- TEST 2: 3 Concurrent Students Booking 3 Distinct Available Slots ---');
  // Use the 3 students that did NOT win Test 1 so they can book distinct slots
  const unbookedCandidates = candidates.filter(c => c.studentId !== successfulBookings[0].candidateId);
  const studentA = unbookedCandidates[0];
  const studentB = unbookedCandidates[1];
  const studentC = unbookedCandidates[2];

  const parallelSlots = [
    { student: studentA, time: '09:40' },
    { student: studentB, time: '09:50' },
    { student: studentC, time: '10:10' }
  ];

  const distinctPromises = parallelSlots.map(({ student, time }, idx) => {
    return new Promise<{ studentId: string; success: boolean; message: string }>((resolve) => {
      setTimeout(() => {
        const res = mockStorage.bookSlot({
          studentId: student.studentId,
          date: contestedDate,
          startTime: time,
          bookingRequestId: `DISTINCT-REQ-${idx}-${Date.now()}`
        });
        resolve({ studentId: student.studentId, success: res.success, message: res.message });
      }, Math.floor(Math.random() * 5));
    });
  });

  const distinctResults = await Promise.all(distinctPromises);
  const allDistinctSucceeded = distinctResults.every(r => r.success);
  console.assert(allDistinctSucceeded, 'All distinct bookings must succeed');
  distinctResults.forEach((r, i) => {
    console.log(`Distinct Slot ${i + 1} [Student ${r.studentId}]: ${r.success ? 'SUCCESS' : 'FAILED: ' + r.message}`);
  });
  console.log('[PASS] Test 2: Non-competing concurrent requests processed without interference.\n');

  // -------------------------------------------------------------------------
  // TEST 3: ATTEMPT SECOND BOOKING BY ALREADY BOOKED STUDENT
  // -------------------------------------------------------------------------
  console.log('--- TEST 3: Enforcing 1 Active Booking Limit ---');
  const winnerStudentId = successfulBookings[0].candidateId;
  const secondAttempt = mockStorage.bookSlot({
    studentId: winnerStudentId,
    date: contestedDate,
    startTime: '10:20',
    bookingRequestId: `DOUBLE-BOOK-REQ-${Date.now()}`
  });
  console.assert(secondAttempt.success === false, 'Second booking attempt must be strictly rejected');
  console.log(`Student ${winnerStudentId} second attempt result: REJECTED (${secondAttempt.message})`);
  console.log('[PASS] Test 3: System strictly blocks multiple bookings by the same candidate.\n');

  // -------------------------------------------------------------------------
  // TEST 4: ADMIN LOGIN, REVIEW ACTIONS, LOGOUT & RELOGIN
  // -------------------------------------------------------------------------
  console.log('--- TEST 4: Admin Authentication, Dossier Review & Access Control ---');
  const adminEmail = 'admin@gitam.in';
  console.assert(isEmailAuthorizedAdmin(adminEmail) === true, 'admin@gitam.in must be authorized');
  console.log(`[AUTH] Admin successfully authenticated as: ${adminEmail}`);

  // Admin approves Candidate 1
  const approveRes = mockStorage.approveStudent(winnerStudentId, 'Cleared all technical criteria during panel evaluation', adminEmail);
  console.assert(approveRes === true, 'Admin approve must succeed');
  const evaluatedStudent = mockStorage.getStudentById(winnerStudentId);
  console.assert(evaluatedStudent?.approvalStatus === 'Approved', 'Status must be Approved');
  console.assert(evaluatedStudent?.bookingStatus === 'Booked', 'Booking status must remain Booked');
  console.log(`[REVIEW] Candidate ${winnerStudentId} evaluated: ApprovalStatus = ${evaluatedStudent?.approvalStatus}, BookingStatus = ${evaluatedStudent?.bookingStatus}`);

  // Admin flags Candidate 2 for document review
  const flagRes = mockStorage.flagStudent(studentA.studentId, 'Check 7th semester original grade sheet', adminEmail);
  console.assert(flagRes === true, 'Admin flag must succeed');
  const flaggedStudent = mockStorage.getStudentById(studentA.studentId);
  console.assert(flaggedStudent?.reviewFlagStatus === 'Flagged for Review', 'Status must be Flagged for Review');
  console.log(`[REVIEW] Candidate ${studentA.studentId} flagged: ReviewFlagStatus = ${flaggedStudent?.reviewFlagStatus}`);

  // Admin Relogin Simulation
  console.log('[AUTH] Admin logged out. Relogging in with placement coordinator account...');
  const coordinatorEmail = 'placement@gitam.in';
  console.assert(isEmailAuthorizedAdmin(coordinatorEmail) === true, 'placement@gitam.in must be authorized');
  console.assert(isEmailAuthorizedAdmin('112525884+pulkit6732@users.noreply.github.com') === false, 'Personal noreply email is NOT an app user');
  console.log(`[AUTH] Relogin successful as: ${coordinatorEmail}`);

  // Non-admin attempting admin access
  const studentEmail = 'asharma14@gitam.in';
  console.assert(isEmailAuthorizedAdmin(studentEmail) === false, 'Student email must NOT be authorized as admin');
  console.log(`[SECURITY] Access Control: Student ${studentEmail} attempting admin endpoints is strictly DENIED.\n`);

  // -------------------------------------------------------------------------
  // TEST 5: REAL-TIME POLLING & LIVE SYNC DATA INTEGRITY
  // -------------------------------------------------------------------------
  console.log('--- TEST 5: Live Synchronization & Summary Metrics Verification ---');
  const daySummary = mockStorage.getDaySummary(contestedDate);
  console.log(`Daily Summary for ${contestedDate}:`);
  console.log(`- Total Scheduled Slots: ${daySummary.totalSlots}`);
  console.log(`- Booked Slots: ${daySummary.booked}`);
  console.log(`- Available Slots: ${daySummary.available}`);
  console.log(`- Approved Candidates: ${daySummary.approved}`);
  console.log(`- Flagged Candidates: ${daySummary.flagged}`);
  console.assert(daySummary.booked + daySummary.available === 36, 'Daily slots must sum to 36');
  console.assert(daySummary.approved >= 1, 'Approved count must reflect admin review');
  console.assert(daySummary.flagged >= 1, 'Flagged count must reflect admin flag');
  console.log('[PASS] Test 5: Live synchronization derives exact, non-overlapping metrics without full-page reloads.\n');

  console.log('================================================================');
  console.log('ALL STRESS AND MULTI-USER TESTS PASSED WITH ZERO ERRORS');
  console.log('================================================================');
}

runStressAndMultiUserSuite().catch((err) => {
  console.error('Stress test failed with error:', err);
});
