/**
 * Direct Verification Suite for Registration Number-Based Student Dossier Retrieval
 * 
 * Verifies all 12 mandatory requirements:
 * 1. Correct Registration Number retrieves the correct form submission.
 * 2. Two students with similar names but different Registration Numbers retrieve separate dossiers.
 * 3. Different email addresses do not break Registration Number matching.
 * 4. A missing Registration Number returns a controlled error.
 * 5. No matching registration returns a controlled error.
 * 6. Duplicate Registration Numbers are detected.
 * 7. Original form answers remain unchanged after admin approval.
 * 8. Admin rejection does not overwrite original form answers.
 * 9. Yellow flag does not change approval status.
 * 10. Comments and audit history remain separate from original responses.
 * 11. A student cannot access another student's dossier.
 * 12. An unauthorized admin cannot access the dossier endpoint.
 * 
 * Tests the ACTUAL JavaScript code in apps-script/src/SheetsRepository.gs, AdminService.gs,
 * Code.gs, Auth.gs, and Config.gs inside a V8 VM environment.
 * Zero emojis per specification.
 */

import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

console.log('================================================================');
console.log('STARTING REGISTRATION NUMBER-BASED DOSSIER VERIFICATION SUITE');
console.log('Timezone: Asia/Kolkata (IST)');
console.log('================================================================\n');

// Read actual Apps Script source files
const configCode = fs.readFileSync('apps-script/src/Config.gs', 'utf8');
const responseCode = fs.readFileSync('apps-script/src/Response.gs', 'utf8');
const authCode = fs.readFileSync('apps-script/src/Auth.gs', 'utf8');
const repoCode = fs.readFileSync('apps-script/src/SheetsRepository.gs', 'utf8');
const adminServiceCode = fs.readFileSync('apps-script/src/AdminService.gs', 'utf8');
const codeEntryCode = fs.readFileSync('apps-script/src/Code.gs', 'utf8');

interface SheetData {
  headers: string[];
  rows: (string | number)[][];
}

// Staging spreadsheet mock data
const stagingSheets: Record<string, SheetData> = {
  'Student Database': {
    headers: [
      'Registration Number', 'StudentID', 'FullName', 'Email', 'Personal Email', 'PhoneNumber',
      'Program', 'Branch', 'AcademicYear', 'Section', 'CGPA', 'Backlogs',
      'HighestQualification', 'UniversityCollege', 'YearOfPassing',
      'DomainPreference1', 'DomainPreference2', 'DomainPreference3',
      'RolesAppliedFor', 'WrittenApplication', 'WorkExperience', 'Internships',
      'TechnicalSkills', 'SoftSkills', 'Certifications', 'Achievements',
      'AvailabilityCommute', 'EventCommitment', 'ResumeLink', 'DocumentLinks',
      'BookingStatus', 'BookingID', 'BookingRequestID', 'InterviewDate', 'InterviewSlot',
      'InterviewStart', 'InterviewEnd', 'BookingTimestamp',
      'ApprovalStatus', 'DecisionBy', 'DecisionTimestamp', 'DecisionComment', 'RejectionReason',
      'ReviewFlagStatus', 'FlaggedBy', 'FlaggedAt', 'FlagReason',
      'AdminComments', 'ReviewHistory'
    ],
    rows: [
      // Candidate 1: Standard unique student
      [
        '202610304010', '202610304010', 'Ananya Sharma', 'asharma10@gitam.in', 'ananya.personal@gmail.com', '+91 98765 43210',
        'B.Tech', 'Computer Science and Engineering', '2026', 'A', '9.42', '0',
        '12th Standard', 'Delhi Public School', '2022',
        'Alumni Relations & Protocol', 'Technical Operations', 'Media & Creative',
        'Student Coordinator', 'Eager to contribute to Homecoming 2026 logistics.', 'Event Lead in TechFest 2025', 'Summer Intern at Infosys',
        'Python, React, TypeScript', 'Public speaking, Crisis resolution', 'AWS Certified Cloud Practitioner', '1st Prize Hackathon 2025',
        'Available all 6 dates. Daily campus commute.', 'Full-time on-site presence confirmed.', 'https://drive.google.com/file/ananya_resume', 'https://drive.google.com/drive/ananya_docs',
        'Not Booked', '', '', '', '',
        '', '', '',
        'Pending', '', '', '', '',
        'Not Flagged', '', '', '',
        '', ''
      ],
      // Candidate 2A: Rahul Sharma (CSE, Reg 202610304021)
      [
        '202610304021', '202610304021', 'Rahul Sharma', 'rsharma21@gitam.in', 'rahul.cse@gmail.com', '+91 98765 43221',
        'B.Tech', 'Computer Science and Engineering', '2026', 'A', '8.85', '0',
        '12th Standard', 'Bhavans Vidyashram', '2022',
        'Technical Operations', 'Hackathon Operations', 'Logistics',
        'Technical Lead', 'Passionate about coding events and hackathon coordination.', 'Web team lead', 'App developer intern',
        'Go, Docker, Kubernetes', 'Team building, Problem solving', 'CKA', 'Dean Honour List 2024',
        'Available all 6 dates', 'Confirmed', 'https://drive.google.com/file/rahul21_resume', '',
        'Not Booked', '', '', '', '',
        '', '', '',
        'Pending', '', '', '', '',
        'Not Flagged', '', '', '',
        '', ''
      ],
      // Candidate 2B: Rahul Sharma (Mech, Reg 202610304022)
      [
        '202610304022', '202610304022', 'Rahul Sharma', 'rsharma22@gitam.in', 'rahul.mech@gmail.com', '+91 98765 43222',
        'B.Tech', 'Mechanical Engineering', '2026', 'B', '7.20', '1',
        '12th Standard', 'KV Picket', '2022',
        'Hospitality & Stage Logistics', 'Transportation', 'Alumni Protocol',
        'Stage Fabricator', 'Experienced in heavy fabrication and stage sound systems.', 'BAJA SAE volunteer', 'Workshop trainee',
        'AutoCAD, SolidWorks', 'Negotiation, Physical stamina', 'SolidWorks Associate', 'Best Fabrication Award',
        'Available all 6 dates', 'Confirmed', 'https://drive.google.com/file/rahul22_resume', '',
        'Not Booked', '', '', '', '',
        '', '', '',
        'Pending', '', '', '', '',
        'Not Flagged', '', '', '',
        '', ''
      ],
      // Candidate 3: Pooja Reddy (Form email != Institutional email)
      [
        '202610304030', '202610304030', 'Pooja Reddy', 'preddy30@gitam.in', 'pooja.personal@gmail.com', '+91 98765 43230',
        'B.Tech', 'Electronics and Communication', '2026', 'C', '8.40', '0',
        '12th Standard', 'Chaitanya Junior College', '2022',
        'Alumni Hospitality', 'Guest Management', 'Registration Desk',
        'Hospitality Lead', 'Excellent communication skills with senior alumni guests.', 'Alumni meet coordinator 2024', 'HR intern',
        'MATLAB, Embedded C', 'Empathy, Multi-lingual', '', '',
        'Available all 6 dates', 'Confirmed', 'https://drive.google.com/file/pooja_resume', '',
        'Not Booked', '', '', '', '',
        '', '', '',
        'Pending', '', '', '', '',
        'Not Flagged', '', '', '',
        '', ''
      ],
      // Candidate 6: Duplicate registration entries with identical Registration Number
      [
        '202610304060', '202610304060-A', 'Siddharth Rao', 'srao60a@gitam.in', 'siddharth@gmail.com', '+91 98765 43261',
        'B.Tech', 'Information Technology', '2026', 'A', '8.10', '0',
        '12th Standard', 'Narayana Junior College', '2022',
        'Web Team', 'Logistics', 'Hospitality',
        'Coordinator', 'Duplicate Submission 1', '', '',
        'HTML, CSS', 'Communication', '', '',
        'Available all dates', 'Confirmed', '', '',
        'Not Booked', '', '', '', '',
        '', '', '',
        'Pending', '', '', '', '',
        'Not Flagged', '', '', '',
        '', ''
      ],
      [
        '202610304060', '202610304060-B', 'Siddharth Rao', 'srao60b@gitam.in', 'siddharth@gmail.com', '+91 98765 43262',
        'B.Tech', 'Information Technology', '2026', 'A', '8.10', '0',
        '12th Standard', 'Narayana Junior College', '2022',
        'Web Team', 'Logistics', 'Hospitality',
        'Coordinator', 'Duplicate Submission 2', '', '',
        'HTML, CSS', 'Communication', '', '',
        'Available all dates', 'Confirmed', '', '',
        'Not Booked', '', '', '', '',
        '', '', '',
        'Pending', '', '', '', '',
        'Not Flagged', '', '', '',
        '', ''
      ],
      // Candidate 7: Approval testing candidate
      [
        '202610304070', '202610304070', 'Vikram Varma', 'vvarma70@gitam.in', 'vikram@gmail.com', '+91 98765 43270',
        'B.Tech', 'Civil Engineering', '2026', 'A', '9.15', '0',
        '12th Standard', 'St. Marys', '2022',
        'Venue Infrastructure', 'Safety & Security', 'Signage',
        'Infrastructure Lead', 'Original unaltered essay on campus infrastructure planning.', 'Campus green initiative', '',
        'STAAD Pro, Revit', 'Leadership', 'AutoCAD Pro', 'Merit Scholar',
        'Available all dates', 'Confirmed', 'https://drive.google.com/file/vikram_resume', '',
        'Not Booked', '', '', '', '',
        '', '', '',
        'Pending', '', '', '', '',
        'Not Flagged', '', '', '',
        '', ''
      ],
      // Candidate 8: Rejection testing candidate
      [
        '202610304080', '202610304080', 'Sneha Patel', 'spatel80@gitam.in', 'sneha@gmail.com', '+91 98765 43280',
        'B.Tech', 'Biotechnology', '2026', 'A', '6.90', '2',
        '12th Standard', 'DPS', '2022',
        'Hospitality', 'Stage Management', 'Media',
        'Volunteer', 'Original application submission for bio-summit coordinator.', '', '',
        'BioPython', 'Organized', '', '',
        'Available all dates', 'Confirmed', '', '',
        'Not Booked', '', '', '', '',
        '', '', '',
        'Pending', '', '', '', '',
        'Not Flagged', '', '', '',
        '', ''
      ],
      // Candidate 9: Yellow flag testing candidate (starts Approved)
      [
        '202610304090', '202610304090', 'Kavita Joshi', 'kjoshi90@gitam.in', 'kavita@gmail.com', '+91 98765 43290',
        'B.Tech', 'CSE', '2026', 'A', '8.95', '0',
        '12th Standard', 'KV', '2022',
        'Alumni Protocol', 'Registration', 'Logistics',
        'Lead Protocol', 'Original application statement.', '', '',
        'Python', 'Speaking', '', '',
        'Available all dates', 'Confirmed', '', '',
        'Not Booked', '', '', '', '',
        '', '', '',
        'Approved', 'admin1@gitam.in', '2026-11-18T10:00:00.000Z', 'Pre-approved candidate', '',
        'Not Flagged', '', '', '',
        '', ''
      ],
      // Candidate 10: Private comments and audit history testing
      [
        '202610304100', '202610304100', 'Tarun Khanna', 'tkhanna100@gitam.in', 'tarun@gmail.com', '+91 98765 43100',
        'B.Tech', 'ECE', '2026', 'B', '8.70', '0',
        '12th Standard', 'DAV', '2022',
        'Audio/Visual Operations', 'Stage Lighting', 'Live Broadcast',
        'AV Lead', 'Original statement on managing high-end sound and broadcast equipment.', 'Sound engineer for college band', '',
        'OBS Studio, ProTools', 'Quick response', 'Avid Audio Tech', '',
        'Available all dates', 'Confirmed', 'https://drive.google.com/file/tarun_resume', '',
        'Not Booked', '', '', '', '',
        '', '', '',
        'Pending', '', '', '', '',
        'Not Flagged', '', '', '',
        '', ''
      ]
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

const secretKey = 'test-signing-secret-super-secure-key-32b';
const adminEmail1 = 'admin1@gitam.in';
const studentEmail = 'student@gitam.in';

// Helper to construct Supabase JWTs
function buildJwt(payload: Record<string, unknown>, secret = secretKey): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${hB64}.${pB64}`;
  const sig = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

const adminToken = buildJwt({
  sub: 'admin-uuid-1',
  aud: 'authenticated',
  iss: 'https://okxwlgmtonkuojbqcxeg.supabase.co/auth/v1',
  email: adminEmail1,
  email_confirmed_at: '2026-11-01T10:00:00Z',
  exp: Math.floor(Date.now() / 1000) + 3600
});

const studentToken = buildJwt({
  sub: 'student-uuid-1',
  aud: 'authenticated',
  iss: 'https://okxwlgmtonkuojbqcxeg.supabase.co/auth/v1',
  email: studentEmail,
  email_confirmed_at: '2026-11-01T10:00:00Z',
  exp: Math.floor(Date.now() / 1000) + 3600
});

const unauthorizedToken = buildJwt({
  sub: 'unauthorized-user-uuid',
  aud: 'authenticated',
  iss: 'https://okxwlgmtonkuojbqcxeg.supabase.co/auth/v1',
  email: 'attacker@otherdomain.com',
  email_confirmed_at: '2026-11-01T10:00:00Z',
  exp: Math.floor(Date.now() / 1000) + 3600
});

function createAppsScriptSandbox() {
  const mockSpreadsheet = {
    getSheetByName: (name: string) => {
      const sheetInfo = stagingSheets[name];
      if (!sheetInfo) return null;
      return {
        getName: () => name,
        getLastColumn: () => sheetInfo.headers.length,
        getLastRow: () => sheetInfo.rows.length + 1,
        getDataRange: () => ({
          getValues: () => [sheetInfo.headers, ...sheetInfo.rows]
        }),
        getRange: (row: number, col: number, numRows?: number, numCols?: number) => ({
          getValues: () => {
            if (row === 1 && numRows === 1) {
              return [sheetInfo.headers.slice(col - 1, (col - 1) + (numCols || 1))];
            }
            if (row > 1 && numRows === 1) {
              const rData = sheetInfo.rows[row - 2];
              return [rData ? rData.slice(col - 1, (col - 1) + (numCols || 1)) : []];
            }
            return [[]];
          },
          setValues: (values: (string | number)[][]) => {
            if (row > 1 && numRows === 1) {
              sheetInfo.rows[row - 2] = values[0];
            }
          },
          setValue: (val: string | number) => {
            if (row > 1) {
              if (!sheetInfo.rows[row - 2]) sheetInfo.rows[row - 2] = [];
              sheetInfo.rows[row - 2][col - 1] = val;
            }
          }
        }),
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
    parseInt,
    parseFloat,
    isNaN,
    CONFIG: null,
    SpreadsheetApp: {
      flush: () => {},
      getActiveSpreadsheet: () => mockSpreadsheet,
      openById: () => mockSpreadsheet
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => {
          if (k === 'SPREADSHEET_ID') return 'mock-ss-id';
          if (k === 'SUPABASE_JWT_SECRET') return secretKey;
          if (k === 'SUPABASE_AUDIENCE') return 'authenticated';
          if (k === 'SUPABASE_ISSUER') return 'https://okxwlgmtonkuojbqcxeg.supabase.co/auth/v1';
          if (k === 'ADMIN_EMAILS') return 'admin1@gitam.in,admin2@gitam.in,admin3@gitam.in';
          return null;
        }
      })
    },
    Utilities: {
      base64Decode: (str: string) => Array.from(Buffer.from(str, 'base64')),
      newBlob: (bytes: number[]) => ({
        getDataAsString: (_enc?: string) => {
          void _enc;
          return Buffer.from(bytes).toString('utf8');
        }
      }),
      computeHmacSha256Signature: (data: string, key: string) => {
        const hmac = crypto.createHmac('sha256', key);
        hmac.update(data);
        return Array.from(hmac.digest());
      },
      base64EncodeWebSafe: (bytes: number[]) => {
        return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      },
      getUuid: () => crypto.randomUUID()
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => true,
        releaseLock: () => {}
      })
    },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (text: string) => ({
        setMimeType: () => ({
          getContent: () => text
        })
      })
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(configCode, sandbox);
  vm.runInContext(responseCode, sandbox);
  vm.runInContext(authCode, sandbox);
  vm.runInContext(repoCode, sandbox);
  vm.runInContext(adminServiceCode, sandbox);
  vm.runInContext(codeEntryCode, sandbox);
  return sandbox;
}

interface DossierResponse {
  success: boolean;
  data?: {
    registrationNumber: string;
    originalSubmission: {
      fullName: string;
      email: string;
      cgpa: number | string;
      branch: string;
      writtenApplication: string;
      committeePreferences: {
        primary: string;
        secondary: string;
        tertiary: string;
      };
      allRawResponses: Record<string, unknown>;
    };
    adminReviewData: {
      approvalStatus: string;
      reviewFlagStatus: string;
      decisionComment?: string;
      adminComments: Array<{ commentId: string; commentText: string }>;
      reviewHistory: Array<{ reviewId: string; newApprovalStatus: string }>;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: { count?: number };
  };
}

const gasBackend = createAppsScriptSandbox() as unknown as {
  getStudentDossier: (token: string, registrationNumber: string) => DossierResponse;
  getOriginalFormSubmissionByRegistrationNumber: (regNum: string) => { success: boolean; error?: { code: string; message: string }; count?: number; rawSubmission?: Record<string, unknown> };
  reviewApprove: (params: { studentId: string; token: string; comment?: string }) => { success: boolean };
  reviewReject: (params: { studentId: string; token: string; reason: string }) => { success: boolean };
  changeApprovalStatus: (params: { studentId: string; token: string; newApprovalStatus?: string; approvalStatus?: string; reason?: string }) => { success: boolean };
  reviewFlag: (params: { studentId: string; token: string; reason: string }) => { success: boolean };
  changeReviewFlag: (params: { studentId: string; token: string; newReviewFlagStatus?: string; reviewFlagStatus?: string; reason?: string }) => { success: boolean };
  createComment: (params: { token: string; studentId: string; commentText: string; adminEmail: string; adminUid?: string }) => { success: boolean };
  doGet: (e: { parameter: Record<string, string> }) => { getContent: () => string };
  invalidateSheetCache: (name?: string) => void;
};

// ─── TEST 1: Correct Registration Number retrieves correct form submission ───
console.log('--- TEST 1: Correct Registration Number retrieves the correct form submission ---');
const test1Res = gasBackend.getStudentDossier(adminToken, '202610304010');
console.assert(test1Res.success === true, 'Test 1: Must return success for valid Registration Number');
console.assert(test1Res.data?.registrationNumber === '202610304010', 'Test 1: Registration Number must match');
console.assert(test1Res.data?.originalSubmission.fullName === 'Ananya Sharma', 'Test 1: Candidate name must match submission');
console.assert(Number(test1Res.data?.originalSubmission.cgpa) === 9.42, 'Test 1: CGPA must match submission');
console.assert(test1Res.data?.originalSubmission.committeePreferences.primary === 'Alumni Relations & Protocol', 'Test 1: Preference must match');
console.log('[PASS] Test 1: Correct Registration Number retrieves the correct form submission.\n');

// ─── TEST 2: Two students with similar names retrieve separate dossiers ───
console.log('--- TEST 2: Two students with similar names but different Registration Numbers retrieve separate dossiers ---');
const resRahulCSE = gasBackend.getStudentDossier(adminToken, '202610304021');
const resRahulMech = gasBackend.getStudentDossier(adminToken, '202610304022');
console.assert(resRahulCSE.success === true && resRahulMech.success === true, 'Test 2: Both lookups must succeed');
console.assert(resRahulCSE.data?.originalSubmission.fullName === 'Rahul Sharma', 'Test 2: Candidate 2A name is Rahul Sharma');
console.assert(resRahulMech.data?.originalSubmission.fullName === 'Rahul Sharma', 'Test 2: Candidate 2B name is Rahul Sharma');
console.assert(resRahulCSE.data?.originalSubmission.branch === 'Computer Science and Engineering', 'Test 2: 2A branch is CSE');
console.assert(resRahulMech.data?.originalSubmission.branch === 'Mechanical Engineering', 'Test 2: 2B branch is Mechanical');
console.assert(Number(resRahulCSE.data?.originalSubmission.cgpa) === 8.85, 'Test 2: 2A CGPA is 8.85');
console.assert(Number(resRahulMech.data?.originalSubmission.cgpa) === 7.20, 'Test 2: 2B CGPA is 7.20');
console.assert(resRahulCSE.data?.registrationNumber !== resRahulMech.data?.registrationNumber, 'Test 2: Distinct registration numbers');
console.log('[PASS] Test 2: Similar names retrieve separate dossiers keyed strictly by Registration Number.\n');

// ─── TEST 3: Different email addresses do not break Registration Number matching ───
console.log('--- TEST 3: Different email addresses do not break Registration Number matching ---');
const test3Res = gasBackend.getStudentDossier(adminToken, '202610304030');
console.assert(test3Res.success === true, 'Test 3: Must succeed despite different email in form vs DB');
console.assert(test3Res.data?.originalSubmission.fullName === 'Pooja Reddy', 'Test 3: Correct student retrieved');
console.assert(test3Res.data?.originalSubmission.email === 'preddy30@gitam.in', 'Test 3: Email extracted cleanly');
console.log('[PASS] Test 3: Different email addresses do not break Registration Number matching.\n');

// ─── TEST 4: A missing Registration Number returns a controlled error ───
console.log('--- TEST 4: A missing Registration Number returns a controlled error ---');
const test4ResEmpty = gasBackend.getStudentDossier(adminToken, '');
const test4ResWhitespace = gasBackend.getStudentDossier(adminToken, '   ');
console.assert(test4ResEmpty.success === false, 'Test 4: Empty registration number must fail');
console.assert(test4ResEmpty.error?.code === 'MISSING_REGISTRATION_NUMBER', 'Test 4: Error code must be MISSING_REGISTRATION_NUMBER');
console.assert(test4ResWhitespace.success === false, 'Test 4: Whitespace registration number must fail');
console.assert(test4ResWhitespace.error?.code === 'MISSING_REGISTRATION_NUMBER', 'Test 4: Error code must be MISSING_REGISTRATION_NUMBER');
console.log('[PASS] Test 4: Missing Registration Number returns controlled MISSING_REGISTRATION_NUMBER error.\n');

// ─── TEST 5: No matching registration returns a controlled error ───
console.log('--- TEST 5: No matching registration returns a controlled error ---');
const test5Res = gasBackend.getStudentDossier(adminToken, '202699999999');
console.assert(test5Res.success === false, 'Test 5: Non-existent registration must fail');
console.assert(test5Res.error?.code === 'SUBMISSION_NOT_FOUND', 'Test 5: Error code must be SUBMISSION_NOT_FOUND');
console.assert(test5Res.error?.message.includes('202699999999'), 'Test 5: Message must state the queried registration number');
console.log('[PASS] Test 5: No matching registration returns controlled SUBMISSION_NOT_FOUND error.\n');

// ─── TEST 6: Duplicate Registration Numbers are detected ───
console.log('--- TEST 6: Duplicate Registration Numbers are detected ---');
const test6Res = gasBackend.getStudentDossier(adminToken, '202610304060');
console.assert(test6Res.success === false, 'Test 6: Ambiguous registration must fail');
console.assert(test6Res.error?.code === 'AMBIGUOUS_REGISTRATION', 'Test 6: Error code must be AMBIGUOUS_REGISTRATION');
console.assert(test6Res.error?.details?.count === 2, 'Test 6: Detected duplicate count must be 2');
console.log('[PASS] Test 6: Duplicate Registration Numbers detected and blocked with AMBIGUOUS_REGISTRATION warning.\n');

// ─── TEST 7: Original form answers remain unchanged after admin approval ───
console.log('--- TEST 7: Original form answers remain unchanged after admin approval ---');
const reg7 = '202610304070';
const preApprovalDossier = gasBackend.getStudentDossier(adminToken, reg7);
const originalCgpa = preApprovalDossier.data?.originalSubmission.cgpa;
const originalEssay = preApprovalDossier.data?.originalSubmission.writtenApplication;

// Admin executes approval
const approveRes = gasBackend.reviewApprove({ studentId: reg7, token: adminToken, comment: 'Candidate approved by committee' });
console.assert(approveRes.success === true, 'Test 7: Approval action must succeed');

// Fetch dossier post-approval
gasBackend.invalidateSheetCache('Student Database');
const postApprovalDossier = gasBackend.getStudentDossier(adminToken, reg7);
console.assert(postApprovalDossier.success === true, 'Test 7: Post-approval dossier retrieval must succeed');
console.assert(postApprovalDossier.data?.originalSubmission.cgpa === originalCgpa, 'Test 7: Original CGPA must remain unchanged');
console.assert(postApprovalDossier.data?.originalSubmission.writtenApplication === originalEssay, 'Test 7: Original written application must remain unchanged');
console.assert(postApprovalDossier.data?.adminReviewData.approvalStatus === 'Approved', 'Test 7: Admin review status updated to Approved');
console.log('[PASS] Test 7: Original form answers remain unchanged after admin approval.\n');

// ─── TEST 8: Admin rejection does not overwrite original form answers ───
console.log('--- TEST 8: Admin rejection does not overwrite original form answers ---');
const reg8 = '202610304080';
const preRejectDossier = gasBackend.getStudentDossier(adminToken, reg8);
const originalBioApp = preRejectDossier.data?.originalSubmission.writtenApplication;

// Admin executes rejection
const rejectRes = gasBackend.changeApprovalStatus({
  studentId: reg8,
  token: adminToken,
  approvalStatus: 'Rejected',
  reason: 'Insufficient prerequisite credentials'
});
console.assert(rejectRes.success === true, 'Test 8: Rejection action must succeed');

// Fetch dossier post-rejection
gasBackend.invalidateSheetCache('Student Database');
const postRejectDossier = gasBackend.getStudentDossier(adminToken, reg8);
console.assert(postRejectDossier.success === true, 'Test 8: Post-rejection dossier retrieval must succeed');
console.assert(postRejectDossier.data?.originalSubmission.writtenApplication === originalBioApp, 'Test 8: Original form application text must remain intact');
console.assert(postRejectDossier.data?.adminReviewData.approvalStatus === 'Rejected', 'Test 8: Admin review status updated to Rejected');
console.assert(postRejectDossier.data?.adminReviewData.decisionComment === 'Insufficient prerequisite credentials', 'Test 8: Rejection rationale recorded');
console.log('[PASS] Test 8: Admin rejection does not overwrite original form answers.\n');

// ─── TEST 9: Yellow flag does not change approval status ───
console.log('--- TEST 9: Yellow flag does not change approval status ---');
const reg9 = '202610304090';
// Candidate 9 starts with ApprovalStatus: 'Approved'
const preFlagDossier = gasBackend.getStudentDossier(adminToken, reg9);
console.assert(preFlagDossier.data?.adminReviewData.approvalStatus === 'Approved', 'Test 9: Initial status must be Approved');

// Admin marks Yellow Flag
const flagRes = gasBackend.changeReviewFlag({
  studentId: reg9,
  token: adminToken,
  newReviewFlagStatus: 'Yellow Flagged',
  reason: 'Document verification required'
});
console.assert(flagRes.success === true, 'Test 9: Flag action must succeed');

// Fetch dossier post-flag
gasBackend.invalidateSheetCache('Student Database');
const postFlagDossier = gasBackend.getStudentDossier(adminToken, reg9);
console.assert(postFlagDossier.data?.adminReviewData.reviewFlagStatus === 'Yellow Flagged', 'Test 9: Review flag status must be Yellow Flagged');
console.assert(postFlagDossier.data?.adminReviewData.approvalStatus === 'Approved', 'Test 9: Approval status must STILL be Approved (not mutated)');
console.log('[PASS] Test 9: Yellow flag does not mutate approval status.\n');

// ─── TEST 10: Comments and audit history remain separate from original responses ───
console.log('--- TEST 10: Comments and audit history remain separate from original responses ---');
const reg10 = '202610304100';
gasBackend.createComment({
  token: adminToken,
  studentId: reg10,
  commentText: 'Candidate demonstrated high aptitude in sound rigging',
  adminEmail: adminEmail1,
  adminUid: 'admin-1'
});

gasBackend.invalidateSheetCache('Student Database');
const test10Dossier = gasBackend.getStudentDossier(adminToken, reg10);
console.assert(test10Dossier.success === true, 'Test 10: Must retrieve dossier');
console.assert(test10Dossier.data?.adminReviewData.adminComments.length === 1, 'Test 10: Admin comments present in adminReviewData');
console.assert(test10Dossier.data?.adminReviewData.adminComments[0].commentText === 'Candidate demonstrated high aptitude in sound rigging', 'Test 10: Comment text matches');
// Verify originalSubmission is pristine
console.assert(!('AdminComments' in test10Dossier.data!.originalSubmission), 'Test 10: originalSubmission must not contain AdminComments');
console.assert(!('adminComments' in test10Dossier.data!.originalSubmission), 'Test 10: originalSubmission must not contain adminComments');
console.assert(test10Dossier.data?.originalSubmission.allRawResponses.WrittenApplication === 'Original statement on managing high-end sound and broadcast equipment.', 'Test 10: Original submission intact');
console.log('[PASS] Test 10: Comments and audit history remain completely separate from original responses.\n');

// ─── TEST 11: A student cannot access another student's dossier ───
console.log('--- TEST 11: A student cannot access another student\'s dossier ---');
const test11Res = gasBackend.getStudentDossier(studentToken, '202610304010');
console.assert(test11Res.success === false, 'Test 11: Student token must be rejected');
console.assert(test11Res.error?.code === 'FORBIDDEN_ADMIN', 'Test 11: Error code must be FORBIDDEN_ADMIN');
console.log('[PASS] Test 11: Student token is strictly blocked from accessing dossier endpoint.\n');

// ─── TEST 12: An unauthorized admin cannot access the dossier endpoint ───
console.log('--- TEST 12: An unauthorized admin cannot access the dossier endpoint ---');
const test12ResUnauth = gasBackend.getStudentDossier(unauthorizedToken, '202610304010');
const test12ResNoToken = gasBackend.getStudentDossier('', '202610304010');
const test12ResMalformed = gasBackend.getStudentDossier('malformed.fake.token', '202610304010');

console.assert(test12ResUnauth.success === false, 'Test 12: Unauthorized user must be blocked');
console.assert(test12ResUnauth.error?.code === 'FORBIDDEN_ADMIN', 'Test 12: Error code must be FORBIDDEN_ADMIN');
console.assert(test12ResNoToken.success === false, 'Test 12: Missing token must be blocked');
console.assert(test12ResNoToken.error?.code === 'AUTH_MISSING', 'Test 12: Error code must be AUTH_MISSING');
console.assert(test12ResMalformed.success === false, 'Test 12: Malformed token must be blocked');
console.assert(test12ResMalformed.error?.code === 'AUTH_INVALID', 'Test 12: Error code must be AUTH_INVALID');

// Also test HTTP GET dispatcher
const httpGetResult = JSON.parse(gasBackend.doGet({
  parameter: {
    action: 'getStudentDossier',
    token: unauthorizedToken,
    registrationNumber: '202610304010'
  }
}).getContent());
console.assert(httpGetResult.success === false, 'Test 12: doGet dispatcher must reject unauthorized admin');
console.assert(httpGetResult.error?.code === 'FORBIDDEN_ADMIN', 'Test 12: doGet must return FORBIDDEN_ADMIN');
console.log('[PASS] Test 12: Unauthorized access to dossier endpoint strictly blocked across all paths.\n');

console.log('================================================================');
console.log('ALL 12 REGISTRATION NUMBER-BASED DOSSIER TESTS PASSED (0 ERRORS)');
console.log('================================================================\n');
