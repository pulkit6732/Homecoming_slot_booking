import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../context/authTypes'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: UserRole
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--portal-text-muted)' }}>
        <p style={{ fontWeight: 600 }}>Verifying credentials and access permissions...</p>
      </div>
    )
  }

  // 1. Not logged in -> Redirect to separate login entry point based on required role
  if (!user) {
    const loginTarget = requiredRole === 'admin' ? '/admin/login' : '/login'
    return <Navigate to={loginTarget} state={{ from: location }} replace />
  }

  // 2. Unregistered student attempting any protected route -> Redirect to unauthorized screen
  if (user.role === 'unregistered') {
    return <Navigate to="/unauthorized" state={{ reason: 'unregistered' }} replace />
  }

  // 3. Student attempting to access Admin route -> Redirect to unauthorized screen
  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <Navigate to="/unauthorized" state={{ reason: 'admin_required' }} replace />
  }

  return <>{children}</>
}
