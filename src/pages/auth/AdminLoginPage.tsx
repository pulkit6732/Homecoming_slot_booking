/**
 * Placement Administrator Login Page
 * 
 * Restricted entry point for authorized university placement personnel.
 * Verifies credentials via Supabase / institutional auth and enforces
 * server-side administrative allowlist authorization.
 * Zero emojis per specification.
 */

import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import '../../styles/portal.css'

interface LocationState {
  from?: {
    pathname: string
  }
}

export function AdminLoginPage() {
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user, login, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const state = location.state as LocationState | null
  const redirectPath = state?.from?.pathname || '/admin'

  // Route strictly upon verified admin role
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate(redirectPath, { replace: true })
      } else {
        // Non-admin attempting to access admin route
        navigate('/unauthorized', { state: { reason: 'admin_required' }, replace: true })
      }
    }
  }, [user, navigate, redirectPath])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!adminEmail.trim() || !password) return

    setIsSubmitting(true)
    await login(adminEmail, password)
    setIsSubmitting(false)
  }

  return (
    <div style={{ maxWidth: '520px', margin: '2.5rem auto', padding: '0 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <img
          src="/assets/homecoming-2026-badge.png"
          alt="GITAM Homecoming 2026"
          style={{ height: '5rem', width: 'auto', display: 'inline-block' }}
        />
      </div>
      <div className="page-heading" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <p className="eyebrow">GITAM Placement Office • Operations</p>
        <h1 style={{ fontSize: '1.85rem' }}>Placement Administrator Login</h1>
        <p style={{ fontSize: '0.9rem' }}>
          Restricted access for authorized university placement officers and department coordinators. Server-side allowlist verification active. Timezone: Asia/Kolkata (IST).
        </p>
      </div>

      <div
        style={{
          background: 'var(--portal-card-bg)',
          color: 'var(--portal-text)',
          border: '1px solid var(--portal-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="filter-input-group">
            <label htmlFor="admin-email">Administrator Username or Email Address:</label>
            <input
              id="admin-email"
              type="text"
              autoComplete="username"
              required
              placeholder="e.g. GMercy, DMoksha, Surya or admin@gitam.in"
              value={adminEmail}
              onChange={(e) => {
                clearError()
                setAdminEmail(e.target.value)
              }}
            />
          </div>

          <div className="filter-input-group">
            <label htmlFor="admin-password">Administrator Password:</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Enter administrator account password"
              value={password}
              onChange={(e) => {
                clearError()
                setPassword(e.target.value)
              }}
            />
          </div>

          {error && (
            <div
              style={{
                backgroundColor: 'var(--status-rejected-bg)',
                border: '1px solid #f8b4b4',
                color: 'var(--status-rejected-text)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
            >
              <strong>Authorization Error:</strong> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-book-slot"
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
            disabled={isSubmitting || !adminEmail.trim() || !password}
          >
            {isSubmitting ? 'Verifying Administrator Authorization...' : 'Sign In as Administrator'}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--portal-border)',
            fontSize: '0.8rem',
            color: 'var(--portal-text-muted)',
            textAlign: 'center',
          }}
        >
          Designated administrator access active. Institutional Single Sign-On and server-side allowlist verification enforced.
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--portal-text-muted)' }}>Are you an interview candidate? </span>
          <Link to="/login" style={{ color: 'var(--portal-primary)', fontWeight: 600 }}>
            Go to Student Booking Login
          </Link>
        </div>
      </div>
    </div>
  )
}
