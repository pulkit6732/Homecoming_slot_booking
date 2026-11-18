import { useState } from 'react'
import type { SearchFilters, Student } from '../../types'
import { ELIGIBLE_DATES } from '../../utils/schedule'
import { mockStorage } from '../../services/mockStorage'
import { useLiveSync } from '../../hooks/useLiveSync'
import { LiveSyncIndicator } from '../../components/common/LiveSyncIndicator'
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

  // Near-real-time synchronization (5-10s polling, tab focus, multi-tab sync)
  const { revision, lastUpdated, isSyncing, triggerSync } = useLiveSync({ pollIntervalMs: 8000 })

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
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  revision // reactive dependency
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
      void triggerSync()
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
    void triggerSync()
  }

  // Confirm Reject
  const handleConfirmReject = (studentId: string, reason: string) => {
    mockStorage.rejectStudent(studentId, reason, 'Administrator')
    void triggerSync()
  }

  // Confirm Flag
  const handleConfirmFlag = (studentId: string, reason: string) => {
    mockStorage.flagStudent(studentId, reason, 'Administrator')
    void triggerSync()
  }

  // Confirm Clear Flag
  const handleConfirmClearFlag = (studentId: string) => {
    mockStorage.clearFlag(studentId)
    void triggerSync()
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
      {/* Real-time synchronization indicator */}
      <LiveSyncIndicator
        lastUpdated={lastUpdated}
        isSyncing={isSyncing}
        onRefresh={triggerSync}
        label="Admin Dashboard Live Sync"
      />

      {/* Simulation Banner */}
      <div className="simulation-pill-banner">
        <span>
          <strong>Phase 5 Active</strong> — Real-time Google Sheets 3-tab architecture and near-real-time polling.
        </span>
        <button type="button" className="btn-reset-mock" onClick={handleResetAllMockData}>
          Reset Data
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
          role="tab"
          aria-selected={activeTab === 'SCHEDULE'}
        >
          Daily Schedule & Student Directory
        </button>
        <button
          type="button"
          className={`admin-subnav-btn ${activeTab === 'FLAGGED' ? 'active' : ''}`}
          onClick={() => setActiveTab('FLAGGED')}
          role="tab"
          aria-selected={activeTab === 'FLAGGED'}
        >
          Flagged for Review ({flaggedStudents.length})
        </button>
        <button
          type="button"
          className={`admin-subnav-btn ${activeTab === 'UNBOOKED' ? 'active' : ''}`}
          onClick={() => setActiveTab('UNBOOKED')}
          role="tab"
          aria-selected={activeTab === 'UNBOOKED'}
        >
          Unbooked Candidates ({unbookedStudents.length})
        </button>
      </div>

      {/* TAB 1: Main Schedule View */}
      {activeTab === 'SCHEDULE' && (
        <>
          {/* Date Selector */}
          <DateSelector selectedDate={selectedDate} onSelectDate={handleSelectDate} />

          {/* 7 Summary Cards */}
          <DailySummary summary={daySummary} />

          {/* Filter Bar */}
          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
          />

          {/* Student Table with Expandable Dossiers */}
          <StudentTable
            students={filteredBookedStudents}
            onTriggerReviewAction={handleTriggerReviewAction}
          />
        </>
      )}

      {/* TAB 2: Flagged Students Section */}
      {activeTab === 'FLAGGED' && (
        <FlaggedStudentsSection
          flaggedStudents={flaggedStudents}
          onClearFlag={handleConfirmClearFlag}
        />
      )}

      {/* TAB 3: Unbooked Students Section */}
      {activeTab === 'UNBOOKED' && (
        <UnbookedStudentsSection unbookedStudents={unbookedStudents} />
      )}

      {/* Action Confirmation Modal */}
      <ReviewActionModal
        isOpen={reviewModalAction !== null}
        onClose={() => {
          setReviewModalAction(null)
          setReviewModalStudent(null)
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
