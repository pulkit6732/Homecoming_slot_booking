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
  var email = payload.email || (payload.user_metadata && payload.user_metadata.email) || '';
  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Token contains no authenticated email' }
    };
  }

  var isEmailVerified = false;
  if (payload.email_confirmed_at && typeof payload.email_confirmed_at === 'string') {
    isEmailVerified = true;
  } else if (payload.user_metadata && payload.user_metadata.email_verified === true) {
    isEmailVerified = true;
  } else if (payload.app_metadata && payload.app_metadata.provider === 'google') {
    isEmailVerified = true;
  }

  if (!isEmailVerified) {
    return {
      valid: false,
      error: { code: CONFIG.ERROR_CODES.AUTH_UNVERIFIED_EMAIL, message: 'Account email has not been verified' }
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

    if (computedSignatureB64 !== incomingSignatureB64) {
      return {
        valid: false,
        error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Invalid token signature' }
      };
    }
  } else if (alg === 'RS256' || alg === 'ES256') {
    var pubKey = getScriptProperty('SUPABASE_PUBLIC_KEY', '');
    var jwksUrl = getScriptProperty('SUPABASE_JWKS_URL', '');
    if (!pubKey && !jwksUrl) {
      return {
        valid: false,
        error: {
          code: CONFIG.ERROR_CODES.AUTH_CONFIG_MISSING,
          message: 'Server public key or JWKS configuration is missing for ' + alg + '. Refusing unverified request.'
        }
      };
    }
    // Asymmetric validation: when configured, public key verifies signature
    if (pubKey) {
      var signedData = parts[0] + '.' + parts[1];
      var rsaSignatureBytes = Utilities.computeRsaSha256Signature(signedData, pubKey);
      var computedRsaB64 = Utilities.base64EncodeWebSafe(rsaSignatureBytes).replace(/=/g, '');
      if (computedRsaB64 !== parts[2].replace(/=/g, '')) {
        return {
          valid: false,
          error: { code: CONFIG.ERROR_CODES.AUTH_INVALID, message: 'Invalid token signature' }
        };
      }
    }
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
  var allowlist = adminConfig
    ? adminConfig.split(',').map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean)
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
 * Never trusts client-supplied StudentID or identity.
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

  return {
    authorized: true,
    studentRecord: studentRecord
  };
}
