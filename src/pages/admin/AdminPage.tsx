import { useState } from 'react'
import type { SearchFilters, Student } from '../../types'
import { ELIGIBLE_DATES } from '../../utils/schedule'
import { mockStorage } from '../../services/mockStorage'
import { DateSelector } from '../../components/student/DateSelector'
import { DailySummary } from '../../components/admin/DailySummary'
import { FilterBar } from '../../components/admin/FilterBar'
import { StudentTable } from '../../components/admin/StudentTable'
import { FlaggedStudentsSection } from '../../components/admin/FlaggedStudentsSection'
import { UnbookedStudentsSection } from '../../components/admin/UnbookedStudentsSection'
import { ReviewActionModal, type ReviewActionType } from '../../components/admin/ReviewActionModal'
import '../../styles/portal.css'

type AdminTab = 'SCHEDULE' | 'FLAGGED' | 'UNBOOKED'

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('SCHEDULE')
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    try {
      return localStorage.getItem('gitam_admin_active_date_v1') || ELIGIBLE_DATES[0].date
    } catch {
      return ELIGIBLE_DATES[0].date
    }
  })
  const [revision, setRevision] = useState<number>(0)

  // Active Review Action Modal state
  const [reviewModalStudent, setReviewModalStudent] = useState<Student | null>(null)
  const [reviewModalAction, setReviewModalAction] = useState<ReviewActionType | null>(null)

  // Filters state with persistence
  const [filters, setFilters] = useState<SearchFilters>(() => {
    try {
      const saved = localStorage.getItem('gitam_admin_filters_v1')
      if (saved) return JSON.parse(saved)
    } catch {
      // fallback
    }
    return {
      nameQuery: '',
      emailQuery: '',
      academicYear: '',
      bookingStatus: '',
      approvalStatus: '',
      reviewFlagStatus: '',
    }
  })

  const handleSelectDate = (date: string) => {
    setSelectedDate(date)
    try {
      localStorage.setItem('gitam_admin_active_date_v1', date)
    } catch {
      // fallback
    }
  }

  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters)
    try {
      localStorage.setItem('gitam_admin_filters_v1', JSON.stringify(newFilters))
    } catch {
      // fallback
    }
  }

  // Derive students and daily summary directly based on selectedDate and revision
  const allStudents = mockStorage.getAllStudents()
  const daySummary = mockStorage.getDaySummary(selectedDate)

  const handleResetFilters = () => {
    const emptyFilters: SearchFilters = {
      nameQuery: '',
      emailQuery: '',
      academicYear: '',
      bookingStatus: '',
      approvalStatus: '',
      reviewFlagStatus: '',
    }
    setFilters(emptyFilters)
    try {
      localStorage.removeItem('gitam_admin_filters_v1')
    } catch {
      // fallback
    }
  }

  const handleResetAllMockData = () => {
    if (window.confirm('Reset all mock students, bookings, and review statuses?')) {
      mockStorage.resetToInitial()
      setRevision((prev) => prev + 1)
    }
  }

  // Trigger Review Action
  const handleTriggerReviewAction = (student: Student, actionType: ReviewActionType) => {
    setReviewModalStudent(student)
    setReviewModalAction(actionType)
  }

  // Confirm Approve
  const handleConfirmApprove = (studentId: string, comment: string) => {
    mockStorage.approveStudent(studentId, comment, 'Administrator')
    setRevision((prev) => prev + 1)
  }

  // Confirm Reject
  const handleConfirmReject = (studentId: string, reason: string) => {
    mockStorage.rejectStudent(studentId, reason, 'Administrator')
    setRevision((prev) => prev + 1)
  }

  // Confirm Flag
  const handleConfirmFlag = (studentId: string, reason: string) => {
    mockStorage.flagStudent(studentId, reason, 'Administrator')
    setRevision((prev) => prev + 1)
  }

  // Confirm Clear Flag
  const handleConfirmClearFlag = (studentId: string) => {
    mockStorage.clearFlag(studentId)
    setRevision((prev) => prev + 1)
  }

  // Filtered students for the table
  const bookedStudentsOnDate = allStudents.filter(
    (s) => s.bookingStatus === 'Booked' && s.bookedDate === selectedDate,
  )
  const filteredBookedStudents = mockStorage.filterStudents(bookedStudentsOnDate, filters)

  const flaggedStudents = mockStorage.getFlaggedStudents()
  const unbookedStudents = mockStorage.getUnbookedStudents()

  return (
    <div className="admin-portal-view">
      {/* Simulation Banner */}
      <div className="simulation-pill-banner">
        <span>
          <strong>Phase 2 Administrator Environment</strong> — Real-time mock data & interview review dashboard.
          {revision > 0 && ` (Updated: Revision #${revision})`}
        </span>
        <button type="button" className="btn-reset-mock" onClick={handleResetAllMockData}>
          Reset Fixture Data
        </button>
      </div>

      <div className="page-heading">
        <p className="eyebrow">GITAM Administration • Interview Operations</p>
        <h1>Interview Schedule & Review Dashboard</h1>
        <p>
          Monitor 10-minute interview slots, evaluate student dossiers, and manage approval and review flag statuses.
        </p>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="admin-subnav-pills" role="tablist" aria-label="Admin Sections">
        <button
          type="button"
          className={`admin-subnav-btn ${activeTab === 'SCHEDULE' ? 'active' : ''}`}
          onClick={() => setActiveTab('SCHEDULE')}
        >
          Schedule View (Date-Based)
        </button>

        <button
          type="button"
          className={`admin-subnav-btn ${activeTab === 'FLAGGED' ? 'active' : ''}`}
          onClick={() => setActiveTab('FLAGGED')}
        >
          Flagged Profiles
          {flaggedStudents.length > 0 && <span className="counter-bubble">{flaggedStudents.length}</span>}
        </button>

        <button
          type="button"
          className={`admin-subnav-btn ${activeTab === 'UNBOOKED' ? 'active' : ''}`}
          onClick={() => setActiveTab('UNBOOKED')}
        >
          Unbooked Candidates
          <span className="counter-bubble">{unbookedStudents.length}</span>
        </button>
      </div>

      {activeTab === 'SCHEDULE' && (
        <>
          {/* Date Selector Tabs */}
          <DateSelector selectedDate={selectedDate} onSelectDate={handleSelectDate} />

          {/* Daily Metric Summary Cards */}
          {daySummary && <DailySummary summary={daySummary} />}

          {/* Search & Multi-Field Filters */}
          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
          />

          {/* Booked Students Table with Expandable Profiles and Pagination */}
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--portal-text)' }}>
              Interview Reservations for {daySummary?.displayDate}
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--portal-text-muted)' }}>
              Total Booked on Date: <strong>{bookedStudentsOnDate.length}</strong> (showing {filteredBookedStudents.length} matching)
            </span>
          </div>

          <StudentTable
            students={filteredBookedStudents}
            onTriggerReviewAction={handleTriggerReviewAction}
          />
        </>
      )}

      {activeTab === 'FLAGGED' && (
        <FlaggedStudentsSection
          flaggedStudents={flaggedStudents}
          onClearFlag={handleConfirmClearFlag}
        />
      )}

      {activeTab === 'UNBOOKED' && (
        <UnbookedStudentsSection unbookedStudents={unbookedStudents} />
      )}

      {/* Review Action Modal Dialog */}
      <ReviewActionModal
        isOpen={reviewModalStudent !== null && reviewModalAction !== null}
        onClose={() => {
          setReviewModalStudent(null)
          setReviewModalAction(null)
        }}
        student={reviewModalStudent}
        actionType={reviewModalAction}
        onConfirmApprove={handleConfirmApprove}
        onConfirmReject={handleConfirmReject}
        onConfirmFlag={handleConfirmFlag}
        onConfirmClearFlag={handleConfirmClearFlag}
      />
    </div>
  )
}
