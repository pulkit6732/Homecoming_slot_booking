/**
 * Google Apps Script Backend - Admin Service and Review Actions
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Every admin endpoint independently verifies administrator privileges.
 * 4 Review Actions: Approve, Reject, Flag, Clear Flag.
 * Independent status fields: BookingStatus, ApprovalStatus, ReviewFlagStatus.
 * Zero emojis per specification.
 */

/**
 * Returns admin view of the daily schedule for a date, including booking and student details.
 * 
 * @param {string} token Admin Supabase JWT
 * @param {string} dateStr YYYY-MM-DD
 * @return {Object}
 */
function getAdminSchedule(token, dateStr) {
  var adminAuth = authenticateAdmin(token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  if (!isEligibleDate(dateStr)) {
    return errorPayload(CONFIG.ERROR_CODES.INVALID_DATE, 'Date (' + dateStr + ') is not an eligible interview date');
  }

  var templates = generateDailySlotTemplates();
  var activeBookings = getBookingsForDate(dateStr);
  var bookingMap = {};
  for (var b = 0; b < activeBookings.length; b++) {
    bookingMap[activeBookings[b].interviewStart] = activeBookings[b];
  }

  var scheduleSlots = [];
  for (var i = 0; i < templates.length; i++) {
    var tmpl = templates[i];
    var booking = bookingMap[tmpl.startTime] || null;

    scheduleSlots.push({
      slotIndex: tmpl.slotIndex,
      session: tmpl.session,
      startTime: tmpl.startTime,
      endTime: tmpl.endTime,
      displayStart: tmpl.displayStart,
      displayEnd: tmpl.displayEnd,
      status: booking ? 'BOOKED' : 'AVAILABLE',
      booking: booking
    });
  }

  return successPayload({
    date: dateStr,
    totalSlots: scheduleSlots.length,
    slots: scheduleSlots
  });
}

/**
 * Calculates admin summary metrics across all students or for a specific date.
 * 
 * @param {string} token
 * @param {string} [dateStr]
 * @return {Object}
 */
function getAdminSummary(token, dateStr) {
  var adminAuth = authenticateAdmin(token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var students = getAllStudentRecords();
  var totalStudents = students.length;
  var bookedCount = 0;
  var unbookedCount = 0;
  var pendingReviewCount = 0;
  var approvedCount = 0;
  var rejectedCount = 0;
  var flaggedCount = 0;

  var filterDate = dateStr && isEligibleDate(dateStr) ? dateStr.trim() : null;

  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    var isBooked = String(s.BookingStatus || '') === 'Booked';

    if (filterDate) {
      if (String(s.InterviewDate || '').trim() !== filterDate) {
        continue;
      }
    }

    if (isBooked) bookedCount++;
    else unbookedCount++;

    var appStatus = String(s.ApprovalStatus || 'Pending');
    if (appStatus === 'Approved') approvedCount++;
    else if (appStatus === 'Rejected') rejectedCount++;
    else pendingReviewCount++;

    if (String(s.ReviewFlagStatus || '') === 'Flagged for Review') {
      flaggedCount++;
    }
  }

  return successPayload({
    date: filterDate,
    totalStudents: totalStudents,
    bookedStudents: bookedCount,
    unbookedStudents: unbookedCount,
    pendingReview: pendingReviewCount,
    approvedStudents: approvedCount,
    rejectedStudents: rejectedCount,
    flaggedStudents: flaggedCount
  });
}

/**
 * Retrieves full dossier for a student by StudentID.
 * 
 * @param {string} token
 * @param {string} studentId
 * @return {Object}
 */
function getStudentDetails(token, studentId) {
  var adminAuth = authenticateAdmin(token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var studentRef = getStudentRecordWithRowById(studentId);
  if (!studentRef) {
    return errorPayload(CONFIG.ERROR_CODES.UNREGISTERED_STUDENT, 'Student with ID ' + studentId + ' not found');
  }

  return successPayload(studentRef.data);
}

/**
 * Review Action 1: APPROVE
 * - ApprovalStatus = Approved
 * - Record DecisionBy and DecisionTimestamp
 * - Sync to Approved sheet
 * 
 * @param {Object} params
 * @return {Object}
 */
function reviewApprove(params) {
  var adminAuth = authenticateAdmin(params.token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var studentId = String(params.studentId || '').trim();
  if (!studentId) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Missing studentId');
  }

  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    var nowIso = new Date().toISOString();
    var reviewUpdate = {
      'ApprovalStatus': 'Approved',
      'DecisionBy': adminAuth.adminEmail,
      'DecisionTimestamp': nowIso,
      'AdminComment': params.comment || ''
    };

    var updated = updateStudentReview(studentId, reviewUpdate);
    if (!updated) {
      return errorPayload(CONFIG.ERROR_CODES.INTERNAL_ERROR, 'Failed to update student review status');
    }

    return successPayload({
      studentId: studentId,
      approvalStatus: 'Approved',
      decisionBy: adminAuth.adminEmail,
      decisionTimestamp: nowIso
    }, 'Student approved successfully');
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * Review Action 2: REJECT
 * - Required reason
 * - ApprovalStatus = Rejected
 * - Record DecisionBy, DecisionTimestamp, RejectionReason
 * - Sync to Rejected sheet
 * 
 * @param {Object} params
 * @return {Object}
 */
function reviewReject(params) {
  var adminAuth = authenticateAdmin(params.token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var studentId = String(params.studentId || '').trim();
  var reason = String(params.reason || '').trim();

  if (!studentId) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Missing studentId');
  }
  if (!reason) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Rejection reason is required');
  }

  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    var nowIso = new Date().toISOString();
    var reviewUpdate = {
      'ApprovalStatus': 'Rejected',
      'DecisionBy': adminAuth.adminEmail,
      'DecisionTimestamp': nowIso,
      'RejectionReason': reason
    };

    var updated = updateStudentReview(studentId, reviewUpdate);
    if (!updated) {
      return errorPayload(CONFIG.ERROR_CODES.INTERNAL_ERROR, 'Failed to update student review status');
    }

    return successPayload({
      studentId: studentId,
      approvalStatus: 'Rejected',
      decisionBy: adminAuth.adminEmail,
      decisionTimestamp: nowIso,
      rejectionReason: reason
    }, 'Student rejected successfully');
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * Review Action 3: FLAG
 * - Required reason
 * - ReviewFlagStatus = Flagged for Review
 * - Record FlaggedBy, FlaggedAt, FlagReason
 * - Independent from ApprovalStatus
 * 
 * @param {Object} params
 * @return {Object}
 */
function reviewFlag(params) {
  var adminAuth = authenticateAdmin(params.token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var studentId = String(params.studentId || '').trim();
  var reason = String(params.reason || '').trim();

  if (!studentId) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Missing studentId');
  }
  if (!reason) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Flag reason is required');
  }

  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    var nowIso = new Date().toISOString();
    var reviewUpdate = {
      'ReviewFlagStatus': 'Flagged for Review',
      'FlaggedBy': adminAuth.adminEmail,
      'FlaggedAt': nowIso,
      'FlagReason': reason
    };

    var updated = updateStudentReview(studentId, reviewUpdate);
    if (!updated) {
      return errorPayload(CONFIG.ERROR_CODES.INTERNAL_ERROR, 'Failed to flag student for review');
    }

    return successPayload({
      studentId: studentId,
      reviewFlagStatus: 'Flagged for Review',
      flaggedBy: adminAuth.adminEmail,
      flaggedAt: nowIso,
      flagReason: reason
    }, 'Student flagged for review');
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * Review Action 4: CLEAR FLAG
 * - ReviewFlagStatus = Not Flagged
 * - Record FlagClearedBy, FlagClearedAt
 * - Independent from ApprovalStatus
 * 
 * @param {Object} params
 * @return {Object}
 */
function reviewClearFlag(params) {
  var adminAuth = authenticateAdmin(params.token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var studentId = String(params.studentId || '').trim();
  if (!studentId) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Missing studentId');
  }

  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    var nowIso = new Date().toISOString();
    var reviewUpdate = {
      'ReviewFlagStatus': 'Not Flagged',
      'FlagClearedBy': adminAuth.adminEmail,
      'FlagClearedAt': nowIso,
      'FlagReason': ''
    };

    var updated = updateStudentReview(studentId, reviewUpdate);
    if (!updated) {
      return errorPayload(CONFIG.ERROR_CODES.INTERNAL_ERROR, 'Failed to clear flag');
    }

    return successPayload({
      studentId: studentId,
      reviewFlagStatus: 'Not Flagged',
      flagClearedBy: adminAuth.adminEmail,
      flagClearedAt: nowIso
    }, 'Flag cleared successfully');
  } finally {
    if (hasLock) lock.releaseLock();
  }
}
