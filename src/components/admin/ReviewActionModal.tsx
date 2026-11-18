import { useState } from 'react'
import type { Student } from '../../types'
import { Modal } from '../common/Modal'

export type ReviewActionType = 'APPROVE' | 'REJECT' | 'FLAG' | 'CLEAR_FLAG'

interface ReviewActionModalProps {
  isOpen: boolean
  onClose: () => void
  student: Student | null
  actionType: ReviewActionType | null
  onConfirmApprove: (studentId: string, comment: string) => void
  onConfirmReject: (studentId: string, reason: string) => void
  onConfirmFlag: (studentId: string, reason: string) => void
  onConfirmClearFlag: (studentId: string) => void
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
    if (draftKey) {
      try {
        localStorage.setItem(`${draftKey}_comment`, val)
      } catch {
        // storage fallback
      }
    }
  }

  const handleReasonChange = (val: string) => {
    setReason(val)
    if (draftKey) {
      try {
        localStorage.setItem(`${draftKey}_reason`, val)
      } catch {
        // storage fallback
      }
    }
  }

  const clearDraft = () => {
    if (draftKey) {
      try {
        localStorage.removeItem(`${draftKey}_comment`)
        localStorage.removeItem(`${draftKey}_reason`)
      } catch {
        // storage fallback
      }
    }
  }

  if (!student || !actionType) return null

  const handleClose = () => {
    setValidationError(null)
    onClose()
  }

  const handleSubmit = () => {
    setValidationError(null)

    if (actionType === 'APPROVE') {
      onConfirmApprove(student.studentId, comment)
      clearDraft()
      setComment('')
      handleClose()
    } else if (actionType === 'REJECT') {
      if (!reason.trim()) {
        setValidationError('A specific rejection reason is mandatory.')
        return
      }
      onConfirmReject(student.studentId, reason.trim())
      clearDraft()
      setReason('')
      handleClose()
    } else if (actionType === 'FLAG') {
      if (!reason.trim()) {
        setValidationError('A reason for flagging this profile is mandatory.')
        return
      }
      onConfirmFlag(student.studentId, reason.trim())
      clearDraft()
      setReason('')
      handleClose()
    } else if (actionType === 'CLEAR_FLAG') {
      onConfirmClearFlag(student.studentId)
      clearDraft()
      handleClose()
    }
  }

  let title = ''
  let actionButtonLabel = ''
  let actionBtnClass = 'btn-book-slot'

  if (actionType === 'APPROVE') {
    title = `Approve Student: ${student.fullName}`
    actionButtonLabel = 'Confirm Approval'
    actionBtnClass = 'btn-book-slot'
  } else if (actionType === 'REJECT') {
    title = `Reject Student: ${student.fullName}`
    actionButtonLabel = 'Confirm Rejection'
    actionBtnClass = 'btn-danger'
  } else if (actionType === 'FLAG') {
    title = `Flag for Review: ${student.fullName}`
    actionButtonLabel = 'Flag Candidate'
    actionBtnClass = 'btn-warning'
  } else if (actionType === 'CLEAR_FLAG') {
    title = `Clear Review Flag: ${student.fullName}`
    actionButtonLabel = 'Clear Flag'
    actionBtnClass = 'btn-secondary'
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--portal-text-muted)' }}>
          Student ID: <strong>{student.studentId}</strong> | Roll Number: <strong>{student.rollNumber}</strong>
          <br />
          Current Status: <strong>{student.approvalStatus}</strong> | Flag: <strong>{student.reviewFlagStatus}</strong>
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
