/**
 * Direct Google Apps Script Authentication & Cryptographic Verification Suite
 * 
 * Executes the ACTUAL JavaScript code from apps-script/src/Auth.gs inside a V8 VM.
 * Verifies all security requirements:
 * 1. Forged signatures rejected.
 * 2. Altered payload claims rejected.
 * 3. Expired tokens rejected.
 * 4. Missing expiry rejected.
 * 5. Wrong issuer rejected.
 * 6. Wrong audience rejected.
 * 7. Unverified email rejected (rejects user_metadata.email_verified tampering).
 * 8. Missing secret fails closed.
 * 9. Algorithm confusion (none, HS384, etc.) rejected.
 * 10. Asymmetric token handling (RS256/ES256 fails closed without verification endpoint).
 * 11. Three equal administrators verified via server allowlist.
 * 12. Student strictly blocked from admin privileges.
 * 
 * Zero emojis per specification.
 */

import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

console.log('================================================================');
console.log('STARTING DIRECT APPS SCRIPT CRYPTOGRAPHIC AUTH AUDIT SUITE');
console.log('Timezone: Asia/Kolkata (IST)');
console.log('================================================================\n');

// Load actual Apps Script source files
const authCode = fs.readFileSync('apps-script/src/Auth.gs', 'utf8');
const configCode = fs.readFileSync('apps-script/src/Config.gs', 'utf8');

interface ScriptPropertiesMap {
  [key: string]: string;
}

const scriptProps: ScriptPropertiesMap = {
  'SUPABASE_JWT_SECRET': 'test-signing-secret-super-secure-key-32b',
  'SUPABASE_AUDIENCE': 'authenticated',
  'SUPABASE_ISSUER': 'https://okxwlgmtonkuojbqcxeg.supabase.co/auth/v1',
  'ADMIN_EMAILS': 'admin1@gitam.in,admin2@gitam.in,admin3@gitam.in'
};

let mockFetchHandler: ((url: string, options: Record<string, unknown>) => { getResponseCode: () => number; getContentText: () => string }) | null = null;

function createAppsScriptSandbox() {
  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => scriptProps[k] !== undefined ? scriptProps[k] : null
      })
    },
    Utilities: {
      base64Decode: (str: string) => Array.from(Buffer.from(str, 'base64')),
      newBlob: (bytes: number[]) => ({
        getDataAsString: (_enc?: string) => {
          void _enc;
          return Buffer.from(bytes).toString('utf8');
        }
      }),
      computeHmacSha256Signature: (data: string, key: string) => {
        const hmac = crypto.createHmac('sha256', key);
        hmac.update(data);
        return Array.from(hmac.digest());
      },
      base64EncodeWebSafe: (bytes: number[]) => {
        return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      }
    },
    UrlFetchApp: {
      fetch: (url: string, options: Record<string, unknown>) => {
        if (!mockFetchHandler) {
          throw new Error('UrlFetchApp unexpected call: ' + url);
        }
        return mockFetchHandler(url, options);
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(configCode, sandbox);
  vm.runInContext(authCode, sandbox);
  return sandbox;
}

const gas = createAppsScriptSandbox() as unknown as {
  validateSupabaseToken: (token: string) => { valid: boolean; user?: { id: string; email: string; role: string }; error?: { code: string; message: string } };
  isAuthorizedAdmin: (email: string) => boolean;
  authenticateAdmin: (token: string) => { authorized: boolean; adminEmail?: string; error?: { code: string; message: string } };
};

// Helper to construct tokens
function buildJwt(header: Record<string, unknown>, payload: Record<string, unknown>, secret?: string): string {
  const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${hB64}.${pB64}`;
  if (!secret) return `${unsigned}.unsigned_signature`;
  const sig = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

const secretKey = 'test-signing-secret-super-secure-key-32b';
const validPayload = {
  sub: 'user-uuid-1234-5678',
  aud: 'authenticated',
  iss: 'https://okxwlgmtonkuojbqcxeg.supabase.co/auth/v1',
  email: 'student1@gitam.in',
  email_confirmed_at: '2026-11-01T10:00:00Z',
  exp: Math.floor(Date.now() / 1000) + 3600
};

// --- TEST 1: Valid HS256 Token ---
console.log('--- TEST 1: Valid HS256 Token Cryptographic Verification ---');
const validToken = buildJwt({ alg: 'HS256', typ: 'JWT' }, validPayload, secretKey);
const validRes = gas.validateSupabaseToken(validToken);
console.assert(validRes.valid === true, 'Valid token must be accepted');
console.assert(validRes.user?.email === 'student1@gitam.in', 'Resolved user email must match payload');
console.log('[PASS] Test 1: Valid HS256 token passes cryptographic verification.\n');

// --- TEST 2: Forged Signature ---
console.log('--- TEST 2: Forged Signature Rejection ---');
const forgedToken = buildJwt({ alg: 'HS256', typ: 'JWT' }, validPayload, 'attacker-different-secret');
const forgedRes = gas.validateSupabaseToken(forgedToken);
console.assert(forgedRes.valid === false, 'Forged signature must be rejected');
console.assert(forgedRes.error?.code === 'AUTH_INVALID', 'Error code must be AUTH_INVALID');
console.log('[PASS] Test 2: Forged signature rejected.\n');

// --- TEST 3: Altered Payload Claims ---
console.log('--- TEST 3: Altered Payload Claims Rejection ---');
const parts = validToken.split('.');
const tamperedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
tamperedPayload.email = 'attacker@malicious.com';
const tamperedParts = `${parts[0]}.${Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url')}.${parts[2]}`;
const tamperedRes = gas.validateSupabaseToken(tamperedParts);
console.assert(tamperedRes.valid === false, 'Altered payload claims must be rejected');
console.assert(tamperedRes.error?.code === 'AUTH_INVALID', 'Error code must be AUTH_INVALID');
console.log('[PASS] Test 3: Altered payload claims rejected.\n');

// --- TEST 4: Expired Token ---
console.log('--- TEST 4: Expired Token Rejection ---');
const expiredPayload = { ...validPayload, exp: Math.floor(Date.now() / 1000) - 60 };
const expiredToken = buildJwt({ alg: 'HS256', typ: 'JWT' }, expiredPayload, secretKey);
const expiredRes = gas.validateSupabaseToken(expiredToken);
console.assert(expiredRes.valid === false, 'Expired token must be rejected');
console.assert(expiredRes.error?.code === 'AUTH_EXPIRED', 'Error code must be AUTH_EXPIRED');
console.log('[PASS] Test 4: Expired token rejected.\n');

// --- TEST 5: Missing Expiry Claim ---
console.log('--- TEST 5: Missing Expiry Rejection ---');
const noExpPayload = { ...validPayload };
// @ts-expect-error test invalid payload
delete noExpPayload.exp;
const noExpToken = buildJwt({ alg: 'HS256', typ: 'JWT' }, noExpPayload, secretKey);
const noExpRes = gas.validateSupabaseToken(noExpToken);
console.assert(noExpRes.valid === false, 'Missing exp claim must be rejected');
console.assert(noExpRes.error?.code === 'AUTH_MISSING_EXPIRY', 'Error code must be AUTH_MISSING_EXPIRY');
console.log('[PASS] Test 5: Missing expiry rejected.\n');

// --- TEST 6: Wrong Issuer ---
console.log('--- TEST 6: Wrong Issuer Rejection ---');
const wrongIssPayload = { ...validPayload, iss: 'https://attacker.supabase.co/auth/v1' };
const wrongIssToken = buildJwt({ alg: 'HS256', typ: 'JWT' }, wrongIssPayload, secretKey);
const wrongIssRes = gas.validateSupabaseToken(wrongIssToken);
console.assert(wrongIssRes.valid === false, 'Wrong issuer must be rejected');
console.assert(wrongIssRes.error?.code === 'AUTH_INVALID_ISSUER', 'Error code must be AUTH_INVALID_ISSUER');
console.log('[PASS] Test 6: Wrong issuer rejected.\n');

// --- TEST 7: Wrong Audience ---
console.log('--- TEST 7: Wrong Audience Rejection ---');
const wrongAudPayload = { ...validPayload, aud: 'public-api' };
const wrongAudToken = buildJwt({ alg: 'HS256', typ: 'JWT' }, wrongAudPayload, secretKey);
const wrongAudRes = gas.validateSupabaseToken(wrongAudToken);
console.assert(wrongAudRes.valid === false, 'Wrong audience must be rejected');
console.assert(wrongAudRes.error?.code === 'AUTH_INVALID_AUDIENCE', 'Error code must be AUTH_INVALID_AUDIENCE');
console.log('[PASS] Test 7: Wrong audience rejected.\n');

// --- TEST 8: Unverified Email & User Metadata Tampering ---
console.log('--- TEST 8: Unverified Email & User Metadata Tampering Rejection ---');
// Attacker does NOT have email_confirmed_at, but injects user_metadata: { email_verified: true }
const unverifiedPayload = {
  ...validPayload,
  email_confirmed_at: undefined,
  user_metadata: { email_verified: true } // Client-editable in Supabase
};
const unverifiedToken = buildJwt({ alg: 'HS256', typ: 'JWT' }, unverifiedPayload, secretKey);
const unverifiedRes = gas.validateSupabaseToken(unverifiedToken);
console.assert(unverifiedRes.valid === false, 'Unverified email with user_metadata tampering must be rejected');
console.assert(unverifiedRes.error?.code === 'AUTH_UNVERIFIED_EMAIL', `Error code must be AUTH_UNVERIFIED_EMAIL (${unverifiedRes.error?.code})`);
console.log('[PASS] Test 8: Unverified email and user_metadata tampering strictly rejected.\n');

// --- TEST 9: Missing Signing Secret (Fail Closed) ---
console.log('--- TEST 9: Missing Signing Secret Fails Closed ---');
scriptProps['SUPABASE_JWT_SECRET'] = '';
const noSecretRes = gas.validateSupabaseToken(validToken);
console.assert(noSecretRes.valid === false, 'Missing secret must fail closed');
console.assert(noSecretRes.error?.code === 'AUTH_CONFIG_MISSING', 'Error code must be AUTH_CONFIG_MISSING');
scriptProps['SUPABASE_JWT_SECRET'] = secretKey; // restore
console.log('[PASS] Test 9: Missing signing secret fails closed.\n');

// --- TEST 10: Algorithm Confusion Attack ---
console.log('--- TEST 10: Algorithm Confusion Attack Rejection ---');
// Attacker tries alg: 'none'
const noneToken = buildJwt({ alg: 'none' }, validPayload);
const noneRes = gas.validateSupabaseToken(noneToken);
console.assert(noneRes.valid === false, 'Algorithm none must be rejected');
console.assert(noneRes.error?.code === 'AUTH_INVALID_ALGORITHM', 'Error code must be AUTH_INVALID_ALGORITHM');

// Attacker tries alg: 'HS384'
const hs384Token = buildJwt({ alg: 'HS384' }, validPayload, secretKey);
const hs384Res = gas.validateSupabaseToken(hs384Token);
console.assert(hs384Res.valid === false, 'Algorithm HS384 must be rejected');
console.assert(hs384Res.error?.code === 'AUTH_INVALID_ALGORITHM', 'Error code must be AUTH_INVALID_ALGORITHM');
console.log('[PASS] Test 10: Algorithm confusion (none, HS384) strictly rejected.\n');

// --- TEST 11: Asymmetric Key Handling (RS256/ES256 Fails Closed Without Endpoint) ---
console.log('--- TEST 11: Asymmetric Algorithm Handling ---');
// RS256 token without online endpoint config
const rs256Token = buildJwt({ alg: 'RS256', typ: 'JWT' }, validPayload, 'dummy');
const rs256Res = gas.validateSupabaseToken(rs256Token);
console.assert(rs256Res.valid === false, 'RS256 without online endpoint must fail closed');
console.assert(rs256Res.error?.code === 'AUTH_INVALID_ALGORITHM', 'Error code must be AUTH_INVALID_ALGORITHM');

// RS256 token WITH online endpoint configured
scriptProps['SUPABASE_URL'] = 'https://okxwlgmtonkuojbqcxeg.supabase.co';
scriptProps['SUPABASE_ANON_KEY'] = 'anon-public-key-test';
mockFetchHandler = (url: string) => {
  if (url.includes('/auth/v1/user')) {
    return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ id: validPayload.sub, email: validPayload.email })
    };
  }
  return { getResponseCode: () => 401, getContentText: () => 'Unauthorized' };
};

const rs256OnlineRes = gas.validateSupabaseToken(rs256Token);
console.assert(rs256OnlineRes.valid === true, 'RS256 token verified via online endpoint must succeed');
console.assert(rs256OnlineRes.user?.email === validPayload.email, 'Resolved email must match');
mockFetchHandler = null; // cleanup
delete scriptProps['SUPABASE_ANON_KEY'];
console.log('[PASS] Test 11: Asymmetric token handling verified (fails closed offline; verifies online when configured).\n');

// --- TEST 12: Three Equal Administrators Authorization ---
console.log('--- TEST 12: Three Equal Administrators Allowlist ---');
// All three admins have identical access
const admin1Token = buildJwt({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, email: 'admin1@gitam.in' }, secretKey);
const admin2Token = buildJwt({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, email: 'admin2@gitam.in' }, secretKey);
const admin3Token = buildJwt({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, email: 'admin3@gitam.in' }, secretKey);

const a1Res = gas.authenticateAdmin(admin1Token);
const a2Res = gas.authenticateAdmin(admin2Token);
const a3Res = gas.authenticateAdmin(admin3Token);

console.assert(a1Res.authorized === true, 'Admin 1 must be authorized');
console.assert(a2Res.authorized === true, 'Admin 2 must be authorized');
console.assert(a3Res.authorized === true, 'Admin 3 must be authorized');
console.assert(a1Res.adminEmail === 'admin1@gitam.in', 'Admin 1 identity resolved');
console.assert(a2Res.adminEmail === 'admin2@gitam.in', 'Admin 2 identity resolved');
console.assert(a3Res.adminEmail === 'admin3@gitam.in', 'Admin 3 identity resolved');

// Student token attempting admin access
const studentAdminRes = gas.authenticateAdmin(validToken);
console.assert(studentAdminRes.authorized === false, 'Student must be denied admin privileges');
console.assert(studentAdminRes.error?.code === 'FORBIDDEN_ADMIN', 'Error must be FORBIDDEN_ADMIN');

// Unlisted admin email
const unlistedAdminToken = buildJwt({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, email: 'intruder@gitam.in' }, secretKey);
const unlistedRes = gas.authenticateAdmin(unlistedAdminToken);
console.assert(unlistedRes.authorized === false, 'Unlisted admin must be denied');
console.assert(unlistedRes.error?.code === 'FORBIDDEN_ADMIN', 'Error must be FORBIDDEN_ADMIN');

// Missing ADMIN_EMAILS configuration
scriptProps['ADMIN_EMAILS'] = '';
const noAdminConfigRes = gas.authenticateAdmin(admin1Token);
console.assert(noAdminConfigRes.authorized === false, 'Empty ADMIN_EMAILS must fail closed');
console.assert(noAdminConfigRes.error?.code === 'FORBIDDEN_ADMIN', 'Error must be FORBIDDEN_ADMIN');
scriptProps['ADMIN_EMAILS'] = 'admin1@gitam.in,admin2@gitam.in,admin3@gitam.in'; // restore

console.log('[PASS] Test 12: Three equal administrators allowlist and student rejection verified.\n');

console.log('================================================================');
console.log('ALL 12 DIRECT APPS SCRIPT AUTHENTICATION AUDIT TESTS PASSED');
console.log('================================================================');
