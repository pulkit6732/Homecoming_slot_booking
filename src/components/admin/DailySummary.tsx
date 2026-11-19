import type { DaySummary } from '../../types'

interface DailySummaryProps {
  summary: DaySummary
}

export function DailySummary({ summary }: DailySummaryProps) {
  return (
    <div className="summary-cards-grid">
      <div className="summary-card">
        <span className="summary-card-label">Total Slots</span>
        <span className="summary-card-value">{summary.totalSlots}</span>
      </div>

      <div className="summary-card highlight-booked">
        <span className="summary-card-label">Booked Slots</span>
        <span className="summary-card-value">{summary.booked}</span>
      </div>

      <div className="summary-card">
        <span className="summary-card-label">Available Slots</span>
        <span className="summary-card-value">{summary.available}</span>
      </div>

      <div className="summary-card">
        <span className="summary-card-label">Pending Review</span>
        <span className="summary-card-value">{summary.pending}</span>
      </div>

      <div className="summary-card highlight-approved">
        <span className="summary-card-label">Accepted</span>
        <span className="summary-card-value">{summary.approved}</span>
      </div>

      <div className="summary-card highlight-rejected">
        <span className="summary-card-label">Rejected</span>
        <span className="summary-card-value">{summary.rejected}</span>
      </div>

      <div className="summary-card highlight-flagged">
        <span className="summary-card-label">Flagged</span>
        <span className="summary-card-value">{summary.flagged}</span>
      </div>
    </div>
  )
}
