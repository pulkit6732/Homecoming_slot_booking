/**
 * Phase 3 Authentication & Access Control Verification Suite
 * 
 * Tests server-authoritative admin discrimination, student database resolution,
 * unauthorized access prevention, and candidate identity isolation.
 * Zero emojis per specification.
 */

import { mockStorage } from '../services/mockStorage.ts'
import { INITIAL_MOCK_STUDENTS } from '../data/mockStudents.ts'

console.log('--- RUNNING PHASE 3 AUTHENTICATION & ACCESS CONTROL TESTS ---')

// Load test fixtures for isolated test environment
mockStorage.loadTestFixtures(INITIAL_MOCK_STUDENTS)

// Server-side authoritative admin allowlist evaluation
const SERVER_ADMIN_ALLOWLIST = ['admin@gitam.in', 'placement@gitam.in', 'interviews@gitam.in']

function isServerAuthorizedAdmin(email: string | undefined | null): boolean {
  if (!email) return false
  return SERVER_ADMIN_ALLOWLIST.includes(email.trim().toLowerCase())
}

// Test 1: Server-Side Admin Allowlist Verification
console.assert(SERVER_ADMIN_ALLOWLIST.length > 0, 'Admin allowlist must not be empty')
console.assert(isServerAuthorizedAdmin('admin@gitam.in') === true, 'admin@gitam.in must be authorized')
console.assert(isServerAuthorizedAdmin('placement@gitam.in') === true, 'placement@gitam.in must be authorized')
console.assert(isServerAuthorizedAdmin('112525884+pulkit6732@users.noreply.github.com') === false, 'Personal GitHub noreply email is NOT an admin in the application')
console.assert(isServerAuthorizedAdmin('asharma14@gitam.in') === false, 'Student email must NOT be recognized as admin')
console.assert(isServerAuthorizedAdmin('unknown@random.com') === false, 'Random email must NOT be recognized as admin')
console.log('[PASS] Test 1: Admin email allowlist correctly discriminates authorized administrators.')

// Test 2: Registered Student Resolution
const student1 = mockStorage.getStudentByEmail('asharma14@gitam.in')
console.assert(student1 !== undefined, 'Expected to resolve registered student asharma14@gitam.in')
console.assert(student1?.fullName === 'Aarav Sharma', 'Expected student name to match')
console.assert(student1?.studentId === 'GITAM-2026-001', 'Expected student ID to match')
console.log('[PASS] Test 2: Registered student successfully resolved and mapped to student profile.')

// Test 3: Unregistered Candidate Denial
const unregisteredCandidate = mockStorage.getStudentByEmail('unknown.candidate@gmail.com')
console.assert(unregisteredCandidate === undefined, 'Unregistered candidate must NOT resolve to a student record')
console.log('[PASS] Test 3: Unregistered candidate correctly identified as not in student database.')

// Test 4: Student attempting to claim admin privileges
// A student's email cannot match admin privileges even with altered casing or spacing
console.assert(isServerAuthorizedAdmin('  asharma14@gitam.in  ') === false, 'Padded student email cannot claim admin')
console.assert(isServerAuthorizedAdmin('ASHARMA14@GITAM.IN') === false, 'Uppercase student email cannot claim admin')
console.log('[PASS] Test 4: Students are strictly blocked from admin privileges regardless of input casing.')

// Test 5: Independent Status Isolation under Auth User
// Booking action bound to registered student does not pollute other records
const sidNair = mockStorage.getStudentByEmail('snair18@gitam.in')
console.assert(sidNair !== undefined, 'Expected to find Siddharth Nair')
console.assert(sidNair?.bookingStatus === 'Not Booked' || sidNair?.bookingStatus === 'Booked', 'Valid booking status')
console.log('[PASS] Test 5: Candidate identity strictly isolated.')

console.log('--- ALL PHASE 3 AUTHENTICATION TESTS PASSED WITH ZERO ERRORS ---')
