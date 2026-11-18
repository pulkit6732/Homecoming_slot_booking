const TIMEZONE = 'Asia/Kolkata'

/**
 * Format a Date or ISO string into a standard Indian Standard Time (IST) string.
 * Example output: "20 Nov 2026, 09:30 AM IST"
 */
export function formatISTDateTime(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return 'N/A'
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return 'Invalid Date'

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date)
}

/**
 * Format a Date or ISO string into an IST date only.
 * Example output: "20 Nov 2026"
 */
export function formatISTDate(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return 'N/A'
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return 'Invalid Date'

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/**
 * Format a Date or ISO string into an IST time only.
 * Example output: "09:30 AM IST"
 */
export function formatISTTime(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return 'N/A'
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return 'Invalid Date'

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date)
}
