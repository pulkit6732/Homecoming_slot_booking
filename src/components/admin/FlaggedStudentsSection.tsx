import type { Student } from '../../types'
import { Badge } from '../common/Badge'

interface FlaggedStudentsSectionProps {
  flaggedStudents: Student[]
  onClearFlag: (studentId: string) => void
}

export function FlaggedStudentsSection({ flaggedStudents, onClearFlag }: FlaggedStudentsSectionProps) {
  if (flaggedStudents.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          border: '1px solid var(--portal-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--portal-text-muted)',
        }}
      >
        <strong>No students are currently flagged for review.</strong>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
          Any profiles flagged by coordinators for discrepancies or verification will appear here prominently.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          backgroundColor: 'var(--status-flagged-bg)',
          border: '1px solid #ffe082',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          color: 'var(--status-flagged-text)',
        }}
      >
        <strong>Attention Required:</strong> {flaggedStudents.length} candidate profile
        {flaggedStudents.length > 1 ? 's' : ''} currently flagged for administrative scrutiny.
      </div>

      <div className="table-responsive">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Academic Year</th>
              <th>Branch / Roll</th>
              <th>Interview Slot</th>
              <th>Flag Reason</th>
              <th>Flagged By</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {flaggedStudents.map((s) => (
              <tr key={s.studentId}>
                <td>
                  <strong>{s.fullName}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--portal-text-muted)' }}>
                    {s.gitamEmail}
                  </div>
                </td>
                <td>{s.academicYear}</td>
                <td>
                  {s.branch}
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{s.rollNumber}</div>
                </td>
                <td>
                  {s.bookingStatus === 'Booked' ? (
                    <div>
                      <strong>{s.bookedDate}</strong>
                      <div style={{ fontSize: '0.75rem' }}>{s.bookedSlotStart} – {s.bookedSlotEnd}</div>
                    </div>
                  ) : (
                    <Badge type="booking" status="Not Booked" />
                  )}
                </td>
                <td style={{ maxWidth: '280px', color: 'var(--status-flagged-text)', fontWeight: 600 }}>
                  "{s.flagReason}"
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--portal-text-muted)' }}>
                  {s.flaggedBy || 'Admin'}
                  <br />
                  {s.flaggedAt ? new Date(s.flaggedAt).toLocaleDateString() : ''}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-table-action"
                    onClick={() => onClearFlag(s.studentId)}
                  >
                    Clear Flag
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
