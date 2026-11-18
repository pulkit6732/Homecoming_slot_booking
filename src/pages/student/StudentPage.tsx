import { useState } from 'react'
import type { BookingConfirmation, SlotWithStatus } from '../../types'
import { ELIGIBLE_DATES, getDisplayDate } from '../../utils/schedule'
import { mockStorage } from '../../services/mockStorage'
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

  // Near-real-time synchronization (5-10s polling, tab focus, multi-tab sync)
  const { revision, lastUpdated, isSyncing, triggerSync } = useLiveSync({ pollIntervalMs: 8000 })

  // Derive fresh data directly from storage based on selectedDate and revision
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  revision // reactive dependency
  const slots = mockStorage.getSlotsForDate(selectedDate)

  // Find up-to-date profile for the logged in student
  const currentStudent = studentProfile
    ? mockStorage.getStudentById(studentProfile.studentId) || studentProfile
    : null

  const isAlreadyBooked = currentStudent?.bookingStatus === 'Booked'

  const handleBookSlotClick = (slot: SlotWithStatus) => {
    setNoticeMessage(null)

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

  const handleConfirmBooking = (
    studentId: string,
    slot: SlotWithStatus,
  ): { success: boolean; message: string; confirmation?: BookingConfirmation } => {
    const result = mockStorage.bookSlot({
      studentId,
      date: slot.date,
      startTime: slot.startTime,
    })

    if (result.success) {
      void triggerSync()
    }

    return result
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
              <span className={`status-badge badge-${currentStudent.approvalStatus.toLowerCase()}`}>
                Review: {currentStudent.approvalStatus}
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
