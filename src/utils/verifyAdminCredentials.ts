/**
 * Designated Placement Administrator Credentials & Equal Privileges Verification Suite
 * 
 * Verifies:
 * 1. Administrator Account 1: GMercy / Diya@291018 (case-insensitive username & email alias)
 * 2. Administrator Account 2: DMoksha / KA51HA4142 (case-insensitive username & email alias)
 * 3. Administrator Account 3: Surya / sreyash@6714369 (accepts username Surya and alias sreyash)
 * 4. Password validation: Wrong passwords rejected with "Invalid administrator username or password."
 * 5. Equal Administrative Privileges for all three accounts:
 *    - View interview schedules and slot allocations (getAdminSchedule)
 *    - View dashboard metrics and daily summaries (getAdminSummary)
 *    - View complete student dossiers by Registration Number (getStudentDossier)
 *    - Update student approval/rejection status (changeApprovalStatus)
 *    - Toggle review flags (changeReviewFlag)
 *    - Add and edit private admin comments (saveAdminComment, editAdminComment)
 *    - Cancel student bookings (cancelBooking)
 * 6. Strict Separation from Student Authentication:
 *    - Admin credentials cannot log in via student portal
 *    - Student login remains email-only with zero password fields
 *    - Student session tokens are blocked from admin endpoints with FORBIDDEN_ADMIN
 * 7. Google Apps Script Backend:
 *    - adminLogin handles credential checks and returns admin session tokens
 *    - authenticateAdmin recognizes ADMIN_SESSION_TOKEN_ prefixes
 *    - doGet and doPost properly route adminLogin action
 * 
 * Zero emojis per specification.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as vm from 'vm'
import * as crypto from 'crypto'
import { DESIGNATED_ADMIN_ACCOUNTS } from '../context/designatedAdmins.ts'
import {
  adminLogin as clientAdminLogin,
  getAdminSchedule,
  getAdminSummary,
  getStudentDossier,
  changeApprovalStatus,
  changeReviewFlag,
  saveAdminComment,
  editAdminComment,
  cancelBooking,
  isAuthorizedAdminToken
} from '../services/appsScriptClient.ts'
import { mockStorage } from '../services/mockStorage.ts'
import { INITIAL_MOCK_STUDENTS } from '../data/mockStudents.ts'

console.log('================================================================')
console.log('STARTING DESIGNATED ADMINISTRATOR CREDENTIALS VERIFICATION SUITE')
console.log('================================================================\n')

let passCount = 0
let failCount = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`)
    passCount++
  } else {
    console.error(`[FAIL] ${testName}`)
    if (detail) console.error(`       Detail: ${detail}`)
    failCount++
  }
}

// Initialize mock storage with initial fixture records
mockStorage.loadTestFixtures(INITIAL_MOCK_STUDENTS)

// ---------------------------------------------------------------------------
// TEST SUITE 1: Designated Admin Accounts Structure & Metadata
// ---------------------------------------------------------------------------
console.log('--- TEST SUITE 1: Admin Account Configuration ---')

assert(
  DESIGNATED_ADMIN_ACCOUNTS.length === 3,
  'Exactly 3 designated administrator accounts are configured'
)

const gmercy = DESIGNATED_ADMIN_ACCOUNTS.find(a => a.username === 'GMercy')
assert(
  Boolean(gmercy && gmercy.password === 'Diya@291018' && gmercy.email === 'gmercy@gitam.in'),
  'Administrator GMercy configuration is correct'
)

const dmoksha = DESIGNATED_ADMIN_ACCOUNTS.find(a => a.username === 'DMoksha')
assert(
  Boolean(dmoksha && dmoksha.password === 'KA51HA4142' && dmoksha.email === 'dmoksha@gitam.in'),
  'Administrator DMoksha configuration is correct'
)

const surya = DESIGNATED_ADMIN_ACCOUNTS.find(a => a.username === 'Surya')
assert(
  Boolean(
    surya &&
    surya.password === 'sreyash@6714369' &&
    surya.email === 'surya@gitam.in' &&
    surya.aliases.includes('sreyash')
  ),
  'Administrator Surya configuration is correct with alias sreyash'
)

// ---------------------------------------------------------------------------
// TEST SUITE 2: Client-side Administrator Authentication
// ---------------------------------------------------------------------------
console.log('\n--- TEST SUITE 2: Administrator Authentication Handler ---')

async function runClientAuthTests() {
  // 1. GMercy login tests
  const resGMercyExact = await clientAdminLogin('GMercy', 'Diya@291018')
  assert(
    resGMercyExact.success && resGMercyExact.data?.token === 'ADMIN_SESSION_TOKEN_GMERCY',
    'GMercy authenticates with exact username'
  )

  const resGMercyLower = await clientAdminLogin('gmercy', 'Diya@291018')
  assert(
    resGMercyLower.success && resGMercyLower.data?.token === 'ADMIN_SESSION_TOKEN_GMERCY',
    'GMercy authenticates case-insensitively (lowercase)'
  )

  const resGMercyEmail = await clientAdminLogin('gmercy@gitam.in', 'Diya@291018')
  assert(
    resGMercyEmail.success && resGMercyEmail.data?.token === 'ADMIN_SESSION_TOKEN_GMERCY',
    'GMercy authenticates via email alias'
  )

  const resGMercyWrongPass = await clientAdminLogin('GMercy', 'WrongPassword123')
  assert(
    !resGMercyWrongPass.success && resGMercyWrongPass.error?.code === 'INVALID_CREDENTIALS',
    'GMercy fails with invalid password'
  )

  // 2. DMoksha login tests
  const resDMokshaExact = await clientAdminLogin('DMoksha', 'KA51HA4142')
  assert(
    resDMokshaExact.success && resDMokshaExact.data?.token === 'ADMIN_SESSION_TOKEN_DMOKSHA',
    'DMoksha authenticates with exact username'
  )

  const resDMokshaLower = await clientAdminLogin('dmoksha', 'KA51HA4142')
  assert(
    resDMokshaLower.success && resDMokshaLower.data?.token === 'ADMIN_SESSION_TOKEN_DMOKSHA',
    'DMoksha authenticates case-insensitively (lowercase)'
  )

  const resDMokshaEmail = await clientAdminLogin('dmoksha@gitam.in', 'KA51HA4142')
  assert(
    resDMokshaEmail.success && resDMokshaEmail.data?.token === 'ADMIN_SESSION_TOKEN_DMOKSHA',
    'DMoksha authenticates via email alias'
  )

  const resDMokshaWrongPass = await clientAdminLogin('DMoksha', 'InvalidPass456')
  assert(
    !resDMokshaWrongPass.success && resDMokshaWrongPass.error?.code === 'INVALID_CREDENTIALS',
    'DMoksha fails with invalid password'
  )

  // 3. Surya / sreyash login tests
  const resSuryaExact = await clientAdminLogin('Surya', 'sreyash@6714369')
  assert(
    resSuryaExact.success && resSuryaExact.data?.token === 'ADMIN_SESSION_TOKEN_SURYA',
    'Surya authenticates with exact username'
  )

  const resSuryaLower = await clientAdminLogin('surya', 'sreyash@6714369')
  assert(
    resSuryaLower.success && resSuryaLower.data?.token === 'ADMIN_SESSION_TOKEN_SURYA',
    'Surya authenticates case-insensitively (lowercase)'
  )

  const resSreyashAlias = await clientAdminLogin('sreyash', 'sreyash@6714369')
  assert(
    resSreyashAlias.success && resSreyashAlias.data?.token === 'ADMIN_SESSION_TOKEN_SURYA',
    'Surya authenticates using alias sreyash'
  )

  const resSreyashAliasEmail = await clientAdminLogin('sreyash@gitam.in', 'sreyash@6714369')
  assert(
    resSreyashAliasEmail.success && resSreyashAliasEmail.data?.token === 'ADMIN_SESSION_TOKEN_SURYA',
    'Surya authenticates using alias email sreyash@gitam.in'
  )

  const resSuryaWrongPass = await clientAdminLogin('Surya', 'BadPassword789')
  assert(
    !resSuryaWrongPass.success && resSuryaWrongPass.error?.code === 'INVALID_CREDENTIALS',
    'Surya fails with invalid password'
  )

  // 4. Unknown account
  const resUnknown = await clientAdminLogin('UnknownAdmin', 'SomePassword')
  assert(
    !resUnknown.success && resUnknown.error?.code === 'INVALID_CREDENTIALS',
    'Unknown administrator username is rejected'
  )
}

// ---------------------------------------------------------------------------
// TEST SUITE 3: Equal Full Administrative Privileges Verification
// ---------------------------------------------------------------------------
console.log('\n--- TEST SUITE 3: Equal Full Administrative Privileges ---')

async function runPrivilegesTests() {
  const adminTokens = [
    { name: 'GMercy', token: 'ADMIN_SESSION_TOKEN_GMERCY', email: 'gmercy@gitam.in', targetReg: '122010301001', targetStu: 'GITAM-2026-001' },
    { name: 'DMoksha', token: 'ADMIN_SESSION_TOKEN_DMOKSHA', email: 'dmoksha@gitam.in', targetReg: '122010402015', targetStu: 'GITAM-2026-002' },
    { name: 'Surya', token: 'ADMIN_SESSION_TOKEN_SURYA', email: 'surya@gitam.in', targetReg: '122010303042', targetStu: 'GITAM-2026-003' }
  ]

  for (const admin of adminTokens) {
    // 1. isAuthorizedAdminToken check
    assert(
      isAuthorizedAdminToken(admin.token),
      `${admin.name} token is recognized as authorized administrator`
    )

    // 2. Schedule retrieval
    const schedRes = await getAdminSchedule(admin.token, '2026-11-20')
    assert(
      schedRes.success && Boolean(schedRes.data?.slots && schedRes.data.slots.length === 36),
      `${admin.name} has permission to retrieve admin schedule (36 slots)`
    )

    // 3. Summary retrieval
    const sumRes = await getAdminSummary(admin.token, '2026-11-20')
    assert(
      sumRes.success && Boolean(sumRes.data?.totalStudents !== undefined),
      `${admin.name} has permission to retrieve admin metrics summary`
    )

    // 4. Student dossier retrieval (by Registration Number)
    const dossierRes = await getStudentDossier(admin.token, admin.targetReg)
    assert(
      dossierRes.success && dossierRes.data?.registrationNumber === admin.targetReg,
      `${admin.name} has permission to retrieve student dossier by registration number`
    )

    // 5. Change approval status
    const approveRes = await changeApprovalStatus(
      admin.token,
      'GITAM-2026-001',
      'Approved',
      `Approved by ${admin.name}`,
      admin.email
    )
    assert(
      approveRes.success && approveRes.data?.approvalStatus === 'Approved',
      `${admin.name} has permission to approve candidates`
    )

    // 6. Change review flag
    const flagRes = await changeReviewFlag(
      admin.token,
      'GITAM-2026-001',
      'Flagged for Review',
      `Flagged for review by ${admin.name}`,
      admin.email
    )
    assert(
      flagRes.success && flagRes.data?.reviewFlagStatus === 'Flagged for Review',
      `${admin.name} has permission to flag candidates`
    )

    // 7. Save admin comment
    const commentRes = await saveAdminComment(
      admin.token,
      'GITAM-2026-001',
      `Evaluation note written by ${admin.name}.`,
      admin.email
    )
    assert(
      commentRes.success && Boolean(commentRes.data.comment?.commentId),
      `${admin.name} has permission to write private comments`
    )

    // 8. Edit admin comment
    if (commentRes.success && commentRes.data.comment?.commentId) {
      const editRes = await editAdminComment(
        admin.token,
        'GITAM-2026-001',
        commentRes.data.comment.commentId,
        `Updated evaluation note by ${admin.name}.`,
        admin.email
      )
      assert(
        editRes.success && Boolean(editRes.data?.updatedComment),
        `${admin.name} has permission to edit private comments`
      )
    }

    // 9. Cancel booking permission
    const cancelRes = await cancelBooking(admin.token, admin.targetStu)
    assert(
      cancelRes.success && cancelRes.data?.bookingStatus === 'Cancelled',
      `${admin.name} has permission to cancel candidate bookings`
    )
  }
}

// ---------------------------------------------------------------------------
// TEST SUITE 4: Separation from Student Authentication & Role Enforcement
// ---------------------------------------------------------------------------
console.log('\n--- TEST SUITE 4: Separation from Student Authentication ---')

async function runSeparationTests() {
  const studentToken = 'STUDENT_EMAIL_SESSION'

  // Student token must fail with FORBIDDEN_ADMIN on admin-only endpoints
  assert(
    !isAuthorizedAdminToken(studentToken),
    'Student session token is NOT an authorized admin token'
  )

  const schedRes = await getAdminSchedule(studentToken, '2026-11-20')
  assert(
    !schedRes.success && schedRes.error?.code === 'FORBIDDEN_ADMIN',
    'Student session is blocked from getAdminSchedule with FORBIDDEN_ADMIN'
  )

  const sumRes = await getAdminSummary(studentToken, '2026-11-20')
  assert(
    !sumRes.success && sumRes.error?.code === 'FORBIDDEN_ADMIN',
    'Student session is blocked from getAdminSummary with FORBIDDEN_ADMIN'
  )

  const dosRes = await getStudentDossier(studentToken, '1210415201')
  assert(
    !dosRes.success && dosRes.error?.code === 'FORBIDDEN_ADMIN',
    'Student session is blocked from getStudentDossier with FORBIDDEN_ADMIN'
  )

  const commRes = await saveAdminComment(studentToken, 'STU-1001', 'Illegal comment')
  assert(
    !commRes.success && commRes.error?.code === 'FORBIDDEN_ADMIN',
    'Student session is blocked from saveAdminComment with FORBIDDEN_ADMIN'
  )

  // Empty or invalid token
  const emptyRes = await getAdminSchedule('', '2026-11-20')
  assert(
    !emptyRes.success && emptyRes.error?.code === 'FORBIDDEN_ADMIN',
    'Empty token is blocked from getAdminSchedule with FORBIDDEN_ADMIN'
  )
}

// ---------------------------------------------------------------------------
// TEST SUITE 5: Google Apps Script Backend Sandbox Verification
// ---------------------------------------------------------------------------
console.log('\n--- TEST SUITE 5: Google Apps Script Backend Execution ---')

function runAppsScriptBackendTests() {
  const appsScriptDir = path.resolve(process.cwd(), 'apps-script/src')
  const scriptFiles = ['Config.gs', 'Response.gs', 'Auth.gs', 'Code.gs']

  const scriptProps: Record<string, string> = {
    ADMIN_EMAILS: 'admin@gitam.in,placement@gitam.in,gmercy@gitam.in,dmoksha@gitam.in,surya@gitam.in',
    SUPABASE_JWT_SECRET: 'test_jwt_secret_homecoming_2026_super_secure_key_12345',
    SUPABASE_ISSUER: 'https://okxwlgmtonkuojbqcxeg.supabase.co/auth/v1',
    SUPABASE_AUDIENCE: 'authenticated',
    SPREADSHEET_ID: 'test_spreadsheet_id_123',
    BOOKING_ENABLED: 'false'
  }

  const context: Record<string, unknown> = {
    console,
    JSON,
    Date,
    Math,
    String,
    Boolean,
    Array,
    Object,
    parseInt,
    parseFloat,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => scriptProps[key] || null,
        getProperties: () => ({ ...scriptProps }),
        setProperty: (key: string, val: string) => { scriptProps[key] = val },
        deleteProperty: (key: string) => { delete scriptProps[key] }
      })
    },
    ContentService: {
      createTextOutput: (text: string) => ({
        setMimeType: () => ({
          getContent: () => text
        })
      }),
      MimeType: { JSON: 'application/json' }
    },
    Utilities: {
      base64Decode: (str: string) => Buffer.from(str, 'base64'),
      base64EncodeWebSafe: (bytes: Buffer) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      newBlob: (bytes: Buffer) => ({
        getDataAsString: () => Buffer.from(bytes).toString('utf-8')
      }),
      computeHmacSha256Signature: (data: string, key: string) => {
        return crypto.createHmac('sha256', key).update(data).digest()
      }
    }
  }

  vm.createContext(context)

  for (const file of scriptFiles) {
    const filePath = path.join(appsScriptDir, file)
    const code = fs.readFileSync(filePath, 'utf-8')
    vm.runInContext(code, context)
  }

  // 1. Test Apps Script adminLogin function directly
  const asAdminLogin = context.adminLogin as (id: string, pass: string) => { success: boolean; data?: { token: string; email: string; username: string }; error?: { code: string; message: string } }
  assert(typeof asAdminLogin === 'function', 'Apps Script adminLogin function is defined')

  const res1 = asAdminLogin('GMercy', 'Diya@291018')
  assert(res1.success && res1.data?.token === 'ADMIN_SESSION_TOKEN_GMERCY', 'Apps Script authenticates GMercy')

  const res2 = asAdminLogin('dmoksha', 'KA51HA4142')
  assert(res2.success && res2.data?.token === 'ADMIN_SESSION_TOKEN_DMOKSHA', 'Apps Script authenticates DMoksha')

  const res3 = asAdminLogin('sreyash', 'sreyash@6714369')
  assert(res3.success && res3.data?.token === 'ADMIN_SESSION_TOKEN_SURYA', 'Apps Script authenticates Surya via sreyash alias')

  const resBadPass = asAdminLogin('GMercy', 'badpass')
  assert(!resBadPass.success, 'Apps Script rejects invalid password')

  // 2. Test Apps Script authenticateAdmin with tokens
  const asAuthAdmin = context.authenticateAdmin as (token: string) => { authorized: boolean; adminEmail?: string; error?: unknown }
  assert(typeof asAuthAdmin === 'function', 'Apps Script authenticateAdmin function is defined')

  const auth1 = asAuthAdmin('ADMIN_SESSION_TOKEN_GMERCY')
  assert(auth1.authorized && auth1.adminEmail === 'gmercy@gitam.in', 'Apps Script authenticateAdmin validates GMercy token')

  const auth2 = asAuthAdmin('ADMIN_SESSION_TOKEN_DMOKSHA')
  assert(auth2.authorized && auth2.adminEmail === 'dmoksha@gitam.in', 'Apps Script authenticateAdmin validates DMoksha token')

  const auth3 = asAuthAdmin('ADMIN_SESSION_TOKEN_SURYA')
  assert(auth3.authorized && auth3.adminEmail === 'surya@gitam.in', 'Apps Script authenticateAdmin validates Surya token')

  const authInvalid = asAuthAdmin('INVALID_TOKEN')
  assert(!authInvalid.authorized, 'Apps Script authenticateAdmin rejects invalid token')

  // 3. Test doGet with action=adminLogin
  const asDoGet = context.doGet as (e: { parameter: Record<string, string> }) => { getContent: () => string }
  const getResp = JSON.parse(asDoGet({ parameter: { action: 'adminLogin', identifier: 'GMercy', password: 'Diya@291018' } }).getContent())
  assert(getResp.success && getResp.data?.token === 'ADMIN_SESSION_TOKEN_GMERCY', 'Apps Script doGet correctly routes adminLogin action')

  // 4. Test doPost with action=adminLogin
  const asDoPost = context.doPost as (e: { postData: { contents: string } }) => { getContent: () => string }
  const postResp = JSON.parse(asDoPost({
    postData: {
      contents: JSON.stringify({ action: 'adminLogin', identifier: 'sreyash', password: 'sreyash@6714369' })
    }
  }).getContent())
  assert(postResp.success && postResp.data?.token === 'ADMIN_SESSION_TOKEN_SURYA', 'Apps Script doPost correctly routes adminLogin action')
}

// ---------------------------------------------------------------------------
// TEST SUITE 6: UI Source Verification
// ---------------------------------------------------------------------------
console.log('\n--- TEST SUITE 6: UI Component Integrity ---')

function runUiSourceTests() {
  const adminLoginPath = path.resolve(process.cwd(), 'src/pages/auth/AdminLoginPage.tsx')
  const studentLoginPath = path.resolve(process.cwd(), 'src/pages/auth/LoginPage.tsx')

  const adminSrc = fs.readFileSync(adminLoginPath, 'utf-8')
  const studentSrc = fs.readFileSync(studentLoginPath, 'utf-8')

  // Admin login input checks
  assert(
    adminSrc.includes('Administrator Username or Email Address:'),
    'Admin login page displays correct identifier prompt'
  )
  assert(
    adminSrc.includes('id="admin-email"') && adminSrc.includes('type="text"') && adminSrc.includes('autoComplete="username"'),
    'Admin login username input is type="text" with autoComplete="username"'
  )
  assert(
    adminSrc.includes('id="admin-password"') && adminSrc.includes('type="password"'),
    'Admin login includes password field'
  )

  // Student login checks
  assert(
    !studentSrc.includes('type="password"'),
    'Student login contains ZERO password inputs'
  )
  assert(
    !studentSrc.includes('id="otp"') && !studentSrc.includes('placeholder="Enter OTP"'),
    'Student login contains zero OTP input fields'
  )
  assert(
    studentSrc.includes('Registered Student Email Address:'),
    'Student login asks only for registered student email address'
  )
}

// Execute all test suites sequentially
async function runAll() {
  await runClientAuthTests()
  await runPrivilegesTests()
  await runSeparationTests()
  runAppsScriptBackendTests()
  runUiSourceTests()

  console.log('\n================================================================')
  console.log(`VERIFICATION SUMMARY: ${passCount} passed, ${failCount} failed`)
  console.log('================================================================')

  if (failCount > 0) {
    process.exit(1)
  }
}

runAll().catch(err => {
  console.error('Unhandled error in verification suite:', err)
  process.exit(1)
})
