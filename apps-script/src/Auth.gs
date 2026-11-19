/**
 * Google Apps Script Backend - Authentication and Identity Validation
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Security architecture: Strict server-side validation of Supabase-issued identity tokens.
 * Fail-closed signature verification.
 * Standard claim validation: alg, exp, sub, aud, iss, verified email.
 * Server-authoritative admin allowlist in Script Properties.
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
 * Constant-time string equality check to mitigate timing side-channel attacks on signatures.
 * @param {string} a
 * @param {string} b
 * @return {boolean}
 */
function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates a Supabase-issued JWT token.
 * 
 * Strict Cryptographic & Claims Validation:
 * 1. Split token into [header, payload, signature].
 * 2. Validate header: alg must be supported (HS256, RS256, ES256) and never 'none'.
 * 3. Validate claims:
 *    - exp: mandatory numeric future timestamp (fails if missing or expired)
 *    - sub: mandatory non-empty subject ID
 *    - aud: mandatory, must match 'authenticated' (or configured expected audience)
 *    - iss: mandatory, must match SUPABASE_ISSUER if configured
 *    - email: mandatory verified email
 * 4. Cryptographic signature check:
 *    - FAILS CLOSED if SUPABASE_JWT_SECRET / SUPABASE_PUBLIC_KEY is missing.
 *    - Rejects invalid signatures immediately.
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

  // 1. Decode & Validate Header
  var headerStr;
  var header;
  try {
    headerStr = decodeBase64Url(parts[0]);
    header = JSON.parse(headerStr);
  } catch (err) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Invalid JWT header format' }
    };
  }

  if (!header || !header.alg || header.alg.toLowerCase() === 'none') {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID_ALGORITHM, message: 'Unsecured or missing algorithm in token header' }
    };
  }

  var allowedAlgorithms = ['HS256', 'RS256', 'ES256'];
  if (allowedAlgorithms.indexOf(header.alg.toUpperCase()) === -1) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID_ALGORITHM, message: 'Unsupported token algorithm: ' + header.alg }
    };
  }

  // 2. Decode & Validate Payload Claims
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

  // Expiry (exp) claim: mandatory and must be strictly in the future
  if (payload.exp === undefined || payload.exp === null || typeof payload.exp !== 'number') {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_MISSING_EXPIRY, message: 'Token missing mandatory exp claim' }
    };
  }

  var nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSeconds) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_EXPIRED, message: 'Authentication token has expired' }
    };
  }

  // Subject (sub) claim: mandatory non-empty string
  if (!payload.sub || typeof payload.sub !== 'string' || !payload.sub.trim()) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID_SUBJECT, message: 'Token missing mandatory sub claim' }
    };
  }

  // Audience (aud) claim: mandatory
  var expectedAudience = getScriptProperty('SUPABASE_AUDIENCE', 'authenticated');
  if (!payload.aud || (payload.aud !== expectedAudience && payload.aud !== 'authenticated')) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID_AUDIENCE, message: 'Invalid token audience: expected ' + expectedAudience }
    };
  }

  // Issuer (iss) claim: mandatory validation if configured
  var expectedIssuer = getScriptProperty('SUPABASE_ISSUER', '');
  if (!expectedIssuer) {
    var sbUrl = getScriptProperty('SUPABASE_URL', '');
    if (sbUrl) {
      expectedIssuer = sbUrl.replace(/\/+$/, '') + '/auth/v1';
    }
  }

  if (expectedIssuer) {
    if (!payload.iss || payload.iss !== expectedIssuer) {
      return {
        valid: false,
        error: { code: CONFIG.ERROR_CODES.AUTH_INVALID_ISSUER, message: 'Invalid token issuer: expected ' + expectedIssuer }
      };
    }
  } else if (!payload.iss) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID_ISSUER, message: 'Token missing mandatory iss claim' }
    };
  }

  // Email claim & verification status
  // Server-authoritative: email must be a top-level claim, NOT user_metadata
  var email = payload.email || '';
  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Token contains no authenticated email' }
    };
  }

  // Server-authoritative email verification check:
  // user_metadata.email_verified is client-editable in Supabase and MUST NOT be trusted.
  // We only trust server-stamped email_confirmed_at or server-controlled app_metadata.
  var isEmailVerified = false;
  if (payload.email_confirmed_at && typeof payload.email_confirmed_at === 'string') {
    isEmailVerified = true;
  } else if (payload.app_metadata && (payload.app_metadata.provider === 'google' || payload.app_metadata.provider === 'sso' || payload.app_metadata.provider === 'saml')) {
    isEmailVerified = true;
  }

  if (!isEmailVerified) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_UNVERIFIED_EMAIL, message: 'Account email has not been verified by authoritative identity provider' }
    };
  }

  // 3. Cryptographic Signature Verification (Strict Fail-Closed)
  var alg = header.alg.toUpperCase();
  if (alg === 'HS256') {
    var jwtSecret = getScriptProperty('SUPABASE_JWT_SECRET', '');
    if (!jwtSecret) {
      return {
        valid: false,
        error: {
          code: CONFIG.ERROR_CODES.AUTH_CONFIG_MISSING,
          message: 'Server token signing configuration is missing. Refusing unverified request.'
        }
      };
    }

    var signedContent = parts[0] + '.' + parts[1];
    var computedSignatureBytes = Utilities.computeHmacSha256Signature(signedContent, jwtSecret);
    var computedSignatureB64 = Utilities.base64EncodeWebSafe(computedSignatureBytes).replace(/=/g, '');
    var incomingSignatureB64 = parts[2].replace(/=/g, '');

    // Constant-time string comparison to prevent timing side-channel attacks
    if (!constantTimeEquals(computedSignatureB64, incomingSignatureB64)) {
      return {
        valid: false,
        error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Invalid token signature' }
      };
    }
  } else if (alg === 'RS256' || alg === 'ES256') {
    // Google Apps Script runtime does not natively support RSA/ECDSA public-key verification.
    // When configured with SUPABASE_URL and SUPABASE_ANON_KEY, verify online via Supabase auth service.
    var supabaseAuthUrl = getScriptProperty('SUPABASE_URL', '');
    var supabaseAnonKey = getScriptProperty('SUPABASE_ANON_KEY', '');
    
    if (supabaseAuthUrl && supabaseAnonKey) {
      try {
        var verifyEndpoint = supabaseAuthUrl.replace(/\/+$/, '') + '/auth/v1/user';
        var verifyResp = UrlFetchApp.fetch(verifyEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + token,
            'apikey': supabaseAnonKey
          },
          muteHttpExceptions: true
        });

        if (verifyResp.getResponseCode() !== 200) {
          return {
            valid: false,
            error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Supabase identity service rejected token' }
          };
        }

        var verifiedUser = JSON.parse(verifyResp.getContentText());
        if (!verifiedUser || verifiedUser.id !== payload.sub) {
          return {
            valid: false,
            error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Token subject mismatch with identity service' }
          };
        }
      } catch (networkErr) {
        return {
          valid: false,
          error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Failed to contact Supabase identity service: ' + networkErr.message }
        };
      }
    } else {
      // Strict fail-closed: Never accept unverified asymmetric JWT without verification endpoint
      return {
        valid: false,
        error: {
          code: CONFIG.ERROR_CODES.AUTH_INVALID_ALGORITHM,
          message: 'Asymmetric token algorithm ' + alg + ' cannot be verified offline. Configure SUPABASE_JWT_SECRET with HS256, or provide SUPABASE_URL and SUPABASE_ANON_KEY for online verification.'
        }
      };
    }
  } else {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID_ALGORITHM, message: 'Unsupported token algorithm: ' + alg }
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
 * Authoritative source: ADMIN_EMAILS script property on Google Apps Script server.
 * 
 * @param {string} email
 * @return {boolean}
 */
function isAuthorizedAdmin(email) {
  if (!email || typeof email !== 'string') return false;
  var cleanEmail = email.trim().toLowerCase();
  
  var adminConfig = getScriptProperty('ADMIN_EMAILS', '');
  if (!adminConfig || !adminConfig.trim()) {
    // Fail-closed: Zero administrators authorized if ADMIN_EMAILS script property is missing or unconfigured
    return false;
  }

  // Authoritative server allowlist: supports designated equal administrators
  var allowlist = adminConfig
    .split(',')
    .map(function(e) { return e.trim().toLowerCase(); })
    .filter(Boolean);

  for (var i = 0; i < allowlist.length; i++) {
    if (allowlist[i] === cleanEmail) {
      return true;
    }
  }
  return false;
}

/**
 * Validates admin request credentials.
 * Every administrative endpoint verifies credentials independently.
 * 
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
 * Strictly checks against the Student Database sheet on the backend.
 * Never trusts client-supplied StudentID, email, or unauthenticated parameters.
 * Requires a cryptographically verified Supabase JWT token with verified email.
 * 
 * @param {string} token Cryptographically signed Supabase identity token
 * @return {{ authorized: boolean, studentRecord?: Object, error?: Object }}
 */
function authenticateStudent(token) {
  var authResult = validateSupabaseToken(token);
  if (!authResult.valid) {
    return { authorized: false, error: authResult.error };
  }

  var email = authResult.user.email;
  var studentRecord = null;
  try {
    studentRecord = getStudentRecordByEmail(email);
  } catch (dbErr) {
    return {
      authorized: false,
      error: {
        code: CONFIG.ERROR_CODES.INTERNAL_ERROR,
        message: 'Student registration database is currently unavailable: ' + (dbErr.message || String(dbErr))
      }
    };
  }
  if (!studentRecord) {
    return {
      authorized: false,
      error: {
        code: CONFIG.ERROR_CODES.UNREGISTERED_STUDENT,
        message: 'Account (' + email + ') is not registered in the student database'
      }
    };
  }

  if (studentRecord.isAmbiguous) {
    return {
      authorized: false,
      error: {
        code: 'AMBIGUOUS_STUDENT_RECORD',
        message: 'Multiple registrations were found for (' + email + '). Please contact the university administrator to resolve the ambiguity before booking.'
      }
    };
  }

  return {
    authorized: true,
    studentRecord: studentRecord
  };
}

/**
 * Checks whether an email address belongs to an eligible student in the official database.
 * Strictly used to gate passwordless OTP generation: only registered candidates may proceed.
 * 
 * @param {string} email
 * @return {Object} Standardized result payload
 */
function checkStudentEligibility(email) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Email address is required');
  }

  var studentRecord = null;
  try {
    studentRecord = getStudentRecordByEmail(email.trim());
  } catch (err) {
    return errorPayload(
      CONFIG.ERROR_CODES.INTERNAL_ERROR,
      'Student registration database is currently unavailable: ' + (err.message || String(err))
    );
  }

  if (!studentRecord) {
    return errorPayload(
      CONFIG.ERROR_CODES.UNREGISTERED_STUDENT,
      'This email address (' + email.trim() + ') is not registered in the student database. Only registered students are eligible to sign in.'
    );
  }

  if (studentRecord.isAmbiguous) {
    return errorPayload(
      'AMBIGUOUS_STUDENT_RECORD',
      'Multiple registrations were found for (' + email.trim() + '). Please contact the university administrator to resolve the ambiguity.'
    );
  }

  return successPayload({
    eligible: true,
    email: email.trim().toLowerCase()
  });
}

/**
 * Retrieves the authenticated student's own profile using verified Supabase JWT.
 * Validates token claims, expiry, and email verification.
 * 
 * @param {string} token Supabase identity token
 * @return {Object} Standardized result payload
 */
function getStudentProfile(token) {
  var studentAuth = authenticateStudent(token);
  if (!studentAuth.authorized) {
    return errorPayload(studentAuth.error.code, studentAuth.error.message);
  }

  return successPayload(studentAuth.studentRecord);
}

/**
 * Student Email-Only Login:
 * Authenticates a candidate via their registered institutional or personal email address.
 * Backend verifies against the official student registration database.
 * If registered, returns their student profile immediately.
 * If unregistered, returns "This email is not registered. Access denied."
 * If ambiguous, returns "Multiple registration records match this email address. Please contact the university placement office."
 * 
 * Note: Email-only access does not verify identity/email ownership per explicit specification.
 * 
 * @param {string} email
 * @return {Object} Standardized result payload
 */
function studentLoginByEmail(email) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    return errorPayload(CONFIG.ERROR_CODES.MISSING_PARAMETER, 'Email address is required');
  }

  var normalizedEmail = email.trim().toLowerCase();
  var studentRecord = null;
  try {
    studentRecord = getStudentRecordByEmail(normalizedEmail);
  } catch (err) {
    return errorPayload(
      CONFIG.ERROR_CODES.INTERNAL_ERROR,
      'Student registration database is currently unavailable: ' + (err.message || String(err))
    );
  }

  if (!studentRecord) {
    return errorPayload(
      CONFIG.ERROR_CODES.UNREGISTERED_STUDENT,
      'This email is not registered. Access denied.'
    );
  }

  if (studentRecord.isAmbiguous) {
    return errorPayload(
      'AMBIGUOUS_STUDENT_RECORD',
      'Multiple registration records match this email address. Please contact the university placement office.'
    );
  }

  // Return minimal required student session info without exposing master sheet
  return successPayload({
    studentId: studentRecord.studentId || studentRecord['Student ID'] || '',
    fullName: studentRecord.fullName || studentRecord['Name'] || studentRecord['Full Name'] || '',
    gitamEmail: studentRecord.gitamEmail || studentRecord['GITAM Email Address'] || studentRecord['Email Address'] || normalizedEmail,
    personalEmail: studentRecord.personalEmail || studentRecord['Personal Email Address'] || '',
    registrationNumber: studentRecord.registrationNumber || studentRecord['Registration Number'] || '',
    rollNumber: studentRecord.rollNumber || studentRecord['Roll Number'] || '',
    branch: studentRecord.branch || studentRecord['Branch'] || '',
    yearOfPassing: studentRecord.yearOfPassing || studentRecord['Passout Year'] || studentRecord['Graduation Year'] || 2026,
    bookingStatus: studentRecord.bookingStatus || studentRecord['Booking Status'] || 'Not Booked',
    bookedDate: studentRecord.bookedDate || studentRecord['Booked Date'] || '',
    bookedSlotStart: studentRecord.bookedSlotStart || studentRecord['Booked Slot Time'] || '',
    bookedSlotEnd: studentRecord.bookedSlotEnd || '',
    bookingId: studentRecord.bookingId || studentRecord['Booking ID'] || '',
    approvalStatus: studentRecord.approvalStatus || studentRecord['Approval Status'] || 'Pending',
    reviewFlag: studentRecord.reviewFlag || studentRecord['Review Flag Status'] || 'Not Flagged'
  });
}
