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
import { studentLoginByEmail, getStudentProfile, isLiveBackendConfigured } from '../services/appsScriptClient.ts'
import { DESIGNATED_ADMIN_ACCOUNTS, type DesignatedAdminAccount } from './designatedAdmins.ts'

export { DESIGNATED_ADMIN_ACCOUNTS, type DesignatedAdminAccount }

const AUTH_STORAGE_KEY = 'gitam_auth_session_v1'

// Explicit development admin identifiers for isolated dev testing only
const DEV_AUTHORIZED_ADMINS = [
  'admin@gitam.in',
  'placement@gitam.in',
  'placement.homecoming2026@gitam.in',
  'gmercy@gitam.in',
  'dmoksha@gitam.in',
  'surya@gitam.in',
  'sreyash@gitam.in',
]

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
            // Check authoritative email confirmation
            const isEmailVerified = Boolean(
              data.session.user.email_confirmed_at ||
              (data.session.user.app_metadata &&
                ['google', 'sso', 'saml'].includes(data.session.user.app_metadata.provider as string))
            )

            if (!isEmailVerified) {
              setUser(null)
              setIsLoading(false)
              return
            }

            const token = data.session.access_token || undefined
            const userEmail = data.session.user.email.toLowerCase()
            const appRole = (data.session.user.app_metadata?.role || data.session.user.user_metadata?.role) as string | undefined

            if (appRole === 'admin') {
              setUser({
                id: data.session.user.id,
                email: userEmail,
                role: 'admin',
                accessToken: token,
              })
            } else {
              // Non-admin session: Verify student registration with backend using verified JWT token
              let matchedStudent = resolveStudentFromIdentifier(userEmail)
              if (!matchedStudent && token) {
                try {
                  const profRes = await getStudentProfile(token)
                  if (profRes.success && profRes.data) {
                    matchedStudent = profRes.data
                  }
                } catch {
                  // Fall through
                }
              }

              if (matchedStudent) {
                setUser({
                  id: data.session.user.id,
                  email: matchedStudent.gitamEmail,
                  role: 'student',
                  studentProfile: matchedStudent,
                  accessToken: token,
                })
              } else {
                setUser({
                  id: data.session.user.id,
                  email: userEmail,
                  role: 'unregistered',
                  accessToken: token,
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

      // 2. Student Email Session or Dev Admin Restoration
      try {
        const cached = localStorage.getItem(AUTH_STORAGE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          // Anti-tampering check: Verify admin role against designated placement administrators or dev admin list
          if (parsed?.role === 'admin') {
            const parsedEmail = String(parsed.email || '').trim().toLowerCase()
            const designatedAdmin = DESIGNATED_ADMIN_ACCOUNTS.find(
              (a) =>
                a.email.toLowerCase() === parsedEmail ||
                a.username.toLowerCase() === parsedEmail ||
                a.aliases.some((alias) => alias.toLowerCase() === parsedEmail)
            )
            const isDevAdmin = isDevMockAuthEnabled && DEV_AUTHORIZED_ADMINS.includes(parsedEmail)

            if (designatedAdmin || isDevAdmin) {
              const token =
                parsed.accessToken ||
                (designatedAdmin
                  ? `ADMIN_SESSION_TOKEN_${designatedAdmin.username.toUpperCase()}`
                  : 'DEV_MOCK_ADMIN_TOKEN')

              setUser({
                id: parsed.id || `admin-${designatedAdmin?.username || parsedEmail}`,
                email: designatedAdmin ? designatedAdmin.email : parsedEmail,
                role: 'admin',
                accessToken: token,
              })
            } else {
              localStorage.removeItem(AUTH_STORAGE_KEY)
              setUser(null)
            }
          } else if (parsed?.role === 'student' && (parsed?.email || parsed?.studentProfile?.studentId)) {
            const studentEmail = parsed.email || parsed.studentProfile?.gitamEmail
            if (studentEmail) {
              if (isLiveBackendConfigured()) {
                const res = await studentLoginByEmail(studentEmail)
                if (res.success && res.data) {
                  setUser({
                    id: res.data.studentId,
                    email: res.data.gitamEmail,
                    role: 'student',
                    studentProfile: res.data,
                    accessToken: 'STUDENT_EMAIL_SESSION',
                  })
                } else {
                  localStorage.removeItem(AUTH_STORAGE_KEY)
                  setUser(null)
                }
              } else {
                const fresh = mockStorage.getStudentByEmail(studentEmail) ||
                  (parsed.studentProfile?.studentId ? mockStorage.getStudentById(parsed.studentProfile.studentId) : undefined) ||
                  parsed.studentProfile
                if (fresh) {
                  setUser({
                    id: fresh.studentId,
                    email: fresh.gitamEmail,
                    role: 'student',
                    studentProfile: fresh,
                    accessToken: 'STUDENT_EMAIL_SESSION',
                  })
                } else {
                  localStorage.removeItem(AUTH_STORAGE_KEY)
                  setUser(null)
                }
              }
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

    const lowerIdent = cleanIdentifier.toLowerCase()

    // 1. Designated Administrator Authentication (GMercy, DMoksha, Surya / sreyash)
    const designatedAdmin = DESIGNATED_ADMIN_ACCOUNTS.find(
      (a) =>
        a.username.toLowerCase() === lowerIdent ||
        a.aliases.some((alias) => alias.toLowerCase() === lowerIdent)
    )

    if (designatedAdmin) {
      if (cleanPassword !== designatedAdmin.password) {
        setError('Invalid administrator username or password.')
        setIsLoading(false)
        return false
      }

      const adminUser: AuthUser = {
        id: `ADMIN-${designatedAdmin.username.toUpperCase()}`,
        email: designatedAdmin.email,
        role: 'admin',
        accessToken: `ADMIN_SESSION_TOKEN_${designatedAdmin.username.toUpperCase()}`,
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

    // 2. Supabase Authentication Path (Primary & Production Authority if configured)
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
          const isEmailVerified = Boolean(
            data.user.email_confirmed_at ||
            (data.user.app_metadata &&
              ['google', 'sso', 'saml'].includes(data.user.app_metadata.provider as string))
          )

          if (!isEmailVerified) {
            setError('Institutional email address has not been verified. Please check your inbox.')
            setIsLoading(false)
            return false
          }

          const token = data.session?.access_token || undefined
          const userEmail = data.user.email.toLowerCase()
          const appRole = (data.user.app_metadata?.role || data.user.user_metadata?.role) as string | undefined

          if (appRole === 'admin') {
            const adminUser: AuthUser = {
              id: data.user.id,
              email: userEmail,
              role: 'admin',
              accessToken: token,
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
              accessToken: token,
            }
            setUser(studentUser)
            setIsLoading(false)
            return true
          }

          const unregUser: AuthUser = {
            id: data.user.id,
            email: userEmail,
            role: 'unregistered',
            accessToken: token,
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

    // Fallback block if neither designated admin nor Supabase nor dev mode:
    if (!isDevMockAuthEnabled) {
      setError('Invalid administrator username or password.')
      setIsLoading(false)
      return false
    }

    // 3. Isolated Development Mock Authentication (Explicitly enabled dev mode only)
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
        accessToken: 'DEV_MOCK_ADMIN_TOKEN',
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
      accessToken: 'DEV_MOCK_STUDENT_TOKEN',
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

  // Student Email-Only Login handler
  // Validates email with backend against the official student database.
  // If registered: immediately grants student access with verified profile.
  // If unregistered: returns exact error "This email is not registered. Access denied."
  // If ambiguous: returns "Multiple registration records match this email address. Please contact the university placement office."
  //
  // Note per explicit user requirements: Email-only access does not verify identity/email ownership.
  const loginStudentByEmail = async (email: string): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true)
    setError(null)

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      const msg = 'Please enter a valid email address.'
      setError(msg)
      setIsLoading(false)
      return { success: false, message: msg }
    }

    const res = await studentLoginByEmail(cleanEmail)
    let studentRecord: import('../types').Student | undefined = res.success ? res.data : undefined

    // Fallback to local registration database when live backend is unconfigured
    if (!studentRecord) {
      const mockRes = mockStorage.studentLoginByEmail(cleanEmail)
      if (mockRes.success) {
        studentRecord = mockRes.data
      } else {
        const backendErrMsg = !res.success ? res.error?.message : undefined
        const msg = mockRes.error?.message || backendErrMsg || 'This email is not registered. Access denied.'
        setError(msg)
        setIsLoading(false)
        return { success: false, message: msg }
      }
    }

    const studentUser: AuthUser = {
      id: studentRecord.studentId,
      email: studentRecord.gitamEmail,
      role: 'student',
      studentProfile: studentRecord,
      accessToken: 'STUDENT_EMAIL_SESSION',
    }

    setUser(studentUser)
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(studentUser))
    } catch {
      // ignore
    }

    setIsLoading(false)
    return { success: true }
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
        loginStudentByEmail,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
