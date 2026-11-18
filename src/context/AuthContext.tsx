import {
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import type { AuthUser } from './authTypes'
import { AuthContext } from './authContextInstance'
import {
  supabase,
  isSupabaseConfigured,
  isEmailAuthorizedAdmin,
} from '../services/supabaseClient'
import { mockStorage } from '../services/mockStorage.ts'

const AUTH_STORAGE_KEY = 'gitam_auth_session_v1'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Resolve user role & profile based on email
  const resolveUserFromEmail = (email: string, id: string): AuthUser => {
    const trimmedEmail = email.trim().toLowerCase()

    // 1. Check if user is in Admin allowlist
    if (isEmailAuthorizedAdmin(trimmedEmail)) {
      return {
        id,
        email: trimmedEmail,
        role: 'admin',
      }
    }

    // 2. Check if user is registered in the Student Database
    const matchedStudent = mockStorage.getStudentByEmail(trimmedEmail)
    if (matchedStudent) {
      return {
        id,
        email: trimmedEmail,
        role: 'student',
        studentProfile: matchedStudent,
      }
    }

    // 3. Authenticated but unregistered in student database
    return {
      id,
      email: trimmedEmail,
      role: 'unregistered',
    }
  }

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      setIsLoading(true)

      // A. If Supabase is configured, check active Supabase session
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession()
          if (data.session?.user?.email) {
            const resolved = resolveUserFromEmail(
              data.session.user.email,
              data.session.user.id,
            )
            setUser(resolved)
            setIsLoading(false)
            return
          }
        } catch {
          // Fall through to local session check
        }
      }

      // B. Check local session storage (for dev & mock mode)
      try {
        const cached = localStorage.getItem(AUTH_STORAGE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed?.email) {
            const resolved = resolveUserFromEmail(
              parsed.email,
              parsed.id || 'sim-user',
            )
            setUser(resolved)
          }
        }
      } catch {
        // Storage unavailable
      }

      setIsLoading(false)
    }

    restoreSession()
  }, [])

  // Login handler
  const login = async (email: string, password?: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    const cleanEmail = email.trim().toLowerCase()

    // Real Supabase Auth path (if configured and password provided)
    if (isSupabaseConfigured && supabase && password) {
      try {
        const { data, error: sbError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

        if (sbError) {
          setError(sbError.message)
          setIsLoading(false)
          return false
        }

        if (data.user?.email) {
          const resolved = resolveUserFromEmail(data.user.email, data.user.id)
          setUser(resolved)
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(resolved))
          setIsLoading(false)
          return true
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Authentication failed.'
        setError(msg)
        setIsLoading(false)
        return false
      }
    }

    // Simulation / Quick-login path (for dev & testing phase 3)
    const simulatedId = `USR-${Date.now().toString(36)}`
    const resolved = resolveUserFromEmail(cleanEmail, simulatedId)
    setUser(resolved)
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(resolved))
    } catch {
      // ignore
    }

    setIsLoading(false)
    return true
  }

  // Logout handler
  const logout = async () => {
    setIsLoading(true)
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut()
      } catch {
        // ignore
      }
    }

    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // ignore
    }

    setUser(null)
    setError(null)
    setIsLoading(false)
  }

  const clearError = () => setError(null)

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
