import type { Student } from '../../types'
import { Badge } from '../common/Badge'
import { formatISTDateTime, formatISTDate } from '../../utils/timezone'

interface StudentProfileDetailsProps {
  student: Student
}

export function StudentProfileDetails({ student }: StudentProfileDetailsProps) {
  return (
    <div className="student-profile-expanded-panel">
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--portal-text)' }}>
            Student Dossier: {student.fullName} ({student.studentId})
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
            Form submitted on: {formatISTDateTime(student.formSubmissionTimestamp)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Badge type="booking" status={student.bookingStatus} />
          <Badge type="approval" status={student.approvalStatus} />
          <Badge type="review" status={student.reviewFlagStatus} />
        </div>
      </div>

      <div className="profile-section-grid">
        {/* 1. Personal & Contact Details */}
        <div className="profile-group">
          <h4 className="profile-group-title">Personal & Contact Information</h4>
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

        {/* 2. Academic Record */}
        <div className="profile-group">
          <h4 className="profile-group-title">Academic Record</h4>
          <div className="profile-field-row">
            <span className="field-key">Program & Degree:</span>
            <span className="field-val">{student.program} - {student.branch}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Academic Year & Section:</span>
            <span className="field-val">{student.academicYear} • Section {student.section}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Roll Number:</span>
            <span className="field-val" style={{ fontFamily: 'monospace' }}>{student.rollNumber}</span>
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

        {/* 3. Skills, Achievements & Certifications */}
        <div className="profile-group">
          <h4 className="profile-group-title">Skills & Certifications</h4>
          <div className="profile-field-row">
            <span className="field-key">Technical Skills:</span>
            <span className="field-val">{student.technicalSkills}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Soft Skills:</span>
            <span className="field-val">{student.softSkills}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Certifications:</span>
            <span className="field-val">{student.certifications || 'None listed'}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Notable Achievements:</span>
            <span className="field-val">{student.achievements || 'None listed'}</span>
          </div>
        </div>

        {/* 4. Projects & Experience */}
        <div className="profile-group">
          <h4 className="profile-group-title">Projects & Experience</h4>
          <div className="profile-field-row">
            <span className="field-key">Key Projects:</span>
            <span className="field-val">{student.projects || 'None listed'}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Internships:</span>
            <span className="field-val">{student.internships || 'None listed'}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Prior Work Experience:</span>
            <span className="field-val">{student.workExperience || 'None listed'}</span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Domain Preferences:</span>
            <span className="field-val">
              1. {student.domainPreference1} <br />
              2. {student.domainPreference2} <br />
              3. {student.domainPreference3}
            </span>
          </div>
        </div>

        {/* 5. Documents & Application Attachments */}
        <div className="profile-group">
          <h4 className="profile-group-title">Documents & Portfolio</h4>
          <div className="profile-field-row">
            <span className="field-key">Resume:</span>
            <span className="field-val">
              {student.resumeLink ? (
                <a href={student.resumeLink} target="_blank" rel="noreferrer" style={{ color: 'var(--portal-primary)', fontWeight: 600 }}>
                  View Resume Document
                </a>
              ) : 'Not uploaded'}
            </span>
          </div>
          <div className="profile-field-row">
            <span className="field-key">Verification Documents:</span>
            <span className="field-val">
              {student.documentLinks ? (
                <a href={student.documentLinks} target="_blank" rel="noreferrer" style={{ color: 'var(--portal-primary)', fontWeight: 600 }}>
                  View Document Folder
                </a>
              ) : 'None provided'}
            </span>
          </div>
        </div>

        {/* 6. Booking & Administrative Review Decisions */}
        <div className="profile-group">
          <h4 className="profile-group-title">Booking & Review Decisions</h4>
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
            <span className="field-key">Approval Decision:</span>
            <span className="field-val">
              <strong>{student.approvalStatus}</strong>
              {student.decisionBy && ` by ${student.decisionBy}`}
              {student.decisionTimestamp && ` on ${formatISTDateTime(student.decisionTimestamp)}`}
            </span>
          </div>
          {student.decisionComment && (
            <div className="profile-field-row">
              <span className="field-key">Decision Remarks:</span>
              <span className="field-val">"{student.decisionComment}"</span>
            </div>
          )}
          {student.reviewFlagStatus === 'Flagged for Review' && (
            <div className="profile-field-row" style={{ backgroundColor: 'var(--status-flagged-bg)', padding: '0.4rem', borderRadius: '4px' }}>
              <span className="field-key" style={{ color: 'var(--status-flagged-text)' }}>Flagged Note:</span>
              <span className="field-val" style={{ color: 'var(--status-flagged-text)' }}>
                {student.flagReason} (by {student.flaggedBy} on {formatISTDateTime(student.flaggedAt)})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

