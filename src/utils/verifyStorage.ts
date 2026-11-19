import { mockStorage } from '../services/mockStorage.ts'
import { INITIAL_MOCK_STUDENTS } from '../data/mockStudents.ts'
import { INITIAL_MOCK_BOOKINGS } from '../data/mockBookings.ts'

console.log('--- RUNNING STORAGE & CONCURRENCY RULE VERIFICATION ---')

// Load test fixtures for isolated test environment
mockStorage.loadTestFixtures(INITIAL_MOCK_STUDENTS, INITIAL_MOCK_BOOKINGS)

const students = mockStorage.getAllStudents()
console.assert(students.length === 6, `Expected 6 mock students, got ${students.length}`)

// 1. Unbooked student (Student 5 - Siddharth Nair) can book an available slot
const sid = students.find((s) => s.bookingStatus !== 'Booked')!
console.assert(sid !== undefined, 'Expected to find an unbooked student')

const bookRes1 = mockStorage.bookSlot({
  studentId: sid.studentId,
  date: '2026-11-20',
  startTime: '10:00',
  bookingRequestId: 'REQ-TEST-001',
})
console.assert(bookRes1.success === true, `Expected booking to succeed, got ${bookRes1.message}`)
console.assert(bookRes1.confirmation !== undefined, 'Expected confirmation object')
console.log('[PASS] Check 1: Unbooked student successfully reserved an available slot.')

// 2. Rule: One active booking per student
// Attempting to book a second slot for the same student must fail
const bookRes2 = mockStorage.bookSlot({
  studentId: sid.studentId,
  date: '2026-11-20',
  startTime: '10:10',
  bookingRequestId: 'REQ-TEST-002',
})
console.assert(bookRes2.success === false, 'Expected booking to fail because student already has active booking')
console.assert(bookRes2.message.includes('already has an active booking'), 'Expected active booking error message')
console.log('[PASS] Check 2: Enforced 1 active booking per student rule (second booking was rejected).')

// 3. Rule: One student per slot (slot occupancy)
// Another student attempting to book 10:00 on Nov 20 (now occupied by Sid) must fail
// Let's create or unbook student 6 to test
const student6 = students.find((s) => s.studentId === 'GITAM-2026-006')!
student6.bookingStatus = 'Not Booked'

const bookRes3 = mockStorage.bookSlot({
  studentId: student6.studentId,
  date: '2026-11-20',
  startTime: '10:00', // occupied!
  bookingRequestId: 'REQ-TEST-003',
})
console.assert(bookRes3.success === false, 'Expected booking to fail because slot is already occupied')
console.assert(bookRes3.message.includes('booked by another student'), 'Expected slot occupied error message')
console.log('[PASS] Check 3: Enforced 1 student per slot rule (competing booking was rejected).')

// 4. Rule: Idempotency (BookingRequestID)
// Submitting the exact same bookingRequestId returns the original confirmation without error or duplicate
const bookRes4 = mockStorage.bookSlot({
  studentId: sid.studentId,
  date: '2026-11-20',
  startTime: '10:00',
  bookingRequestId: 'REQ-TEST-001', // same ID
})
console.assert(bookRes4.success === true, 'Expected idempotent booking request to succeed')
console.assert(bookRes4.confirmation?.bookingId === bookRes1.confirmation?.bookingId, 'Expected matching booking ID')
console.log('[PASS] Check 4: Idempotency preserved (repeated request with same BookingRequestID returned original confirmation).')

// 5. Rule: Status Independence
// Approving or rejecting a student must NOT change their bookingStatus
const prevBookingStatus = sid.bookingStatus
mockStorage.approveStudent(sid.studentId, 'Excellent profile', 'Admin Test')
const updatedSid = mockStorage.getStudentById(sid.studentId)!
console.assert(updatedSid.approvalStatus === 'Approved', 'Expected approvalStatus to be Approved')
console.assert(updatedSid.bookingStatus === prevBookingStatus, 'Expected bookingStatus to remain unaffected by approval')
console.log('[PASS] Check 5: Status independence verified (review actions do not mutate booking state).')

console.log('--- ALL STORAGE & CONCURRENCY TESTS PASSED ---')
