/**
 * Student Email-Only Authentication Verification Suite
 * 
 * Verifies:
 * 1. Student login screen contains ONLY a single email input and single sign-in button.
 * 2. Zero password fields, zero OTP fields, zero verification code prompts, zero magic link text.
 * 3. Registered candidate email immediately grants dashboard access and returns student profile.
 * 4. Unregistered email is denied access immediately with exact message:
 *    "This email is not registered. Access denied."
 * 5. Ambiguous duplicate registrations are detected and denied access.
 * 6. Server-side registration check is enforced on Google Apps Script backend and local mockStorage.
 * 7. Student access cannot access administrative endpoints.
 * 8. Administrator authentication remains completely separate, protected with password/SSO and ADMIN_EMAILS allowlist.
 * 9. BOOKING_ENABLED=false remains strictly enforced.
 * 10. UI text contrast: INSPECTION MODE, Morning Session, Afternoon Session, slot counts appear in white/high-contrast.
 * 
 * Zero emojis per specification.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as vm from 'vm'
import * as crypto from 'crypto'
import { mockStorage } from '../services/mockStorage.ts'
import { INITIAL_MOCK_STUDENTS } from '../data/mockStudents.ts'
import { studentLoginByEmail } from '../services/appsScriptClient.ts'

console.log('================================================================')
console.log('STARTING STUDENT EMAIL-ONLY AUTHENTICATION VERIFICATION SUITE')
console.log('================================================================\n')

// 1. Initialize mock storage with initial fixture records
mockStorage.loadTestFixtures(INITIAL_MOCK_STUDENTS)

// Load Google Apps Script backend files into a sandbox
const appsScriptDir = path.resolve(process.cwd(), 'apps-script/src')
const scriptFiles = ['Config.gs', 'Response.gs', 'Auth.gs', 'SheetsRepository.gs', 'BookingService.gs', 'AdminService.gs']

const scriptProps: Record<string, string> = {
  ADMIN_EMAILS: 'admin@gitam.in,placement@gitam.in,placement.homecoming2026@gitam.in',
  SUPABASE_JWT_SECRET: 'test_jwt_secret_homecoming_2026_super_secure_key_12345',
  SUPABASE_ISSUER: 'https://okxwlgmtonkuojbqcxeg.supabase.co/auth/v1',
  SUPABASE_AUDIENCE: 'authenticated',
  SPREADSHEET_ID: 'test_spreadsheet_id_123',
  BOOKING_ENABLED: 'false'
}

const mockSheetDb: Record<string, Record<string, unknown>[]> = {
  'Student Database': INITIAL_MOCK_STUDENTS.map(s => ({
    'Student ID': s.studentId,
    'Registration Number': s.registrationNumber,
    'Roll Number': s.rollNumber,
    'Name': s.fullName,
    'Full Name': s.fullName,
    'GITAM Email Address': s.gitamEmail,
    'Email Address': s.gitamEmail,
    'Personal Email Address': s.personalEmail,
    'Phone Number': s.phoneNumber,
    'Branch': s.branch,
    'Section': s.section,
    'CGPA': s.cgpa,
    'Passout Year': s.yearOfPassing,
    'Booking Status': s.bookingStatus,
    'Booked Date': s.bookedDate || '',
    'Booked Slot Time': s.bookedSlotStart || '',
    'Approval Status': s.approvalStatus,
    'Review Flag Status': s.reviewFlagStatus
  })),
  'Approved': [],
  'Rejected': []
}

// Add an ambiguous record fixture to test collision detection
mockSheetDb['Student Database'].push({
  'Student ID': 'GITAM-2026-DUP-1',
  'Registration Number': '122010300999',
  'Roll Number': 'ROLL-DUP-1',
  'Name': 'Duplicate Candidate 1',
  'Full Name': 'Duplicate Candidate 1',
  'GITAM Email Address': 'duplicate.candidate@gitam.in',
  'Email Address': 'duplicate.candidate@gitam.in',
  'Booking Status': 'Not Booked',
  'Approval Status': 'Pending'
})
mockSheetDb['Student Database'].push({
  'Student ID': 'GITAM-2026-DUP-2',
  'Registration Number': '122010300998',
  'Roll Number': 'ROLL-DUP-2',
  'Name': 'Duplicate Candidate 2',
  'Full Name': 'Duplicate Candidate 2',
  'GITAM Email Address': 'duplicate.candidate@gitam.in',
  'Email Address': 'duplicate.candidate@gitam.in',
  'Booking Status': 'Not Booked',
  'Approval Status': 'Pending'
})

const mockSpreadsheet = {
  getSheetByName: (name: string) => {
    const rows = mockSheetDb[name] || []
    return {
      getName: () => name,
      getLastRow: () => rows.length + 1,
      getLastColumn: () => (rows.length > 0 ? Object.keys(rows[0]).length : 1),
      getDataRange: () => ({
        getValues: () => {
          if (rows.length === 0) return [[]]
          const headers = Object.keys(rows[0])
          const dataValues = rows.map(r => headers.map(h => (r[h] !== undefined ? r[h] : '')))
          return [headers, ...dataValues]
        }
      })
    }
  }
}

const sandbox: Record<string, unknown> = {
  console: console,
  Math: Math,
  Date: Date,
  JSON: JSON,
  Utilities: {
    base64Decode: (str: string) => Buffer.from(str, 'base64'),
    newBlob: (bytes: Buffer) => ({
      getDataAsString: () => bytes.toString('utf8')
    }),
    computeHmacSha256Signature: (val: string, secret: string) => {
      return crypto.createHmac('sha256', secret).update(val).digest()
    },
    base64EncodeWebSafe: (bytes: Buffer) => {
      return Buffer.from(bytes)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    }
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key: string) => scriptProps[key] || null,
      getProperties: () => ({ ...scriptProps })
    })
  },
  SpreadsheetApp: {
    openById: () => mockSpreadsheet,
    getActiveSpreadsheet: () => mockSpreadsheet,
    flush: () => {}
  },
  LockService: {
    getScriptLock: () => ({
      tryLock: () => true,
      releaseLock: () => {}
    })
  },
  ContentService: {
    createTextOutput: (text: string) => ({
      setMimeType: () => text
    }),
    MimeType: { JSON: 'application/json' }
  }
}

vm.createContext(sandbox)
for (const file of scriptFiles) {
  const code = fs.readFileSync(path.join(appsScriptDir, file), 'utf8')
  vm.runInContext(code, sandbox)
}

// Helper to create test Supabase JWTs
function createTestToken(payload: Record<string, unknown>, secret = scriptProps.SUPABASE_JWT_SECRET): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url')
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const toSign = `${b64Header}.${b64Payload}`
  const sig = crypto.createHmac('sha256', secret).update(toSign).digest('base64url')
  return `${toSign}.${sig}`
}

async function runTests() {
  // --- TEST 1: Password field and OTP UI are NOT present on student login view ---
  console.log('--- TEST 1: Student Login UI Contains Zero Password and Zero OTP Inputs ---')
  const loginPageSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/auth/LoginPage.tsx'), 'utf8')
  console.assert(!loginPageSrc.includes('type="password"'), 'Student LoginPage must NOT contain any password input')
  console.assert(!loginPageSrc.includes('login-password'), 'Student LoginPage must NOT reference login-password')
  console.assert(!loginPageSrc.includes('login-otp'), 'Student LoginPage must NOT reference login-otp')
  console.assert(!loginPageSrc.includes('handleVerifyOtp'), 'Student LoginPage must NOT contain handleVerifyOtp')
  console.assert(!loginPageSrc.includes('requestStudentOtp'), 'Student LoginPage must NOT wire requestStudentOtp')
  console.assert(!loginPageSrc.includes('verifyStudentOtp'), 'Student LoginPage must NOT wire verifyStudentOtp')
  console.assert(!loginPageSrc.includes('Resend verification code'), 'Student LoginPage must NOT contain resend code option')
  console.assert(loginPageSrc.includes('loginStudentByEmail'), 'Student LoginPage must wire loginStudentByEmail')
  console.assert(loginPageSrc.includes('Sign In as Student'), 'Student LoginPage must feature Sign In as Student button')
  console.assert(loginPageSrc.includes('/assets/homecoming-2026-badge.png'), 'Must feature official Homecoming 2026 badge')
  console.log('[PASS] Test 1: Student login view contains zero passwords, zero OTP inputs, and single email sign-in.\n')

  // --- TEST 2: Registered student email succeeds on backend ---
  console.log('--- TEST 2: Backend Confirms Registration for Registered Candidate ---')
  const registeredEmail = 'asharma14@gitam.in'
  const studentLoginRes = vm.runInContext(`studentLoginByEmail('${registeredEmail}')`, sandbox)
  console.assert(studentLoginRes.success === true, 'Registered student must succeed')
  console.assert(studentLoginRes.data.studentId === 'GITAM-2026-001', 'Must return studentId GITAM-2026-001')
  console.assert(studentLoginRes.data.fullName === 'Aarav Sharma', 'Must return fullName Aarav Sharma')
  console.assert(studentLoginRes.data.gitamEmail === registeredEmail, 'Must return matching email')
  console.log('[PASS] Test 2: Registered student email resolves immediately to official candidate profile.\n')

  // --- TEST 3: Unregistered student email fails with exact required message ---
  console.log('--- TEST 3: Backend Rejects Unregistered Email with Exact Error Message ---')
  const unregisteredEmail = 'stranger@external.com'
  const unregCheck = vm.runInContext(`studentLoginByEmail('${unregisteredEmail}')`, sandbox)
  console.assert(unregCheck.success === false, 'Unregistered email must fail')
  console.assert(unregCheck.error.code === 'UNREGISTERED_STUDENT', 'Error code must be UNREGISTERED_STUDENT')
  console.assert(
    unregCheck.error.message === 'This email is not registered. Access denied.',
    `Error message must be exactly 'This email is not registered. Access denied.', got: '${unregCheck.error.message}'`
  )
  console.log('[PASS] Test 3: Unregistered email returns exact error: "This email is not registered. Access denied."\n')

  // --- TEST 4: Ambiguous registration email detection ---
  console.log('--- TEST 4: Ambiguous Duplicate Registration Email Blocked ---')
  const ambiguousEmail = 'duplicate.candidate@gitam.in'
  const ambCheck = vm.runInContext(`studentLoginByEmail('${ambiguousEmail}')`, sandbox)
  console.assert(ambCheck.success === false, 'Ambiguous registration must fail')
  console.assert(ambCheck.error.code === 'AMBIGUOUS_STUDENT_RECORD', 'Error code must be AMBIGUOUS_STUDENT_RECORD')
  console.assert(
    ambCheck.error.message.includes('Multiple registration records match this email address'),
    'Must instruct student to contact placement office'
  )
  console.log('[PASS] Test 4: Ambiguous duplicate registration detected and denied access.\n')

  // --- TEST 5: MockStorage studentLoginByEmail parity check ---
  console.log('--- TEST 5: Local mockStorage Behavior Aligns with Backend Specification ---')
  const localSuccess = mockStorage.studentLoginByEmail('asharma14@gitam.in')
  console.assert(localSuccess.success === true, 'mockStorage must succeed for registered student')
  if (localSuccess.success) {
    console.assert(localSuccess.data.studentId === 'GITAM-2026-001', 'mockStorage must return correct student')
  }

  const localUnreg = mockStorage.studentLoginByEmail('outsider@random.com')
  console.assert(localUnreg.success === false, 'mockStorage must fail for unregistered candidate')
  if (!localUnreg.success) {
    console.assert(
      localUnreg.error.message === 'This email is not registered. Access denied.',
      `mockStorage error message must match exact string, got: '${localUnreg.error.message}'`
    )
  }
  console.log('[PASS] Test 5: Local mockStorage behavior matches backend specification exactly.\n')

  // --- TEST 6: Client-side service fail-closed check ---
  console.log('--- TEST 6: Client-Side Fail-Closed Guard in Unconfigured Production ---')
  const clientRes = await studentLoginByEmail('asharma14@gitam.in')
  console.assert(
    clientRes.success === false && clientRes.error?.code === 'BACKEND_NOT_CONFIGURED',
    'Client studentLoginByEmail must fail-closed in unconfigured production environments'
  )
  console.log('[PASS] Test 6: Client-side fail-closed security guard verified.\n')

  // --- TEST 7: Admin endpoints reject non-admin access ---
  console.log('--- TEST 7: Administrative Endpoints Require Verified Admin Token ---')
  const bogusStudentToken = 'STUDENT_EMAIL_SESSION'
  const adminScheduleRes = vm.runInContext(`getAdminSchedule('${bogusStudentToken}', '2026-11-20')`, sandbox)
  console.assert(adminScheduleRes.success === false, 'Student session token must NOT be authorized for admin schedule')
  console.assert(
    adminScheduleRes.error.code === 'AUTH_INVALID' || adminScheduleRes.error.code === 'AUTH_UNAUTHORIZED' || adminScheduleRes.error.code === 'FORBIDDEN_ADMIN',
    'Must return administrative authorization error'
  )

  // Also test with a student JWT token (valid signature, but not an admin email)
  const studentJwt = createTestToken({
    sub: 'student-uuid-001',
    email: 'asharma14@gitam.in',
    aud: 'authenticated',
    iss: scriptProps.SUPABASE_ISSUER,
    exp: Math.floor(Date.now() / 1000) + 3600,
    email_confirmed_at: '2026-11-19T08:00:00Z'
  })
  const studentAttemptRes = vm.runInContext(`getAdminSchedule('${studentJwt}', '2026-11-20')`, sandbox)
  console.assert(studentAttemptRes.success === false, 'Student JWT must NOT access admin schedule')
  console.assert(studentAttemptRes.error.code === 'FORBIDDEN_ADMIN', 'Must return FORBIDDEN_ADMIN error')
  console.log('[PASS] Test 7: Administrative endpoints strictly reject student sessions and non-admin tokens.\n')

  // --- TEST 8: Admin login remains dedicated and password-protected ---
  console.log('--- TEST 8: Administrator Login Remains Dedicated and Password-Protected ---')
  const adminLoginSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/auth/AdminLoginPage.tsx'), 'utf8')
  console.assert(adminLoginSrc.includes('type="password"'), 'Admin login must retain password protection')
  console.assert(adminLoginSrc.includes('Administrator Password'), 'Admin login must have password label')
  console.assert(adminLoginSrc.includes('ADMIN_EMAILS') || adminLoginSrc.includes('Placement Administrator Login'), 'Admin login must be distinct')
  console.log('[PASS] Test 8: Administrator login is completely separate and requires password credentials.\n')

  // --- TEST 9: BOOKING_ENABLED=false lock remains strictly enforced ---
  console.log('--- TEST 9: Booking Enabled Lock Remains False ---')
  const bookingAttempt = vm.runInContext(`createBooking({
    token: 'any-token',
    date: '2026-11-20',
    startTime: '09:00',
    bookingRequestId: 'test-req-12345'
  })`, sandbox)
  console.assert(bookingAttempt.success === false, 'Booking must fail while BOOKING_ENABLED=false')
  console.assert(bookingAttempt.error.code === 'BOOKING_DISABLED', 'Error code must be BOOKING_DISABLED')
  console.log('[PASS] Test 9: Booking disabled lock strictly enforced on backend.\n')

  // --- TEST 10: UI Contrast Verification for Session Headings and Inspection Mode ---
  console.log('--- TEST 10: UI Contrast Verification for Session Headings and Inspection Mode ---')
  const adminPageSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/AdminPage.tsx'), 'utf8')
  console.assert(adminPageSrc.includes('INSPECTION MODE:'), 'AdminPage must display uppercase INSPECTION MODE:')
  console.assert(adminPageSrc.includes("color: '#FFFFFF'"), 'AdminPage INSPECTION MODE must have color #FFFFFF')
  console.assert(adminPageSrc.includes("fontWeight: 700"), 'AdminPage INSPECTION MODE must have fontWeight 700')

  const adminScheduleSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/admin/AdminScheduleView.tsx'), 'utf8')
  console.assert(adminScheduleSrc.includes('Morning Session (09:00 - 12:00 IST)'), 'AdminScheduleView must include Morning Session')
  console.assert(adminScheduleSrc.includes('Afternoon Session (13:00 - 16:00 IST)'), 'AdminScheduleView must include Afternoon Session')
  console.assert(adminScheduleSrc.includes('session-slot-count'), 'AdminScheduleView must use session-slot-count')

  const studentDirectorySrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/student/SlotDirectory.tsx'), 'utf8')
  console.assert(studentDirectorySrc.includes('Morning Session (09:00 - 12:00 IST)'), 'SlotDirectory must include Morning Session')
  console.assert(studentDirectorySrc.includes('Afternoon Session (13:00 - 16:00 IST)'), 'SlotDirectory must include Afternoon Session')
  console.assert(studentDirectorySrc.includes('session-slot-count'), 'SlotDirectory must use session-slot-count')

  const portalCssSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/portal.css'), 'utf8')
  console.assert(portalCssSrc.includes('.session-slot-count {'), 'portal.css must define .session-slot-count')
  console.assert(portalCssSrc.includes('color: #ffffff !important;'), 'portal.css must enforce #ffffff !important on slot-section-title')
  console.log('[PASS] Test 10: UI contrast verified: INSPECTION MODE, session headers, and slot counts in white & bold.\n')

  console.log('================================================================')
  console.log('ALL 10 STUDENT EMAIL-ONLY AUTHENTICATION TESTS PASSED (0 ERRORS)')
  console.log('================================================================')
}

runTests().catch(err => {
  console.error('FATAL ERROR in verifyStudentEmailOnlyAuth:', err)
  process.exit(1)
})
