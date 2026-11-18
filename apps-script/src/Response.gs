/**
 * Google Apps Script Backend - Response Formatter and CORS Handling
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Zero emojis per specification.
 */

/**
 * Creates a standard JSON text output for Google Apps Script Web App.
 * @param {Object} payload
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function createJsonResponse(payload) {
  var jsonString = JSON.stringify(payload);
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Returns a standardized success response payload.
 * @param {any} data
 * @param {string} [message]
 * @return {Object}
 */
function successPayload(data, message) {
  return {
    success: true,
    data: data || null,
    message: message || 'Operation completed successfully',
    timestamp: new Date().toISOString()
  };
}

/**
 * Returns a standardized error response payload.
 * @param {string} code
 * @param {string} message
 * @param {any} [details]
 * @return {Object}
 */
function errorPayload(code, message, details) {
  return {
    success: false,
    error: {
      code: code || 'UNKNOWN_ERROR',
      message: message || 'An unexpected error occurred',
      details: details || null
    },
    timestamp: new Date().toISOString()
  };
}
