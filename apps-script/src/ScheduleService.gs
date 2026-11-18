/**
 * Google Apps Script Backend - Central Schedule Generator
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Timezone: Asia/Kolkata (Indian Standard Time - IST)
 * Zero emojis per specification.
 */

/**
 * Pads a number to 2 digits.
 * @param {number} num
 * @return {string}
 */
function padZero(num) {
  return num < 10 ? '0' + num : String(num);
}

/**
 * Formats 24h time string HH:mm to 12h display string (e.g. "09:00 AM").
 * @param {string} time24
 * @return {string}
 */
function formatDisplayTime(time24) {
  var parts = time24.split(':');
  var hours = parseInt(parts[0], 10);
  var minutes = parts[1];
  var period = hours >= 12 ? 'PM' : 'AM';
  var displayHours = hours % 12;
  if (displayHours === 0) displayHours = 12;
  return padZero(displayHours) + ':' + minutes + ' ' + period;
}

/**
 * Validates whether a date string is one of the 6 designated interview dates.
 * @param {string} dateStr Format: YYYY-MM-DD
 * @return {boolean}
 */
function isEligibleDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  return CONFIG.ELIGIBLE_DATES.indexOf(dateStr.trim()) !== -1;
}

/**
 * Generates the standard 36 time slots for any interview day.
 * Strictly:
 * - 18 Morning slots: 09:00 to 12:00 (10 min each)
 * - 18 Afternoon slots: 13:00 to 16:00 (10 min each)
 * - Lunch (12:00 to 13:00) is strictly omitted.
 * 
 * @return {Array<Object>} 36 slot definitions
 */
function generateDailySlotTemplates() {
  var slots = [];
  var slotIndex = 1;

  // Morning Session: 09:00 - 12:00 (18 slots)
  var morningStartMinutes = 9 * 60; // 540 min
  for (var m = 0; m < 18; m++) {
    var startTotal = morningStartMinutes + (m * 10);
    var endTotal = startTotal + 10;

    var startH = Math.floor(startTotal / 60);
    var startM = startTotal % 60;
    var endH = Math.floor(endTotal / 60);
    var endM = endTotal % 60;

    var startTime = padZero(startH) + ':' + padZero(startM);
    var endTime = padZero(endH) + ':' + padZero(endM);

    slots.push({
      slotIndex: slotIndex++,
      session: 'Morning',
      startTime: startTime,
      endTime: endTime,
      displayStart: formatDisplayTime(startTime),
      displayEnd: formatDisplayTime(endTime)
    });
  }

  // Afternoon Session: 13:00 - 16:00 (18 slots)
  var afternoonStartMinutes = 13 * 60; // 780 min
  for (var a = 0; a < 18; a++) {
    var aStartTotal = afternoonStartMinutes + (a * 10);
    var aEndTotal = aStartTotal + 10;

    var aStartH = Math.floor(aStartTotal / 60);
    var aStartM = aStartTotal % 60;
    var aEndH = Math.floor(aEndTotal / 60);
    var aEndM = aEndTotal % 60;

    var aStartTime = padZero(aStartH) + ':' + padZero(aStartM);
    var aEndTime = padZero(aEndH) + ':' + padZero(aEndM);

    slots.push({
      slotIndex: slotIndex++,
      session: 'Afternoon',
      startTime: aStartTime,
      endTime: aEndTime,
      displayStart: formatDisplayTime(aStartTime),
      displayEnd: formatDisplayTime(aEndTime)
    });
  }

  return slots;
}

/**
 * Validates whether a specific slot (date + startTime) is a valid, scheduled interview slot.
 * @param {string} dateStr
 * @param {string} startTime
 * @return {boolean}
 */
function isValidSlot(dateStr, startTime) {
  if (!isEligibleDate(dateStr)) return false;
  if (!startTime || typeof startTime !== 'string') return false;

  var templates = generateDailySlotTemplates();
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].startTime === startTime.trim()) {
      return true;
    }
  }
  return false;
}

/**
 * Finds slot template metadata for a given start time.
 * @param {string} startTime
 * @return {Object|null}
 */
function getSlotTemplate(startTime) {
  var templates = generateDailySlotTemplates();
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].startTime === startTime.trim()) {
      return templates[i];
    }
  }
  return null;
}
