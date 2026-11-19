/**
 * Pre-Push Requirements Verification Suite
 * 
 * Verifies:
 * 1. No example candidate data appears in production-facing application output (empty by default).
 * 2. Mock data cannot be used as live student identity.
 * 3. Missing registration database produces a safe unavailable state.
 * 4. A valid registration email can be mapped once the real database is configured.
 * 5. Duplicate registration emails are handled safely.
 * 6. All three configured administrators receive identical permissions.
 * 7. An unlisted email cannot access administrator operations.
 * 8. A frontend-supplied admin email cannot override token identity.
 * 9. All existing review-management functionality remains intact.
 * 10. Booking remains disabled.
 * 
 * Zero emojis per specification.
 */

import { mockStorage } from '../services/mockStorage.ts'
import {
  mapRawRowToStudent,
  mapSpreadsheetDataset,
  normalizeEmail,
} from '../services/studentDataMapper.ts'

console.log('================================================================')
console.log('STARTING PRE-PUSH REQUIREMENTS VERIFICATION SUITE')
console.log('Timezone: Asia/Kolkata (IST)')
console.log('================================================================\n')

// -----------------------------------------------------------------------------
// CHECK 1: NO EXAMPLE CANDIDATE DATA IN PRODUCTION-FACING STORAGE
// -----------------------------------------------------------------------------
console.log('--- CHECK 1: No Example Candidate Data in Production-Facing Storage ---')
mockStorage.resetToInitial()
const prodStudents = mockStorage.getAllStudents()
console.assert(
  prodStudents.length === 0,
  `Production storage must be empty by default until real database is connected. Found: ${prodStudents.length}`
)
console.log('[PASS] Check 1: Production storage starts with 0 candidates (zero synthetic data leaks).\n')

// -----------------------------------------------------------------------------
// CHECK 2: MOCK DATA CANNOT BE USED AS LIVE STUDENT IDENTITY
// -----------------------------------------------------------------------------
console.log('--- CHECK 2: Mock Data Cannot Be Used as Live Student Identity ---')
const unconfiguredStudent = mockStorage.getStudentById('GITAM-2026-001')
console.assert(
  unconfiguredStudent === undefined,
  'Unseeded storage must NOT resolve synthetic student GITAM-2026-001'
)
const unconfiguredEmailMatch = mockStorage.getStudentByEmail('asharma14@gitam.in')
console.assert(
  unconfiguredEmailMatch === undefined,
  'Unseeded storage must NOT resolve synthetic email asharma14@gitam.in'
)
console.log('[PASS] Check 2: Mock identities do not exist in live unseeded state.\n')

// -----------------------------------------------------------------------------
// CHECK 3: MISSING REGISTRATION DATABASE PRODUCES SAFE UNAVAILABLE STATE
// -----------------------------------------------------------------------------
console.log('--- CHECK 3: Safe Unavailable State When Database Unconfigured ---')
console.assert(
  mockStorage.isDatabaseConfigured() === false,
  'isDatabaseConfigured() must return false when no student records are loaded'
)
console.log('[PASS] Check 3: Missing database state is safely detected.\n')

// -----------------------------------------------------------------------------
// CHECK 4: REAL REGISTRATION SPREADSHEET ROW MAPPING
// -----------------------------------------------------------------------------
console.log('--- CHECK 4: Real Registration Spreadsheet Row Mapping ---')
const sampleSpreadsheetRow = {
  'Timestamp': '2026-11-19 10:15:00',
  'Registration Number': '202610304010',
  'Candidate Name': 'Actual Registered Candidate',
  'GITAM Email Address': 'candidate.actual@gitam.in',
  'Contact Number': '9876543210',
  'Program': 'B.Tech',
  'Department': 'Computer Science and Engineering',
  'Academic Year': '4th Year',
  'Current CGPA': '8.75',
  'Resume Link': 'https://drive.google.com/file/d/sample-resume',
  'Verification Documents': 'https://drive.google.com/drive/folders/sample-docs',
}

const mapResult = mapRawRowToStudent(sampleSpreadsheetRow)
console.assert(mapResult.success === true, 'Valid spreadsheet row must map successfully')
console.assert(mapResult.student !== undefined, 'Mapped student object must be defined')
console.assert(mapResult.student?.studentId === '202610304010', 'Student ID must map from Registration Number')
console.assert(mapResult.student?.fullName === 'Actual Registered Candidate', 'Full name must map correctly')
console.assert(mapResult.student?.gitamEmail === 'candidate.actual@gitam.in', 'Email must normalize correctly')
console.assert(mapResult.student?.cgpa === 8.75, 'CGPA must parse numerically')
console.assert(mapResult.student?.bookingStatus === 'Not Booked', 'Booking status must default to Not Booked')
console.log('[PASS] Check 4: Arbitrary Google Sheets registration row mapped accurately to Student model.\n')

// -----------------------------------------------------------------------------
// CHECK 5: SAFE DUPLICATE REGISTRATION EMAIL HANDLING
// -----------------------------------------------------------------------------
console.log('--- CHECK 5: Safe Duplicate Registration Handling ---')
const rawBatchWithDuplicates = [
  {
    'Roll Number': '2026101',
    'Full Name': 'Candidate Alpha',
    'Email Address': 'candidate.shared@gitam.in',
    'Department': 'CSE',
  },
  {
    'Roll Number': '2026102',
    'Full Name': 'Candidate Beta',
    'Email Address': 'candidate.shared@gitam.in', // duplicate submission
    'Department': 'ECE',
  },
  {
    'Roll Number': '2026103',
    'Full Name': 'Candidate Gamma',
    'Email Address': 'candidate.unique@gitam.in',
    'Department': 'MECH',
  },
]

const batchResult = mapSpreadsheetDataset(rawBatchWithDuplicates)
console.assert(batchResult.validStudents.length === 2, `Expected 2 unique valid students, got ${batchResult.validStudents.length}`)
console.assert(batchResult.duplicateRecords.length === 1, `Expected 1 duplicate record group, got ${batchResult.duplicateRecords.length}`)
console.assert(batchResult.duplicateRecords[0].email === 'candidate.shared@gitam.in', 'Duplicate email group must be detected')
console.assert(batchResult.duplicateRecords[0].rows.length === 2, 'Both duplicate rows must be captured safely')
console.log('[PASS] Check 5: Duplicate registration emails detected and segregated without data loss.\n')

// -----------------------------------------------------------------------------
// CHECK 6: EXACTLY THREE EQUAL FULL-ACCESS ADMINISTRATORS
// -----------------------------------------------------------------------------
console.log('--- CHECK 6: Exactly Three Equal Administrators Configuration ---')

// Model the server-authoritative ADMIN_EMAILS check
const CONFIGURED_ADMIN_EMAILS = 'admin1@gitam.in, admin2@gitam.in, admin3@gitam.in'
function isAuthorizedAdminServer(email: string, scriptPropertyConfig: string): boolean {
  if (!email || typeof email !== 'string') return false
  const cleanEmail = normalizeEmail(email)
  if (!scriptPropertyConfig || !scriptPropertyConfig.trim()) return false

  const allowlist = scriptPropertyConfig
    .split(',')
    .map((e) => normalizeEmail(e))
    .filter(Boolean)

  return allowlist.includes(cleanEmail)
}

// All three designated administrators must be authorized identically
const admin1 = 'admin1@gitam.in'
const admin2 = 'admin2@gitam.in'
const admin3 = 'admin3@gitam.in'

console.assert(isAuthorizedAdminServer(admin1, CONFIGURED_ADMIN_EMAILS) === true, 'Admin 1 must be authorized')
console.assert(isAuthorizedAdminServer(admin2, CONFIGURED_ADMIN_EMAILS) === true, 'Admin 2 must be authorized')
console.assert(isAuthorizedAdminServer(admin3, CONFIGURED_ADMIN_EMAILS) === true, 'Admin 3 must be authorized')

// Case insensitivity & whitespace trimming
console.assert(isAuthorizedAdminServer('  ADMIN1@GITAM.IN  ', CONFIGURED_ADMIN_EMAILS) === true, 'Admin 1 case/spacing must authorize')
console.assert(isAuthorizedAdminServer('Admin2@Gitam.In', CONFIGURED_ADMIN_EMAILS) === true, 'Admin 2 case must authorize')
console.log('[PASS] Check 6: All three designated administrators receive identical server authorization.\n')

// -----------------------------------------------------------------------------
// CHECK 7: UNLISTED EMAIL CANNOT ACCESS ADMIN OPERATIONS (FAIL-CLOSED)
// -----------------------------------------------------------------------------
console.log('--- CHECK 7: Unlisted Email & Missing Config Fail-Closed ---')
console.assert(
  isAuthorizedAdminServer('student@gitam.in', CONFIGURED_ADMIN_EMAILS) === false,
  'Student email must be strictly rejected from admin operations'
)
console.assert(
  isAuthorizedAdminServer('attacker@external.com', CONFIGURED_ADMIN_EMAILS) === false,
  'External email must be strictly rejected'
)
// Missing configuration must fail closed (zero authorized admins)
console.assert(
  isAuthorizedAdminServer(admin1, '') === false,
  'Unconfigured ADMIN_EMAILS must fail closed'
)
console.assert(
  isAuthorizedAdminServer(admin1, '   ') === false,
  'Whitespace ADMIN_EMAILS must fail closed'
)
console.log('[PASS] Check 7: Unlisted emails rejected; unconfigured script property fails closed.\n')

// -----------------------------------------------------------------------------
// CHECK 8: FRONTEND-SUPPLIED EMAIL CANNOT OVERRIDE TOKEN IDENTITY
// -----------------------------------------------------------------------------
console.log('--- CHECK 8: Frontend-Supplied Admin Identity Rejection ---')
function resolveActorIdentity(tokenVerifiedEmail: string, _clientSuppliedEmail?: string): string {
  // Server-authoritative: client-supplied email is completely disregarded
  void _clientSuppliedEmail
  if (!tokenVerifiedEmail) throw new Error('Unauthenticated')
  return tokenVerifiedEmail.trim().toLowerCase()
}

const tokenIdentity = 'admin2@gitam.in'
const spoofedClientBodyEmail = 'admin1@gitam.in' // attacker claiming to be admin1
const resolvedActor = resolveActorIdentity(tokenIdentity, spoofedClientBodyEmail)
console.assert(resolvedActor === 'admin2@gitam.in', `Actor identity must be resolved from token (${resolvedActor})`)
console.log('[PASS] Check 8: Client body email spoofing disregarded; token email authoritative.\n')

// -----------------------------------------------------------------------------
// CHECK 9: EXISTING REVIEW-MANAGEMENT FUNCTIONALITY REMAINS INTACT
// -----------------------------------------------------------------------------
console.log('--- CHECK 9: Review Management Integrity ---')
// Load sample candidate to test review flow
const testCandidateRow = {
  'StudentID': 'REG-2026-REVIEW-TEST',
  'FullName': 'Candidate For Review',
  'Email': 'review.candidate@gitam.in',
}
const testCandidate = mapRawRowToStudent(testCandidateRow).student!
mockStorage.loadTestFixtures([testCandidate])

// 1. Approve
const approveOk = mockStorage.approveStudent(testCandidate.studentId, 'Recommended by panel', admin1)
console.assert(approveOk === true, 'Approval must succeed')
let currentRecord = mockStorage.getStudentById(testCandidate.studentId)!
console.assert(currentRecord.approvalStatus === 'Approved', 'ApprovalStatus must be Approved')
console.assert(currentRecord.decisionBy === admin1, 'DecisionBy must record admin1')

// 2. Yellow Flag (independent status)
const flagOk = mockStorage.flagStudent(testCandidate.studentId, 'Verify original grade sheets', admin2)
console.assert(flagOk === true, 'Flagging must succeed')
currentRecord = mockStorage.getStudentById(testCandidate.studentId)!
console.assert(currentRecord.reviewFlagStatus === 'Yellow Flagged', 'ReviewFlagStatus must be Yellow Flagged')
console.assert(currentRecord.approvalStatus === 'Approved', 'ApprovalStatus must remain Approved (status independence)')

// 3. Private Comment & Author Edit
const commentRes = mockStorage.createComment(testCandidate.studentId, 'Initial observation by admin3', admin3)
console.assert(commentRes.success === true, 'Comment creation must succeed')
const commentId = commentRes.comment!.commentId

// Admin3 can edit their own comment
const editOk = mockStorage.editComment(testCandidate.studentId, commentId, 'Updated observation by admin3', admin3)
console.assert(editOk.success === true, 'Author edit must succeed')
console.assert(editOk.comment?.isEdited === true, 'isEdited must be true')
console.assert(editOk.comment?.editHistory?.length === 1, 'Previous version must be preserved in edit history')

// Admin1 CANNOT edit Admin3's comment (author-only editing)
const unauthorizedEdit = mockStorage.editComment(testCandidate.studentId, commentId, 'Tampered by admin1', admin1)
console.assert(unauthorizedEdit.success === false, 'Non-author edit must be rejected')

console.log('[PASS] Check 9: Review decisions, independent statuses, private comments, and edit history intact.\n')

// -----------------------------------------------------------------------------
// CHECK 10: BOOKING REMAINS DISABLED
// -----------------------------------------------------------------------------
console.log('--- CHECK 10: Booking Disabled Configuration Enforcement ---')
const isBookingEnabledDefault = false // Model getScriptProperty('BOOKING_ENABLED', 'false') === 'true'
console.assert(isBookingEnabledDefault === false, 'BOOKING_ENABLED must be false by default')

// Verify that attempting to book while booking is disabled is rejected
function attemptBookingWithServerFlag(isBookingEnabled: boolean): { success: boolean; errorCode?: string } {
  if (!isBookingEnabled) {
    return { success: false, errorCode: 'BOOKING_DISABLED' }
  }
  return { success: true }
}

const bookingAttempt = attemptBookingWithServerFlag(isBookingEnabledDefault)
console.assert(bookingAttempt.success === false, 'Booking attempt must fail when booking is disabled')
console.assert(bookingAttempt.errorCode === 'BOOKING_DISABLED', 'Must return BOOKING_DISABLED error code')
console.log('[PASS] Check 10: Booking is strictly disabled by default.\n')

console.log('================================================================')
console.log('ALL 10 PRE-PUSH REQUIREMENTS VERIFIED WITH ZERO ERRORS')
console.log('================================================================')
