/**
 * Google Apps Script Backend - Booking Service and Concurrency Locking
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Concurrency: LockService.getScriptLock() with 30s timeout and guaranteed release in finally.
 * Idempotency: BookingRequestID caching and replay.
 * Single active booking per student rule. Single student per slot rule.
 * Zero emojis per specification.
 */

/**
 * Creates an interview slot booking with concurrency locking and idempotency.
 * 
 * Execution flow:
 * 1. Acquire script lock.
 * 2. Authenticate student and resolve registered StudentID.
 * 3. Check BookingRequestID (idempotency check).
 * 4. Verify student does not already have an active booking.
 * 5. Validate date and slot against central schedule generator.
 * 6. Verify slot is not already reserved by another student.
 * 7. Generate BookingID.
 * 8. Update existing row in Student Database.
 * 9. Return confirmation.
 * 
 * @param {Object} params
 * @param {string} params.token Supabase identity JWT
 * @param {string} params.date YYYY-MM-DD
 * @param {string} params.startTime HH:mm
 * @param {string} params.bookingRequestId Client generated idempotency UUID
 * @return {Object} Standardized result payload
 */
function createBooking(params) {
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    if (!hasLock) {
      return errorPayload(
        CONFIG.ERROR_CODES.LOCK_TIMEOUT,
        'Server is experiencing high traffic. Please retry in a few moments.'
      );
    }

    // 0. Server-enforced Booking Configuration: Fail closed if booking is disabled
    var isBookingEnabled = getScriptProperty('BOOKING_ENABLED', 'false') === 'true';
    if (!isBookingEnabled) {
      return errorPayload(
        CONFIG.ERROR_CODES.BOOKING_DISABLED,
        'Student slot booking is currently disabled while the registration database is being finalized. Please contact the university placement office.'
      );
    }

    // 1. Authenticate student from token (server-side authority)
    var authResult = authenticateStudent(params.token);
    if (!authResult.authorized) {
      return errorPayload(authResult.error.code, authResult.error.message);
    }
    var student = authResult.studentRecord;
    var studentId = student.StudentID || student['Student ID'] || student['Roll Number'] || student['Registration Number'] || student['Registration no.'] || student.Email || student['Email Address'] || '';

    var bookingRequestId = String(params.bookingRequestId || '').trim();
    if (!bookingRequestId) {
      return errorPayload(
        CONFIG.ERROR_CODES.MISSING_PARAMETER,
        'Missing required parameter: bookingRequestId'
      );
    }

    // 2. Idempotency Check: Same BookingRequestID returns existing confirmation
    var existingByRequest = findBookingByRequestId(bookingRequestId);
    if (existingByRequest) {
      return successPayload({
        bookingId: existingByRequest.BookingID,
        bookingRequestId: existingByRequest.BookingRequestID,
        studentId: existingByRequest.StudentID,
        fullName: existingByRequest.FullName,
        email: existingByRequest.Email,
        interviewDate: existingByRequest.InterviewDate,
        interviewSlot: existingByRequest.InterviewSlot,
        interviewStart: existingByRequest.InterviewStart,
        interviewEnd: existingByRequest.InterviewEnd,
        bookingStatus: existingByRequest.BookingStatus,
        approvalStatus: existingByRequest.ApprovalStatus || 'Pending',
        isIdempotentReplay: true
      }, 'Existing booking confirmed (idempotent request)');
    }

    // 3. One Active Booking Rule: Student must not already have an active reservation
    if (student.BookingStatus === 'Booked') {
      return errorPayload(
        CONFIG.ERROR_CODES.ALREADY_BOOKED,
        'You already have an active interview booking (' + student.BookingID + ' on ' + student.InterviewDate + '). Students are limited to one active booking.'
      );
    }

    var dateStr = String(params.date || '').trim();
    var startTime = String(params.startTime || '').trim();

    // 4. Validate Date
    if (!isEligibleDate(dateStr)) {
      return errorPayload(
        CONFIG.ERROR_CODES.INVALID_DATE,
        'Selected date (' + dateStr + ') is not an eligible interview date'
      );
    }

    // 5. Validate Slot
    if (!isValidSlot(dateStr, startTime)) {
      return errorPayload(
        CONFIG.ERROR_CODES.INVALID_SLOT,
        'Selected time (' + startTime + ') is not a valid scheduled slot'
      );
    }

    var slotTemplate = getSlotTemplate(startTime);
    if (!slotTemplate) {
      return errorPayload(CONFIG.ERROR_CODES.INVALID_SLOT, 'Slot metadata could not be resolved');
    }

    // 6. One Student Per Slot Rule: Verify slot is not already taken
    var existingBookings = getBookingsForDate(dateStr);
    for (var i = 0; i < existingBookings.length; i++) {
      if (existingBookings[i].interviewStart === startTime && existingBookings[i].bookingStatus === 'Booked') {
        return errorPayload(
          CONFIG.ERROR_CODES.SLOT_UNAVAILABLE,
          'This slot (' + slotTemplate.displayStart + ' on ' + dateStr + ') has just been reserved by another student. Please select an available slot.'
        );
      }
    }

    // 7. Generate BookingID
    var dateCompact = dateStr.replace(/-/g, '');
    var timeCompact = startTime.replace(/:/g, '');
    var bookingId = 'BK-' + dateCompact + '-' + timeCompact + '-' + studentId;
    var nowTimestamp = new Date().toISOString();

    var bookingRecord = {
      bookingId: bookingId,
      bookingRequestId: bookingRequestId,
      studentId: studentId,
      fullName: student.FullName,
      email: student.Email,
      interviewDate: dateStr,
      interviewSlot: slotTemplate.slotIndex,
      interviewStart: startTime,
      interviewEnd: slotTemplate.endTime,
      bookingStatus: 'Booked',
      bookingTimestamp: nowTimestamp
    };

    // 8. Update Student Database row in place
    var updated = updateStudentBooking(studentId, bookingRecord);
    if (!updated) {
      return errorPayload(
        CONFIG.ERROR_CODES.INTERNAL_ERROR,
        'Failed to save booking record in student database'
      );
    }

    // 9. Return Booking Confirmation
    return successPayload({
      bookingId: bookingId,
      bookingRequestId: bookingRequestId,
      studentId: studentId,
      fullName: student.FullName,
      email: student.Email,
      interviewDate: dateStr,
      interviewSlot: slotTemplate.slotIndex,
      interviewStart: startTime,
      interviewEnd: slotTemplate.endTime,
      displayTime: slotTemplate.displayStart + ' - ' + slotTemplate.displayEnd,
      bookingStatus: 'Booked',
      approvalStatus: student.ApprovalStatus || 'Pending',
      bookingTimestamp: nowTimestamp
    }, 'Interview slot booked successfully');

  } catch (err) {
    return errorPayload(
      CONFIG.ERROR_CODES.INTERNAL_ERROR,
      'Internal error during booking creation: ' + (err.message || String(err))
    );
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

/**
 * Cancels a student's active booking.
 * Can be performed by the booking owner or an administrator.
 * 
 * @param {Object} params
 * @param {string} params.token
 * @param {string} [params.targetStudentId] Required only if admin is canceling on behalf of student
 * @return {Object}
 */
function cancelBooking(params) {
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    if (!hasLock) {
      return errorPayload(CONFIG.ERROR_CODES.LOCK_TIMEOUT, 'Server is busy. Please try again.');
    }

    var tokenAuth = validateSupabaseToken(params.token);
    if (!tokenAuth.valid) {
      return errorPayload(tokenAuth.error.code, tokenAuth.error.message);
    }

    var requesterEmail = tokenAuth.user.email;
    var isAdmin = isAuthorizedAdmin(requesterEmail);
    var targetStudentId = '';

    if (isAdmin && params.targetStudentId) {
      targetStudentId = String(params.targetStudentId).trim();
    } else {
      var studentRef = getStudentRecordByEmail(requesterEmail);
      if (!studentRef) {
        return errorPayload(CONFIG.ERROR_CODES.UNREGISTERED_STUDENT, 'Student profile not found');
      }
      targetStudentId = studentRef.StudentID;
    }

    var targetStudent = getStudentRecordWithRowById(targetStudentId);
    if (!targetStudent) {
      return errorPayload(CONFIG.ERROR_CODES.BOOKING_NOT_FOUND, 'Target student record not found');
    }

    if (targetStudent.data.BookingStatus !== 'Booked') {
      return errorPayload(
        CONFIG.ERROR_CODES.BOOKING_NOT_FOUND,
        'Student currently has no active booking to cancel'
      );
    }

    var cancelled = cancelStudentBooking(targetStudentId);
    if (!cancelled) {
      return errorPayload(CONFIG.ERROR_CODES.INTERNAL_ERROR, 'Failed to update student database');
    }

    return successPayload({
      studentId: targetStudentId,
      bookingStatus: 'Cancelled',
      cancelledAt: new Date().toISOString()
    }, 'Booking cancelled successfully');

  } catch (err) {
    return errorPayload(CONFIG.ERROR_CODES.INTERNAL_ERROR, err.message || String(err));
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

/**
 * Returns slot availability for a specified date (36 slots).
 * Does not require privileged access; shows AVAILABLE or BOOKED status.
 * Lunch slots are strictly excluded.
 * 
 * @param {string} dateStr YYYY-MM-DD
 * @return {Object}
 */
function getAvailabilityForDate(dateStr) {
  if (!isEligibleDate(dateStr)) {
    return errorPayload(
      CONFIG.ERROR_CODES.INVALID_DATE,
      'Date (' + dateStr + ') is not an eligible interview date'
    );
  }

  var templates = generateDailySlotTemplates();
  var activeBookings = getBookingsForDate(dateStr);

  var bookedMap = {};
  for (var b = 0; b < activeBookings.length; b++) {
    bookedMap[activeBookings[b].interviewStart] = true;
  }

  var slots = [];
  var availableCount = 0;
  var bookedCount = 0;

  for (var s = 0; s < templates.length; s++) {
    var tmpl = templates[s];
    var isBooked = !!bookedMap[tmpl.startTime];
    var status = isBooked ? 'BOOKED' : 'AVAILABLE';

    if (isBooked) bookedCount++;
    else availableCount++;

    slots.push({
      slotIndex: tmpl.slotIndex,
      session: tmpl.session,
      startTime: tmpl.startTime,
      endTime: tmpl.endTime,
      displayStart: tmpl.displayStart,
      displayEnd: tmpl.displayEnd,
      status: status
    });
  }

  return successPayload({
    date: dateStr,
    totalSlots: templates.length,
    availableSlots: availableCount,
    bookedSlots: bookedCount,
    slots: slots
  });
}
