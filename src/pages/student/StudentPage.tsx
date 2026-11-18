import { useState } from 'react'
import type { BookingConfirmation, SlotWithStatus } from '../../types'
import { ELIGIBLE_DATES } from '../../utils/schedule'
import { mockStorage } from '../../services/mockStorage'
import { DateSelector } from '../../components/student/DateSelector'
import { SlotDirectory } from '../../components/student/SlotDirectory'
import { BookingModal } from '../../components/student/BookingModal'
import '../../styles/portal.css'

export function StudentPage() {
  const [selectedDate, setSelectedDate] = useState<string>(ELIGIBLE_DATES[0].date)
  const [revision, setRevision] = useState<number>(0)
  const [activeSlotToBook, setActiveSlotToBook] = useState<SlotWithStatus | null>(null)

  // Derive data directly from storage based on selectedDate and revision
  const slots = mockStorage.getSlotsForDate(selectedDate)
  const students = mockStorage.getAllStudents()

  const handleBookSlotClick = (slot: SlotWithStatus) => {
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
      setRevision((prev) => prev + 1)
    }

    return result
  }

  const handleResetData = () => {
    if (window.confirm('Reset all mock bookings and reviews back to factory fixtures?')) {
      mockStorage.resetToInitial()
      setRevision((prev) => prev + 1)
    }
  }

  const availableCount = slots.filter((s) => s.status === 'AVAILABLE').length
  const bookedCount = slots.filter((s) => s.status === 'BOOKED').length

  return (
    <div className="student-portal-view">
      {/* Simulation Notice Banner */}
      <div className="simulation-pill-banner">
        <span>
          <strong>Phase 2 Prototype</strong> — Mock Data & Interactive Booking Directory Simulation.
          {revision > 0 && ` (Updated: Revision #${revision})`}
        </span>
        <button type="button" className="btn-reset-mock" onClick={handleResetData}>
          Reset Mock Data
        </button>
      </div>

      <div className="page-heading">
        <p className="eyebrow">GITAM University • Placements 2026</p>
        <h1>Student Interview Booking Directory</h1>
        <p>
          Select an interview date and choose an available 10-minute session. Each student is
          permitted exactly one confirmed interview reservation.
        </p>
      </div>

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
        students={students}
        onConfirmBooking={handleConfirmBooking}
      />
    </div>
  )
}
