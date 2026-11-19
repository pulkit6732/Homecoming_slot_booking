// ─── Enums ───────────────────────────────────────────────

export type BookingStatus = 'Not Booked' | 'Booked' | 'Cancelled'
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected'
export type ReviewFlagStatus = 'Not Flagged' | 'Flagged for Review' | 'Yellow Flagged'
export type SlotStatus = 'AVAILABLE' | 'BOOKED'

// ─── Review & Private Comments ────────────────────────────

export interface CommentVersion {
  commentText: string
  editedAt: string
  editedBy: string
}

export interface AdminComment {
  commentId: string
  studentId: string
  adminUid: string
  adminEmail: string
  commentText: string
  createdAt: string
  updatedAt: string
  isEdited: boolean
  editHistory?: CommentVersion[]
}

export interface ReviewHistoryEntry {
  reviewId: string
  studentId: string
  previousApprovalStatus: ApprovalStatus
  newApprovalStatus: ApprovalStatus
  previousReviewFlagStatus: ReviewFlagStatus
  newReviewFlagStatus: ReviewFlagStatus
  changedBy: string
  changedAt: string
  reason?: string
}

// ─── Schedule ────────────────────────────────────────────

export interface TimeSlot {
  date: string            // ISO date string YYYY-MM-DD
  startTime: string       // HH:mm (24h)
  endTime: string         // HH:mm (24h)
  displayStart: string    // 9:00 AM
  displayEnd: string      // 9:10 AM
  session: 'morning' | 'afternoon'
  slotIndex: number       // 0-35 within the day
}

export interface SlotWithStatus extends TimeSlot {
  status: SlotStatus
  bookedStudentId?: string
  bookingId?: string
}

export interface DaySummary {
  date: string
  displayDate: string
  totalSlots: number
  booked: number
  available: number
  pending: number
  approved: number
  rejected: number
  flagged: number
}

// ─── Student (≈40 fields) ────────────────────────────────

export interface Student {
  // Identity
  studentId: string
  registrationNumber?: string | undefined
  fullName: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  phoneNumber: string
  personalEmail: string
  gitamEmail: string
  address: string
  city: string
  state: string
  country: string

  // Academic
  academicYear: string
  program: string
  branch: string
  section: string
  rollNumber: string
  cgpa: number
  backlogs: number

  // Qualifications
  highestQualification: string
  universityCollege: string
  yearOfPassing: string

  // Profile
  achievements: string
  certifications: string
  technicalSkills: string
  softSkills: string
  projects: string
  internships: string
  workExperience: string
  domainPreference1: string
  domainPreference2: string
  domainPreference3: string

  // Form submission
  formSubmissionTimestamp: string
  resumeLink: string
  documentLinks: string

  // Booking fields
  bookingStatus: BookingStatus
  bookingId: string
  bookingRequestId: string
  bookedDate: string
  bookedSlotStart: string
  bookedSlotEnd: string
  bookedTimestamp: string

  // Approval fields
  approvalStatus: ApprovalStatus
  decisionBy: string
  decisionTimestamp: string
  decisionComment: string

  // Review fields
  reviewFlagStatus: ReviewFlagStatus
  flaggedBy: string
  flaggedAt: string
  flagReason: string

  // Dossier application sections (recruitment submission)
  committeePreferences?: string
  rolesAppliedFor?: string
  writtenApplication?: string
  selfAssessment?: string
  availabilityCommute?: string

  // Private administration & audit history
  adminComments?: AdminComment[]
  reviewHistory?: ReviewHistoryEntry[]
}

// ─── Booking ─────────────────────────────────────────────

export interface BookingConfirmation {
  bookingId: string
  bookingRequestId: string
  studentId: string
  studentName: string
  gitamEmail: string
  date: string
  displayDate: string
  startTime: string
  endTime: string
  displayStart?: string
  displayEnd?: string
  status: 'Confirmed'
}

// ─── Filters ─────────────────────────────────────────────

export interface SearchFilters {
  nameQuery: string
  emailQuery: string
  academicYear: string
  bookingStatus: BookingStatus | ''
  approvalStatus: ApprovalStatus | ''
  reviewFlagStatus: ReviewFlagStatus | ''
}

// ─── Pagination ──────────────────────────────────────────

export interface PaginationState {
  currentPage: number
  entriesPerPage: number | 'all'
  totalEntries: number
}

export type EntriesPerPage = 10 | 25 | 50 | 'all'

// ─── Student Dossier (Original Form Submission & Separate Admin Review Data) ───

export interface OriginalFormSubmission {
  timestamp?: string
  registrationNumber: string
  fullName: string
  email: string
  personalEmail?: string
  phoneNumber?: string
  dateOfBirth?: string
  gender?: string
  address?: string
  city?: string
  state?: string
  country?: string
  program?: string
  branch?: string
  academicYear?: string
  section?: string
  cgpa?: number | string
  backlogs?: number | string
  highestQualification?: string
  universityCollege?: string
  yearOfPassing?: string
  committeePreferences?: {
    primary?: string
    secondary?: string
    tertiary?: string
  }
  rolesAppliedFor?: string
  writtenApplication?: string
  priorExperience?: string
  internships?: string
  technicalSkills?: string
  softSkills?: string
  certifications?: string
  achievements?: string
  availabilityCommute?: string
  eventCommitment?: string
  resumeLink?: string
  documentLinks?: string
  allRawResponses: Record<string, unknown>
}

export interface AdminReviewData {
  approvalStatus: ApprovalStatus
  decisionBy?: string
  decisionTimestamp?: string
  decisionComment?: string
  reviewFlagStatus: ReviewFlagStatus
  flaggedBy?: string
  flaggedAt?: string
  flagReason?: string
  bookingStatus: BookingStatus
  bookingId?: string
  bookingRequestId?: string
  bookedDate?: string
  bookedSlotStart?: string
  bookedSlotEnd?: string
  bookedTimestamp?: string
  adminComments: AdminComment[]
  reviewHistory: ReviewHistoryEntry[]
}

export interface StudentDossier {
  registrationNumber: string
  originalSubmission: OriginalFormSubmission
  adminReviewData: AdminReviewData
}
