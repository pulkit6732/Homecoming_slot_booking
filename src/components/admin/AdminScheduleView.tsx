/**
 * Admin Daily Schedule Slot Inspector (36 Slots Grid)
 * 
 * Shows all 36 slots chronologically for the selected date:
 * - Available slots (how many are left)
 * - Booked slots with candidate details (name, roll number, department, review status)
 * - Administrative "Remove Slot" capability to free up any reservation.
 * Zero emojis per specification.
 */

import type { SlotWithStatus, Student } from '../../types'
import { Badge } from '../common/Badge'

interface AdminScheduleViewProps {
  slots: SlotWithStatus[]
  students: Student[]
  onRemoveSlot: (student: Student) => void
  onViewStudent: (student: Student) => void
}

export function AdminScheduleView({
  slots,
  students,
  onRemoveSlot,
  onViewStudent,
}: AdminScheduleViewProps) {
  const morningSlots = slots.filter((s) => s.session === 'morning')
  const afternoonSlots = slots.filter((s) => s.session === 'afternoon')

  // Map startTime to booked student
  const studentByTime = new Map<string, Student>()
  students.forEach((s) => {
    if (s.bookingStatus === 'Booked' && s.bookedSlotStart) {
      studentByTime.set(s.bookedSlotStart, s)
    }
  })

  const renderSlotItem = (slot: SlotWithStatus) => {
    const isAvailable = slot.status === 'AVAILABLE'
    const bookedStudent = studentByTime.get(slot.startTime)

    return (
      <div
        key={slot.startTime}
        style={{
          backgroundColor: isAvailable ? '#f0fdf4' : '#ffffff',
          border: isAvailable ? '1px solid #bbf7d0' : '1px solid var(--portal-border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
          position: 'relative',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.95rem' }}>
            {slot.displayStart} – {slot.displayEnd}
          </span>
          <Badge type="slot" status={slot.status} />
        </div>

        {isAvailable ? (
          <div style={{ fontSize: '0.8rem', color: '#15803d', fontStyle: 'italic', marginTop: '0.25rem' }}>
            Available for booking (10 mins)
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--portal-text)' }}>
              {bookedStudent ? bookedStudent.fullName : 'Reserved Candidate'}
            </div>
            {bookedStudent && (
              <>
                <div style={{ fontSize: '0.775rem', color: 'var(--portal-text-muted)' }}>
                  Roll: {bookedStudent.rollNumber} | {bookedStudent.branch}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                  <Badge type="approval" status={bookedStudent.approvalStatus} />
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn-table-action"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => onViewStudent(bookedStudent)}
                    >
                      Dossier
                    </button>
                    <button
                      type="button"
                      className="btn-table-action btn-reject"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => onRemoveSlot(bookedStudent)}
                      title="Release this slot and cancel reservation"
                    >
                      Remove Slot
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Morning Session */}
      <div className="slot-section-title">
        <span>Morning Session (09:00 - 12:00 IST) — 18 Slots</span>
      </div>
      <div className="slot-grid" style={{ marginBottom: '1.5rem' }}>
        {morningSlots.map(renderSlotItem)}
      </div>

      {/* Afternoon Session */}
      <div className="slot-section-title">
        <span>Afternoon Session (13:00 - 16:00 IST) — 18 Slots</span>
      </div>
      <div className="slot-grid">
        {afternoonSlots.map(renderSlotItem)}
      </div>
    </div>
  )
}
