import type { Student } from '../../types'
import { Badge } from '../common/Badge'

interface UnbookedStudentsSectionProps {
  unbookedStudents: Student[]
}

export function UnbookedStudentsSection({ unbookedStudents }: UnbookedStudentsSectionProps) {
  if (unbookedStudents.length === 0) {
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
        <strong>All Registered Students Have Reserved Slots</strong>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
          All registered students have successfully secured an interview slot.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--portal-border)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <strong style={{ fontSize: '1rem' }}>Registered Candidates Awaiting Reservation</strong>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
            These students are present in the Master Student Database but have not yet selected a 10-minute slot.
          </p>
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--portal-primary)' }}>
          {unbookedStudents.length} Remaining
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Roll Number</th>
              <th>Program & Branch</th>
              <th>Academic Year</th>
              <th>CGPA</th>
              <th>Phone Number</th>
              <th>Review Status</th>
            </tr>
          </thead>
          <tbody>
            {unbookedStudents.map((s) => (
              <tr key={s.studentId}>
                <td>
                  <strong>{s.fullName}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--portal-text-muted)' }}>
                    {s.gitamEmail}
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace' }}>{s.rollNumber}</td>
                <td>{s.program} - {s.branch}</td>
                <td>{s.academicYear}</td>
                <td><strong>{s.cgpa.toFixed(2)}</strong></td>
                <td>{s.phoneNumber}</td>
                <td>
                  <Badge type="review" status={s.reviewFlagStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
