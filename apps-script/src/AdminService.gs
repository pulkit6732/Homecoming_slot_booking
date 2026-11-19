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
 * Retrieves full dossier for a student using exact Registration Number as primary key.
 * 
 * Rules:
 * - Registration Number is the unique identifier.
 * - Searches original Google Form responses dataset.
 * - Authenticates admin privileges (blocks student or unauthorized access).
 * - Exact 1 match: returns dossier with separate original submission and admin review data.
 * - 0 matches: returns controlled SUBMISSION_NOT_FOUND error.
 * - >1 matches: returns controlled AMBIGUOUS_REGISTRATION warning (prevents silent selection).
 * - Missing Registration Number: returns controlled MISSING_REGISTRATION_NUMBER error.
 * - Never falls back to email or another student.
 * 
 * @param {string} token
 * @param {string} registrationNumber
 * @return {Object}
 */
function getStudentDossier(token, registrationNumber) {
  var adminAuth = authenticateAdmin(token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var normalizedReg = normalizeRegistrationNumber(registrationNumber);
  if (!normalizedReg) {
    return errorPayload(
      CONFIG.ERROR_CODES.MISSING_REGISTRATION_NUMBER,
      'Data integrity error: Registration Number is missing or empty. Lookup prevented.'
    );
  }

  var searchResult = getOriginalFormSubmissionByRegistrationNumber(normalizedReg);
  if (!searchResult.success) {
    return errorPayload(
      searchResult.error.code,
      searchResult.error.message,
      searchResult.error.details
    );
  }

  var originalSubmission = formatOriginalSubmission(searchResult.rawSubmission, normalizedReg);
  var adminReviewData = getAdminReviewDataByRegistrationNumber(normalizedReg);

  return successPayload({
    registrationNumber: normalizedReg,
    originalSubmission: originalSubmission,
    adminReviewData: adminReviewData
  });
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

/**
 * Returns complete administrative review dossier, comments, and decision history.
 * Admin-only operation with strict cryptographic verification.
 * 
 * @param {string} token
 * @param {string} studentId
 * @return {Object}
 */
function getReviewDetails(token, studentId) {
  var adminAuth = authenticateAdmin(token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var studentRef = getStudentRecordWithRowById(studentId);
  if (!studentRef) {
    return errorPayload(CONFIG.ERROR_CODES.UNREGISTERED_STUDENT, 'Student with ID ' + studentId + ' not found');
  }

  var d = studentRef.data;
  var comments = [];
  try {
    if (d.AdminComments) {
      comments = JSON.parse(d.AdminComments);
    }
  } catch (e) {
    comments = [];
  }

  var history = [];
  try {
    if (d.ReviewHistory) {
      history = JSON.parse(d.ReviewHistory);
    }
  } catch (e) {
    history = [];
  }

  return successPayload({
    studentId: studentId,
    approvalStatus: d.ApprovalStatus || 'Pending',
    reviewFlagStatus: d.ReviewFlagStatus || 'Not Flagged',
    decisionBy: d.DecisionBy || '',
    decisionTimestamp: d.DecisionTimestamp || '',
    decisionComment: d.DecisionComment || d.AdminComment || '',
    rejectionReason: d.RejectionReason || '',
    flaggedBy: d.FlaggedBy || '',
    flaggedAt: d.FlaggedAt || '',
    flagReason: d.FlagReason || '',
    comments: comments,
    reviewHistory: history
  });
}

/**
 * Updates ApprovalStatus independently from BookingStatus and ReviewFlagStatus.
 * Preserves audit history of all transitions.
 * 
 * @param {Object} params
 * @return {Object}
 */
function changeApprovalStatus(params) {
  var adminAuth = authenticateAdmin(params.token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var studentId = String(params.studentId || '').trim();
  var newStatus = String(params.newApprovalStatus || params.approvalStatus || '').trim();
  var reason = String(params.reason || params.comment || '').trim();

  if (!studentId) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Missing studentId');
  }
  if (!newStatus || (newStatus !== 'Approved' && newStatus !== 'Rejected' && newStatus !== 'Pending')) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Invalid approval status: must be Approved, Rejected, or Pending');
  }

  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    if (!hasLock) {
      return errorPayload(CONFIG.ERROR_CODES.LOCK_TIMEOUT, 'Server is experiencing high traffic. Please retry.');
    }

    var studentRef = getStudentRecordWithRowById(studentId);
    if (!studentRef) {
      return errorPayload(CONFIG.ERROR_CODES.UNREGISTERED_STUDENT, 'Student with ID ' + studentId + ' not found');
    }

    var d = studentRef.data;
    var prevApproval = d.ApprovalStatus || 'Pending';
    var prevFlag = d.ReviewFlagStatus || 'Not Flagged';
    var nowIso = new Date().toISOString();

    var history = [];
    try {
      if (d.ReviewHistory) history = JSON.parse(d.ReviewHistory);
    } catch (e) {
      history = [];
    }

    var historyEntry = {
      reviewId: 'REV-' + Utilities.getUuid(),
      studentId: studentId,
      previousApprovalStatus: prevApproval,
      newApprovalStatus: newStatus,
      previousReviewFlagStatus: prevFlag,
      newReviewFlagStatus: prevFlag,
      changedBy: adminAuth.adminEmail,
      changedAt: nowIso,
      reason: reason
    };
    history.unshift(historyEntry);

    var reviewUpdate = {
      'ApprovalStatus': newStatus,
      'DecisionBy': adminAuth.adminEmail,
      'DecisionTimestamp': nowIso,
      'DecisionComment': reason,
      'ReviewHistory': JSON.stringify(history)
    };
    if (newStatus === 'Rejected') {
      reviewUpdate.RejectionReason = reason;
    }

    var updated = updateStudentReview(studentId, reviewUpdate);
    if (!updated) {
      return errorPayload(CONFIG.ERROR_CODES.INTERNAL_ERROR, 'Failed to update student approval status');
    }

    return successPayload({
      studentId: studentId,
      approvalStatus: newStatus,
      reviewFlagStatus: prevFlag,
      decisionBy: adminAuth.adminEmail,
      decisionTimestamp: nowIso,
      decisionComment: reason,
      reviewHistory: history
    }, 'Approval status updated to ' + newStatus);
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * Updates ReviewFlagStatus independently from ApprovalStatus and BookingStatus.
 * Preserves audit history of all transitions.
 * 
 * @param {Object} params
 * @return {Object}
 */
function changeReviewFlag(params) {
  var adminAuth = authenticateAdmin(params.token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var studentId = String(params.studentId || '').trim();
  var newFlag = String(params.newReviewFlagStatus || params.reviewFlagStatus || '').trim();
  var reason = String(params.reason || '').trim();

  if (!studentId) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Missing studentId');
  }
  if (!newFlag || (newFlag !== 'Yellow Flagged' && newFlag !== 'Flagged for Review' && newFlag !== 'Not Flagged')) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Invalid review flag: must be Yellow Flagged, Flagged for Review, or Not Flagged');
  }

  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    if (!hasLock) {
      return errorPayload(CONFIG.ERROR_CODES.LOCK_TIMEOUT, 'Server is experiencing high traffic. Please retry.');
    }

    var studentRef = getStudentRecordWithRowById(studentId);
    if (!studentRef) {
      return errorPayload(CONFIG.ERROR_CODES.UNREGISTERED_STUDENT, 'Student with ID ' + studentId + ' not found');
    }

    var d = studentRef.data;
    var prevApproval = d.ApprovalStatus || 'Pending';
    var prevFlag = d.ReviewFlagStatus || 'Not Flagged';
    var nowIso = new Date().toISOString();

    var history = [];
    try {
      if (d.ReviewHistory) history = JSON.parse(d.ReviewHistory);
    } catch (e) {
      history = [];
    }

    var historyEntry = {
      reviewId: 'REV-' + Utilities.getUuid(),
      studentId: studentId,
      previousApprovalStatus: prevApproval,
      newApprovalStatus: prevApproval,
      previousReviewFlagStatus: prevFlag,
      newReviewFlagStatus: newFlag,
      changedBy: adminAuth.adminEmail,
      changedAt: nowIso,
      reason: reason
    };
    history.unshift(historyEntry);

    var reviewUpdate = {
      'ReviewFlagStatus': newFlag,
      'FlaggedBy': newFlag === 'Not Flagged' ? '' : adminAuth.adminEmail,
      'FlaggedAt': newFlag === 'Not Flagged' ? '' : nowIso,
      'FlagReason': newFlag === 'Not Flagged' ? '' : reason,
      'ReviewHistory': JSON.stringify(history)
    };
    if (newFlag === 'Not Flagged') {
      reviewUpdate.FlagClearedBy = adminAuth.adminEmail;
      reviewUpdate.FlagClearedAt = nowIso;
    }

    var updated = updateStudentReview(studentId, reviewUpdate);
    if (!updated) {
      return errorPayload(CONFIG.ERROR_CODES.INTERNAL_ERROR, 'Failed to update student review flag');
    }

    return successPayload({
      studentId: studentId,
      approvalStatus: prevApproval,
      reviewFlagStatus: newFlag,
      flaggedBy: newFlag === 'Not Flagged' ? '' : adminAuth.adminEmail,
      flaggedAt: newFlag === 'Not Flagged' ? '' : nowIso,
      flagReason: newFlag === 'Not Flagged' ? '' : reason,
      reviewHistory: history
    }, 'Review flag updated to ' + newFlag);
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * Creates a private administrative comment for a student.
 * Never silently overwrites older comments; stores in chronological order (newest first).
 * 
 * @param {Object} params
 * @return {Object}
 */
function createComment(params) {
  var adminAuth = authenticateAdmin(params.token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var studentId = String(params.studentId || '').trim();
  var commentText = String(params.commentText || params.comment || '').trim();

  if (!studentId) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Missing studentId');
  }
  if (!commentText) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Comment text cannot be empty');
  }

  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    if (!hasLock) {
      return errorPayload(CONFIG.ERROR_CODES.LOCK_TIMEOUT, 'Server is experiencing high traffic. Please retry.');
    }

    var studentRef = getStudentRecordWithRowById(studentId);
    if (!studentRef) {
      return errorPayload(CONFIG.ERROR_CODES.UNREGISTERED_STUDENT, 'Student with ID ' + studentId + ' not found');
    }

    var d = studentRef.data;
    var nowIso = new Date().toISOString();

    var comments = [];
    try {
      if (d.AdminComments) comments = JSON.parse(d.AdminComments);
    } catch (e) {
      comments = [];
    }

    var newComment = {
      commentId: 'COMM-' + Utilities.getUuid(),
      studentId: studentId,
      adminUid: adminAuth.user && adminAuth.user.id ? adminAuth.user.id : ('admin-' + adminAuth.adminEmail),
      adminEmail: adminAuth.adminEmail,
      commentText: commentText,
      createdAt: nowIso,
      updatedAt: nowIso,
      isEdited: false,
      editHistory: []
    };

    comments.unshift(newComment); // Newest first

    var reviewUpdate = {
      'AdminComments': JSON.stringify(comments),
      'AdminComment': commentText
    };

    var updated = updateStudentReview(studentId, reviewUpdate);
    if (!updated) {
      return errorPayload(CONFIG.ERROR_CODES.INTERNAL_ERROR, 'Failed to save comment');
    }

    return successPayload({
      comment: newComment,
      comments: comments
    }, 'Comment saved successfully');
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * Edits an administrator's existing private comment.
 * Verifies author identity and preserves prior versions in editHistory.
 * 
 * @param {Object} params
 * @return {Object}
 */
function editComment(params) {
  var adminAuth = authenticateAdmin(params.token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var studentId = String(params.studentId || '').trim();
  var commentId = String(params.commentId || '').trim();
  var newText = String(params.newCommentText || params.commentText || '').trim();

  if (!studentId || !commentId) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Missing studentId or commentId');
  }
  if (!newText) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Comment text cannot be empty');
  }

  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    if (!hasLock) {
      return errorPayload(CONFIG.ERROR_CODES.LOCK_TIMEOUT, 'Server is experiencing high traffic. Please retry.');
    }

    var studentRef = getStudentRecordWithRowById(studentId);
    if (!studentRef) {
      return errorPayload(CONFIG.ERROR_CODES.UNREGISTERED_STUDENT, 'Student with ID ' + studentId + ' not found');
    }

    var d = studentRef.data;
    var nowIso = new Date().toISOString();

    var comments = [];
    try {
      if (d.AdminComments) comments = JSON.parse(d.AdminComments);
    } catch (e) {
      comments = [];
    }

    var targetComment = null;
    for (var i = 0; i < comments.length; i++) {
      if (comments[i].commentId === commentId) {
        targetComment = comments[i];
        break;
      }
    }

    if (!targetComment) {
      return errorPayload(CONFIG.ERROR_CODES.INTERNAL_ERROR, 'Comment not found');
    }

    // Verify authorship: author can edit their own comment
    if (targetComment.adminEmail !== adminAuth.adminEmail) {
      return errorPayload(CONFIG.ERROR_CODES.FORBIDDEN_ADMIN, 'Forbidden: You can only edit comments created by your account');
    }

    if (!targetComment.editHistory) {
      targetComment.editHistory = [];
    }

    // Preserve previous version in edit history
    targetComment.editHistory.push({
      commentText: targetComment.commentText,
      editedAt: nowIso,
      editedBy: adminAuth.adminEmail
    });

    targetComment.commentText = newText;
    targetComment.updatedAt = nowIso;
    targetComment.isEdited = true;

    var reviewUpdate = {
      'AdminComments': JSON.stringify(comments)
    };

    var updated = updateStudentReview(studentId, reviewUpdate);
    if (!updated) {
      return errorPayload(CONFIG.ERROR_CODES.INTERNAL_ERROR, 'Failed to update comment');
    }

    return successPayload({
      updatedComment: targetComment,
      comments: comments
    }, 'Comment updated successfully');
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * Returns comment history for a student. Strictly admin-only.
 * 
 * @param {string} token
 * @param {string} studentId
 * @return {Object}
 */
function getCommentHistory(token, studentId) {
  var adminAuth = authenticateAdmin(token);
  if (!adminAuth.authorized) {
    return errorPayload(adminAuth.error.code, adminAuth.error.message);
  }

  var studentRef = getStudentRecordWithRowById(studentId);
  if (!studentRef) {
    return errorPayload(CONFIG.ERROR_CODES.UNREGISTERED_STUDENT, 'Student with ID ' + studentId + ' not found');
  }

  var comments = [];
  try {
    if (studentRef.data.AdminComments) comments = JSON.parse(studentRef.data.AdminComments);
  } catch (e) {
    comments = [];
  }

  return successPayload({
    studentId: studentId,
    comments: comments
  });
}
