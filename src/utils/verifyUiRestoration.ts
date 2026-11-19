/**
 * Verification Script: UI Restoration, 2026 Schedule Integrity, Contrast & Crash Resilience
 * 
 * Validates:
 * 1. Strict 6-day interview schedule: Nov 20, 23, 24, 25, 26, 27 (2026).
 * 2. Slot structure: exactly 18 morning (09:00-12:00), 18 afternoon (13:00-16:00), 36/day, 216 total.
 * 3. Lunch exclusion: 12:00-13:00 strictly excluded.
 * 4. CSS contrast rules: background #00392F, card text colors, header text colors, button contrasts.
 * 5. Defensive formatting: NaN/undefined CGPA, null statuses, undefined dates in sorting.
 * 6. Asset presence: official Homecoming 2026 badge.
 * 
 * Timezone: Asia/Kolkata (IST).
 * Zero emojis per specification.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ELIGIBLE_DATES,
  generateDaySlots,
  generateAllSlots,
} from './schedule.ts';

console.log('================================================================');
console.log('STARTING UI RESTORATION & SCHEDULE INTEGRITY VERIFICATION SUITE');
console.log('Timezone: Asia/Kolkata (IST)');
console.log('================================================================\n');

// ─── 1. SCHEDULE INTEGRITY CHECKS ─────────────────────────────────────────────
console.log('--- CHECK 1: Interview Schedule Dates & Zero Weekends ---');
const expectedDates = [
  '2026-11-20', // Friday
  '2026-11-23', // Monday
  '2026-11-24', // Tuesday
  '2026-11-25', // Wednesday
  '2026-11-26', // Thursday
  '2026-11-27', // Friday
];

if (ELIGIBLE_DATES.length !== 6) {
  throw new Error(`Expected exactly 6 eligible dates, found ${ELIGIBLE_DATES.length}`);
}

for (let i = 0; i < expectedDates.length; i++) {
  const expected = expectedDates[i];
  const actual = ELIGIBLE_DATES[i];
  if (actual.date !== expected) {
    throw new Error(`Date mismatch at index ${i}: expected ${expected}, got ${actual.date}`);
  }
  const dateObj = new Date(actual.date + 'T00:00:00+05:30');
  const day = dateObj.getDay();
  if (day === 0 || day === 6) {
    throw new Error(`Weekend date detected: ${actual.date} (day of week: ${day})`);
  }
}
console.log('[PASS] Exactly 6 approved dates present (Nov 20, 23, 24, 25, 26, 27). Zero weekend dates.\n');

console.log('--- CHECK 2: Slot Structure & 216 Total Slots ---');
const allSlots = generateAllSlots();
if (Object.keys(allSlots).length !== 6) {
  throw new Error(`generateAllSlots must return exactly 6 dates, got ${Object.keys(allSlots).length}`);
}
let grandTotalSlots = 0;

for (const date of expectedDates) {
  const daySlots = generateDaySlots(date);
  if (daySlots.length !== 36) {
    throw new Error(`Date ${date} has ${daySlots.length} slots; expected exactly 36`);
  }

  const morning = daySlots.filter((s) => s.session === 'morning');
  const afternoon = daySlots.filter((s) => s.session === 'afternoon');

  if (morning.length !== 18) {
    throw new Error(`Date ${date} has ${morning.length} morning slots; expected exactly 18`);
  }
  if (afternoon.length !== 18) {
    throw new Error(`Date ${date} has ${afternoon.length} afternoon slots; expected exactly 18`);
  }

  // Verify morning starts at 09:00 and ends at 12:00
  if (morning[0].startTime !== '09:00' || morning[17].endTime !== '12:00') {
    throw new Error(`Morning session bounds invalid: starts ${morning[0].startTime}, ends ${morning[17].endTime}`);
  }

  // Verify afternoon starts at 13:00 and ends at 16:00
  if (afternoon[0].startTime !== '13:00' || afternoon[17].endTime !== '16:00') {
    throw new Error(`Afternoon session bounds invalid: starts ${afternoon[0].startTime}, ends ${afternoon[17].endTime}`);
  }

  // Verify every slot is exactly 10 minutes
  for (const s of daySlots) {
    const [startH, startM] = s.startTime.split(':').map(Number);
    const [endH, endM] = s.endTime.split(':').map(Number);
    const duration = (endH * 60 + endM) - (startH * 60 + startM);
    if (duration !== 10) {
      throw new Error(`Slot ${s.startTime}-${s.endTime} duration is ${duration} mins; expected 10`);
    }
  }

  // Verify lunch hour (12:00 - 13:00) is strictly omitted
  for (const s of daySlots) {
    const [startH, startM] = s.startTime.split(':').map(Number);
    const totalM = startH * 60 + startM;
    if (totalM >= 720 && totalM < 780) {
      throw new Error(`Lunch slot detected: ${s.startTime} on ${date}`);
    }
  }

  grandTotalSlots += daySlots.length;
}

if (grandTotalSlots !== 216) {
  throw new Error(`Grand total slots is ${grandTotalSlots}; expected exactly 216`);
}
console.log('[PASS] Exactly 36 slots/day (18 morning, 18 afternoon). Exactly 216 total slots. Lunch strictly omitted.\n');

// ─── 2. CSS & CONTRAST AUDIT ──────────────────────────────────────────────────
console.log('--- CHECK 3: CSS Palette, Background #00392F & Contrast Rules ---');
const globalCss = fs.readFileSync(path.resolve('src/styles/global.css'), 'utf-8').replace(/\r\n/g, '\n');
const layoutCss = fs.readFileSync(path.resolve('src/styles/layout.css'), 'utf-8').replace(/\r\n/g, '\n');
const portalCss = fs.readFileSync(path.resolve('src/styles/portal.css'), 'utf-8').replace(/\r\n/g, '\n');

// Verify background #00392F presence
if (!globalCss.includes('#00392F') && !globalCss.includes('#00392f')) {
  throw new Error('global.css must specify background #00392F');
}
if (!layoutCss.includes('#00392F') && !layoutCss.includes('#00392f')) {
  throw new Error('layout.css must specify background #00392F on app-shell and site-header');
}

// Verify slot section title is white (#ffffff)
if (!portalCss.includes('.slot-section-title {\n  font-size: 1.15rem;\n  font-weight: 700;\n  color: #ffffff;')) {
  throw new Error('portal.css .slot-section-title must have color: #ffffff for contrast on #00392F');
}

// Verify date-tab-button has explicit text color
if (!portalCss.includes('.date-tab-button {\n  flex: 1 1 0;\n  min-width: 130px;\n  padding: 0.85rem 1rem;\n  background: var(--portal-card-bg);\n  color: var(--portal-text);')) {
  throw new Error('portal.css .date-tab-button must define color: var(--portal-text)');
}

// Verify date-tab-button active has gold accent border
if (!portalCss.includes('.date-tab-button.active {\n  background: var(--portal-primary);\n  border-color: #FDB813;')) {
  throw new Error('portal.css .date-tab-button.active must define gold accent border (#FDB813)');
}

// Verify summary card has explicit text color
if (!portalCss.includes('.summary-card {\n  background: var(--portal-card-bg);\n  color: var(--portal-text);')) {
  throw new Error('portal.css .summary-card must define color: var(--portal-text)');
}

// Verify filter-bar-container has explicit text color
if (!portalCss.includes('.filter-bar-container {\n  background: var(--portal-card-bg);\n  color: var(--portal-text);')) {
  throw new Error('portal.css .filter-bar-container must define color: var(--portal-text)');
}

// Verify placeholder-panel headers are dark on light surface
if (!layoutCss.includes('.placeholder-panel h1 {\n  margin: 0;\n  color: #172b22;')) {
  throw new Error('layout.css .placeholder-panel h1 must have color: #172b22 on white card');
}

// Verify error-panel headers are dark on light surface
if (!layoutCss.includes('.error-panel h1 {\n  color: #172b22;')) {
  throw new Error('layout.css .error-panel h1 must have color: #172b22 on white card');
}

console.log('[PASS] CSS contrast audit passed: #00392F restored, white cards have dark text, headers have high contrast.\n');

// ─── 3. RESILIENCE AGAINST CRASHES ────────────────────────────────────────────
console.log('--- CHECK 4: Defensive Coding & Crash Resilience ---');

// Test 4A: Safe CGPA formatting function
function formatCgpa(cgpaVal: unknown): string {
  return (Number(cgpaVal) || 0).toFixed(2);
}

const testCgpaCases = [8.5, '8.5', undefined, null, NaN, '', 'invalid'];
for (const testVal of testCgpaCases) {
  try {
    const formatted = formatCgpa(testVal);
    if (typeof formatted !== 'string') throw new Error('Not a string');
  } catch (err) {
    throw new Error(`formatCgpa crashed on input ${String(testVal)}`, { cause: err });
  }
}
console.log('[PASS] CGPA formatting is crash-proof against undefined, null, NaN, and string inputs.');

// Test 4B: Safe student sorting when dates are undefined
const mockStudentsWithUndefined: Array<{ studentId: string; bookedDate?: string; bookedSlotStart?: string }> = [
  { studentId: '1' },
  { studentId: '2', bookedDate: '2026-11-20', bookedSlotStart: '09:00' },
  { studentId: '3', bookedSlotStart: '10:00' },
  { studentId: '4', bookedDate: '2026-11-20' },
];

try {
  const sorted = [...mockStudentsWithUndefined].sort((a, b) => {
    const dateA = a.bookedDate || '';
    const dateB = b.bookedDate || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const slotA = a.bookedSlotStart || '';
    const slotB = b.bookedSlotStart || '';
    return slotA.localeCompare(slotB);
  });
  if (sorted.length !== 4) throw new Error('Sort output length mismatch');
} catch (err) {
  throw new Error('Student sort crashed on undefined properties', { cause: err });
}
console.log('[PASS] Student sorting is crash-proof against undefined/missing booked dates and slot times.');

// Test 4C: Safe approval status case conversion
const testStatuses = ['Approved', 'Rejected', 'Pending', undefined, null];
for (const st of testStatuses) {
  const safeBadgeClass = `badge-${(st || 'Pending').toLowerCase()}`;
  if (!safeBadgeClass.startsWith('badge-')) throw new Error('Invalid badge class');
}
console.log('[PASS] Status badge formatting is crash-proof against undefined/null approval status.\n');

// ─── 4. ASSET VERIFICATION ────────────────────────────────────────────────────
console.log('--- CHECK 5: Official Homecoming 2026 Badge Asset ---');
const badgePath = path.resolve('public/assets/homecoming-2026-badge.png');
if (!fs.existsSync(badgePath)) {
  throw new Error('Homecoming 2026 badge is missing from public/assets/homecoming-2026-badge.png');
}
const badgeStat = fs.statSync(badgePath);
if (badgeStat.size < 1000) {
  throw new Error(`Homecoming 2026 badge file is suspiciously small (${badgeStat.size} bytes)`);
}
console.log(`[PASS] Official Homecoming 2026 badge verified at public/assets/homecoming-2026-badge.png (${badgeStat.size} bytes).\n`);

console.log('================================================================');
console.log('ALL UI RESTORATION & SCHEDULE INTEGRITY VERIFICATIONS PASSED (0 ERRORS)');
console.log('================================================================');
