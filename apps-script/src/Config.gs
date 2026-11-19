/**
 * Google Apps Script Backend - Configuration and Constants
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Timezone: Asia/Kolkata (Indian Standard Time - IST)
 * Zero emojis per specification.
 */

var CONFIG = {
  TIMEZONE: 'Asia/Kolkata',
  LOCALE: 'en-IN',
  
  // 6 designated interview dates (zero weekend dates)
  ELIGIBLE_DATES: [
    '2026-11-20',
    '2026-11-23',
    '2026-11-24',
    '2026-11-25',
    '2026-11-26',
    '2026-11-27'
  ],
  
  // Daily session boundaries
  SESSIONS: {
    MORNING: {
      START: '09:00',
      END: '12:00',
      SLOTS: 18
    },
    AFTERNOON: {
      START: '13:00',
      END: '16:00',
      SLOTS: 18
    },
    LUNCH: {
      START: '12:00',
      END: '13:00'
    }
  },
  
  SLOT_DURATION_MINUTES: 10,
  DAILY_TOTAL_SLOTS: 36,
  TOTAL_EVENT_SLOTS: 216,
  
  // Lock timeout in milliseconds (30 seconds)
  LOCK_TIMEOUT_MS: 30000,
  
  // Spreadsheet Tab Names (4-tab architecture)
  SHEET_NAMES: {
    STUDENT_DB: 'Student Database',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    FLAGGED: 'Flagged'
  },

  // Admin emails are stored exclusively in Script Properties (key: ADMIN_EMAILS).
  // Never hardcode admin email addresses in source code.


  // Error codes conforming to specification
  ERROR_CODES: {
    AUTH_MISSING: 'AUTH_MISSING',
    AUTH_INVALID: 'AUTH_INVALID',
    AUTH_EXPIRED: 'AUTH_EXPIRED',
    AUTH_CONFIG_MISSING: 'AUTH_CONFIG_MISSING',
    AUTH_UNVERIFIED_EMAIL: 'AUTH_UNVERIFIED_EMAIL',
    AUTH_INVALID_ALGORITHM: 'AUTH_INVALID_ALGORITHM',
    AUTH_INVALID_AUDIENCE: 'AUTH_INVALID_AUDIENCE',
    AUTH_INVALID_ISSUER: 'AUTH_INVALID_ISSUER',
    AUTH_INVALID_SUBJECT: 'AUTH_INVALID_SUBJECT',
    AUTH_MISSING_EXPIRY: 'AUTH_MISSING_EXPIRY',
    UNREGISTERED_STUDENT: 'UNREGISTERED_STUDENT',
    FORBIDDEN_ADMIN: 'FORBIDDEN_ADMIN',
    BOOKING_DISABLED: 'BOOKING_DISABLED',
    INVALID_DATE: 'INVALID_DATE',
    INVALID_SLOT: 'INVALID_SLOT',
    SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
    ALREADY_BOOKED: 'ALREADY_BOOKED',
    BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
    LOCK_TIMEOUT: 'LOCK_TIMEOUT',
    MISSING_PARAMETER: 'MISSING_PARAMETER',
    MISSING_REGISTRATION_NUMBER: 'MISSING_REGISTRATION_NUMBER',
    SUBMISSION_NOT_FOUND: 'SUBMISSION_NOT_FOUND',
    AMBIGUOUS_REGISTRATION: 'AMBIGUOUS_REGISTRATION',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
  }
};

/**
 * Retrieves a script property with fallback.
 * @param {string} key
 * @param {string} defaultValue
 * @return {string}
 */
function getScriptProperty(key, defaultValue) {
  try {
    var props = PropertiesService.getScriptProperties();
    var val = props.getProperty(key);
    return val !== null && val !== undefined ? val : (defaultValue || '');
  } catch (err) {
    return defaultValue || '';
  }
}
