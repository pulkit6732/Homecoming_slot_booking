/**
 * Google Apps Script Backend - Web App Entry Points & Router
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Endpoints: doGet and doPost handlers.
 * Timezone: Asia/Kolkata (Indian Standard Time - IST)
 * Zero emojis per specification.
 */

/**
 * HTTP GET Handler.
 * Supports public availability querying and authenticated administrative reads.
 * 
 * @param {GoogleAppsScript.Events.DoGet} e
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || '';

    switch (action) {
      case 'ping':
        return createJsonResponse(successPayload({ status: 'ok', time: new Date().toISOString() }));

      case 'getAvailability':
        var date = params.date || '';
        return createJsonResponse(getAvailabilityForDate(date));

      case 'getAdminSchedule':
        var adminToken = params.token || '';
        var scheduleDate = params.date || '';
        return createJsonResponse(getAdminSchedule(adminToken, scheduleDate));

      case 'getAdminSummary':
        var summaryToken = params.token || '';
        var summaryDate = params.date || '';
        return createJsonResponse(getAdminSummary(summaryToken, summaryDate));

      case 'studentLoginByEmail':
        var studentEmail = params.email || '';
        return createJsonResponse(studentLoginByEmail(studentEmail));

      case 'checkStudentEligibility':
        var eligEmail = params.email || '';
        return createJsonResponse(checkStudentEligibility(eligEmail));

      case 'getStudentProfile':
        var profToken = params.token || '';
        return createJsonResponse(getStudentProfile(profToken));

      case 'getStudentDetails':
        var detailsToken = params.token || '';
        var studentId = params.studentId || '';
        return createJsonResponse(getStudentDetails(detailsToken, studentId));

      case 'getStudentDossier':
        var dosToken = params.token || '';
        var dosReg = params.registrationNumber || params.regNo || params.studentId || '';
        return createJsonResponse(getStudentDossier(dosToken, dosReg));

      case 'getReviewDetails':
        var revToken = params.token || '';
        var revStudentId = params.studentId || '';
        return createJsonResponse(getReviewDetails(revToken, revStudentId));

      case 'getCommentHistory':
        var commToken = params.token || '';
        var commStudentId = params.studentId || '';
        return createJsonResponse(getCommentHistory(commToken, commStudentId));

      default:
        return createJsonResponse(errorPayload(
          CONFIG.ERROR_CODES.MISSING_PARAMETER,
          'Unknown or missing GET action: ' + action
        ));
    }
  } catch (err) {
    return createJsonResponse(errorPayload(
      CONFIG.ERROR_CODES.INTERNAL_ERROR,
      'Internal server error in doGet: ' + (err.message || String(err))
    ));
  }
}

/**
 * HTTP POST Handler.
 * Handles state-mutating requests (bookings, cancellations, review actions).
 * 
 * @param {GoogleAppsScript.Events.DoPost} e
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        return createJsonResponse(errorPayload(
          CONFIG.ERROR_CODES.MISSING_PARAMETER,
          'Malformed JSON in request body'
        ));
      }
    }

    var action = body.action || (e && e.parameter && e.parameter.action) || '';

    switch (action) {
      case 'createBooking':
        return createJsonResponse(createBooking(body));

      case 'cancelBooking':
        return createJsonResponse(cancelBooking(body));

      case 'reviewApprove':
        return createJsonResponse(reviewApprove(body));

      case 'reviewReject':
        return createJsonResponse(reviewReject(body));

      case 'reviewFlag':
        return createJsonResponse(reviewFlag(body));

      case 'reviewClearFlag':
        return createJsonResponse(reviewClearFlag(body));

      case 'changeApprovalStatus':
        return createJsonResponse(changeApprovalStatus(body));

      case 'changeReviewFlag':
        return createJsonResponse(changeReviewFlag(body));

      case 'createComment':
        return createJsonResponse(createComment(body));

      case 'editComment':
        return createJsonResponse(editComment(body));

      default:
        return createJsonResponse(errorPayload(
          CONFIG.ERROR_CODES.MISSING_PARAMETER,
          'Unknown or missing POST action: ' + action
        ));
    }
  } catch (err) {
    return createJsonResponse(errorPayload(
      CONFIG.ERROR_CODES.INTERNAL_ERROR,
      'Internal server error in doPost: ' + (err.message || String(err))
    ));
  }
}
