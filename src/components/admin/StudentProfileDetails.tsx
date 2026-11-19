import { useState, useEffect, useMemo, type FormEvent } from 'react'
import type { Student, ApprovalStatus, ReviewFlagStatus, AdminComment, ReviewHistoryEntry, StudentDossier } from '../../types'
import { Badge } from '../common/Badge'
import { formatISTDateTime, formatISTDate } from '../../utils/timezone'
import { useAuth } from '../../hooks/useAuth'
import {
  changeApprovalStatus,
  changeReviewFlag,
  saveAdminComment,
  editAdminComment,
  getStudentDossier,
} from '../../services/appsScriptClient'
import { normalizeRegistrationNumber } from '../../services/studentDataMapper'

interface StudentProfileDetailsProps {
  student: Student
  onReviewUpdate?: (() => void) | undefined
}

export function StudentProfileDetails({ student, onReviewUpdate }: StudentProfileDetailsProps) {
  const { user } = useAuth()
  const adminEmail = user?.email || ''
  const sessionToken = user?.accessToken || ''

  // Extract student Registration Number (the strict unique identifier for dossier lookup)
  const regNum = normalizeRegistrationNumber(
    student.registrationNumber || student.rollNumber || (!student.studentId.includes('@') ? student.studentId : '')
  )

  // Dossier retrieval state
  const [dossierState, setDossierState] = useState<{
    loading: boolean
    error?: { code: string; message: string; count?: number | undefined } | undefined
    dossier?: StudentDossier | undefined
  }>(() => {
    if (!regNum) {
      return {
        loading: false,
        error: {
          code: 'MISSING_REGISTRATION_NUMBER',
          message:
            'Data integrity notice: This student record lacks an institutional Registration Number. In accordance with data integrity rules, Google Form original submission lookup cannot be performed. Email or name fallback is prohibited.',
        },
      }
    }
    return { loading: true }
  })

  // Local comments & history state (reflects student and updates optimistically)
  const [comments, setComments] = useState<AdminComment[]>(() => student.adminComments || [])
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryEntry[]>(() => student.reviewHistory || [])
  const [currentApproval, setCurrentApproval] = useState<ApprovalStatus>(student.approvalStatus || 'Pending')
  const [currentFlag, setCurrentFlag] = useState<ReviewFlagStatus>(student.reviewFlagStatus || 'Not Flagged')
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

  // Fetch dossier using exact Registration Number
  useEffect(() => {
    let isCancelled = false

    if (!regNum) {
      return
    }

    getStudentDossier(sessionToken, regNum)
      .then((res) => {
        if (isCancelled) return

        if (res.success && res.data) {
          setDossierState({ loading: false, dossier: res.data })

          // Sync separate admin review data if present
          if (res.data.adminReviewData) {
            const adm = res.data.adminReviewData
            if (adm.approvalStatus) setCurrentApproval(adm.approvalStatus)
            if (adm.reviewFlagStatus) setCurrentFlag(adm.reviewFlagStatus)
            if (adm.decisionBy) setCurrentDecisionBy(adm.decisionBy)
            if (adm.decisionTimestamp) setCurrentDecisionTimestamp(adm.decisionTimestamp)
            if (adm.decisionComment) setCurrentDecisionComment(adm.decisionComment)
            if (adm.adminComments && adm.adminComments.length > 0) setComments(adm.adminComments)
            if (adm.reviewHistory && adm.reviewHistory.length > 0) setReviewHistory(adm.reviewHistory)
          }
        } else {
          const errCode = res.success ? 'UNKNOWN_ERROR' : res.error.code
          const errMsg = res.success ? 'Failed to retrieve dossier' : res.error.message
          const errDetails = (res as unknown as { error?: { details?: { count?: number } } })?.error?.details
          setDossierState({
            loading: false,
            error: {
              code: errCode,
              message: errMsg,
              count: errDetails?.count,
            },
          })
        }
      })
      .catch((err: unknown) => {
        if (isCancelled) return
        setDossierState({
          loading: false,
          error: {
            code: 'FETCH_ERROR',
            message: err instanceof Error ? err.message : String(err),
          },
        })
      })

    return () => {
      isCancelled = true
    }
  }, [regNum, sessionToken])

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

    const res = await saveAdminComment(sessionToken, student.studentId, newCommentText, adminEmail, user?.id)
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
    const res = await editAdminComment(sessionToken, student.studentId, commentId, editingText, adminEmail)
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
      const res = await changeApprovalStatus(sessionToken, student.studentId, 'Accepted', reasonInput, adminEmail)
      if (res.success) {
        setCurrentApproval('Accepted')
        setCurrentDecisionBy(adminEmail)
        setCurrentDecisionTimestamp(res.data.decisionTimestamp)
        setCurrentDecisionComment(reasonInput)
        if (res.data.reviewHistory) setReviewHistory(res.data.reviewHistory)
        setDecisionFeedback('Candidate accepted for Homecoming executive board.')
        onReviewUpdate?.()
      } else {
        setDecisionFeedback(res.error.message)
      }
    } else if (activeReasonAction === 'REJECT') {
      const res = await changeApprovalStatus(sessionToken, student.studentId, 'Rejected', reasonInput || 'Application rejected by placement committee', adminEmail)
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
      const res = await changeReviewFlag(sessionToken, student.studentId, 'Yellow Flagged', reasonInput || 'Flagged for internal verification', adminEmail)
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

  // Calculate additional Google Form questions dynamically from raw responses
  const additionalQuestions = useMemo(() => {
    if (!dossierState.dossier?.originalSubmission?.allRawResponses) return []
    const raw = dossierState.dossier.originalSubmission.allRawResponses
    const knownKeys = new Set([
      'timestamp', 'submission timestamp', 'formsubmissiontimestamp',
      'registration number', 'registration no.', 'registration no', 'reg no', 'reg. no.', 'regno', 'roll number', 'roll no', 'rollno', 'studentid', 'student id',
      'fullname', 'full name', 'name', 'student name', 'candidate name',
      'email', 'email address', 'gitam email', 'gitam email address', 'student email', 'candidate email', 'personal email', 'alternate email',
      'phonenumber', 'phone number', 'phone', 'mobile number', 'contact number',
      'dateofbirth', 'date of birth', 'dob', 'gender', 'sex',
      'address', 'residential address', 'city', 'state', 'country',
      'program', 'degree', 'course', 'branch', 'department', 'specialization',
      'academicyear', 'academic year', 'year', 'section', 'class section',
      'cgpa', 'current cgpa', 'grade point average', 'backlogs', 'active backlogs',
      'highestqualification', 'highest qualification', 'universitycollege', 'college', 'university', 'yearofpassing', 'passing year',
      'domainpreference1', 'preference 1', 'primary preference', 'committee preferences',
      'domainpreference2', 'preference 2', 'secondary preference',
      'domainpreference3', 'preference 3', 'tertiary preference',
      'rolesappliedfor', 'roles applied for', 'applied positions', 'applied tracks',
      'writtenapplication', 'written application', 'statement of purpose', 'projects', 'project highlights',
      'workexperience', 'experience', 'prior committee experience', 'internships', 'internship experience',
      'technicalskills', 'technical skills', 'softskills', 'soft skills',
      'certifications', 'achievements', 'availabilitycommute', 'availability', 'interview day availability', 'commute',
      'eventcommitment', 'event week commitment',
      'resumelink', 'resume link', 'resume', 'upload resume',
      'documentlinks', 'document links', 'verification documents', 'certificates',
      'bookingstatus', 'booking status', 'bookingid', 'booking id', 'bookingrequestid', 'booking request id',
      'interviewdate', 'interview date', 'interviewslot', 'interview slot', 'interviewstart', 'interview start',
      'interviewend', 'interview end', 'bookingtimestamp', 'booking timestamp',
      'approvalstatus', 'approval status', 'decisionby', 'decision by', 'decisiontimestamp', 'decision timestamp',
      'decisioncomment', 'decision comment', 'admincomment', 'admincomments',
      'reviewflagstatus', 'review flag status', 'flaggedby', 'flagged by', 'flaggedat', 'flagged at',
      'flagreason', 'flag reason', 'reviewhistory'
    ])

    return Object.entries(raw).filter(([key, val]) => {
      const cleanKey = key.trim().toLowerCase()
      return !knownKeys.has(cleanKey) && val !== undefined && val !== null && String(val).trim() !== ''
    })
  }, [dossierState.dossier?.originalSubmission?.allRawResponses])

  // Extract source values (preferring original Google Form submission)
  const orig = dossierState.dossier?.originalSubmission
  const fullName = orig?.fullName || student.fullName
  const gender = orig?.gender || student.gender || 'Unspecified'
  const dob = orig?.dateOfBirth || student.dateOfBirth
  const gitamEmail = orig?.email || student.gitamEmail
  const personalEmail = orig?.personalEmail || student.personalEmail
  const phoneNumber = orig?.phoneNumber || student.phoneNumber
  const address = orig?.address || student.address
  const city = orig?.city || student.city
  const state = orig?.state || student.state
  const country = orig?.country || student.country

  const program = orig?.program || student.program
  const branch = orig?.branch || student.branch
  const academicYear = orig?.academicYear || student.academicYear
  const section = orig?.section || student.section
  const displayRegNum = orig?.registrationNumber || regNum || student.rollNumber || student.studentId
  const cgpa = orig?.cgpa !== undefined ? orig.cgpa : student.cgpa
  const backlogs = orig?.backlogs !== undefined ? orig.backlogs : student.backlogs
  const highestQualification = orig?.highestQualification || student.highestQualification
  const college = orig?.universityCollege || student.universityCollege
  const yearOfPassing = orig?.yearOfPassing || student.yearOfPassing

  const pref1 = orig?.committeePreferences?.primary || student.committeePreferences || student.domainPreference1
  const pref2 = orig?.committeePreferences?.secondary || student.domainPreference2 || 'General Coordination'
  const pref3 = orig?.committeePreferences?.tertiary || student.domainPreference3 || 'Hospitality & Logistics'

  const rolesAppliedFor = orig?.rolesAppliedFor || student.rolesAppliedFor || `${student.domainPreference1} Lead / Student Coordinator`
  const priorExp = orig?.priorExperience || student.workExperience || 'First-time Homecoming Applicant'
  const sop = orig?.writtenApplication || student.writtenApplication || student.projects || 'Candidate applied for Homecoming 2026 Student Organization Team.'
  const internships = orig?.internships || student.internships || 'None listed'

  const technicalSkills = orig?.technicalSkills || student.technicalSkills
  const softSkills = orig?.softSkills || student.softSkills
  const certifications = orig?.certifications || student.certifications || 'None listed'
  const achievements = orig?.achievements || student.achievements || 'None listed'

  const availability = orig?.availabilityCommute || student.availabilityCommute || 'Available across all 6 scheduled interview dates. Daily campus commute.'
  const eventCommitment = orig?.eventCommitment || 'Full-time on-site presence confirmed for Homecoming 2026.'
  const resumeLink = orig?.resumeLink || student.resumeLink
  const documentLinks = orig?.documentLinks || student.documentLinks
  const submissionTimestamp = orig?.timestamp || student.formSubmissionTimestamp

  return (
    <div className="student-profile-expanded-panel">
      {/* Dossier Header */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#00392F', fontWeight: 750 }}>
            Student Dossier: {fullName} (Reg: {displayRegNum})
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
            Original Form Submitted: {formatISTDateTime(submissionTimestamp)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Badge type="booking" status={student.bookingStatus} />
          <Badge type="approval" status={currentApproval} />
          <Badge type="review" status={currentFlag} />
        </div>
      </div>

      {/* Loading State Banner */}
      {dossierState.loading && (
        <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: '#eef8f3', borderRadius: '6px', textAlign: 'center', color: '#00392F' }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>
            Retrieving original Google Form submission by Registration Number ({regNum})...
          </p>
        </div>
      )}

      {/* Error / Data Integrity / Ambiguity Banners */}
      {dossierState.error && (
        <div style={{ marginBottom: '1rem' }}>
          {dossierState.error.code === 'MISSING_REGISTRATION_NUMBER' && (
            <div className="error-panel" style={{ border: '1px solid #dc3545', backgroundColor: '#fff5f5', padding: '1rem', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 0.35rem 0', color: '#c53030', fontSize: '0.98rem' }}>
                Data Integrity Notice: Missing Registration Number
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#742a2a' }}>
                {dossierState.error.message}
              </p>
            </div>
          )}

          {dossierState.error.code === 'AMBIGUOUS_REGISTRATION' && (
            <div className="error-panel" style={{ border: '1px solid #d69e2e', backgroundColor: '#fffaf0', padding: '1rem', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 0.35rem 0', color: '#b7791f', fontSize: '0.98rem' }}>
                Ambiguity Warning: Multiple Submissions Detected
              </h4>
              <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.88rem', color: '#744210' }}>
                {dossierState.error.message}
              </p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#744210' }}>
                Automated selection has been blocked to protect candidate data integrity. Please review the duplicate registrations directly in the spreadsheet database.
              </p>
            </div>
          )}

          {dossierState.error.code === 'SUBMISSION_NOT_FOUND' && (
            <div className="error-panel" style={{ border: '1px solid #cbd5e0', backgroundColor: '#f7fafc', padding: '1rem', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 0.35rem 0', color: '#4a5568', fontSize: '0.98rem' }}>
                Original Submission Not Found
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#4a5568' }}>
                {dossierState.error.message}
              </p>
            </div>
          )}

          {dossierState.error.code !== 'MISSING_REGISTRATION_NUMBER' &&
            dossierState.error.code !== 'AMBIGUOUS_REGISTRATION' &&
            dossierState.error.code !== 'SUBMISSION_NOT_FOUND' && (
              <div className="error-panel" style={{ border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 0.35rem 0', color: '#334155', fontSize: '0.98rem' }}>
                  Dossier Notice
                </h4>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569' }}>
                  {dossierState.error.message}
                </p>
              </div>
            )}
        </div>
      )}

      {/* Structured Original Google Form Responses Grid */}
      <div className="profile-section-grid">
        {/* SECTION 1: Registration & Contact */}
        <div className="profile-group">
          <h4 className="profile-group-title">1. Registration & Contact</h4>
          <div className="profile-field-row">
            <span className="field-key">Full Name:</span>
            <span className="field-val">{fullName} ({gender})</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Date of Birth:</span>
            <span className="field-val">{formatISTDate(dob)}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">GITAM Email:</span>
            <span className="field-val">{gitamEmail}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Personal Email:</span>
            <span className="field-val">{personalEmail}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Phone Number:</span>
            <span className="field-val">{phoneNumber}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Residential Location:</span>
            <span className="field-val">
              {address}, {city}, {state}, {country}
            </span>
          </div>
        </div>

        {/* SECTION 2: Academic Information */}
        <div className="profile-group">
          <h4 className="profile-group-title">2. Academic Information</h4>
          <div className="profile-field-row">
            <span className="field-key">Program & Degree:</span>
            <span className="field-val">{program} - {branch}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Academic Year & Section:</span>
            <span className="field-val">{academicYear} • Section {section}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Registration Number:</span>
            <span className="field-val" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
              {displayRegNum}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Current CGPA:</span>
            <span className="field-val" style={{ fontWeight: 700, color: (Number(cgpa) || 0) >= 8.0 ? 'var(--status-approved-text)' : 'inherit' }}>
              {(Number(cgpa) || 0).toFixed(2)}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Active Backlogs:</span>
            <span className="field-val" style={{ color: (Number(backlogs) || 0) > 0 ? 'var(--status-rejected-text)' : 'inherit' }}>
              {backlogs !== undefined && backlogs !== null ? backlogs : 0}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Prior Qualification:</span>
            <span className="field-val">{highestQualification} ({college}, {yearOfPassing})</span>
          </div>
        </div>

        {/* SECTION 3: Committee Preferences */}
        <div className="profile-group">
          <h4 className="profile-group-title">3. Committee Preferences</h4>
          <div className="profile-field-row">
            <span className="field-key">Primary Preference:</span>
            <span className="field-val"><strong>1.</strong> {pref1}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Secondary Preference:</span>
            <span className="field-val"><strong>2.</strong> {pref2}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Tertiary Preference:</span>
            <span className="field-val"><strong>3.</strong> {pref3}</span>
          </div>
        </div>

        {/* SECTION 4: Roles Applied For */}
        <div className="profile-group">
          <h4 className="profile-group-title">4. Roles Applied For</h4>
          <div className="profile-field-row">
            <span className="field-key">Applied Positions / Tracks:</span>
            <span className="field-val">{rolesAppliedFor}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Prior Committee Experience:</span>
            <span className="field-val">{priorExp}</span>
          </div>
        </div>

        {/* SECTION 5: Written Application */}
        <div className="profile-group">
          <h4 className="profile-group-title">5. Written Application</h4>
          <div className="profile-field-row">
            <span className="field-key">Statement of Purpose / Project Highlights:</span>
            <span className="field-val" style={{ lineHeight: 1.5 }}>{sop}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Internships & Practical Exposure:</span>
            <span className="field-val">{internships}</span>
          </div>
        </div>

        {/* SECTION 6: Self-Assessment */}
        <div className="profile-group">
          <h4 className="profile-group-title">6. Self-Assessment</h4>
          <div className="profile-field-row">
            <span className="field-key">Technical Competencies:</span>
            <span className="field-val">{technicalSkills}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Soft Skills & Communication:</span>
            <span className="field-val">{softSkills}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Certifications & Credentials:</span>
            <span className="field-val">{certifications}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Notable Achievements:</span>
            <span className="field-val">{achievements}</span>
          </div>
        </div>

        {/* SECTION 7: Availability & Commute */}
        <div className="profile-group">
          <h4 className="profile-group-title">7. Availability & Commute</h4>
          <div className="profile-field-row">
            <span className="field-key">Interview Day Availability:</span>
            <span className="field-val">{availability}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Event Week Commitment:</span>
            <span className="field-val">{eventCommitment}</span>
          </div>
        </div>

        {/* SECTION 8: Documents & Attachments */}
        <div className="profile-group">
          <h4 className="profile-group-title">8. Documents & Attachments</h4>
          <div className="profile-field-row">
            <span className="field-key">Resume Document:</span>
            <span className="field-val">
              {resumeLink ? (
                <a href={resumeLink} target="_blank" rel="noreferrer" style={{ color: 'var(--portal-primary)', fontWeight: 600 }}>
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
              {documentLinks ? (
                <a href={documentLinks} target="_blank" rel="noreferrer" style={{ color: 'var(--portal-primary)', fontWeight: 600 }}>
                  View Verification Folder
                </a>
              ) : (
                'None provided'
              )}
            </span>
          </div>
        </div>

        {/* SECTION 9: Additional Form Questions (if present in Google Form) */}
        {additionalQuestions.length > 0 && (
          <div className="profile-group" style={{ gridColumn: '1 / -1' }}>
            <h4 className="profile-group-title">9. Additional Google Form Questions</h4>
            {additionalQuestions.map(([q, ans]) => (
              <div key={q} className="profile-field-row" style={{ alignItems: 'flex-start' }}>
                <span className="field-key" style={{ maxWidth: '300px' }}>{q}:</span>
                <span className="field-val" style={{ whiteSpace: 'pre-wrap' }}>{String(ans)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 10: Administrative Review & Comments (MANDATORY FINAL SECTION - STRICTLY SEPARATE) */}
      <div className="admin-review-section">
        <div className="review-section-header">
          <div>
            <h4 className="review-section-title">10. Administrative Review & Comments</h4>
            <span style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
              Restricted administrative assessments, review status controls, and private assessor observations.
            </span>
          </div>
        </div>

        {/* Sub-section: Booking Information */}
        <div style={{ marginBottom: '1.25rem', padding: '0.85rem', backgroundColor: '#f4fbf7', border: '1px solid #cce8db', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--portal-text-muted)', display: 'block', fontWeight: 700, marginBottom: '0.4rem' }}>
            Interview Reservation Details:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.88rem' }}>
            <div>
              <span style={{ color: 'var(--portal-text-muted)' }}>Status: </span>
              <strong>{student.bookingStatus}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--portal-text-muted)' }}>Slot: </span>
              <span>
                {student.bookingStatus === 'Booked'
                  ? `${student.bookedDate} at ${student.bookedSlotStart} – ${student.bookedSlotEnd} IST`
                  : 'No Slot Reserved'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--portal-text-muted)' }}>Booking ID: </span>
              <span style={{ fontFamily: 'monospace' }}>{student.bookingId || 'N/A'}</span>
            </div>
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
                  currentApproval === 'Approved' || currentApproval === 'Accepted'
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
                &ldquo;{currentDecisionComment}&rdquo;
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
              className={`btn-decision btn-decision-approve ${currentApproval === 'Approved' || currentApproval === 'Accepted' ? 'active' : ''}`}
              onClick={() => handleTriggerDecision('APPROVE')}
              disabled={isSubmittingDecision}
            >
              <span className="decision-indicator-dot decision-indicator-green" />
              Accepted
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

        {/* Active Decision Prompt Modal / Reason Box */}
        {activeReasonAction && (
          <div className="decision-prompt-box">
            <h5 style={{ margin: '0 0 0.5rem 0', color: '#00392F', fontSize: '0.95rem' }}>
              Confirm Decision: <strong>{activeReasonAction.replace('_', ' ')}</strong>
            </h5>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
              Please provide the official administrative rationale for this decision. This will be recorded in the audit history.
            </p>
            <textarea
              className="comment-textarea"
              rows={2}
              placeholder="Enter official decision rationale..."
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              disabled={isSubmittingDecision}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-comment-submit"
                onClick={handleConfirmDecision}
                disabled={isSubmittingDecision}
              >
                {isSubmittingDecision ? 'Submitting...' : 'Confirm & Apply Decision'}
              </button>
              <button
                type="button"
                className="btn-comment-cancel"
                onClick={() => setActiveReasonAction(null)}
                disabled={isSubmittingDecision}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {decisionFeedback && (
          <div style={{ fontSize: '0.85rem', color: 'var(--portal-primary)', fontWeight: 600 }}>
            {decisionFeedback}
          </div>
        )}

        {/* Part B: Private Administrative Comments */}
        <div className="comments-container">
          <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#00392F' }}>
            Private Administrator Comments ({comments.length})
          </h5>
          <span style={{ fontSize: '0.8rem', color: 'var(--portal-text-muted)', display: 'block', marginBottom: '0.75rem' }}>
            Confidential assessor observations visible only to authorized Homecoming administrators.
          </span>

          {/* Add New Comment Form */}
          <form onSubmit={handleSaveComment} style={{ marginBottom: '1rem' }}>
            <textarea
              className="comment-textarea"
              rows={2}
              placeholder="Add confidential notes, assessor remarks, or verification requirements..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              disabled={isSavingComment}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="btn-comment-submit"
                disabled={isSavingComment || !newCommentText.trim()}
              >
                {isSavingComment ? 'Saving Note...' : 'Save Private Comment'}
              </button>
            </div>
          </form>

          {commentFeedback && (
            <div style={{ fontSize: '0.85rem', color: 'var(--portal-primary)', marginBottom: '0.75rem' }}>
              {commentFeedback}
            </div>
          )}

          {/* Comments List */}
          {comments.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--portal-text-muted)', fontStyle: 'italic' }}>
              No private assessor comments recorded yet.
            </p>
          ) : (
            <div className="comment-list">
              {comments.map((comment) => (
                <div key={comment.commentId} className="comment-item">
                  <div className="comment-header">
                    <div>
                      <span className="comment-author">{comment.adminEmail}</span>
                      <span className="comment-timestamp">
                        {' • '}{formatISTDateTime(comment.createdAt)}
                        {comment.isEdited && ' (edited)'}
                      </span>
                    </div>

                    {/* Allow author or administrators to edit comment */}
                    {editingCommentId !== comment.commentId && (
                      <button
                        type="button"
                        className="btn-comment-edit"
                        onClick={() => handleStartEdit(comment)}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {editingCommentId === comment.commentId ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <textarea
                        className="comment-textarea"
                        rows={2}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        disabled={isEditingComment}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn-comment-submit"
                          onClick={() => handleSaveEdit(comment.commentId)}
                          disabled={isEditingComment || !editingText.trim()}
                        >
                          {isEditingComment ? 'Saving...' : 'Save Edit'}
                        </button>
                        <button
                          type="button"
                          className="btn-comment-cancel"
                          onClick={() => setEditingCommentId(null)}
                          disabled={isEditingComment}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="comment-text">{comment.commentText}</div>
                      {comment.isEdited && comment.editHistory && comment.editHistory.length > 0 && (
                        <div style={{ marginTop: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn-history-toggle"
                            onClick={() => toggleHistoryExpanded(comment.commentId)}
                          >
                            {expandedHistoryIds.has(comment.commentId)
                              ? 'Hide Edit History'
                              : `View Edit History (${comment.editHistory.length} previous versions)`}
                          </button>

                          {expandedHistoryIds.has(comment.commentId) && (
                            <div className="comment-history-box">
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--portal-text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                                Edit Audit Trail:
                              </span>
                              {comment.editHistory.map((ver, vIdx) => (
                                <div key={vIdx} className="history-version-row">
                                  <span className="history-version-meta">
                                    Version edited on {formatISTDateTime(ver.editedAt)} by {ver.editedBy}:
                                  </span>
                                  <span className="history-version-text">&ldquo;{ver.commentText}&rdquo;</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Part C: Administrative Audit History */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #cce8db', paddingTop: '1rem' }}>
          <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#00392F' }}>
            Administrative Audit History ({reviewHistory.length} recorded events)
          </h5>
          <span style={{ fontSize: '0.8rem', color: 'var(--portal-text-muted)', display: 'block', marginBottom: '0.75rem' }}>
            Full immutable chronological log of state changes, review actions, and timestamps.
          </span>

          {reviewHistory.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--portal-text-muted)', fontStyle: 'italic' }}>
              No audit events recorded for this candidate yet.
            </p>
          ) : (
            <div className="audit-history-list">
              {reviewHistory.map((entry) => (
                <div key={entry.reviewId} className="audit-history-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#00392F' }}>
                      Status Transition: {entry.previousApprovalStatus} → {entry.newApprovalStatus}
                      {entry.newReviewFlagStatus !== entry.previousReviewFlagStatus &&
                        ` | Flag: ${entry.previousReviewFlagStatus} → ${entry.newReviewFlagStatus}`}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--portal-text-muted)' }}>
                      {formatISTDateTime(entry.changedAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--portal-text)', marginTop: '0.2rem' }}>
                    Action recorded by: <strong>{entry.changedBy}</strong>
                    {entry.reason && ` • Rationale: "${entry.reason}"`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
