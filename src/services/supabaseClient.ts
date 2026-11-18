import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const globalProcess = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process

const env: Record<string, string | undefined> =
  typeof import.meta !== 'undefined' &&
  typeof (import.meta as unknown as { env?: Record<string, string> }).env !== 'undefined'
    ? (import.meta as unknown as { env: Record<string, string> }).env
    : (globalProcess?.env || {})

const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey.length > 20,
)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

const rawAdminEmails =
  (env.VITE_ADMIN_EMAILS as string | undefined) ||
  'admin@gitam.in,pulkitsrivastavae@gmail.com'

export const ADMIN_EMAILS_ALLOWLIST: string[] = rawAdminEmails
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export function isEmailAuthorizedAdmin(email: string | undefined | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS_ALLOWLIST.includes(email.trim().toLowerCase())
}
