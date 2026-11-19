import type { ApprovalStatus, BookingStatus, ReviewFlagStatus, SlotStatus } from '../../types'

interface BadgeProps {
  type: 'slot' | 'approval' | 'review' | 'booking'
  status: SlotStatus | ApprovalStatus | ReviewFlagStatus | BookingStatus
}

export function Badge({ type, status }: BadgeProps) {
  let badgeClass = 'status-badge'

  if (type === 'slot') {
    if (status === 'AVAILABLE') badgeClass += ' badge-available'
    else badgeClass += ' badge-booked'
  } else if (type === 'approval') {
    if (status === 'Approved') badgeClass += ' badge-approved'
    else if (status === 'Rejected') badgeClass += ' badge-rejected'
    else badgeClass += ' badge-pending'
  } else if (type === 'review') {
    if (status === 'Flagged for Review' || status === 'Yellow Flagged') badgeClass += ' badge-flagged'
    else badgeClass += ' badge-pending'
  } else if (type === 'booking') {
    if (status === 'Booked') badgeClass += ' badge-available'
    else if (status === 'Cancelled') badgeClass += ' badge-rejected'
    else badgeClass += ' badge-pending'
  }

  return <span className={badgeClass}>{status}</span>
}
