import { useState, type FormEvent } from 'react'
import type { Student, ApprovalStatus, ReviewFlagStatus, AdminComment, ReviewHistoryEntry } from '../../types'
import { Badge } from '../common/Badge'
import { formatISTDateTime, formatISTDate } from '../../utils/timezone'
import { useAuth } from '../../hooks/useAuth'
import {
  changeApprovalStatus,
  changeReviewFlag,
  saveAdminComment,
  editAdminComment,
} from '../../services/appsScriptClient'

interface StudentProfileDetailsProps {
  student: Student
  onReviewUpdate?: (() => void) | undefined
}

export function StudentProfileDetails({ student, onReviewUpdate }: StudentProfileDetailsProps) {
  const { user } = useAuth()
  const adminEmail = user?.email || 'admin@gitam.in'

  // Local comments & history state (reflects student and updates optimistically)
  const [comments, setComments] = useState<AdminComment[]>(() => student.adminComments || [])
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryEntry[]>(() => student.reviewHistory || [])
  const [currentApproval, setCurrentApproval] = useState<ApprovalStatus>(student.approvalStatus)
  const [currentFlag, setCurrentFlag] = useState<ReviewFlagStatus>(student.reviewFlagStatus)
  const [currentDecisionBy, setCurrentDecisionBy] = useState<string>(student.decisionBy || '')
  const [currentDecisionTimestamp, setCurrentDecisionTimestamp] = useState<string>(student.decisionTimestamp || '')
  const [currentDecisionComment, setCurrentDecisionComment] = useState<string>(student.decisionComment || '')

  // Form states for comments
  const [newCommentText, setNewCommentText] = useState('')
  const [isSavingComment, setIsSavingComment] = useState(false)
  const [commentFeedback, setCommentFeedback] = useState<string | null>(null)

  // Edit comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [isEditingComment, setIsEditingComment] = useState(false)
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set())

  // Decision reason prompt modal/state
  const [activeReasonAction, setActiveReasonAction] = useState<'APPROVE' | 'REJECT' | 'YELLOW_FLAG' | null>(null)
  const [reasonInput, setReasonInput] = useState('')
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false)
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null)

  const toggleHistoryExpanded = (commentId: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
  }

  // Handle Save Comment
  const handleSaveComment = async (e: FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim() || isSavingComment) return

    setIsSavingComment(true)
    setCommentFeedback(null)

    const res = await saveAdminComment('ADMIN_TOKEN', student.studentId, newCommentText, adminEmail, user?.id)
    if (res.success && res.data.comment) {
      setComments([res.data.comment, ...comments.filter((c) => c.commentId !== res.data.comment.commentId)])
      setNewCommentText('')
      setCommentFeedback('Comment saved successfully.')
      onReviewUpdate?.()
    } else {
      setCommentFeedback(res.success ? 'Comment saved.' : res.error.message)
    }

    setIsSavingComment(false)
  }

  // Handle Start Edit Comment
  const handleStartEdit = (comment: AdminComment) => {
    setEditingCommentId(comment.commentId)
    setEditingText(comment.commentText)
  }

  // Handle Save Edited Comment
  const handleSaveEdit = async (commentId: string) => {
    if (!editingText.trim() || isEditingComment) return

    setIsEditingComment(true)
    const res = await editAdminComment('ADMIN_TOKEN', student.studentId, commentId, editingText, adminEmail)
    if (res.success && res.data.updatedComment) {
      setComments((prev) =>
        prev.map((c) => (c.commentId === commentId ? res.data.updatedComment : c))
      )
      setEditingCommentId(null)
      setEditingText('')
      setCommentFeedback('Comment updated successfully.')
      onReviewUpdate?.()
    } else {
      setCommentFeedback(res.success ? 'Comment updated.' : res.error.message)
    }
    setIsEditingComment(false)
  }

  // Handle Review Decision Actions (Approved, Rejected, Yellow Flagged)
  const handleTriggerDecision = (action: 'APPROVE' | 'REJECT' | 'YELLOW_FLAG') => {
    setActiveReasonAction(action)
    setReasonInput('')
    setDecisionFeedback(null)
  }

  const handleConfirmDecision = async () => {
    if (!activeReasonAction) return
    setIsSubmittingDecision(true)

    if (activeReasonAction === 'APPROVE') {
      const res = await changeApprovalStatus('ADMIN_TOKEN', student.studentId, 'Approved', reasonInput, adminEmail)
      if (res.success) {
        setCurrentApproval('Approved')
        setCurrentDecisionBy(adminEmail)
        setCurrentDecisionTimestamp(res.data.decisionTimestamp)
        setCurrentDecisionComment(reasonInput)
        if (res.data.reviewHistory) setReviewHistory(res.data.reviewHistory)
        setDecisionFeedback('Student application officially approved.')
        onReviewUpdate?.()
      } else {
        setDecisionFeedback(res.error.message)
      }
    } else if (activeReasonAction === 'REJECT') {
      const res = await changeApprovalStatus('ADMIN_TOKEN', student.studentId, 'Rejected', reasonInput || 'Application rejected by placement committee', adminEmail)
      if (res.success) {
        setCurrentApproval('Rejected')
        setCurrentDecisionBy(adminEmail)
        setCurrentDecisionTimestamp(res.data.decisionTimestamp)
        setCurrentDecisionComment(reasonInput)
        if (res.data.reviewHistory) setReviewHistory(res.data.reviewHistory)
        setDecisionFeedback('Student application officially rejected.')
        onReviewUpdate?.()
      } else {
        setDecisionFeedback(res.error.message)
      }
    } else if (activeReasonAction === 'YELLOW_FLAG') {
      const res = await changeReviewFlag('ADMIN_TOKEN', student.studentId, 'Yellow Flagged', reasonInput || 'Flagged for internal verification', adminEmail)
      if (res.success) {
        setCurrentFlag('Yellow Flagged')
        if (res.data.reviewHistory) setReviewHistory(res.data.reviewHistory)
        setDecisionFeedback('Application marked as Yellow Flagged (requires further attention).')
        onReviewUpdate?.()
      } else {
        setDecisionFeedback(res.error.message)
      }
    }

    setIsSubmittingDecision(false)
    setActiveReasonAction(null)
  }

  return (
    <div className="student-profile-expanded-panel">
      {/* Dossier Header */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#00392F', fontWeight: 750 }}>
            Student Dossier: {student.fullName} ({student.studentId})
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
            Form submitted on: {formatISTDateTime(student.formSubmissionTimestamp)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Badge type="booking" status={student.bookingStatus} />
          <Badge type="approval" status={currentApproval} />
          <Badge type="review" status={currentFlag} />
        </div>
      </div>

      <div className="profile-section-grid">
        {/* SECTION 1: Registration & Contact */}
        <div className="profile-group">
          <h4 className="profile-group-title">1. Registration & Contact</h4>
          <div className="profile-field-row">
            <span className="field-key">Full Name:</span>
            <span className="field-val">{student.fullName} ({student.gender})</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Date of Birth:</span>
            <span className="field-val">{formatISTDate(student.dateOfBirth)}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">GITAM Email:</span>
            <span className="field-val">{student.gitamEmail}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Personal Email:</span>
            <span className="field-val">{student.personalEmail}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Phone Number:</span>
            <span className="field-val">{student.phoneNumber}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Residential Location:</span>
            <span className="field-val">
              {student.address}, {student.city}, {student.state}, {student.country}
            </span>
          </div>
        </div>

        {/* SECTION 2: Academic Information */}
        <div className="profile-group">
          <h4 className="profile-group-title">2. Academic Information</h4>
          <div className="profile-field-row">
            <span className="field-key">Program & Degree:</span>
            <span className="field-val">{student.program} - {student.branch}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Academic Year & Section:</span>
            <span className="field-val">{student.academicYear} • Section {student.section}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Roll Number / Student ID:</span>
            <span className="field-val" style={{ fontFamily: 'monospace' }}>{student.rollNumber} ({student.studentId})</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Current CGPA:</span>
            <span className="field-val" style={{ fontWeight: 700, color: student.cgpa >= 8.0 ? 'var(--status-approved-text)' : 'inherit' }}>
              {student.cgpa.toFixed(2)}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Active Backlogs:</span>
            <span className="field-val" style={{ color: student.backlogs > 0 ? 'var(--status-rejected-text)' : 'inherit' }}>
              {student.backlogs}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Prior Qualification:</span>
            <span className="field-val">{student.highestQualification} ({student.universityCollege}, {student.yearOfPassing})</span>
          </div>
        </div>

        {/* SECTION 3: Committee Preferences */}
        <div className="profile-group">
          <h4 className="profile-group-title">3. Committee Preferences</h4>
          <div className="profile-field-row">
            <span className="field-key">Primary Preference:</span>
            <span className="field-val"><strong>1.</strong> {student.committeePreferences || student.domainPreference1}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Secondary Preference:</span>
            <span className="field-val"><strong>2.</strong> {student.domainPreference2 || 'General Coordination'}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Tertiary Preference:</span>
            <span className="field-val"><strong>3.</strong> {student.domainPreference3 || 'Hospitality & Logistics'}</span>
          </div>
        </div>

        {/* SECTION 4: Roles Applied For */}
        <div className="profile-group">
          <h4 className="profile-group-title">4. Roles Applied For</h4>
          <div className="profile-field-row">
            <span className="field-key">Applied Positions / Tracks:</span>
            <span className="field-val">
              {student.rolesAppliedFor || `${student.domainPreference1} Lead / Student Coordinator`}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Prior Committee Experience:</span>
            <span className="field-val">{student.workExperience || 'First-time Homecoming Applicant'}</span>
          </div>
        </div>

        {/* SECTION 5: Written Application */}
        <div className="profile-group">
          <h4 className="profile-group-title">5. Written Application</h4>
          <div className="profile-field-row">
            <span className="field-key">Statement of Purpose / Project Highlights:</span>
            <span className="field-val" style={{ lineHeight: 1.5 }}>
              {student.writtenApplication || student.projects || 'Candidate applied for Homecoming 2026 Student Organization Team.'}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Internships & Practical Exposure:</span>
            <span className="field-val">{student.internships || 'None listed'}</span>
          </div>
        </div>

        {/* SECTION 6: Self-Assessment */}
        <div className="profile-group">
          <h4 className="profile-group-title">6. Self-Assessment</h4>
          <div className="profile-field-row">
            <span className="field-key">Technical Competencies:</span>
            <span className="field-val">{student.technicalSkills}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Soft Skills & Communication:</span>
            <span className="field-val">{student.softSkills}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Certifications & Credentials:</span>
            <span className="field-val">{student.certifications || 'None listed'}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Notable Achievements:</span>
            <span className="field-val">{student.achievements || 'None listed'}</span>
          </div>
        </div>

        {/* SECTION 7: Availability & Commute */}
        <div className="profile-group">
          <h4 className="profile-group-title">7. Availability & Commute</h4>
          <div className="profile-field-row">
            <span className="field-key">Interview Day Availability:</span>
            <span className="field-val">
              {student.availabilityCommute || 'Available across all 6 scheduled interview dates. Daily campus commute.'}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Event Week Commitment:</span>
            <span className="field-val">Full-time on-site presence confirmed for Homecoming 2026.</span>
          </div>
        </div>

        {/* SECTION 8: Documents & Attachments */}
        <div className="profile-group">
          <h4 className="profile-group-title">8. Documents & Attachments</h4>
          <div className="profile-field-row">
            <span className="field-key">Resume Document:</span>
            <span className="field-val">
              {student.resumeLink ? (
                <a href={student.resumeLink} target="_blank" rel="noreferrer" style={{ color: 'var(--portal-primary)', fontWeight: 600 }}>
                  View Resume Document
                </a>
              ) : (
                'Not uploaded'
              )}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Verification Documents & Portfolio:</span>
            <span className="field-val">
              {student.documentLinks ? (
                <a href={student.documentLinks} target="_blank" rel="noreferrer" style={{ color: 'var(--portal-primary)', fontWeight: 600 }}>
                  View Verification Folder
                </a>
              ) : (
                'None provided'
              )}
            </span>
          </div>
        </div>

        {/* SECTION 9: Booking Information */}
        <div className="profile-group">
          <h4 className="profile-group-title">9. Booking Information</h4>
          <div className="profile-field-row">
            <span className="field-key">Reservation Status:</span>
            <span className="field-val">
              <strong>{student.bookingStatus}</strong>
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Interview Slot:</span>
            <span className="field-val">
              {student.bookingStatus === 'Booked'
                ? `${student.bookedDate} at ${student.bookedSlotStart} – ${student.bookedSlotEnd} IST`
                : 'No Slot Reserved'}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Booking ID:</span>
            <span className="field-val" style={{ fontFamily: 'monospace' }}>
              {student.bookingId || 'N/A'}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Idempotency Request ID:</span>
            <span className="field-val" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
              {student.bookingRequestId || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 10: Administrative Review & Comments (MANDATORY FINAL SECTION) */}
      <div className="admin-review-section">
        <div className="review-section-header">
          <div>
            <h4 className="review-section-title">10. Administrative Review & Comments</h4>
            <span style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
              Restricted administrative assessments, review status controls, and private assessor observations.
            </span>
          </div>
        </div>

        {/* Latest Official Review Decision Prominent Banner */}
        <div className="review-prominent-status">
          <div>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--portal-text-muted)', display: 'block', fontWeight: 700 }}>
              Official Review Decision:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
              <span
                className={`decision-indicator-dot ${
                  currentApproval === 'Approved'
                    ? 'decision-indicator-green'
                    : currentApproval === 'Rejected'
                    ? 'decision-indicator-red'
                    : 'decision-indicator-yellow'
                }`}
              />
              <span style={{ fontSize: '1.15rem', fontWeight: 750, color: '#00392F' }}>
                {currentApproval}
              </span>
            </div>
            {currentDecisionBy && (
              <div style={{ fontSize: '0.8rem', color: 'var(--portal-text-muted)', marginTop: '0.25rem' }}>
                Evaluated by <strong>{currentDecisionBy}</strong> on {formatISTDateTime(currentDecisionTimestamp)}
              </div>
            )}
            {currentDecisionComment && (
              <div style={{ fontSize: '0.85rem', color: 'var(--portal-text)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                "{currentDecisionComment}"
              </div>
            )}
          </div>

          <div style={{ borderLeft: '1px solid #cce8db', paddingLeft: '1.5rem' }}>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--portal-text-muted)', display: 'block', fontWeight: 700 }}>
              Review Flag Status:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
              <span
                className={`decision-indicator-dot ${
                  currentFlag === 'Yellow Flagged' || currentFlag === 'Flagged for Review'
                    ? 'decision-indicator-yellow'
                    : 'decision-indicator-green'
                }`}
              />
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: currentFlag === 'Yellow Flagged' ? '#b27b00' : 'inherit' }}>
                {currentFlag}
              </span>
            </div>
          </div>
        </div>

        {/* Part A: Review Decision Controls (Approved, Rejected, Yellow Flagged) */}
        <div>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--portal-text-muted)', display: 'block', marginBottom: '0.5rem' }}>
            Record Review Decision (Administrators Can Change Decisions Subject to Audit History):
          </span>
          <div className="review-decision-controls">
            <button
              type="button"
              className={`btn-decision btn-decision-approve ${currentApproval === 'Approved' ? 'active' : ''}`}
              onClick={() => handleTriggerDecision('APPROVE')}
              disabled={isSubmittingDecision}
            >
              <span className="decision-indicator-dot decision-indicator-green" />
              Approved
            </button>

            <button
              type="button"
              className={`btn-decision btn-decision-reject ${currentApproval === 'Rejected' ? 'active' : ''}`}
              onClick={() => handleTriggerDecision('REJECT')}
              disabled={isSubmittingDecision}
            >
              <span className="decision-indicator-dot decision-indicator-red" />
              Rejected
            </button>

            <button
              type="button"
              className={`btn-decision btn-decision-flag ${currentFlag === 'Yellow Flagged' ? 'active' : ''}`}
              onClick={() => handleTriggerDecision('YELLOW_FLAG')}
              disabled={isSubmittingDecision}
            >
              <span className="decision-indicator-dot decision-indicator-yellow" />
              Yellow Flagged
            </button>
          </div>
        </div>

        {/* Decision Reason Input Box when action triggered */}
        {activeReasonAction && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f8faf9',
              border: '1px solid var(--portal-border)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.25rem',
            }}
          >
            <label htmlFor={`decision-reason-${student.studentId}`} style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem', color: '#00392F' }}>
              Reason for {activeReasonAction === 'APPROVE' ? 'Approval' : activeReasonAction === 'REJECT' ? 'Rejection' : 'Yellow Flagging'}:
            </label>
            <input
              id={`decision-reason-${student.studentId}`}
              type="text"
              placeholder="e.g. Verified technical certifications; recommended for final panel"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--portal-border)',
                fontSize: '0.9rem',
                marginBottom: '0.75rem',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-book-slot"
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                onClick={handleConfirmDecision}
                disabled={isSubmittingDecision}
              >
                {isSubmittingDecision ? 'Recording Decision...' : 'Confirm Decision'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                onClick={() => setActiveReasonAction(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {decisionFeedback && (
          <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: '#e6f7ee', color: '#0e623b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {decisionFeedback}
          </div>
        )}

        {/* Part B: Private Administrative Comments */}
        <div className="private-comments-box">
          <form onSubmit={handleSaveComment}>
            <label htmlFor={`private-comments-${student.studentId}`}>
              Private Admin Comments
            </label>
            <span style={{ fontSize: '0.8rem', color: 'var(--portal-text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              Record reasons for decision, application concerns, missing verification points, interviewer observations, or follow-up notes. Strictly internal; never exposed to students.
            </span>
            <textarea
              id={`private-comments-${student.studentId}`}
              className="comments-textarea"
              placeholder="Enter private assessor note..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.65rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--portal-text-muted)' }}>
                Posting as: <strong>{adminEmail}</strong>
              </span>
              <button
                type="submit"
                className="btn-book-slot"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.88rem' }}
                disabled={isSavingComment || !newCommentText.trim()}
              >
                {isSavingComment ? 'Saving...' : 'Save Comment'}
              </button>
            </div>
          </form>

          {commentFeedback && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#0e623b' }}>
              {commentFeedback}
            </div>
          )}

          {/* Comment Thread (Chronological Order, Newest First) */}
          <div style={{ marginTop: '1.25rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
              Saved Private Comments ({comments.length}):
            </span>

            {comments.length === 0 ? (
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--portal-text-muted)', fontStyle: 'italic' }}>
                No private administrative comments recorded for this candidate yet.
              </p>
            ) : (
              <div className="comment-list">
                {comments.map((comment) => {
                  const isAuthor = comment.adminEmail.toLowerCase() === adminEmail.toLowerCase()
                  const isCurrentlyEditing = editingCommentId === comment.commentId
                  const isHistoryExpanded = expandedHistoryIds.has(comment.commentId)

                  return (
                    <div key={comment.commentId} className="comment-card">
                      <div className="comment-card-header">
                        <div>
                          <span className="comment-author">{comment.adminEmail}</span>
                          <span style={{ marginLeft: '0.5rem' }}>
                            • {formatISTDateTime(comment.createdAt)}
                          </span>
                          {comment.isEdited && (
                            <span style={{ marginLeft: '0.5rem', fontStyle: 'italic', color: '#8a6100' }}>
                              (edited {formatISTDateTime(comment.updatedAt)})
                            </span>
                          )}
                        </div>

                        {isAuthor && !isCurrentlyEditing && (
                          <button
                            type="button"
                            className="btn-comment-action"
                            onClick={() => handleStartEdit(comment)}
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {isCurrentlyEditing ? (
                        <div style={{ marginTop: '0.5rem' }}>
                          <textarea
                            className="comments-textarea"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            style={{ minHeight: '70px' }}
                          />
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              type="button"
                              className="btn-book-slot"
                              style={{ padding: '0.35rem 0.8rem', fontSize: '0.82rem' }}
                              onClick={() => handleSaveEdit(comment.commentId)}
                              disabled={isEditingComment || !editingText.trim()}
                            >
                              {isEditingComment ? 'Saving Edit...' : 'Save Edit'}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.8rem', fontSize: '0.82rem' }}
                              onClick={() => {
                                setEditingCommentId(null)
                                setEditingText('')
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="comment-body">{comment.commentText}</div>
                      )}

                      {/* Preserved Previous Versions in Edit History */}
                      {comment.editHistory && comment.editHistory.length > 0 && (
                        <div style={{ marginTop: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn-comment-action"
                            onClick={() => toggleHistoryExpanded(comment.commentId)}
                          >
                            {isHistoryExpanded
                              ? 'Hide Edit History'
                              : `View Edit History (${comment.editHistory.length} previous version${comment.editHistory.length > 1 ? 's' : ''})`}
                          </button>

                          {isHistoryExpanded && (
                            <div className="edit-history-panel">
                              <span style={{ fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>
                                Prior Versions:
                              </span>
                              {comment.editHistory.map((version, vIdx) => (
                                <div key={vIdx} style={{ marginBottom: '0.4rem', borderBottom: '1px solid #d8e2dc', paddingBottom: '0.3rem' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--portal-text-muted)' }}>
                                    Edited by {version.editedBy} on {formatISTDateTime(version.editedAt)}
                                  </div>
                                  <div style={{ marginTop: '0.15rem' }}>"{version.commentText}"</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Part C: Review Decision Audit History */}
        {reviewHistory.length > 0 && (
          <div className="audit-history-box">
            <h5 className="audit-history-title">Official Review Audit History ({reviewHistory.length} Entries)</h5>
            <div style={{ overflowX: 'auto' }}>
              <table className="audit-history-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Changed By</th>
                    <th>Approval Transition</th>
                    <th>Flag Transition</th>
                    <th>Reason / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewHistory.map((entry) => (
                    <tr key={entry.reviewId}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatISTDateTime(entry.changedAt)}</td>
                      <td><strong>{entry.changedBy}</strong></td>
                      <td>
                        <span style={{ color: 'var(--portal-text-muted)' }}>{entry.previousApprovalStatus}</span>
                        {' → '}
                        <strong>{entry.newApprovalStatus}</strong>
                      </td>
                      <td>
                        <span style={{ color: 'var(--portal-text-muted)' }}>{entry.previousReviewFlagStatus}</span>
                        {' → '}
                        <strong>{entry.newReviewFlagStatus}</strong>
                      </td>
                      <td>{entry.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
