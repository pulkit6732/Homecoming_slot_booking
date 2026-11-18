import {
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import type { AuthUser } from './authTypes'
import { AuthContext } from './authContextInstance'
import { isDevMockAuthEnabled } from './authEnv.ts'
import {
  supabase,
  isSupabaseConfigured,
} from '../services/supabaseClient'
import { mockStorage } from '../services/mockStorage.ts'

const AUTH_STORAGE_KEY = 'gitam_auth_session_v1'

// Explicit development admin identifiers for isolated dev testing only
const DEV_AUTHORIZED_ADMINS = ['admin@gitam.in', 'placement@gitam.in', 'placement.homecoming2026@gitam.in']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Resolve user role & profile based on identifier (isolated to development mock mode only)
  const resolveStudentFromIdentifier = (identifier: string) => {
    // In production builds, never resolve against mock storage or fabricate student profiles
    if (!isDevMockAuthEnabled) {
      return undefined
    }
    const cleanId = identifier.trim().toLowerCase()
    const all = mockStorage.getAllStudents()
    return all.find(
      (s) =>
        s.studentId.toLowerCase() === cleanId ||
        s.gitamEmail.toLowerCase() === cleanId ||
        s.personalEmail.toLowerCase() === cleanId,
    )
  }

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      setIsLoading(true)

      // 1. Production / Supabase session restoration (authoritative)
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession()
          if (data.session?.user?.email) {
            const userEmail = data.session.user.email.toLowerCase()
            const appRole = (data.session.user.app_metadata?.role || data.session.user.user_metadata?.role) as string | undefined

            if (appRole === 'admin') {
              setUser({
                id: data.session.user.id,
                email: userEmail,
                role: 'admin',
              })
            } else {
              const matchedStudent = resolveStudentFromIdentifier(userEmail)
              if (matchedStudent) {
                setUser({
                  id: data.session.user.id,
                  email: matchedStudent.gitamEmail,
                  role: 'student',
                  studentProfile: matchedStudent,
                })
              } else {
                setUser({
                  id: data.session.user.id,
                  email: userEmail,
                  role: 'unregistered',
                })
              }
            }
            setIsLoading(false)
            return
          }
        } catch {
          // Fall through to unauthenticated state
        }
      }

      // 2. Production Build Check: NEVER trust localStorage as authentication authority
      if (!isDevMockAuthEnabled) {
        // Clear any lingering dev session key in production
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY)
        } catch {
          // ignore
        }
        setUser(null)
        setIsLoading(false)
        return
      }

      // 3. Isolated Development Mock Mode Session Restoration
      try {
        const cached = localStorage.getItem(AUTH_STORAGE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          // Anti-tampering check: Never restore admin role from localStorage unless verified against dev admin list
          if (parsed?.role === 'admin') {
            const parsedEmail = String(parsed.email || '').trim().toLowerCase()
            if (DEV_AUTHORIZED_ADMINS.includes(parsedEmail)) {
              setUser({
                id: parsed.id || 'admin-session',
                email: parsedEmail,
                role: 'admin',
              })
            } else {
              // Tampered role detected: reject and clear
              localStorage.removeItem(AUTH_STORAGE_KEY)
              setUser(null)
            }
          } else if (parsed?.role === 'student' && parsed?.studentProfile?.studentId) {
            const freshStudent = mockStorage.getStudentById(parsed.studentProfile.studentId)
            if (freshStudent) {
              setUser({
                id: freshStudent.studentId,
                email: freshStudent.gitamEmail,
                role: 'student',
                studentProfile: freshStudent,
              })
            } else {
              localStorage.removeItem(AUTH_STORAGE_KEY)
              setUser(null)
            }
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
  const login = async (identifier: string, password?: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    const cleanIdentifier = identifier.trim()
    const cleanPassword = password ? password.trim() : ''

    if (!cleanIdentifier || !cleanPassword) {
      setError('Identifier and password are required.')
      setIsLoading(false)
      return false
    }

    // 1. Supabase Authentication Path (Primary & Production Authority)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error: sbError } = await supabase.auth.signInWithPassword({
          email: cleanIdentifier.toLowerCase(),
          password: cleanPassword,
        })

        if (sbError) {
          setError(sbError.message)
          setIsLoading(false)
          return false
        }

        if (data.user?.email) {
          const userEmail = data.user.email.toLowerCase()
          const appRole = (data.user.app_metadata?.role || data.user.user_metadata?.role) as string | undefined

          if (appRole === 'admin') {
            const adminUser: AuthUser = {
              id: data.user.id,
              email: userEmail,
              role: 'admin',
            }
            setUser(adminUser)
            setIsLoading(false)
            return true
          }

          const matchedStudent = resolveStudentFromIdentifier(userEmail)
          if (matchedStudent) {
            const studentUser: AuthUser = {
              id: data.user.id,
              email: matchedStudent.gitamEmail,
              role: 'student',
              studentProfile: matchedStudent,
            }
            setUser(studentUser)
            setIsLoading(false)
            return true
          }

          const unregUser: AuthUser = {
            id: data.user.id,
            email: userEmail,
            role: 'unregistered',
          }
          setUser(unregUser)
          setIsLoading(false)
          return false
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Authentication failed.'
        setError(msg)
        setIsLoading(false)
        return false
      }
    }

    // 2. Production Mode Block: Disable mock authentication completely in production
    if (!isDevMockAuthEnabled) {
      setError('Mock authentication is disabled in production builds. Institutional authentication via Supabase is required.')
      setIsLoading(false)
      return false
    }

    // 3. Isolated Development Mock Authentication (Explicitly enabled dev mode only)
    const lowerIdent = cleanIdentifier.toLowerCase()

    // Dev Admin Check
    if (DEV_AUTHORIZED_ADMINS.includes(lowerIdent)) {
      if (cleanPassword.length < 6) {
        setError('Invalid credentials provided. Please check your identifier and password.')
        setIsLoading(false)
        return false
      }

      const adminUser: AuthUser = {
        id: `DEV-ADMIN-${Date.now()}`,
        email: lowerIdent,
        role: 'admin',
      }
      setUser(adminUser)
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(adminUser))
      } catch {
        // ignore
      }
      setIsLoading(false)
      return true
    }

    // Dev Registered Student Check
    const matchedStudent = resolveStudentFromIdentifier(cleanIdentifier)
    if (!matchedStudent) {
      setError('Invalid credentials provided. Student record not found in registration database.')
      setIsLoading(false)
      return false
    }

    if (cleanPassword.length < 6) {
      setError('Invalid credentials provided. Please check your identifier and password.')
      setIsLoading(false)
      return false
    }

    const studentUser: AuthUser = {
      id: matchedStudent.studentId,
      email: matchedStudent.gitamEmail,
      role: 'student',
      studentProfile: matchedStudent,
    }
    setUser(studentUser)
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(studentUser))
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
