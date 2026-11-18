import { useState } from 'react'
import type { BookingConfirmation, SlotWithStatus, Student } from '../../types'
import { Modal } from '../common/Modal'
import { getDisplayDate } from '../../utils/schedule'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  slot: SlotWithStatus | null
  students: Student[]
  onConfirmBooking: (studentId: string, slot: SlotWithStatus) => {
    success: boolean
    message: string
    confirmation?: BookingConfirmation
  }
}

export function BookingModal({
  isOpen,
  onClose,
  slot,
  students,
  onConfirmBooking,
}: BookingModalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    students.find((s) => s.bookingStatus !== 'Booked')?.studentId || students[0]?.studentId || '',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmationReceipt, setConfirmationReceipt] = useState<BookingConfirmation | null>(null)

  if (!slot) return null

  const handleBooking = () => {
    setErrorMessage(null)
    setIsSubmitting(true)

    // Simulate backend network latency (300ms)
    setTimeout(() => {
      const result = onConfirmBooking(selectedStudentId, slot)
      setIsSubmitting(false)

      if (result.success && result.confirmation) {
        setConfirmationReceipt(result.confirmation)
      } else {
        setErrorMessage(result.message)
      }
    }, 300)
  }

  const handleClose = () => {
    setConfirmationReceipt(null)
    setErrorMessage(null)
    onClose()
  }

  const selectedStudent = students.find((s) => s.studentId === selectedStudentId)

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={confirmationReceipt ? 'Booking Confirmed' : 'Confirm Interview Slot Booking'}
    >
      {confirmationReceipt ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--status-approved-bg)',
              border: '1px solid #b9e6cf',
              borderRadius: 'var(--radius-md)',
              color: 'var(--status-approved-text)',
            }}
          >
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>
              Your interview slot has been booked.
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              Confirmation details have been recorded in the system. Timezone: Indian Standard Time (IST).
            </p>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--portal-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--portal-text-muted)' }}>Booking ID:</span>
              <strong style={{ fontFamily: 'monospace', color: 'var(--portal-primary)' }}>
                {confirmationReceipt.bookingId}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--portal-text-muted)' }}>Student Name:</span>
              <strong>{confirmationReceipt.studentName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--portal-text-muted)' }}>GITAM Email:</span>
              <strong>{confirmationReceipt.gitamEmail}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--portal-text-muted)' }}>Interview Date:</span>
              <strong>{confirmationReceipt.displayDate}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--portal-text-muted)' }}>Start Time:</span>
              <strong>{confirmationReceipt.displayStart || confirmationReceipt.startTime}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--portal-text-muted)' }}>End Time:</span>
              <strong>{confirmationReceipt.displayEnd || confirmationReceipt.endTime}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--portal-text-muted)' }}>Status:</span>
              <span className="status-badge badge-approved">{confirmationReceipt.status}</span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-book-slot" onClick={handleClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            style={{
              background: '#f8faf9',
              border: '1px solid var(--portal-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
          >
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
                Selected Slot Details
              </span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--portal-text)' }}>
              {getDisplayDate(slot.date)}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--portal-primary)' }}>
              {slot.displayStart} – {slot.displayEnd} (10 Minutes)
            </div>
          </div>

          <div className="filter-input-group">
            <label htmlFor="student-selector">Select Mock Student (Simulating Authenticated Student):</label>
            <select
              id="student-selector"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              {students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.fullName} ({s.gitamEmail}) — {s.bookingStatus === 'Booked' ? '[Already Booked]' : '[Eligible]'}
                </option>
              ))}
            </select>
          </div>

          {selectedStudent && (
            <div style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
              Student ID: <strong>{selectedStudent.studentId}</strong> | Branch:{' '}
              <strong>{selectedStudent.branch}</strong>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                backgroundColor: 'var(--status-rejected-bg)',
                border: '1px solid #f8b4b4',
                color: 'var(--status-rejected-text)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
              }}
            >
              <strong>Booking Error:</strong> {errorMessage}
            </div>
          )}

          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--portal-text-muted)',
              borderTop: '1px solid var(--portal-border)',
              paddingTop: '0.5rem',
            }}
          >
            <em>Note (Simulation Mode):</em> Real-world authentication and Google Apps Script lock service will be enforced in Phase 3 & 4. One active booking per student rule is strictly validated. All slot times are Asia/Kolkata (IST).
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-book-slot"
              onClick={handleBooking}
              disabled={isSubmitting || !selectedStudentId}
            >
              {isSubmitting ? 'Confirming...' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
