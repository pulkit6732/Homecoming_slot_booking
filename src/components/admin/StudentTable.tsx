import { useState, useId } from 'react'
import type { EntriesPerPage, Student } from '../../types'
import { Badge } from '../common/Badge'
import { StudentProfileDetails } from './StudentProfileDetails'
import type { ReviewActionType } from './ReviewActionModal'

interface StudentTableProps {
  students: Student[]
  onTriggerReviewAction: (student: Student, actionType: ReviewActionType) => void
}

export function StudentTable({ students, onTriggerReviewAction }: StudentTableProps) {
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [entriesPerPage, setEntriesPerPage] = useState<EntriesPerPage>(10)
  const entriesPerPageSelectId = useId()

  const toggleExpand = (studentId: string) => {
    setExpandedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }
      return next
    })
  }

  // Sorting: Chronological by booked date then slot start
  const sortedStudents = [...students].sort((a, b) => {
    if (a.bookedDate !== b.bookedDate) {
      return a.bookedDate.localeCompare(b.bookedDate)
    }
    return a.bookedSlotStart.localeCompare(b.bookedSlotStart)
  })

  // Pagination calculation
  const totalEntries = sortedStudents.length
  const pageSize = entriesPerPage === 'all' ? totalEntries : entriesPerPage
  const totalPages = Math.max(1, Math.ceil(totalEntries / (pageSize || 1)))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const startIndex = (safeCurrentPage - 1) * (entriesPerPage === 'all' ? 0 : pageSize)
  const endIndex = entriesPerPage === 'all' ? totalEntries : Math.min(startIndex + pageSize, totalEntries)
  const paginatedStudents = sortedStudents.slice(startIndex, endIndex)

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  const handleEntriesPerPageChange = (val: string) => {
    setEntriesPerPage(val === 'all' ? 'all' : (Number(val) as EntriesPerPage))
    setCurrentPage(1)
  }

  if (students.length === 0) {
    return (
      <div
        style={{
          padding: '2.5rem',
          textAlign: 'center',
          backgroundColor: 'var(--portal-card-bg)',
          border: '1px solid var(--portal-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--portal-text-muted)',
        }}
      >
        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>No booked students match this date or filter query.</p>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
          Try clearing your search query or selecting a different interview date.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="table-responsive">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Slot Time</th>
              <th>Student Name</th>
              <th>Roll Number</th>
              <th>Branch</th>
              <th>CGPA</th>
              <th>Approval</th>
              <th>Review Flag</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.map((student) => {
              const isExpanded = expandedStudentIds.has(student.studentId)

              return (
                <tr key={`${student.studentId}-${student.bookingId}`}>
                  <td colSpan={8} style={{ padding: 0 }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1.5fr 130px 1.2fr 80px 110px 130px auto',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        borderBottom: isExpanded ? 'none' : '1px solid #eef2ef',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {student.bookedSlotStart || '—'}
                      </div>
                      <div>
                        <strong>{student.fullName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--portal-text-muted)' }}>
                          {student.gitamEmail}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{student.rollNumber}</div>
                      <div style={{ fontSize: '0.85rem' }}>{student.branch}</div>
                      <div>
                        <strong>{student.cgpa.toFixed(2)}</strong>
                      </div>
                      <div>
                        <Badge type="approval" status={student.approvalStatus} />
                      </div>
                      <div>
                        <Badge type="review" status={student.reviewFlagStatus} />
                      </div>
                      <div className="admin-actions-cell">
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => toggleExpand(student.studentId)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? 'Hide Details' : 'View Full Details'}
                        </button>

                        <button
                          type="button"
                          className="btn-table-action btn-approve"
                          onClick={() => onTriggerReviewAction(student, 'APPROVE')}
                          title="Approve candidate"
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          className="btn-table-action btn-reject"
                          onClick={() => onTriggerReviewAction(student, 'REJECT')}
                          title="Reject candidate"
                        >
                          Reject
                        </button>

                        {student.reviewFlagStatus === 'Flagged for Review' ? (
                          <button
                            type="button"
                            className="btn-table-action"
                            onClick={() => onTriggerReviewAction(student, 'CLEAR_FLAG')}
                            title="Clear review flag"
                          >
                            Clear Flag
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-table-action btn-flag"
                            onClick={() => onTriggerReviewAction(student, 'FLAG')}
                            title="Flag for review"
                          >
                            Flag
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-table-action btn-reject"
                          onClick={() => onTriggerReviewAction(student, 'CANCEL_BOOKING')}
                          title="Release this slot and cancel reservation"
                        >
                          Remove Slot
                        </button>
                      </div>
                    </div>

                    {isExpanded && <StudentProfileDetails student={student} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="pagination-container">
        <div>
          Showing {totalEntries === 0 ? 0 : startIndex + 1}–{endIndex} of {totalEntries} booked students
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label htmlFor={entriesPerPageSelectId} style={{ fontSize: '0.85rem' }}>Rows per page:</label>
            <select
              id={entriesPerPageSelectId}
              value={entriesPerPage}
              onChange={(e) => handleEntriesPerPageChange(e.target.value)}
              style={{
                padding: '0.3rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--portal-border)',
                fontSize: '0.85rem',
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="pagination-controls-buttons">
            <button
              type="button"
              className="pagination-btn"
              disabled={safeCurrentPage <= 1}
              onClick={() => handlePageChange(safeCurrentPage - 1)}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Page {safeCurrentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="pagination-btn"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => handlePageChange(safeCurrentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
