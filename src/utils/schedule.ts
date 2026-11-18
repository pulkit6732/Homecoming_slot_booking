import type { TimeSlot } from '../types'

export interface EligibleDateInfo {
  date: string          // YYYY-MM-DD
  dayOfWeek: string     // Friday, Monday, etc.
  displayDate: string   // 20 Nov 2026
  fullDisplay: string   // Friday, 20 Nov 2026
}

export const ELIGIBLE_DATES: EligibleDateInfo[] = [
  { date: '2026-11-20', dayOfWeek: 'Friday', displayDate: '20 Nov 2026', fullDisplay: 'Friday, 20 Nov 2026' },
  { date: '2026-11-23', dayOfWeek: 'Monday', displayDate: '23 Nov 2026', fullDisplay: 'Monday, 23 Nov 2026' },
  { date: '2026-11-24', dayOfWeek: 'Tuesday', displayDate: '24 Nov 2026', fullDisplay: 'Tuesday, 24 Nov 2026' },
  { date: '2026-11-25', dayOfWeek: 'Wednesday', displayDate: '25 Nov 2026', fullDisplay: 'Wednesday, 25 Nov 2026' },
  { date: '2026-11-26', dayOfWeek: 'Thursday', displayDate: '26 Nov 2026', fullDisplay: 'Thursday, 26 Nov 2026' },
  { date: '2026-11-27', dayOfWeek: 'Friday', displayDate: '27 Nov 2026', fullDisplay: 'Friday, 27 Nov 2026' },
]

export const ELIGIBLE_DATE_STRINGS = ELIGIBLE_DATES.map((d) => d.date)

/**
 * Converts hour and minute numbers to a 12-hour formatted string (e.g. 9:00 AM, 1:10 PM)
 */
export function formatTime12h(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 === 0 ? 12 : hours % 12
  const displayMinutes = minutes.toString().padStart(2, '0')
  return `${displayHours}:${displayMinutes} ${period}`
}

/**
 * Converts hour and minute numbers to 24-hour HH:mm string (e.g. 09:00, 13:10)
 */
export function formatTime24h(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Generates the standardized 36 time slots for any given date.
 * Exactly 18 morning slots (9:00 AM - 12:00 PM, 10-min intervals)
 * Exactly 18 afternoon slots (1:00 PM - 4:00 PM, 10-min intervals)
 * Lunch interval (12:00 PM - 1:00 PM) is completely omitted.
 */
export function generateDaySlots(date: string): TimeSlot[] {
  const slots: TimeSlot[] = []
  let slotIndex = 0

  // Morning Session: 9:00 AM - 12:00 PM (18 slots)
  // Starts at 9*60 = 540 min, ends at 12*60 = 720 min
  for (let min = 540; min < 720; min += 10) {
    const startH = Math.floor(min / 60)
    const startM = min % 60
    const endMin = min + 10
    const endH = Math.floor(endMin / 60)
    const endM = endMin % 60

    slots.push({
      date,
      startTime: formatTime24h(startH, startM),
      endTime: formatTime24h(endH, endM),
      displayStart: formatTime12h(startH, startM),
      displayEnd: formatTime12h(endH, endM),
      session: 'morning',
      slotIndex: slotIndex++,
    })
  }

  // Afternoon Session: 1:00 PM - 4:00 PM (18 slots)
  // Starts at 13*60 = 780 min, ends at 16*60 = 960 min
  for (let min = 780; min < 960; min += 10) {
    const startH = Math.floor(min / 60)
    const startM = min % 60
    const endMin = min + 10
    const endH = Math.floor(endMin / 60)
    const endM = endMin % 60

    slots.push({
      date,
      startTime: formatTime24h(startH, startM),
      endTime: formatTime24h(endH, endM),
      displayStart: formatTime12h(startH, startM),
      displayEnd: formatTime12h(endH, endM),
      session: 'afternoon',
      slotIndex: slotIndex++,
    })
  }

  return slots
}

/**
 * Generates all 216 slots for the entire 6-day interview window.
 */
export function generateAllSlots(): Record<string, TimeSlot[]> {
  const schedule: Record<string, TimeSlot[]> = {}
  for (const dateObj of ELIGIBLE_DATES) {
    schedule[dateObj.date] = generateDaySlots(dateObj.date)
  }
  return schedule
}

/**
 * Validates whether a date and slot belong to the central schedule.
 */
export function isValidSlot(date: string, startTime: string): boolean {
  if (!ELIGIBLE_DATE_STRINGS.includes(date)) return false
  const slots = generateDaySlots(date)
  return slots.some((s) => s.startTime === startTime)
}

/**
 * Friendly date formatter
 */
export function getDisplayDate(dateStr: string): string {
  const match = ELIGIBLE_DATES.find((d) => d.date === dateStr)
  if (match) return match.fullDisplay
  return dateStr
}
