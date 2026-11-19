import type { Student } from '../types'

export type UserRole = 'student' | 'admin' | 'unregistered'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  studentProfile?: Student | undefined
  accessToken?: string | undefined
}

export interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  error: string | null
  login: (email: string, password?: string) => Promise<boolean>
  loginStudentByEmail: (email: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  clearError: () => void
}
