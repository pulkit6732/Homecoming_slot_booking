/**
 * Google Apps Script Backend - Authentication and Identity Validation
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Security architecture: Server-side validation of Supabase-issued identity tokens.
 * Zero client-supplied identity trusting. Zero emojis per specification.
 */

/**
 * Decodes base64url string to standard string.
 * @param {string} base64UrlStr
 * @return {string}
 */
function decodeBase64Url(base64UrlStr) {
  var base64 = base64UrlStr.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  var decodedBytes = Utilities.base64Decode(base64);
  return Utilities.newBlob(decodedBytes).getDataAsString('UTF-8');
}

/**
 * Validates a Supabase-issued JWT token.
 * 
 * Cryptographic approach:
 * 1. Split token into [header, payload, signature].
 * 2. Decode payload JSON and verify expiry (exp).
 * 3. Verify HMAC-SHA256 signature using SUPABASE_JWT_SECRET (if configured).
 * 
 * @param {string} token
 * @return {{ valid: boolean, user?: Object, error?: { code: string, message: string } }}
 */
function validateSupabaseToken(token) {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_MISSING, message: 'Authentication token is required' }
    };
  }

  var parts = token.split('.');
  if (parts.length !== 3) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Invalid JWT structure' }
    };
  }

  var payloadStr;
  var payload;
  try {
    payloadStr = decodeBase64Url(parts[1]);
    payload = JSON.parse(payloadStr);
  } catch (err) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Invalid JWT payload format' }
    };
  }

  // Check token expiration
  var nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSeconds) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_EXPIRED, message: 'Authentication token has expired' }
    };
  }

  // Signature verification when SUPABASE_JWT_SECRET is configured
  var jwtSecret = getScriptProperty('SUPABASE_JWT_SECRET', '');
  if (jwtSecret) {
    var signedContent = parts[0] + '.' + parts[1];
    var computedSignatureBytes = Utilities.computeHmacSha256Signature(signedContent, jwtSecret);
    var computedSignatureB64 = Utilities.base64EncodeWebSafe(computedSignatureBytes).replace(/=/g, '');
    var incomingSignatureB64 = parts[2].replace(/=/g, '');

    if (computedSignatureB64 !== incomingSignatureB64) {
      return {
        valid: false,
        error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Invalid token signature' }
      };
    }
  }

  var email = payload.email || (payload.user_metadata && payload.user_metadata.email) || '';
  if (!email) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Token contains no verified email' }
    };
  }

  return {
    valid: true,
    user: {
      id: payload.sub,
      email: email.trim().toLowerCase(),
      role: payload.role || 'authenticated'
    }
  };
}

/**
 * Checks whether an email address is an authorized administrator.
 * Matches against ADMIN_EMAILS script property or default allowlist.
 * 
 * @param {string} email
 * @return {boolean}
 */
function isAuthorizedAdmin(email) {
  if (!email || typeof email !== 'string') return false;
  var cleanEmail = email.trim().toLowerCase();
  
  var adminConfig = getScriptProperty('ADMIN_EMAILS', '');
  var allowlist = adminConfig
    ? adminConfig.split(',').map(function(e) { return e.trim().toLowerCase(); })
    : CONFIG.DEFAULT_ADMIN_EMAILS;

  for (var i = 0; i < allowlist.length; i++) {
    if (allowlist[i] === cleanEmail) {
      return true;
    }
  }
  return false;
}

/**
 * Validates admin request credentials.
 * @param {string} token
 * @return {{ authorized: boolean, adminEmail?: string, error?: Object }}
 */
function authenticateAdmin(token) {
  var authResult = validateSupabaseToken(token);
  if (!authResult.valid) {
    return { authorized: false, error: authResult.error };
  }

  var email = authResult.user.email;
  if (!isAuthorizedAdmin(email)) {
    return {
      authorized: false,
      error: {
        code: CONFIG.ERROR_CODES.FORBIDDEN_ADMIN,
        message: 'Forbidden: Account (' + email + ') does not have administrative privileges'
      }
    };
  }

  return { authorized: true, adminEmail: email };
}

/**
 * Validates student request credentials and resolves registered StudentID.
 * Strictly checks against the Student Database sheet.
 * 
 * @param {string} token
 * @return {{ authorized: boolean, studentRecord?: Object, error?: Object }}
 */
function authenticateStudent(token) {
  var authResult = validateSupabaseToken(token);
  if (!authResult.valid) {
    return { authorized: false, error: authResult.error };
  }

  var email = authResult.user.email;
  var studentRecord = getStudentRecordByEmail(email);
  if (!studentRecord) {
    return {
      authorized: false,
      error: {
        code: CONFIG.ERROR_CODES.UNREGISTERED_STUDENT,
        message: 'Account (' + email + ') is not registered in the student database'
      }
    };
  }

  return {
    authorized: true,
    studentRecord: studentRecord
  };
}
