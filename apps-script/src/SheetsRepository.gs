/**
 * Google Apps Script Backend - Sheets Data Access Layer
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Architecture: Strict 3-tab spreadsheet architecture:
 *   1. "Student Database" (Master source of truth)
 *   2. "Approved" (Decision record sync)
 *   3. "Rejected" (Decision record sync)
 * Primary Key: StudentID
 * Zero emojis per specification.
 */

/**
 * Retrieves the target Google Spreadsheet instance.
 * Supports bound scripts (getActiveSpreadsheet) and standalone scripts (openById).
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  var explicitId = getScriptProperty('SPREADSHEET_ID', '');
  if (explicitId) {
    return SpreadsheetApp.openById(explicitId);
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('Spreadsheet not configured. Set SPREADSHEET_ID in Script Properties.');
}

/**
 * Gets a sheet by name with error checking.
 * @param {string} sheetName
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheetByName(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" not found in spreadsheet');
  }
  return sheet;
}

// Request-scoped cache to prevent redundant full-sheet reads within a single transaction
var _sheetRowsCache = {};

function getCachedSheetRows(sheetName) {
  if (!_sheetRowsCache[sheetName]) {
    var sheet = getSheetByName(sheetName);
    _sheetRowsCache[sheetName] = readSheetRowsWithHeader(sheet);
  }
  return _sheetRowsCache[sheetName];
}

function invalidateSheetCache(sheetName) {
  if (sheetName) {
    delete _sheetRowsCache[sheetName];
  } else {
    _sheetRowsCache = {};
  }
}

/**
 * Converts a sheet into an array of objects based on its header row.
 * Returns both the data objects and row index mapping (1-based row numbers).
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @return {Array<{ rowNumber: number, data: Object }>}
 */
function readSheetRowsWithHeader(sheet) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length < 2) return [];

  var headers = values[0];
  var results = [];

  for (var r = 1; r < values.length; r++) {
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      var headerName = String(headers[c]).trim();
      if (headerName) {
        rowObj[headerName] = values[r][c];
      }
    }
    results.push({
      rowNumber: r + 1, // 1-based index in Google Sheets
      data: rowObj
    });
  }

  return results;
}

/**
 * Retrieves all student records from the "Student Database" sheet.
 * @return {Array<Object>}
 */
function getAllStudentRecords() {
  var rows = getCachedSheetRows(CONFIG.SHEET_NAMES.STUDENT_DB);
  return rows.map(function(r) { return r.data; });
}

/**
 * Retrieves a student record by verified email address (case-insensitive).
 * Detects ambiguous duplicate submissions and flags them for administrator resolution.
 * 
 * @param {string} email
 * @return {Object|null}
 */
function getStudentRecordByEmail(email) {
  if (!email) return null;
  var target = String(email).trim().toLowerCase().replace(/\s+/g, '');
  var rows = getCachedSheetRows(CONFIG.SHEET_NAMES.STUDENT_DB);
  var matches = [];

  for (var i = 0; i < rows.length; i++) {
    var d = rows[i].data;
    var rowEmail = String(d.Email || d['GITAM Email'] || d['GITAM Email Address'] || d['Student Email'] || d['Email Address'] || d['Candidate Email'] || '').trim().toLowerCase().replace(/\s+/g, '');
    if (rowEmail === target) {
      matches.push(rows[i].data);
    }
  }

  if (matches.length === 0) {
    return null;
  }
  
  // Ambiguity detection: Never silently select the first duplicate registration as authoritative
  if (matches.length > 1) {
    return {
      isAmbiguous: true,
      duplicateCount: matches.length,
      error: 'AMBIGUOUS_STUDENT_RECORD: Multiple registrations found for ' + target + '. Administrative resolution required.',
      matches: matches
    };
  }

  return matches[0];
}

/**
 * Retrieves a student record and row number by StudentID or Email.
 * @param {string} studentId
 * @return {{ rowNumber: number, data: Object }|null}
 */
function getStudentRecordWithRowById(studentId) {
  if (!studentId) return null;
  var target = String(studentId).trim().toLowerCase();
  var rows = getCachedSheetRows(CONFIG.SHEET_NAMES.STUDENT_DB);

  for (var i = 0; i < rows.length; i++) {
    var d = rows[i].data;
    var sid = String(d.StudentID || d['Student ID'] || d['Roll Number'] || d['Registration Number'] || d['Registration no.'] || '').trim().toLowerCase();
    var email = String(d.Email || d['GITAM Email'] || d['GITAM Email Address'] || d['Student Email'] || d['Email Address'] || d['Candidate Email'] || '').trim().toLowerCase().replace(/\s+/g, '');
    if (sid === target || (target.indexOf('@') !== -1 && email === target)) {
      return rows[i];
    }
  }
  return null;
}

/**
 * Retrieves all active bookings for a specific interview date.
 * @param {string} dateStr Format: YYYY-MM-DD
 * @return {Array<Object>}
 */
function getBookingsForDate(dateStr) {
  var rows = getCachedSheetRows(CONFIG.SHEET_NAMES.STUDENT_DB);
  var target = dateStr.trim();
  var bookings = [];

  for (var i = 0; i < rows.length; i++) {
    var d = rows[i].data;
    var bDate = String(d.InterviewDate || '').trim();
    var bStatus = String(d.BookingStatus || '').trim();

    if (bDate === target && bStatus === 'Booked') {
      bookings.push({
        bookingId: d.BookingID,
        bookingRequestId: d.BookingRequestID,
        studentId: d.StudentID,
        fullName: d.FullName,
        email: d.Email,
        interviewDate: d.InterviewDate,
        interviewSlot: d.InterviewSlot,
        interviewStart: d.InterviewStart,
        interviewEnd: d.InterviewEnd,
        bookingStatus: d.BookingStatus,
        approvalStatus: d.ApprovalStatus || 'Pending',
        reviewFlagStatus: d.ReviewFlagStatus || 'Not Flagged'
      });
    }
  }
  return bookings;
}

/**
 * Searches for an existing booking matching a BookingRequestID (idempotency check).
 * @param {string} bookingRequestId
 * @return {Object|null}
 */
function findBookingByRequestId(bookingRequestId) {
  if (!bookingRequestId) return null;
  var target = String(bookingRequestId).trim();
  var rows = getCachedSheetRows(CONFIG.SHEET_NAMES.STUDENT_DB);

  for (var i = 0; i < rows.length; i++) {
    var d = rows[i].data;
    if (String(d.BookingRequestID || '').trim() === target && String(d.BookingStatus || '') === 'Booked') {
      return d;
    }
  }
  return null;
}

/**
 * Updates a student's row in "Student Database" with new booking details.
 * Optimized with single-pass atomic batch row write. Modifies existing row in place.
 * 
 * @param {string} studentId
 * @param {Object} bookingDetails
 * @return {boolean}
 */
function updateStudentBooking(studentId, bookingDetails) {
  var studentRef = getStudentRecordWithRowById(studentId);
  if (!studentRef) return false;

  var sheet = getSheetByName(CONFIG.SHEET_NAMES.STUDENT_DB);
  var lastCol = sheet.getLastColumn();
  var rowNumber = studentRef.rowNumber;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rowValues = sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];

  var fieldMap = {
    'InterviewDate': bookingDetails.interviewDate,
    'InterviewSlot': bookingDetails.interviewSlot,
    'InterviewStart': bookingDetails.interviewStart,
    'InterviewEnd': bookingDetails.interviewEnd,
    'BookingID': bookingDetails.bookingId,
    'BookingRequestID': bookingDetails.bookingRequestId,
    'BookingStatus': 'Booked',
    'BookingTimestamp': bookingDetails.bookingTimestamp || new Date().toISOString()
  };

  for (var c = 0; c < headers.length; c++) {
    var header = String(headers[c]).trim();
    if (Object.prototype.hasOwnProperty.call(fieldMap, header)) {
      rowValues[c] = fieldMap[header];
    }
  }

  // Atomic batch write of the entire row (1 API call instead of N separate calls)
  sheet.getRange(rowNumber, 1, 1, lastCol).setValues([rowValues]);
  SpreadsheetApp.flush();
  invalidateSheetCache(CONFIG.SHEET_NAMES.STUDENT_DB);
  return true;
}

/**
 * Cancels a student's active booking in "Student Database".
 * Optimized with single-pass atomic batch row write.
 * 
 * @param {string} studentId
 * @return {boolean}
 */
function cancelStudentBooking(studentId) {
  var studentRef = getStudentRecordWithRowById(studentId);
  if (!studentRef) return false;

  var sheet = getSheetByName(CONFIG.SHEET_NAMES.STUDENT_DB);
  var lastCol = sheet.getLastColumn();
  var rowNumber = studentRef.rowNumber;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rowValues = sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];

  var fieldMap = {
    'InterviewDate': '',
    'InterviewSlot': '',
    'InterviewStart': '',
    'InterviewEnd': '',
    'BookingStatus': 'Cancelled',
    'BookingTimestamp': new Date().toISOString()
  };

  for (var c = 0; c < headers.length; c++) {
    var header = String(headers[c]).trim();
    if (Object.prototype.hasOwnProperty.call(fieldMap, header)) {
      rowValues[c] = fieldMap[header];
    }
  }

  // Atomic batch write of the entire row
  sheet.getRange(rowNumber, 1, 1, lastCol).setValues([rowValues]);
  SpreadsheetApp.flush();
  invalidateSheetCache(CONFIG.SHEET_NAMES.STUDENT_DB);
  return true;
}

/**
 * Updates review / approval status on the student master record and synchronizes
 * decision sheets (Approved / Rejected) without creating duplicates.
 * 
 * @param {string} studentId
 * @param {Object} reviewData
 * @return {boolean}
 */
function updateStudentReview(studentId, reviewData) {
  var studentRef = getStudentRecordWithRowById(studentId);
  if (!studentRef) return false;

  var sheet = getSheetByName(CONFIG.SHEET_NAMES.STUDENT_DB);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rowNumber = studentRef.rowNumber;

  // Dynamically ensure missing columns exist in Student Database header row without adding extra tabs
  for (var key in reviewData) {
    var found = false;
    for (var h = 0; h < headers.length; h++) {
      if (String(headers[h]).trim() === key) {
        found = true;
        break;
      }
    }
    if (!found) {
      var lastCol = sheet.getLastColumn();
      sheet.getRange(1, lastCol + 1).setValue(key);
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
  }

  var lastCol = sheet.getLastColumn();
  var rowValues = sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];
  for (var c = 0; c < headers.length; c++) {
    var header = String(headers[c]).trim();
    if (Object.prototype.hasOwnProperty.call(reviewData, header)) {
      rowValues[c] = reviewData[header];
    }
  }

  // Atomic batch write of the entire updated review row
  sheet.getRange(rowNumber, 1, 1, lastCol).setValues([rowValues]);
  SpreadsheetApp.flush();
  invalidateSheetCache(CONFIG.SHEET_NAMES.STUDENT_DB);

  // Decision sheet synchronization for Approved / Rejected
  if (reviewData.ApprovalStatus === 'Approved') {
    syncDecisionSheet(CONFIG.SHEET_NAMES.APPROVED, studentId, studentRef.data, reviewData);
    removeDecisionSheetRecord(CONFIG.SHEET_NAMES.REJECTED, studentId);
  } else if (reviewData.ApprovalStatus === 'Rejected') {
    syncDecisionSheet(CONFIG.SHEET_NAMES.REJECTED, studentId, studentRef.data, reviewData);
    removeDecisionSheetRecord(CONFIG.SHEET_NAMES.APPROVED, studentId);
  }

  return true;
}

/**
 * Synchronizes an approved or rejected student record into the decision tab.
 * Ensures StudentID remains unique in that tab (updates if exists, appends if new).
 * 
 * @param {string} targetSheetName
 * @param {string} studentId
 * @param {Object} studentData
 * @param {Object} reviewData
 */
function syncDecisionSheet(targetSheetName, studentId, studentData, reviewData) {
  var sheet = getSheetByName(targetSheetName);
  var rows = readSheetRowsWithHeader(sheet);
  var existingRowNumber = -1;

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].data.StudentID || '').trim() === String(studentId).trim()) {
      existingRowNumber = rows[i].rowNumber;
      break;
    }
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var mergedData = {};
  for (var k in studentData) mergedData[k] = studentData[k];
  for (var rk in reviewData) mergedData[rk] = reviewData[rk];

  if (existingRowNumber > 0) {
    // Update existing record
    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c]).trim();
      if (Object.prototype.hasOwnProperty.call(mergedData, h)) {
        sheet.getRange(existingRowNumber, c + 1).setValue(mergedData[h]);
      }
    }
  } else {
    // Append new record
    var newRow = [];
    for (var nc = 0; nc < headers.length; nc++) {
      var nh = String(headers[nc]).trim();
      newRow.push(mergedData[nh] !== undefined ? mergedData[nh] : '');
    }
    sheet.appendRow(newRow);
  }

  SpreadsheetApp.flush();
}

/**
 * Removes a student record from a decision sheet if present (e.g. status changed from Rejected to Approved).
 * @param {string} sheetName
 * @param {string} studentId
 */
function removeDecisionSheetRecord(sheetName, studentId) {
  var sheet = getSheetByName(sheetName);
  var rows = readSheetRowsWithHeader(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].data.StudentID || '').trim() === String(studentId).trim()) {
      sheet.deleteRow(rows[i].rowNumber);
      SpreadsheetApp.flush();
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION NUMBER-BASED STUDENT DOSSIER RETRIEVAL
// ─────────────────────────────────────────────────────────────────────────────

var REGISTRATION_NUMBER_HEADERS = [
  'Registration Number',
  'Registration no.',
  'Registration No',
  'Reg No',
  'Reg. No.',
  'RegNo',
  'Roll Number',
  'Roll No',
  'RollNo',
  'StudentID',
  'Student ID'
];

/**
 * Normalizes Registration Number by trimming whitespace, stripping non-printable characters,
 * and converting to uppercase. Empty strings or non-strings return empty string.
 * @param {*} regNum
 * @return {string}
 */
function normalizeRegistrationNumber(regNum) {
  if (regNum === null || regNum === undefined) return '';
  var str = String(regNum).trim().toUpperCase();
  return str.replace(/[\u200B-\u200D\uFEFF]/g, '');
}

/**
 * Extracts normalized Registration Number from a sheet row object using candidate headers.
 * @param {Object} rowObj
 * @return {string}
 */
function extractRegistrationNumberFromRow(rowObj) {
  if (!rowObj) return '';
  var keys = Object.keys(rowObj);
  for (var h = 0; h < REGISTRATION_NUMBER_HEADERS.length; h++) {
    var candidate = REGISTRATION_NUMBER_HEADERS[h].toLowerCase();
    for (var k = 0; k < keys.length; k++) {
      if (keys[k].trim().toLowerCase() === candidate) {
        var val = rowObj[keys[k]];
        if (val !== undefined && val !== null) {
          var normalized = normalizeRegistrationNumber(val);
          if (normalized) return normalized;
        }
      }
    }
  }
  return '';
}

/**
 * Retrieves the sheet containing the original Google Form submissions.
 * Checks FORM_RESPONSES_SPREADSHEET_ID in Script Properties if external form responses are used.
 * Otherwise, reads from "Student Database" in the master spreadsheet.
 * Preserves strict 3-tab architecture without creating unapproved fourth tabs.
 * 
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOriginalFormResponsesSheet() {
  var externalSsId = getScriptProperty('FORM_RESPONSES_SPREADSHEET_ID', '');
  if (externalSsId) {
    var extSs = SpreadsheetApp.openById(externalSsId);
    var extSheetName = getScriptProperty('FORM_RESPONSES_SHEET_NAME', '');
    if (extSheetName) {
      var extSheet = extSs.getSheetByName(extSheetName);
      if (extSheet) return extSheet;
    }
    return extSs.getSheets()[0];
  }
  return getSheetByName(CONFIG.SHEET_NAMES.STUDENT_DB);
}

/**
 * Searches the original Google Form response dataset for a candidate matching Registration Number.
 * 
 * Enforcement rules:
 * - Exactly one match: returns success with submission data.
 * - Zero matches: returns controlled SUBMISSION_NOT_FOUND error.
 * - Multiple matches: returns controlled AMBIGUOUS_REGISTRATION warning (prevents silent selection).
 * - Missing Registration Number: returns controlled MISSING_REGISTRATION_NUMBER error.
 * - Never silently falls back to another student or merges records via email.
 * 
 * @param {string} registrationNumber
 * @return {Object}
 */
function getOriginalFormSubmissionByRegistrationNumber(registrationNumber) {
  var normalizedTarget = normalizeRegistrationNumber(registrationNumber);
  if (!normalizedTarget) {
    return {
      success: false,
      error: {
        code: CONFIG.ERROR_CODES.MISSING_REGISTRATION_NUMBER,
        message: 'Data integrity error: Registration Number is missing or empty. Lookup prevented.'
      }
    };
  }

  var sheet = getOriginalFormResponsesSheet();
  var rows = readSheetRowsWithHeader(sheet);
  var matches = [];

  for (var i = 0; i < rows.length; i++) {
    var rowData = rows[i].data;
    var rowReg = extractRegistrationNumberFromRow(rowData);
    if (rowReg === normalizedTarget) {
      matches.push({
        rowNumber: rows[i].rowNumber,
        data: rowData
      });
    }
  }

  if (matches.length === 0) {
    return {
      success: false,
      error: {
        code: CONFIG.ERROR_CODES.SUBMISSION_NOT_FOUND,
        message: 'Original form submission not found for Registration Number: ' + registrationNumber
      }
    };
  }

  if (matches.length > 1) {
    return {
      success: false,
      error: {
        code: CONFIG.ERROR_CODES.AMBIGUOUS_REGISTRATION,
        message: 'Multiple submissions (' + matches.length + ') found for Registration Number: ' + registrationNumber + '. Ambiguity warning: automated selection prevented.',
        details: { count: matches.length }
      }
    };
  }

  return {
    success: true,
    count: 1,
    rowNumber: matches[0].rowNumber,
    rawSubmission: matches[0].data
  };
}

/**
 * Maps raw form submission into structured originalSubmission object.
 * Preserves all answers exactly as submitted without mutating or inventing fields.
 * Includes allRawResponses dictionary for any additional custom questions.
 * 
 * @param {Object} raw
 * @param {string} registrationNumber
 * @return {Object}
 */
function formatOriginalSubmission(raw, registrationNumber) {
  function getField(candidates) {
    var keys = Object.keys(raw);
    for (var c = 0; c < candidates.length; c++) {
      var target = candidates[c].toLowerCase();
      for (var k = 0; k < keys.length; k++) {
        if (keys[k].trim().toLowerCase() === target) {
          var val = raw[keys[k]];
          if (val !== undefined && val !== null) return String(val).trim();
        }
      }
    }
    return '';
  }

  var rawCgpa = getField(['CGPA', 'Current CGPA', 'Grade Point Average']);
  var parsedCgpa = rawCgpa ? parseFloat(rawCgpa) : 0.0;
  var rawBacklogs = getField(['Backlogs', 'Active Backlogs']);
  var parsedBacklogs = rawBacklogs ? parseInt(rawBacklogs, 10) : 0;

  return {
    timestamp: getField(['Timestamp', 'Submission Timestamp', 'FormSubmissionTimestamp']),
    registrationNumber: registrationNumber,
    fullName: getField(['FullName', 'Full Name', 'Name', 'Student Name', 'Candidate Name']),
    email: getField(['GITAM Email', 'GITAM Email Address', 'Student Email', 'Email Address', 'Email', 'Candidate Email']),
    personalEmail: getField(['Personal Email', 'Alternate Email']),
    phoneNumber: getField(['PhoneNumber', 'Phone Number', 'Phone', 'Mobile Number', 'Contact Number']),
    dateOfBirth: getField(['DateOfBirth', 'Date of Birth', 'DOB']),
    gender: getField(['Gender', 'Sex']),
    address: getField(['Address', 'Residential Address']),
    city: getField(['City']),
    state: getField(['State']),
    country: getField(['Country']),
    program: getField(['Program', 'Degree', 'Course']),
    branch: getField(['Branch', 'Department', 'Specialization']),
    academicYear: getField(['AcademicYear', 'Academic Year', 'Year']),
    section: getField(['Section', 'Class Section']),
    cgpa: isNaN(parsedCgpa) ? rawCgpa : parsedCgpa,
    backlogs: isNaN(parsedBacklogs) ? rawBacklogs : parsedBacklogs,
    highestQualification: getField(['HighestQualification', 'Highest Qualification']),
    universityCollege: getField(['UniversityCollege', 'College', 'University']),
    yearOfPassing: getField(['YearOfPassing', 'Passing Year']),
    committeePreferences: {
      primary: getField(['DomainPreference1', 'Preference 1', 'Primary Preference', 'Committee Preferences']),
      secondary: getField(['DomainPreference2', 'Preference 2', 'Secondary Preference']),
      tertiary: getField(['DomainPreference3', 'Preference 3', 'Tertiary Preference'])
    },
    rolesAppliedFor: getField(['RolesAppliedFor', 'Roles Applied For', 'Applied Positions', 'Applied Tracks']),
    writtenApplication: getField(['WrittenApplication', 'Written Application', 'Statement of Purpose', 'Projects', 'Project Highlights']),
    priorExperience: getField(['WorkExperience', 'Experience', 'Prior Committee Experience']),
    internships: getField(['Internships', 'Internship Experience']),
    technicalSkills: getField(['TechnicalSkills', 'Technical Skills']),
    softSkills: getField(['SoftSkills', 'Soft Skills']),
    certifications: getField(['Certifications']),
    achievements: getField(['Achievements']),
    availabilityCommute: getField(['AvailabilityCommute', 'Availability', 'Interview Day Availability', 'Commute']),
    eventCommitment: getField(['EventCommitment', 'Event Week Commitment']),
    resumeLink: getField(['ResumeLink', 'Resume Link', 'Resume', 'Upload Resume']),
    documentLinks: getField(['DocumentLinks', 'Document Links', 'Verification Documents', 'Certificates']),
    allRawResponses: raw
  };
}

/**
 * Retrieves administrative review and booking records for a student from Student Database.
 * Kept strictly separate from the original Google Form submission.
 * 
 * @param {string} registrationNumber
 * @return {Object}
 */
function getAdminReviewDataByRegistrationNumber(registrationNumber) {
  var normalizedTarget = normalizeRegistrationNumber(registrationNumber);
  var rows = getCachedSheetRows(CONFIG.SHEET_NAMES.STUDENT_DB);
  var studentRow = null;

  for (var i = 0; i < rows.length; i++) {
    var d = rows[i].data;
    var rowReg = extractRegistrationNumberFromRow(d);
    if (rowReg === normalizedTarget) {
      studentRow = d;
      break;
    }
  }

  // Fallback check by StudentID if Student Database uses custom StudentID
  if (!studentRow) {
    for (var j = 0; j < rows.length; j++) {
      var sd = rows[j].data;
      var sid = String(sd.StudentID || '').trim().toUpperCase();
      if (sid === normalizedTarget) {
        studentRow = sd;
        break;
      }
    }
  }

  var comments = [];
  var reviewHistory = [];

  if (studentRow) {
    try {
      if (studentRow.AdminComments) comments = JSON.parse(studentRow.AdminComments);
    } catch (e) {
      comments = [];
    }
    try {
      if (studentRow.ReviewHistory) reviewHistory = JSON.parse(studentRow.ReviewHistory);
    } catch (e) {
      reviewHistory = [];
    }
  }

  return {
    approvalStatus: studentRow ? (studentRow.ApprovalStatus || 'Pending') : 'Pending',
    decisionBy: studentRow ? (studentRow.DecisionBy || '') : '',
    decisionTimestamp: studentRow ? (studentRow.DecisionTimestamp || '') : '',
    decisionComment: studentRow ? (studentRow.DecisionComment || studentRow.AdminComment || studentRow.RejectionReason || '') : '',
    reviewFlagStatus: studentRow ? (studentRow.ReviewFlagStatus || 'Not Flagged') : 'Not Flagged',
    flaggedBy: studentRow ? (studentRow.FlaggedBy || '') : '',
    flaggedAt: studentRow ? (studentRow.FlaggedAt || '') : '',
    flagReason: studentRow ? (studentRow.FlagReason || '') : '',
    bookingStatus: studentRow ? (studentRow.BookingStatus || 'Not Booked') : 'Not Booked',
    bookingId: studentRow ? (studentRow.BookingID || '') : '',
    bookingRequestId: studentRow ? (studentRow.BookingRequestID || '') : '',
    bookedDate: studentRow ? (studentRow.InterviewDate || '') : '',
    bookedSlotStart: studentRow ? (studentRow.InterviewStart || '') : '',
    bookedSlotEnd: studentRow ? (studentRow.InterviewEnd || '') : '',
    bookedTimestamp: studentRow ? (studentRow.BookingTimestamp || '') : '',
    adminComments: Array.isArray(comments) ? comments : [],
    reviewHistory: Array.isArray(reviewHistory) ? reviewHistory : []
  };
}
