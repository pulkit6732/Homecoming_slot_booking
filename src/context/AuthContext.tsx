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

  // Resolve user role & profile based on identifier (email or studentId)
  const resolveStudentFromIdentifier = (identifier: string) => {
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

      // A. If Supabase is configured, check active Supabase session
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession()
          if (data.session?.user?.email) {
            const email = data.session.user.email.toLowerCase()
            if (isEmailAuthorizedAdmin(email)) {
              setUser({
                id: data.session.user.id,
                email,
                role: 'admin',
              })
            } else {
              const matchedStudent = resolveStudentFromIdentifier(email)
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
                  email,
                  role: 'unregistered',
                })
              }
            }
            setIsLoading(false)
            return
          }
        } catch {
          // Fall through to local session check
        }
      }

      // B. Check local session storage (dev & verified simulation)
      try {
        const cached = localStorage.getItem(AUTH_STORAGE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed?.role === 'admin' && isEmailAuthorizedAdmin(parsed.email)) {
            setUser({
              id: parsed.id || 'admin-session',
              email: parsed.email,
              role: 'admin',
            })
          } else if (parsed?.role === 'student' && parsed?.studentProfile?.studentId) {
            // Re-fetch fresh student profile from storage to guarantee data freshness
            const freshStudent = mockStorage.getStudentById(parsed.studentProfile.studentId)
            if (freshStudent) {
              setUser({
                id: parsed.id || freshStudent.studentId,
                email: freshStudent.gitamEmail,
                role: 'student',
                studentProfile: freshStudent,
              })
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

  // Strict Login handler with credential and password validation
  const login = async (identifier: string, password?: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    const cleanIdentifier = identifier.trim()
    const cleanPassword = password ? password.trim() : ''

    // 1. Password must be supplied
    if (!cleanPassword) {
      setError('Password is required. Please enter your credentials.')
      setIsLoading(false)
      return false
    }

    // 2. Real Supabase Auth path (if configured)
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
          if (isEmailAuthorizedAdmin(userEmail)) {
            const adminUser: AuthUser = {
              id: data.user.id,
              email: userEmail,
              role: 'admin',
            }
            setUser(adminUser)
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(adminUser))
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
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(studentUser))
            setIsLoading(false)
            return true
          }

          const unregUser: AuthUser = {
            id: data.user.id,
            email: userEmail,
            role: 'unregistered',
          }
          setUser(unregUser)
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(unregUser))
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

    // 3. Dedicated Database & Admin Authentication Path
    // A. Check Admin credentials
    const lowerIdent = cleanIdentifier.toLowerCase()
    if (isEmailAuthorizedAdmin(lowerIdent)) {
      if (cleanPassword !== 'Admin@Gitam2026') {
        setError('Invalid password for administrator account. Expected password for admin: Admin@Gitam2026')
        setIsLoading(false)
        return false
      }

      const adminUser: AuthUser = {
        id: `ADMIN-${Date.now()}`,
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

    // B. Check Registered Student credentials (lookup by Student ID or Email)
    const matchedStudent = resolveStudentFromIdentifier(cleanIdentifier)
    if (!matchedStudent) {
      setError(`No student record found matching "${cleanIdentifier}". Only registered students in the database can sign in.`)
      setIsLoading(false)
      return false
    }

    // Verify student password
    const expectedPassword = matchedStudent.password || 'Student@Gitam2026'
    if (cleanPassword !== expectedPassword) {
      setError(`Incorrect password for student ${matchedStudent.fullName} (${matchedStudent.studentId}). Expected: Student@Gitam2026`)
      setIsLoading(false)
      return false
    }

    // Grant student session bound permanently to their student record
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
