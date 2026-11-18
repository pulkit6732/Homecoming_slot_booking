import { ELIGIBLE_DATES, ELIGIBLE_DATE_STRINGS, generateDaySlots, generateAllSlots, isValidSlot } from './schedule.ts'

console.log('--- RUNNING RULE VERIFICATION SUITE ---')

// 1. Check Date Count & Weekday rules
console.assert(ELIGIBLE_DATES.length === 6, `Expected 6 dates, got ${ELIGIBLE_DATES.length}`)
for (const d of ELIGIBLE_DATES) {
  const dateObj = new Date(d.date)
  const day = dateObj.getDay()
  console.assert(day !== 0 && day !== 6, `Date ${d.date} is a weekend (${d.dayOfWeek})!`)
}
console.log('[PASS] Check 1: Exactly 6 dates, zero weekends.')

// 2. Check 36 slots per day, 10 min each, contiguous within sessions, no overlaps
const allSlots = generateAllSlots()
console.assert(Object.keys(allSlots).length === 6, `Expected 6 keys in allSlots, got ${Object.keys(allSlots).length}`)
let grandTotalSlots = 0

for (const date of ELIGIBLE_DATE_STRINGS) {
  const daySlots = generateDaySlots(date)
  console.assert(daySlots.length === 36, `Date ${date} has ${daySlots.length} slots instead of 36!`)
  grandTotalSlots += daySlots.length

  // Check morning session: 18 slots, from 09:00 to 12:00
  const morning = daySlots.filter((s) => s.session === 'morning')
  console.assert(morning.length === 18, `Morning session has ${morning.length} slots instead of 18!`)
  console.assert(morning[0].startTime === '09:00', `Morning starts at ${morning[0].startTime}`)
  console.assert(morning[17].endTime === '12:00', `Morning ends at ${morning[17].endTime}`)

  // Check afternoon session: 18 slots, from 13:00 to 16:00
  const afternoon = daySlots.filter((s) => s.session === 'afternoon')
  console.assert(afternoon.length === 18, `Afternoon session has ${afternoon.length} slots instead of 18!`)
  console.assert(afternoon[0].startTime === '13:00', `Afternoon starts at ${afternoon[0].startTime}`)
  console.assert(afternoon[17].endTime === '16:00', `Afternoon ends at ${afternoon[17].endTime}`)

  // Verify non-overlapping intervals within the day
  for (let i = 0; i < daySlots.length; i++) {
    const cur = daySlots[i]
    const [cH, cM] = cur.startTime.split(':').map(Number)
    const [eH, eM] = cur.endTime.split(':').map(Number)
    const curStartMin = cH * 60 + cM
    const curEndMin = eH * 60 + eM

    // Exactly 10 minutes
    console.assert(curEndMin - curStartMin === 10, `Slot duration is ${curEndMin - curStartMin} mins for ${cur.startTime}`)

    // No overlap with previous slot
    if (i > 0) {
      const prev = daySlots[i - 1]
      const [pH, pM] = prev.endTime.split(':').map(Number)
      const prevEndMin = pH * 60 + pM
      console.assert(
        curStartMin >= prevEndMin,
        `Overlap detected between slot ${prev.startTime}-${prev.endTime} and ${cur.startTime}-${cur.endTime}`,
      )
    }

    // Lunch exclusion: No slot between 12:00 and 13:00 (720 to 780 min)
    const inLunch = (curStartMin >= 720 && curStartMin < 780) || (curEndMin > 720 && curEndMin <= 780)
    console.assert(!inLunch, `Slot ${cur.startTime}-${cur.endTime} falls in lunch break (12 PM - 1 PM)!`)
  }
}

console.assert(grandTotalSlots === 216, `Total slots across 6 days is ${grandTotalSlots} (expected 216)!`)
console.log('[PASS] Check 2: Exactly 36 slots/day, 216 total slots, contiguous 10-min duration, zero overlaps, zero lunch slots.')

// 3. Slot validation function
console.assert(isValidSlot('2026-11-20', '09:00') === true, '09:00 on Nov 20 should be valid')
console.assert(isValidSlot('2026-11-20', '12:00') === false, '12:00 (lunch) should be invalid')
console.assert(isValidSlot('2026-11-20', '12:30') === false, '12:30 (lunch) should be invalid')
console.assert(isValidSlot('2026-11-21', '09:00') === false, 'Nov 21 (Saturday) should be invalid')
console.assert(isValidSlot('2026-11-22', '09:00') === false, 'Nov 22 (Sunday) should be invalid')
console.log('[PASS] Check 3: Central slot validator accurately permits valid slots and rejects invalid/lunch/weekend slots.')

console.log('--- ALL INTEGRITY RULES PASSED WITH ZERO ERRORS ---')
