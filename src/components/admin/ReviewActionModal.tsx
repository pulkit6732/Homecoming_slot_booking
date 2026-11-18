import { useState } from 'react'
import type { Student } from '../../types'
import { Modal } from '../common/Modal'

export type ReviewActionType = 'APPROVE' | 'REJECT' | 'FLAG' | 'CLEAR_FLAG' | 'CANCEL_BOOKING'

interface ReviewActionModalProps {
  isOpen: boolean
  onClose: () => void
  student: Student | null
  actionType: ReviewActionType | null
  onConfirmApprove: (studentId: string, comment: string) => void
  onConfirmReject: (studentId: string, reason: string) => void
  onConfirmFlag: (studentId: string, reason: string) => void
  onConfirmClearFlag: (studentId: string) => void
  onConfirmCancelBooking?: (studentId: string, reason: string) => void
}

export function ReviewActionModal({
  isOpen,
  onClose,
  student,
  actionType,
  onConfirmApprove,
  onConfirmReject,
  onConfirmFlag,
  onConfirmClearFlag,
  onConfirmCancelBooking,
}: ReviewActionModalProps) {
  const draftKey = student ? `gitam_review_draft_${student.studentId}_${actionType || ''}` : ''

  const [comment, setComment] = useState(() => {
    if (!draftKey) return ''
    try {
      return localStorage.getItem(`${draftKey}_comment`) || ''
    } catch {
      return ''
    }
  })

  const [reason, setReason] = useState(() => {
    if (!draftKey) return ''
    try {
      return localStorage.getItem(`${draftKey}_reason`) || ''
    } catch {
      return ''
    }
  })

  const [validationError, setValidationError] = useState<string | null>(null)

  const handleCommentChange = (val: string) => {
    setComment(val)
    setValidationError(null)
    if (draftKey) {
      try {
        localStorage.setItem(`${draftKey}_comment`, val)
      } catch {
        // ignore
      }
    }
  }

  const handleReasonChange = (val: string) => {
    setReason(val)
    setValidationError(null)
    if (draftKey) {
      try {
        localStorage.setItem(`${draftKey}_reason`, val)
      } catch {
        // ignore
      }
    }
  }

  const handleClose = () => {
    setValidationError(null)
    onClose()
  }

  const clearDraft = () => {
    if (draftKey) {
      try {
        localStorage.removeItem(`${draftKey}_comment`)
        localStorage.removeItem(`${draftKey}_reason`)
      } catch {
        // ignore
      }
    }
  }

  const handleSubmit = () => {
    if (!student) return

    if (actionType === 'APPROVE') {
      onConfirmApprove(student.studentId, comment)
      clearDraft()
      handleClose()
    } else if (actionType === 'REJECT') {
      if (!reason.trim()) {
        setValidationError('Rejection reason is mandatory per academic audit policy.')
        return
      }
      onConfirmReject(student.studentId, reason)
      clearDraft()
      handleClose()
    } else if (actionType === 'FLAG') {
      if (!reason.trim()) {
        setValidationError('A reason is mandatory when flagging a student for review.')
        return
      }
      onConfirmFlag(student.studentId, reason)
      clearDraft()
      handleClose()
    } else if (actionType === 'CLEAR_FLAG') {
      onConfirmClearFlag(student.studentId)
      clearDraft()
      handleClose()
    } else if (actionType === 'CANCEL_BOOKING') {
      if (onConfirmCancelBooking) {
        onConfirmCancelBooking(student.studentId, reason || comment || 'Cancelled by administrator')
      }
      clearDraft()
      handleClose()
    }
  }

  if (!student || !actionType) return null

  let title = ''
  let actionButtonLabel = ''
  let actionBtnClass = 'btn-book-slot'

  if (actionType === 'APPROVE') {
    title = `Approve Candidate: ${student.fullName}`
    actionButtonLabel = 'Confirm Approval'
    actionBtnClass = 'btn-book-slot'
  } else if (actionType === 'REJECT') {
    title = `Reject Candidate: ${student.fullName}`
    actionButtonLabel = 'Confirm Rejection'
    actionBtnClass = 'btn-table-action btn-reject'
  } else if (actionType === 'FLAG') {
    title = `Flag for Review: ${student.fullName}`
    actionButtonLabel = 'Flag Profile'
    actionBtnClass = 'btn-table-action btn-flag'
  } else if (actionType === 'CLEAR_FLAG') {
    title = `Clear Review Flag: ${student.fullName}`
    actionButtonLabel = 'Clear Flag'
    actionBtnClass = 'btn-secondary'
  } else if (actionType === 'CANCEL_BOOKING') {
    title = `Remove Slot Reservation: ${student.fullName}`
    actionButtonLabel = 'Free Up Slot & Cancel Booking'
    actionBtnClass = 'btn-table-action btn-reject'
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--portal-text-muted)' }}>
          Student ID: <strong>{student.studentId}</strong> | Roll Number: <strong>{student.rollNumber}</strong>
          <br />
          Current Status: <strong>{student.approvalStatus}</strong> | Booking: <strong>{student.bookingStatus}</strong>
          {student.bookedSlotStart && (
            <span> | Slot: <strong>{student.bookedSlotStart} on {student.bookedDate}</strong></span>
          )}
        </div>

        {actionType === 'APPROVE' && (
          <div className="filter-input-group">
            <label htmlFor="approve-comment">Optional Decision Remarks / Feedback:</label>
            <textarea
              id="approve-comment"
              rows={3}
              placeholder="e.g. Recommended for Tier 1 interview round based on high CGPA."
              value={comment}
              onChange={(e) => handleCommentChange(e.target.value)}
              style={{
                padding: '0.55rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--portal-border)',
                fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {actionType === 'REJECT' && (
          <div className="filter-input-group">
            <label htmlFor="reject-reason">Mandatory Rejection Reason:</label>
            <textarea
              id="reject-reason"
              rows={3}
              placeholder="e.g. Ineligible: Active backlog count exceeds policy limit."
              value={reason}
              onChange={(e) => handleReasonChange(e.target.value)}
              style={{
                padding: '0.55rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--portal-border)',
                fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {actionType === 'FLAG' && (
          <div className="filter-input-group">
            <label htmlFor="flag-reason">Mandatory Reason for Flagging:</label>
            <textarea
              id="flag-reason"
              rows={3}
              placeholder="e.g. Check for missing documents or certificate authenticity."
              value={reason}
              onChange={(e) => handleReasonChange(e.target.value)}
              style={{
                padding: '0.55rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--portal-border)',
                fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {actionType === 'CLEAR_FLAG' && (
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            Are you sure you want to clear the review flag for <strong>{student.fullName}</strong>?
            <br />
            <span style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
              Previous flag reason was: "{student.flagReason}"
            </span>
          </p>
        )}

        {actionType === 'CANCEL_BOOKING' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div
              style={{
                backgroundColor: 'var(--status-rejected-bg)',
                border: '1px solid #f8b4b4',
                color: 'var(--status-rejected-text)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            >
              <strong>Warning:</strong> You are about to remove the interview slot ({student.bookedSlotStart} on {student.bookedDate}) for <strong>{student.fullName}</strong>.
              This will release the 10-minute slot and make it immediately available for other students to reserve.
            </div>

            <div className="filter-input-group">
              <label htmlFor="cancel-reason">Reason or Administrative Note (Optional):</label>
              <textarea
                id="cancel-reason"
                rows={2}
                placeholder="e.g. Candidate requested slot rescheduling due to lab exam conflict."
                value={reason}
                onChange={(e) => handleReasonChange(e.target.value)}
                style={{
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--portal-border)',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        )}

        {validationError && (
          <div
            style={{
              backgroundColor: 'var(--status-rejected-bg)',
              color: 'var(--status-rejected-text)',
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
            }}
          >
            {validationError}
          </div>
        )}

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button type="button" className={actionBtnClass} onClick={handleSubmit}>
            {actionButtonLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
