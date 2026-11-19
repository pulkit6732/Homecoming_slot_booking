import { useState, useCallback, useEffect } from 'react'
import type { SearchFilters, Student } from '../../types'
import { ELIGIBLE_DATES } from '../../utils/schedule'
import { mockStorage } from '../../services/mockStorage'
import {
  getAdminSchedule,
  getAdminSummary,
  getAllStudents,
  changeApprovalStatus,
  changeReviewFlag,
  cancelBooking,
  isLiveBackendConfigured,
} from '../../services/appsScriptClient'
import { useAuth } from '../../hooks/useAuth'
import { useLiveSync } from '../../hooks/useLiveSync'
import { LiveSyncIndicator } from '../../components/common/LiveSyncIndicator'
import { DateSelector } from '../../components/student/DateSelector'
import { DailySummary } from '../../components/admin/DailySummary'
import { FilterBar } from '../../components/admin/FilterBar'
import { StudentTable } from '../../components/admin/StudentTable'
import { FlaggedStudentsSection } from '../../components/admin/FlaggedStudentsSection'
import { UnbookedStudentsSection } from '../../components/admin/UnbookedStudentsSection'
import { AdminScheduleView } from '../../components/admin/AdminScheduleView'
import { ReviewActionModal, type ReviewActionType } from '../../components/admin/ReviewActionModal'
import '../../styles/portal.css'

type AdminTab = 'SCHEDULE' | 'FLAGGED' | 'UNBOOKED'
type ScheduleSubView = 'GRID' | 'TABLE'

export function AdminPage() {
  const { user } = useAuth()
  const sessionToken = user?.accessToken || ''
  const adminEmail = user?.email || ''

  const [activeTab, setActiveTab] = useState<AdminTab>('SCHEDULE')
  const [scheduleSubView, setScheduleSubView] = useState<ScheduleSubView>('GRID')
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    try {
      return localStorage.getItem('gitam_admin_active_date_v1') || ELIGIBLE_DATES[0].date
    } catch {
      return ELIGIBLE_DATES[0].date
    }
  })

  // Synchronized state
  const [allStudents, setAllStudents] = useState<Student[]>(() => mockStorage.getAllStudents())
  const [daySummary, setDaySummary] = useState(() => mockStorage.getDaySummary(selectedDate))
  const [slotsForDate, setSlotsForDate] = useState(() => mockStorage.getSlotsForDate(selectedDate))

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

  // Refresh callback that performs an actual backend or storage fetch
  const refreshAdminData = useCallback(async () => {
    if (isLiveBackendConfigured()) {
      const [scheduleRes, summaryRes, studentsRes] = await Promise.all([
        getAdminSchedule(sessionToken, selectedDate),
        getAdminSummary(sessionToken, selectedDate),
        getAllStudents(sessionToken),
      ])
      if (scheduleRes.success && summaryRes.success) {
        setDaySummary({
          date: selectedDate,
          displayDate: ELIGIBLE_DATES.find((d) => d.date === selectedDate)?.displayDate || selectedDate,
          totalSlots: scheduleRes.data.totalSlots,
          booked: summaryRes.data.bookedStudents,
          available: scheduleRes.data.totalSlots - summaryRes.data.bookedStudents,
          pending: summaryRes.data.pendingReview,
          approved: summaryRes.data.approvedStudents,
          rejected: summaryRes.data.rejectedStudents,
          flagged: summaryRes.data.flaggedStudents,
        })
        setSlotsForDate(
          scheduleRes.data.slots.map((s) => ({
            date: selectedDate,
            startTime: s.startTime,
            endTime: s.endTime,
            displayStart: s.displayStart,
            displayEnd: s.displayEnd,
            session: s.session.toLowerCase() as 'morning' | 'afternoon',
            slotIndex: s.slotIndex,
            status: s.status,
          }))
        )
        if (studentsRes.success && studentsRes.data) {
          setAllStudents(studentsRes.data.students as Student[])
        }
        return
      }
      const err = !scheduleRes.success
        ? scheduleRes.error.message
        : (!summaryRes.success ? summaryRes.error.message : 'Admin data sync failed')
      throw new Error(err)
    }

    // Local development storage fetch
    setDaySummary(mockStorage.getDaySummary(selectedDate))
    setSlotsForDate(mockStorage.getSlotsForDate(selectedDate))
    setAllStudents(mockStorage.getAllStudents())
  }, [selectedDate, sessionToken])

  // Near-real-time synchronization (8-second interval polling, tab focus, multi-tab sync)
  const { lastUpdated, isSyncing, syncError, triggerSync } = useLiveSync({
    pollIntervalMs: 8000,
    onSync: refreshAdminData,
  })

  // Trigger sync on date change
  useEffect(() => {
    void triggerSync()
  }, [selectedDate, triggerSync])

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

  // Trigger Review Action
  const handleTriggerReviewAction = (student: Student, actionType: ReviewActionType) => {
    setReviewModalStudent(student)
    setReviewModalAction(actionType)
  }

  // Confirm Accept (formerly Approve)
  const handleConfirmApprove = async (studentId: string, comment: string) => {
    if (isLiveBackendConfigured()) {
      await changeApprovalStatus(sessionToken, studentId, 'Accepted', comment, adminEmail)
    } else {
      mockStorage.approveStudent(studentId, comment, adminEmail)
    }
    void triggerSync()
  }

  // Confirm Reject
  const handleConfirmReject = async (studentId: string, reason: string) => {
    if (isLiveBackendConfigured()) {
      await changeApprovalStatus(sessionToken, studentId, 'Rejected', reason, adminEmail)
    } else {
      mockStorage.rejectStudent(studentId, reason, adminEmail)
    }
    void triggerSync()
  }

  // Confirm Flag
  const handleConfirmFlag = async (studentId: string, reason: string) => {
    if (isLiveBackendConfigured()) {
      await changeReviewFlag(sessionToken, studentId, 'Yellow Flagged', reason, adminEmail)
    } else {
      mockStorage.flagStudent(studentId, reason, adminEmail)
    }
    void triggerSync()
  }

  // Confirm Clear Flag
  const handleConfirmClearFlag = async (studentId: string) => {
    if (isLiveBackendConfigured()) {
      await changeReviewFlag(sessionToken, studentId, 'Not Flagged', 'Flag cleared', adminEmail)
    } else {
      mockStorage.clearFlag(studentId)
    }
    void triggerSync()
  }

  // Confirm Cancel / Remove Slot Reservation
  const handleConfirmCancelBooking = async (studentId: string) => {
    if (isLiveBackendConfigured()) {
      await cancelBooking(sessionToken, studentId)
    } else {
      mockStorage.cancelBooking(studentId, adminEmail)
    }
    void triggerSync()
  }

  // Filtered students for the table (derived from live allStudents, not mock storage)
  const bookedStudentsOnDate = allStudents.filter(
    (s) => s.bookingStatus === 'Booked' && s.bookedDate === selectedDate,
  )
  const filteredBookedStudents = mockStorage.filterStudents(bookedStudentsOnDate, filters)

  const flaggedStudents = allStudents.filter(
    (s) => s.reviewFlagStatus === 'Flagged for Review' || s.reviewFlagStatus === 'Yellow Flagged',
  )
  const unbookedStudents = allStudents.filter((s) => s.bookingStatus !== 'Booked')

  return (
    <div className="admin-portal-view">
      {/* Real-time synchronization indicator */}
      <LiveSyncIndicator
        lastUpdated={lastUpdated}
        isSyncing={isSyncing}
        onRefresh={triggerSync}
        label="Admin Dashboard Live Sync"
      />

      {syncError && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            fontSize: '0.85rem',
          }}
        >
          <strong>Sync Notice:</strong> {syncError} (Retrying automatically)
        </div>
      )}

      <div className="page-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p className="eyebrow">GITAM Administration • Interview Operations</p>
            <h1>Interview Schedule & Review Dashboard</h1>
            <p>
              Monitor slot availability, inspect candidate bookings, evaluate student dossiers, and manage review decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Database Availability Status Banner */}
      {allStudents.length === 0 && (
        <div
          style={{
            backgroundColor: '#fefce8',
            border: '1px solid #fde047',
            color: '#854d0e',
            padding: '1.25rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          <div style={{ fontWeight: 750, fontSize: '1rem', color: '#713f12' }}>
            Official Registration Database Pending Connection
          </div>
          <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
            No candidate records are currently loaded in the portal. The official student registration spreadsheet has not yet been connected. Once the authorized Google Sheet is linked, candidates will be populated automatically without fabricated test data.
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="admin-subnav-pills" role="tablist" aria-label="Admin Sections">
        <button
          type="button"
          className={`admin-subnav-btn ${activeTab === 'SCHEDULE' ? 'active' : ''}`}
          onClick={() => setActiveTab('SCHEDULE')}
          role="tab"
          aria-selected={activeTab === 'SCHEDULE'}
        >
          Daily Schedule & Slots ({daySummary.available} Left)
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

          {/* Schedule View Mode Toggle */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '1.5rem 0 1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--portal-border)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase' }}>
                Inspection Mode:
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`admin-subnav-btn ${scheduleSubView === 'GRID' ? 'active' : ''}`}
                style={{ fontSize: '0.825rem', padding: '0.35rem 0.85rem' }}
                onClick={() => setScheduleSubView('GRID')}
              >
                36-Slot Schedule Grid ({daySummary.available} Available)
              </button>
              <button
                type="button"
                className={`admin-subnav-btn ${scheduleSubView === 'TABLE' ? 'active' : ''}`}
                style={{ fontSize: '0.825rem', padding: '0.35rem 0.85rem' }}
                onClick={() => setScheduleSubView('TABLE')}
              >
                Booked Candidate Table ({bookedStudentsOnDate.length})
              </button>
            </div>
          </div>

          {/* VIEW MODE A: 36-Slot Schedule Grid */}
          {scheduleSubView === 'GRID' && (
            <AdminScheduleView
              slots={slotsForDate}
              students={allStudents}
              onRemoveSlot={(student) => handleTriggerReviewAction(student, 'CANCEL_BOOKING')}
              onViewStudent={(student) => {
                setScheduleSubView('TABLE')
                setFilters({ ...filters, nameQuery: student.fullName })
              }}
            />
          )}

          {/* VIEW MODE B: Filter Bar & Detailed Candidate Table */}
          {scheduleSubView === 'TABLE' && (
            <>
              <FilterBar
                filters={filters}
                onFilterChange={handleFilterChange}
                onResetFilters={handleResetFilters}
              />

              <StudentTable
                students={filteredBookedStudents}
                onTriggerReviewAction={handleTriggerReviewAction}
                onRefreshData={triggerSync}
              />
            </>
          )}
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
        onConfirmCancelBooking={handleConfirmCancelBooking}
      />
    </div>
  )
}
