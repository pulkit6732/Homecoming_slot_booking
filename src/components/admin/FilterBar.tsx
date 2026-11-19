import type { ApprovalStatus, BookingStatus, ReviewFlagStatus, SearchFilters } from '../../types'

interface FilterBarProps {
  filters: SearchFilters
  onFilterChange: (newFilters: SearchFilters) => void
  onResetFilters: () => void
}

export function FilterBar({ filters, onFilterChange, onResetFilters }: FilterBarProps) {
  const handleChange = (key: keyof SearchFilters, val: string) => {
    onFilterChange({
      ...filters,
      [key]: val,
    })
  }

  const hasActiveFilters =
    filters.nameQuery !== '' ||
    filters.emailQuery !== '' ||
    filters.academicYear !== '' ||
    filters.bookingStatus !== '' ||
    filters.approvalStatus !== '' ||
    filters.reviewFlagStatus !== ''

  return (
    <div className="filter-bar-container">
      <div className="filter-row">
        <div className="filter-input-group" style={{ flex: '2 1 240px' }}>
          <label htmlFor="search-name">Search Student Name:</label>
          <input
            id="search-name"
            type="text"
            placeholder="Type student name..."
            value={filters.nameQuery}
            onChange={(e) => handleChange('nameQuery', e.target.value)}
          />
        </div>

        <div className="filter-input-group" style={{ flex: '2 1 240px' }}>
          <label htmlFor="search-email">Search GITAM Email:</label>
          <input
            id="search-email"
            type="text"
            placeholder="e.g. student@gitam.in"
            value={filters.emailQuery}
            onChange={(e) => handleChange('emailQuery', e.target.value)}
          />
        </div>

        <div className="filter-input-group">
          <label htmlFor="filter-year">Academic Year:</label>
          <select
            id="filter-year"
            value={filters.academicYear}
            onChange={(e) => handleChange('academicYear', e.target.value)}
          >
            <option value="">All Academic Years</option>
            <option value="Final Year">Final Year</option>
            <option value="Third Year">Third Year</option>
            <option value="Second Year">Second Year</option>
          </select>
        </div>
      </div>

      <div className="filter-row">
        <div className="filter-input-group">
          <label htmlFor="filter-booking">Booking Status:</label>
          <select
            id="filter-booking"
            value={filters.bookingStatus}
            onChange={(e) => handleChange('bookingStatus', e.target.value as BookingStatus)}
          >
            <option value="">All Booking Statuses</option>
            <option value="Booked">Booked</option>
            <option value="Not Booked">Not Booked</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="filter-input-group">
          <label htmlFor="filter-approval">Approval Status:</label>
          <select
            id="filter-approval"
            value={filters.approvalStatus}
            onChange={(e) => handleChange('approvalStatus', e.target.value as ApprovalStatus)}
          >
            <option value="">All Approval Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div className="filter-input-group">
          <label htmlFor="filter-flag">Review Flag:</label>
          <select
            id="filter-flag"
            value={filters.reviewFlagStatus}
            onChange={(e) => handleChange('reviewFlagStatus', e.target.value as ReviewFlagStatus)}
          >
            <option value="">All Review Flags</option>
            <option value="Yellow Flagged">Yellow Flagged</option>
            <option value="Flagged for Review">Flagged for Review</option>
            <option value="Not Flagged">Not Flagged</option>
          </select>
        </div>

        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onResetFilters}
              style={{ height: '38px', padding: '0 1rem' }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
