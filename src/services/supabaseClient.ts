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

/**
 * Server-authoritative admin policy:
 * Administrative permissions are verified strictly server-side on Google Apps Script
 * via script properties or secure backend configuration.
 * The frontend client does NOT define an authoritative allowlist.
 */

