import type {
  BookingConfirmation,
  DaySummary,
  SearchFilters,
  SlotWithStatus,
  Student,
} from '../types'
import { INITIAL_MOCK_BOOKINGS } from '../data/mockBookings.ts'
import { INITIAL_MOCK_STUDENTS } from '../data/mockStudents.ts'
import { formatTime12h, generateDaySlots, getDisplayDate, isValidSlot } from '../utils/schedule.ts'

const STORAGE_KEYS = {
  STUDENTS: 'gitam_mock_students_v1',
  BOOKINGS: 'gitam_mock_bookings_v1',
}

class MockStorageService {
  private inMemoryStudents: Student[] = []
  private inMemoryBookings: BookingConfirmation[] = []

  constructor() {
    this.init()
  }

  private init() {
    try {
      const storedStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS)
      const storedBookings = localStorage.getItem(STORAGE_KEYS.BOOKINGS)

      if (storedStudents && storedBookings) {
        this.inMemoryStudents = JSON.parse(storedStudents)
        this.inMemoryBookings = JSON.parse(storedBookings)
        return
      }
    } catch {
      // In-memory fallback if localStorage fails or is blocked
    }

    this.resetToInitial()
  }

  public resetToInitial() {
    this.inMemoryStudents = JSON.parse(JSON.stringify(INITIAL_MOCK_STUDENTS))
    this.inMemoryBookings = JSON.parse(JSON.stringify(INITIAL_MOCK_BOOKINGS))
    this.save()
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(this.inMemoryStudents))
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(this.inMemoryBookings))
    } catch {
      // In-memory mode active
    }
  }

  // ─── Query Operations ─────────────────────────────────────

  public getAllStudents(): Student[] {
    return [...this.inMemoryStudents]
  }

  public getStudentById(studentId: string): Student | undefined {
    return this.inMemoryStudents.find((s) => s.studentId === studentId)
  }

  public getStudentByEmail(email: string): Student | undefined {
    return this.inMemoryStudents.find(
      (s) => s.gitamEmail.toLowerCase() === email.toLowerCase() || s.personalEmail.toLowerCase() === email.toLowerCase(),
    )
  }

  public getAllBookings(): BookingConfirmation[] {
    return [...this.inMemoryBookings]
  }

  /**
   * Returns all 36 slots for a given eligible date with their current status.
   */
  public getSlotsForDate(date: string): SlotWithStatus[] {
    const baseSlots = generateDaySlots(date)
    const bookingsForDate = this.inMemoryBookings.filter((b) => b.date === date)

    return baseSlots.map((slot) => {
      const matchedBooking = bookingsForDate.find((b) => b.startTime === slot.startTime)
      if (matchedBooking) {
        return {
          ...slot,
          status: 'BOOKED',
          bookedStudentId: matchedBooking.studentId,
          bookingId: matchedBooking.bookingId,
        }
      }
      return {
        ...slot,
        status: 'AVAILABLE',
      }
    })
  }

  /**
   * Computes the daily summary for a given date.
   */
  public getDaySummary(date: string): DaySummary {
    const slots = this.getSlotsForDate(date)
    const bookedSlots = slots.filter((s) => s.status === 'BOOKED')
    const bookedStudentIds = bookedSlots.map((s) => s.bookedStudentId).filter(Boolean) as string[]

    const studentsForDate = this.inMemoryStudents.filter((s) => bookedStudentIds.includes(s.studentId))

    const pending = studentsForDate.filter((s) => s.approvalStatus === 'Pending').length
    const approved = studentsForDate.filter((s) => s.approvalStatus === 'Approved').length
    const rejected = studentsForDate.filter((s) => s.approvalStatus === 'Rejected').length
    const flagged = studentsForDate.filter((s) => s.reviewFlagStatus === 'Flagged for Review').length

    return {
      date,
      displayDate: getDisplayDate(date),
      totalSlots: 36,
      booked: bookedSlots.length,
      available: 36 - bookedSlots.length,
      pending,
      approved,
      rejected,
      flagged,
    }
  }

  // ─── Booking Actions ──────────────────────────────────────

  /**
   * Books a slot for a student while enforcing:
   * 1. Valid slot verification
   * 2. Slot occupancy check (one student per slot)
   * 3. One active booking per student
   * 4. Idempotency (BookingRequestID)
   */
  public bookSlot(params: {
    studentId: string
    date: string
    startTime: string
    bookingRequestId?: string
  }): { success: boolean; message: string; confirmation?: BookingConfirmation } {
    const { studentId, date, startTime } = params
    const bookingRequestId = params.bookingRequestId || `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    // 1. Idempotency check: if this request ID was already processed, return existing confirmation
    const existingReq = this.inMemoryBookings.find((b) => b.bookingRequestId === bookingRequestId)
    if (existingReq) {
      return { success: true, message: 'Existing booking returned for this request ID.', confirmation: existingReq }
    }

    // 2. Validate slot exists in central schedule
    if (!isValidSlot(date, startTime)) {
      return { success: false, message: 'Selected time slot does not belong to the eligible interview schedule.' }
    }

    // 3. Resolve student
    const student = this.getStudentById(studentId)
    if (!student) {
      return { success: false, message: `Student record with ID ${studentId} not found.` }
    }

    // 4. Enforce ONE active booking per student rule
    if (student.bookingStatus === 'Booked') {
      return {
        success: false,
        message: `Student ${student.fullName} already has an active booking on ${student.bookedDate} at ${student.bookedSlotStart}. Only one active booking is permitted.`,
      }
    }

    // 5. Enforce ONE student per slot rule (slot occupancy)
    const slotOccupied = this.inMemoryBookings.some((b) => b.date === date && b.startTime === startTime)
    if (slotOccupied) {
      return { success: false, message: 'This time slot was just booked by another student. Please select an available slot.' }
    }

    // 6. Calculate end time (10 minutes after start)
    const [h, m] = startTime.split(':').map(Number)
    const endMinutes = h * 60 + m + 10
    const endH = Math.floor(endMinutes / 60)
    const endM = endMinutes % 60
    const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`

    const bookingId = `BK-${date.replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const confirmation: BookingConfirmation = {
      bookingId,
      bookingRequestId,
      studentId,
      studentName: student.fullName,
      gitamEmail: student.gitamEmail,
      date,
      displayDate: getDisplayDate(date),
      startTime,
      endTime,
      displayStart: formatTime12h(h, m),
      displayEnd: formatTime12h(endH, endM),
      status: 'Confirmed',
    }

    // Update student master record
    student.bookingStatus = 'Booked'
    student.bookingId = bookingId
    student.bookingRequestId = bookingRequestId
    student.bookedDate = date
    student.bookedSlotStart = startTime
    student.bookedSlotEnd = endTime
    student.bookedTimestamp = new Date().toISOString()

    this.inMemoryBookings.push(confirmation)
    this.save()

    return {
      success: true,
      message: 'Interview slot successfully confirmed.',
      confirmation,
    }
  }

  // ─── Admin Review Operations ──────────────────────────────

  public approveStudent(studentId: string, comment: string, adminName: string): boolean {
    const student = this.getStudentById(studentId)
    if (!student) return false

    student.approvalStatus = 'Approved'
    student.decisionBy = adminName || 'Administrator'
    student.decisionTimestamp = new Date().toISOString()
    student.decisionComment = comment || ''

    this.save()
    return true
  }

  public rejectStudent(studentId: string, reason: string, adminName: string): boolean {
    const student = this.getStudentById(studentId)
    if (!student) return false

    student.approvalStatus = 'Rejected'
    student.decisionBy = adminName || 'Administrator'
    student.decisionTimestamp = new Date().toISOString()
    student.decisionComment = reason

    this.save()
    return true
  }

  public flagStudent(studentId: string, reason: string, adminName: string): boolean {
    const student = this.getStudentById(studentId)
    if (!student) return false

    student.reviewFlagStatus = 'Flagged for Review'
    student.flaggedBy = adminName || 'Administrator'
    student.flaggedAt = new Date().toISOString()
    student.flagReason = reason

    this.save()
    return true
  }

  public clearFlag(studentId: string): boolean {
    const student = this.getStudentById(studentId)
    if (!student) return false

    student.reviewFlagStatus = 'Not Flagged'
    student.flaggedBy = ''
    student.flaggedAt = ''
    student.flagReason = ''

    this.save()
    return true
  }

  // ─── Filter & Search Helpers ──────────────────────────────

  public filterStudents(students: Student[], filters: SearchFilters, activeDate?: string): Student[] {
    return students.filter((s) => {
      // Date filter
      if (activeDate && s.bookedDate !== activeDate) return false

      // Name query
      if (filters.nameQuery.trim()) {
        const query = filters.nameQuery.toLowerCase()
        if (!s.fullName.toLowerCase().includes(query)) return false
      }

      // Email query
      if (filters.emailQuery.trim()) {
        const query = filters.emailQuery.toLowerCase()
        if (!s.gitamEmail.toLowerCase().includes(query) && !s.personalEmail.toLowerCase().includes(query)) {
          return false
        }
      }

      // Academic year
      if (filters.academicYear && s.academicYear !== filters.academicYear) {
        return false
      }

      // Booking status
      if (filters.bookingStatus && s.bookingStatus !== filters.bookingStatus) {
        return false
      }

      // Approval status
      if (filters.approvalStatus && s.approvalStatus !== filters.approvalStatus) {
        return false
      }

      // Review flag status
      if (filters.reviewFlagStatus && s.reviewFlagStatus !== filters.reviewFlagStatus) {
        return false
      }

      return true
    })
  }

  public getFlaggedStudents(): Student[] {
    return this.inMemoryStudents.filter((s) => s.reviewFlagStatus === 'Flagged for Review')
  }

  public getUnbookedStudents(): Student[] {
    return this.inMemoryStudents.filter((s) => s.bookingStatus !== 'Booked')
  }
}

export const mockStorage = new MockStorageService()
