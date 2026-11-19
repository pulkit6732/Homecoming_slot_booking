import { useState, useCallback, useEffect } from 'react'
import type { BookingConfirmation, SlotWithStatus } from '../../types'
import { ELIGIBLE_DATES, getDisplayDate } from '../../utils/schedule'
import { mockStorage } from '../../services/mockStorage'
import { getAvailability, createBooking, isLiveBackendConfigured } from '../../services/appsScriptClient'
import { isBookingEnabled, isDevMockAuthEnabled } from '../../context/authEnv'
import { useAuth } from '../../hooks/useAuth'
import { useLiveSync } from '../../hooks/useLiveSync'
import { LiveSyncIndicator } from '../../components/common/LiveSyncIndicator'
import { DateSelector } from '../../components/student/DateSelector'
import { SlotDirectory } from '../../components/student/SlotDirectory'
import { BookingModal } from '../../components/student/BookingModal'
import '../../styles/portal.css'

export function StudentPage() {
  const { user } = useAuth()
  const studentProfile = user?.studentProfile
  const [selectedDate, setSelectedDate] = useState<string>(ELIGIBLE_DATES[0].date)
  const [activeSlotToBook, setActiveSlotToBook] = useState<SlotWithStatus | null>(null)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotWithStatus[]>(() => mockStorage.getSlotsForDate(selectedDate))

  // Refresh callback that performs an actual backend or storage fetch
  const refreshSlots = useCallback(async () => {
    if (isLiveBackendConfigured()) {
      const res = await getAvailability(selectedDate)
      if (res.success && res.data) {
        setSlots(
          res.data.slots.map((s) => ({
            date: selectedDate,
            startTime: s.startTime,
            endTime: s.endTime,
            displayStart: s.displayStart,
            displayEnd: s.displayEnd,
            session: s.session.toLowerCase() as 'morning' | 'afternoon',
            slotIndex: s.slotIndex,
            status: s.status,
          }))
        )
        return
      }
      const errorMsg = !res.success ? res.error.message : 'Failed to fetch slot availability from backend'
      throw new Error(errorMsg)
    }

    // Local development storage fetch
    setSlots(mockStorage.getSlotsForDate(selectedDate))
  }, [selectedDate])

  // Near-real-time synchronization (8-second interval polling, tab focus, multi-tab sync)
  const { lastUpdated, isSyncing, syncError, triggerSync } = useLiveSync({
    pollIntervalMs: 8000,
    onSync: refreshSlots,
  })

  // Trigger sync on selected date change
  useEffect(() => {
    void triggerSync()
  }, [selectedDate, triggerSync])

  // Find up-to-date profile for the logged in student
  const currentStudent = studentProfile
    ? mockStorage.getStudentById(studentProfile.studentId) || studentProfile
    : null

  const isAlreadyBooked = currentStudent?.bookingStatus === 'Booked'

  const handleBookSlotClick = (slot: SlotWithStatus) => {
    setNoticeMessage(null)

    if (!isBookingEnabled) {
      setNoticeMessage('Interview slot booking is currently closed. Please check back later.')
      return
    }

    if (!currentStudent && !user?.id) {
      setNoticeMessage('Booking is unavailable: Your session could not be verified. Please log in again.')
      return
    }


    if (slot.status === 'BOOKED') {
      setNoticeMessage(`Slot ${slot.displayStart} on ${getDisplayDate(slot.date)} is already reserved by another student.`)
      return
    }

    if (isAlreadyBooked) {
      setNoticeMessage(
        `You already have an active interview reservation on ${currentStudent?.bookedDate} at ${currentStudent?.bookedSlotStart} IST (Booking ID: ${currentStudent?.bookingId}). Students are limited to exactly one active reservation.`
      )
      return
    }

    setActiveSlotToBook(slot)
  }

  const handleConfirmBooking = async (
    studentId: string,
    slot: SlotWithStatus,
  ): Promise<{ success: boolean; message: string; confirmation?: BookingConfirmation }> => {
    if (!isBookingEnabled) {
      return { success: false, message: 'Interview slot booking is currently closed.' }
    }

    const token = user?.accessToken || ''
    const bookingRequestId = `BRQ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    if (isLiveBackendConfigured()) {
      const res = await createBooking(token, slot.date, slot.startTime, bookingRequestId)
      if (res.success && res.data) {
        void triggerSync()
        return {
          success: true,
          message: 'Booking confirmed!',
          confirmation: {
            bookingId: res.data.bookingId,
            bookingRequestId: res.data.bookingRequestId,
            studentId: res.data.studentId,
            studentName: res.data.fullName,
            gitamEmail: res.data.email,
            date: res.data.interviewDate,
            displayDate: slot.date,
            startTime: res.data.interviewStart,
            endTime: res.data.interviewEnd,
            displayStart: slot.displayStart,
            displayEnd: slot.displayEnd,
            status: 'Confirmed',
          },
        }
      }
      const errMsg = !res.success
        ? (res as { success: false; error: { message: string } }).error?.message || 'Booking failed'
        : 'Booking failed'
      return { success: false, message: errMsg }
    }

    // Dev mock fallback (only when explicitly enabled)
    if (isDevMockAuthEnabled) {
      const result = mockStorage.bookSlot({ studentId, date: slot.date, startTime: slot.startTime })
      if (result.success) void triggerSync()
      return result
    }

    return { success: false, message: 'Backend service is not configured. Please contact the placement office.' }
  }

  const availableCount = slots.filter((s) => s.status === 'AVAILABLE').length
  const bookedCount = slots.filter((s) => s.status === 'BOOKED').length

  return (
    <div className="student-portal-view">
      {/* Real-time synchronization indicator */}
      <LiveSyncIndicator
        lastUpdated={lastUpdated}
        isSyncing={isSyncing}
        onRefresh={triggerSync}
        label="Student Directory Live Sync"
      />

      {!currentStudent && (
        <div
          style={{
            backgroundColor: '#fefce8',
            border: '1px solid #fde047',
            color: '#854d0e',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.25rem',
            fontSize: '0.9rem',
            lineHeight: 1.5,
          }}
        >
          <strong>Registration Record Pending:</strong> Your institutional account ({user?.email || 'unregistered'}) is not currently associated with an active registration record in the portal database. Once the official registration dataset is connected by the placement office, your profile will update automatically.
        </div>
      )}

      {syncError && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            fontSize: '0.85rem',
          }}
        >
          <strong>Sync Notice:</strong> {syncError} (Retrying automatically)
        </div>
      )}

      <div className="page-heading">
        <p className="eyebrow">GITAM University • Placements 2026</p>
        <h1>Student Interview Booking Directory</h1>
        <p>
          Select an interview date and choose an available 10-minute session. Each student is
          permitted exactly one confirmed interview reservation. Timezone: Asia/Kolkata (IST).
        </p>
      </div>

      {/* Active Booking Banner for Logged-In Student */}
      {isAlreadyBooked && currentStudent && (
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '2px solid #86efac',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#15803d' }}>
                Your Confirmed Interview Reservation
              </span>
              <h2 style={{ margin: '0.25rem 0', fontSize: '1.25rem', color: '#166534' }}>
                {getDisplayDate(currentStudent.bookedDate || '')} at {currentStudent.bookedSlotStart} IST
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#166534' }}>
                Booking ID: <strong style={{ fontFamily: 'monospace' }}>{currentStudent.bookingId}</strong> | Candidate: <strong>{currentStudent.fullName}</strong> ({currentStudent.studentId})
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="status-badge badge-booked">Reserved</span>
              <span className={`status-badge badge-${(currentStudent.approvalStatus || 'Pending').toLowerCase()}`}>
                Review: {currentStudent.approvalStatus || 'Pending'}
              </span>
            </div>
          </div>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.825rem', color: '#166534' }}>
            You have already secured your interview session. To change your slot, contact the university placement office.
          </p>
        </div>
      )}

      {/* Notice Message if Double-Booking Attempted */}
      {noticeMessage && (
        <div
          style={{
            backgroundColor: 'var(--status-rejected-bg)',
            border: '1px solid #f8b4b4',
            color: 'var(--status-rejected-text)',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}
        >
          <strong>Notice:</strong> {noticeMessage}
        </div>
      )}

      {/* Date Selector */}
      <DateSelector selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* Slot Availability Summary Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'center',
          padding: '0.85rem 1.25rem',
          backgroundColor: '#ffffff',
          color: 'var(--portal-text)',
          border: '1px solid var(--portal-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
        }}
      >
        <div>
          Total Slots:{' '}
          <strong style={{ color: 'var(--portal-text)' }}>36</strong>
        </div>
        <div>
          Available:{' '}
          <strong style={{ color: 'var(--color-available)' }}>{availableCount}</strong>
        </div>
        <div>
          Reserved:{' '}
          <strong style={{ color: 'var(--color-booked)' }}>{bookedCount}</strong>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--portal-text-muted)' }}>
          Lunch interval (12:00 - 13:00 IST) excluded
        </div>
      </div>

      {/* 36-Slot Chronological Directory */}
      <SlotDirectory slots={slots} onBookSlot={handleBookSlotClick} />

      {/* Booking Confirmation Dialog */}
      <BookingModal
        isOpen={activeSlotToBook !== null}
        onClose={() => setActiveSlotToBook(null)}
        slot={activeSlotToBook}
        onConfirmBooking={handleConfirmBooking}
      />
    </div>
  )
}
