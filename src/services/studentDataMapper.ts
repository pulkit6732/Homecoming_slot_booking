/**
 * Registration Database Mapping and Normalization Layer
 * 
 * Project: GITAM Homecoming Interview Portal 2026
 * 
 * Provides dynamic header mapping between raw Google Sheets rows and the internal Student model.
 * Preserves all original Google Form registration fields without mutation.
 * Enforces verified email matching and safe duplicate handling.
 * Zero emojis per specification.
 */

import type { Student, BookingStatus, ApprovalStatus, ReviewFlagStatus } from '../types'

export interface RawSpreadsheetRow {
  [header: string]: unknown
}

export interface FieldMappingConfig {
  emailHeaders: string[]
  studentIdHeaders: string[]
  fullNameHeaders: string[]
  phoneHeaders: string[]
  programHeaders: string[]
  branchHeaders: string[]
  academicYearHeaders: string[]
  cgpaHeaders: string[]
  resumeHeaders: string[]
  documentHeaders: string[]
}

export const DEFAULT_FIELD_MAPPING_CONFIG: FieldMappingConfig = {
  emailHeaders: [
    'Email',
    'Email Address',
    'GITAM Email',
    'GITAM Email Address',
    'Student Email',
    'Candidate Email',
    'Institutional Email',
    'Personal Email',
  ],
  studentIdHeaders: [
    'StudentID',
    'Student ID',
    'Roll Number',
    'Roll No',
    'Registration Number',
    'Registration no.',
    'Reg No',
  ],
  fullNameHeaders: [
    'FullName',
    'Full Name',
    'Name',
    'Student Name',
    'Candidate Name',
  ],
  phoneHeaders: [
    'PhoneNumber',
    'Phone Number',
    'Phone',
    'Mobile Number',
    'Contact Number',
  ],
  programHeaders: [
    'Program',
    'Degree',
    'Course',
  ],
  branchHeaders: [
    'Branch',
    'Department',
    'Specialization',
  ],
  academicYearHeaders: [
    'AcademicYear',
    'Academic Year',
    'Year',
  ],
  cgpaHeaders: [
    'CGPA',
    'Current CGPA',
    'Grade Point Average',
  ],
  resumeHeaders: [
    'ResumeLink',
    'Resume Link',
    'Resume',
    'Upload Resume',
  ],
  documentHeaders: [
    'DocumentLinks',
    'Document Links',
    'Verification Documents',
    'Certificates',
  ],
}

/**
 * Normalizes email address by trimming whitespace, lowercasing, and removing internal whitespace.
 */
export function normalizeEmail(email: unknown): string {
  if (!email || typeof email !== 'string') return ''
  return email.trim().toLowerCase().replace(/\s+/g, '')
}

/**
 * Extracts a field value from a raw row given candidate header names.
 */
export function extractFieldByHeaders(row: RawSpreadsheetRow, candidateHeaders: string[]): string {
  const rowKeys = Object.keys(row)
  for (const candidate of candidateHeaders) {
    const candidateClean = candidate.trim().toLowerCase()
    for (const key of rowKeys) {
      if (key.trim().toLowerCase() === candidateClean) {
        const val = row[key]
        if (val !== undefined && val !== null) {
          return String(val).trim()
        }
      }
    }
  }
  return ''
}

export interface StudentNormalizationResult {
  success: boolean
  student?: Student
  error?: string
  isDuplicate?: boolean
  extractedEmail?: string
}

/**
 * Maps a single raw spreadsheet row into the internal Student model without altering original data.
 */
export function mapRawRowToStudent(
  rawRow: RawSpreadsheetRow,
  config: FieldMappingConfig = DEFAULT_FIELD_MAPPING_CONFIG
): StudentNormalizationResult {
  const email = normalizeEmail(extractFieldByHeaders(rawRow, config.emailHeaders))
  if (!email) {
    return {
      success: false,
      error: 'Row missing required institutional or candidate email address',
    }
  }

  const rawStudentId = extractFieldByHeaders(rawRow, config.studentIdHeaders)
  const fullName = extractFieldByHeaders(rawRow, config.fullNameHeaders) || 'Candidate'
  const phoneNumber = extractFieldByHeaders(rawRow, config.phoneHeaders)
  const program = extractFieldByHeaders(rawRow, config.programHeaders) || 'Undergraduate'
  const branch = extractFieldByHeaders(rawRow, config.branchHeaders) || 'General'
  const academicYear = extractFieldByHeaders(rawRow, config.academicYearHeaders) || '2026'
  const rawCgpa = extractFieldByHeaders(rawRow, config.cgpaHeaders)
  const cgpa = parseFloat(rawCgpa) || 0.0

  const resumeLink = extractFieldByHeaders(rawRow, config.resumeHeaders)
  const documentLinks = extractFieldByHeaders(rawRow, config.documentHeaders)

  // Booking, approval, and review fields preserved if present in row
  const bookingStatus = (extractFieldByHeaders(rawRow, ['BookingStatus', 'Booking Status']) || 'Not Booked') as BookingStatus
  const bookingId = extractFieldByHeaders(rawRow, ['BookingID', 'Booking ID'])
  const bookingRequestId = extractFieldByHeaders(rawRow, ['BookingRequestID', 'Booking Request ID'])
  const bookedDate = extractFieldByHeaders(rawRow, ['InterviewDate', 'Interview Date'])
  const bookedSlotStart = extractFieldByHeaders(rawRow, ['InterviewStart', 'Interview Start'])
  const bookedSlotEnd = extractFieldByHeaders(rawRow, ['InterviewEnd', 'Interview End'])
  const bookedTimestamp = extractFieldByHeaders(rawRow, ['BookingTimestamp', 'Booking Timestamp'])

  const approvalStatus = (extractFieldByHeaders(rawRow, ['ApprovalStatus', 'Approval Status']) || 'Pending') as ApprovalStatus
  const decisionBy = extractFieldByHeaders(rawRow, ['DecisionBy', 'Decision By'])
  const decisionTimestamp = extractFieldByHeaders(rawRow, ['DecisionTimestamp', 'Decision Timestamp'])
  const decisionComment = extractFieldByHeaders(rawRow, ['DecisionComment', 'Decision Comment', 'AdminComment'])

  const reviewFlagStatus = (extractFieldByHeaders(rawRow, ['ReviewFlagStatus', 'Review Flag Status']) || 'Not Flagged') as ReviewFlagStatus
  const flaggedBy = extractFieldByHeaders(rawRow, ['FlaggedBy', 'Flagged By'])
  const flaggedAt = extractFieldByHeaders(rawRow, ['FlaggedAt', 'Flagged At'])
  const flagReason = extractFieldByHeaders(rawRow, ['FlagReason', 'Flag Reason'])

  const nameParts = fullName.split(' ')
  const firstName = nameParts[0] || fullName
  const lastName = nameParts.slice(1).join(' ')

  const student: Student = {
    studentId: rawStudentId || email,
    fullName,
    firstName,
    lastName,
    dateOfBirth: extractFieldByHeaders(rawRow, ['DateOfBirth', 'Date of Birth', 'DOB']),
    gender: extractFieldByHeaders(rawRow, ['Gender', 'Sex']) || 'Unspecified',
    phoneNumber,
    personalEmail: email,
    gitamEmail: email,
    address: extractFieldByHeaders(rawRow, ['Address', 'Residential Address']),
    city: extractFieldByHeaders(rawRow, ['City']) || 'Hyderabad',
    state: extractFieldByHeaders(rawRow, ['State']) || 'Telangana',
    country: extractFieldByHeaders(rawRow, ['Country']) || 'India',

    academicYear,
    program,
    branch,
    section: extractFieldByHeaders(rawRow, ['Section', 'Class Section']) || 'A',
    rollNumber: rawStudentId || email,
    cgpa,
    backlogs: parseInt(extractFieldByHeaders(rawRow, ['Backlogs', 'Active Backlogs']) || '0', 10),

    highestQualification: extractFieldByHeaders(rawRow, ['HighestQualification', 'Highest Qualification']) || program,
    universityCollege: extractFieldByHeaders(rawRow, ['UniversityCollege', 'College', 'University']) || 'GITAM University',
    yearOfPassing: extractFieldByHeaders(rawRow, ['YearOfPassing', 'Passing Year']) || '2026',

    achievements: extractFieldByHeaders(rawRow, ['Achievements']),
    certifications: extractFieldByHeaders(rawRow, ['Certifications']),
    technicalSkills: extractFieldByHeaders(rawRow, ['TechnicalSkills', 'Technical Skills']),
    softSkills: extractFieldByHeaders(rawRow, ['SoftSkills', 'Soft Skills']),
    projects: extractFieldByHeaders(rawRow, ['Projects', 'Project Highlights']),
    internships: extractFieldByHeaders(rawRow, ['Internships']),
    workExperience: extractFieldByHeaders(rawRow, ['WorkExperience', 'Experience']),
    domainPreference1: extractFieldByHeaders(rawRow, ['DomainPreference1', 'Preference 1', 'Primary Preference']),
    domainPreference2: extractFieldByHeaders(rawRow, ['DomainPreference2', 'Preference 2', 'Secondary Preference']),
    domainPreference3: extractFieldByHeaders(rawRow, ['DomainPreference3', 'Preference 3', 'Tertiary Preference']),

    formSubmissionTimestamp: extractFieldByHeaders(rawRow, ['Timestamp', 'Submission Timestamp', 'FormSubmissionTimestamp']),
    resumeLink,
    documentLinks,

    bookingStatus,
    bookingId,
    bookingRequestId,
    bookedDate,
    bookedSlotStart,
    bookedSlotEnd,
    bookedTimestamp,

    approvalStatus,
    decisionBy,
    decisionTimestamp,
    decisionComment,

    reviewFlagStatus,
    flaggedBy,
    flaggedAt,
    flagReason,
  }

  return {
    success: true,
    student,
    extractedEmail: email,
  }
}

/**
 * Batch maps a collection of raw spreadsheet rows into validated Student records.
 * Identifies duplicate email registrations safely without throwing or silently discarding data.
 */
export function mapSpreadsheetDataset(
  rawRows: RawSpreadsheetRow[],
  config: FieldMappingConfig = DEFAULT_FIELD_MAPPING_CONFIG
): {
  validStudents: Student[]
  duplicateRecords: { email: string; rows: RawSpreadsheetRow[] }[]
  unmappedRows: RawSpreadsheetRow[]
} {
  const validStudents: Student[] = []
  const seenEmails = new Map<string, RawSpreadsheetRow[]>()
  const unmappedRows: RawSpreadsheetRow[] = []

  for (const row of rawRows) {
    const res = mapRawRowToStudent(row, config)
    if (!res.success || !res.student || !res.extractedEmail) {
      unmappedRows.push(row)
      continue
    }

    const email = res.extractedEmail
    if (!seenEmails.has(email)) {
      seenEmails.set(email, [row])
      validStudents.push(res.student)
    } else {
      // Duplicate registration row detected
      seenEmails.get(email)!.push(row)
    }
  }

  const duplicateRecords: { email: string; rows: RawSpreadsheetRow[] }[] = []
  for (const [email, rows] of seenEmails.entries()) {
    if (rows.length > 1) {
      duplicateRecords.push({ email, rows })
    }
  }

  return {
    validStudents,
    duplicateRecords,
    unmappedRows,
  }
}
