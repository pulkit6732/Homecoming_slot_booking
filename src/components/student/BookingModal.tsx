import { useState } from 'react'
import type { BookingConfirmation, SlotWithStatus } from '../../types'
import { Modal } from '../common/Modal'
import { getDisplayDate } from '../../utils/schedule'
import { useAuth } from '../../hooks/useAuth'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  slot: SlotWithStatus | null
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
  onConfirmBooking,
}: BookingModalProps) {
  const { user } = useAuth()
  const student = user?.studentProfile

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmationReceipt, setConfirmationReceipt] = useState<BookingConfirmation | null>(null)

  if (!slot) return null

  const handleBooking = () => {
    if (!student) {
      setErrorMessage('You must be signed in as a registered student to book an interview slot.')
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    // Execute booking bound strictly to authenticated student ID
    setTimeout(() => {
      const result = onConfirmBooking(student.studentId, slot)
      setIsSubmitting(false)

      if (result.success && result.confirmation) {
        setConfirmationReceipt(result.confirmation)
      } else {
        setErrorMessage(result.message)
      }
    }, 200)
  }

  const handleClose = () => {
    setConfirmationReceipt(null)
    setErrorMessage(null)
    onClose()
  }

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
              Confirmation details have been recorded in the database. Timezone: Indian Standard Time (IST).
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
              <span style={{ color: 'var(--portal-text-muted)' }}>Student ID:</span>
              <strong>{confirmationReceipt.studentId}</strong>
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
              <span style={{ color: 'var(--portal-text-muted)' }}>Time Slot:</span>
              <strong>{confirmationReceipt.displayStart || confirmationReceipt.startTime} – {confirmationReceipt.displayEnd || confirmationReceipt.endTime} IST</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--portal-text-muted)' }}>Booking Status:</span>
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
          {/* Slot Metadata Summary */}
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
              {slot.displayStart} – {slot.displayEnd} (10 Minutes, IST)
            </div>
          </div>

          {/* Bound Authenticated Student Details */}
          {student ? (
            <div
              style={{
                backgroundColor: 'var(--portal-primary-light)',
                border: '1px solid #b7dfcb',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--portal-primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Booking Candidate (Verified Identity):
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--portal-text)', marginTop: '0.25rem' }}>
                {student.fullName}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)', marginTop: '0.2rem' }}>
                ID: <strong>{student.studentId}</strong> | Roll: <strong>{student.rollNumber}</strong> | Branch: <strong>{student.branch}</strong>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
                Email: {student.gitamEmail}
              </div>
            </div>
          ) : (
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
              <strong>Access Restriction:</strong> Only verified registered students can reserve an interview slot.
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
            <em>Policy:</em> Each student is strictly permitted exactly one active interview reservation. Timezone: Asia/Kolkata (IST).
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-book-slot"
              onClick={handleBooking}
              disabled={isSubmitting || !student}
            >
              {isSubmitting ? 'Confirming Reservation...' : 'Confirm Reservation'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
