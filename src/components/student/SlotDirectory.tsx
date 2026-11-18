import type { SlotWithStatus } from '../../types'
import { Badge } from '../common/Badge'

interface SlotDirectoryProps {
  slots: SlotWithStatus[]
  onBookSlot: (slot: SlotWithStatus) => void
}

export function SlotDirectory({ slots, onBookSlot }: SlotDirectoryProps) {
  const morningSlots = slots.filter((s) => s.session === 'morning')
  const afternoonSlots = slots.filter((s) => s.session === 'afternoon')

  return (
    <div className="slot-directory-container">
      {/* Morning Session: 9:00 AM - 12:00 PM (18 slots) */}
      <div className="slot-section-title">
        <span>Morning Session (09:00 - 12:00 IST)</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--portal-text-muted)' }}>
          18 slots • 10 mins each
        </span>
      </div>
      <div className="slot-grid">
        {morningSlots.map((slot) => (
          <SlotCard key={slot.startTime} slot={slot} onBook={onBookSlot} />
        ))}
      </div>

      {/* Afternoon Session: 1:00 PM - 4:00 PM (18 slots) */}
      <div className="slot-section-title">
        <span>Afternoon Session (13:00 - 16:00 IST)</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--portal-text-muted)' }}>
          18 slots • 10 mins each
        </span>
      </div>
      <div className="slot-grid">
        {afternoonSlots.map((slot) => (
          <SlotCard key={slot.startTime} slot={slot} onBook={onBookSlot} />
        ))}
      </div>
    </div>
  )
}

interface SlotCardProps {
  slot: SlotWithStatus
  onBook: (slot: SlotWithStatus) => void
}

function SlotCard({ slot, onBook }: SlotCardProps) {
  const isAvailable = slot.status === 'AVAILABLE'

  return (
    <div className={`slot-card ${isAvailable ? 'available' : 'booked'}`}>
      <div className="slot-card-header">
        <span className="slot-time">
          {slot.displayStart} – {slot.displayEnd}
        </span>
        <Badge type="slot" status={slot.status} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--portal-text-muted)' }}>
          Duration: 10 mins
        </span>

        {isAvailable ? (
          <button
            type="button"
            className="btn-book-slot"
            onClick={() => onBook(slot)}
          >
            Book Slot
          </button>
        ) : (
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-booked)' }}>
            Reserved
          </span>
        )}
      </div>
    </div>
  )
}
