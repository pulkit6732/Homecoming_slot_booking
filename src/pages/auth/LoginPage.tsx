import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import '../../styles/portal.css'

interface LocationState {
  from?: {
    pathname: string
  }
}

export function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user, login, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const state = location.state as LocationState | null
  const redirectPath = state?.from?.pathname || '/student'

  // Route strictly based on verified user.role upon successful authentication
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin', { replace: true })
      } else if (user.role === 'student') {
        navigate(redirectPath, { replace: true })
      } else if (user.role === 'unregistered') {
        navigate('/unauthorized', { replace: true })
      }
    }
  }, [user, navigate, redirectPath])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || !password) return

    setIsSubmitting(true)
    await login(identifier, password)
    setIsSubmitting(false)
  }

  return (
    <div style={{ maxWidth: '520px', margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <img
          src="/assets/homecoming-2026-badge.png"
          alt="GITAM Homecoming 2026"
          style={{ height: '5rem', width: 'auto', display: 'inline-block' }}
        />
      </div>
      <div className="page-heading" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <p className="eyebrow">GITAM Candidate Access • Placements 2026</p>
        <h1 style={{ fontSize: '1.85rem' }}>Student Interview Portal Login</h1>
        <p style={{ fontSize: '0.9rem' }}>
          Sign in with your verified institutional credentials to view slot schedules and reserve your interview. Timezone: Asia/Kolkata (IST).
        </p>
      </div>

      <div
        style={{
          background: 'var(--portal-card-bg)',
          border: '1px solid var(--portal-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="filter-input-group">
            <label htmlFor="login-identifier">Student ID or Institutional Email:</label>
            <input
              id="login-identifier"
              type="text"
              required
              placeholder="e.g. student@gitam.in"
              value={identifier}
              onChange={(e) => {
                clearError()
                setIdentifier(e.target.value)
              }}
            />
          </div>

          <div className="filter-input-group">
            <label htmlFor="login-password">Password (Required):</label>
            <input
              id="login-password"
              type="password"
              required
              placeholder="Enter your student account password"
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
              <strong>Authentication Error:</strong> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-book-slot"
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
            disabled={isSubmitting || !identifier.trim() || !password}
          >
            {isSubmitting ? 'Verifying Student Credentials...' : 'Sign In as Student'}
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
          Official institutional login active. Use your verified institutional Google Workspace credentials.
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--portal-text-muted)' }}>University Placement Administrator? </span>
          <Link to="/admin/login" style={{ color: 'var(--portal-primary)', fontWeight: 600 }}>
            Go to Administrator Login
          </Link>
        </div>
      </div>
    </div>
  )
}
