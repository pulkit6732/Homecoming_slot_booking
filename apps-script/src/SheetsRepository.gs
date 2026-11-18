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
  var sheet = getSheetByName(CONFIG.SHEET_NAMES.STUDENT_DB);
  var rows = readSheetRowsWithHeader(sheet);
  return rows.map(function(r) { return r.data; });
}

/**
 * Retrieves a student record by verified email address (case-insensitive).
 * @param {string} email
 * @return {Object|null}
 */
function getStudentRecordByEmail(email) {
  if (!email) return null;
  var target = email.trim().toLowerCase();
  var sheet = getSheetByName(CONFIG.SHEET_NAMES.STUDENT_DB);
  var rows = readSheetRowsWithHeader(sheet);

  for (var i = 0; i < rows.length; i++) {
    var d = rows[i].data;
    var rowEmail = String(d.Email || d['GITAM Email'] || d['Student Email'] || d['Email Address'] || d['Candidate Email'] || '').trim().toLowerCase();
    if (rowEmail === target) {
      return rows[i].data;
    }
  }
  return null;
}

/**
 * Retrieves a student record and row number by StudentID.
 * @param {string} studentId
 * @return {{ rowNumber: number, data: Object }|null}
 */
function getStudentRecordWithRowById(studentId) {
  if (!studentId) return null;
  var target = String(studentId).trim();
  var sheet = getSheetByName(CONFIG.SHEET_NAMES.STUDENT_DB);
  var rows = readSheetRowsWithHeader(sheet);

  for (var i = 0; i < rows.length; i++) {
    var d = rows[i].data;
    var sid = String(d.StudentID || d['Student ID'] || d['Roll Number'] || d['Registration Number'] || '').trim();
    if (sid === target) {
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
  var sheet = getSheetByName(CONFIG.SHEET_NAMES.STUDENT_DB);
  var rows = readSheetRowsWithHeader(sheet);
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
  var sheet = getSheetByName(CONFIG.SHEET_NAMES.STUDENT_DB);
  var rows = readSheetRowsWithHeader(sheet);

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
 * Modifies existing row in place. Never appends a duplicate row.
 * 
 * @param {string} studentId
 * @param {Object} bookingDetails
 * @return {boolean}
 */
function updateStudentBooking(studentId, bookingDetails) {
  var studentRef = getStudentRecordWithRowById(studentId);
  if (!studentRef) return false;

  var sheet = getSheetByName(CONFIG.SHEET_NAMES.STUDENT_DB);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rowNumber = studentRef.rowNumber;

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
      sheet.getRange(rowNumber, c + 1).setValue(fieldMap[header]);
    }
  }

  SpreadsheetApp.flush();
  return true;
}

/**
 * Cancels a student's active booking in "Student Database".
 * Preserves the student record, approval status, and review flags.
 * 
 * @param {string} studentId
 * @return {boolean}
 */
function cancelStudentBooking(studentId) {
  var studentRef = getStudentRecordWithRowById(studentId);
  if (!studentRef) return false;

  var sheet = getSheetByName(CONFIG.SHEET_NAMES.STUDENT_DB);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rowNumber = studentRef.rowNumber;

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
      sheet.getRange(rowNumber, c + 1).setValue(fieldMap[header]);
    }
  }

  SpreadsheetApp.flush();
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

  for (var c = 0; c < headers.length; c++) {
    var header = String(headers[c]).trim();
    if (Object.prototype.hasOwnProperty.call(reviewData, header)) {
      sheet.getRange(rowNumber, c + 1).setValue(reviewData[header]);
    }
  }

  SpreadsheetApp.flush();

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
