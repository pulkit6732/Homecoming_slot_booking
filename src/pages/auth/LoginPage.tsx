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
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user, loginStudentByEmail, error, clearError } = useAuth()
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
    if (!email.trim() || isSubmitting) return

    clearError()
    setIsSubmitting(true)
    await loginStudentByEmail(email.trim())
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
        <p className="eyebrow" style={{ color: '#FDB813', fontWeight: 700 }}>
          GITAM Candidate Access • Placements 2026
        </p>
        <h1 style={{ fontSize: '1.85rem', color: '#FFFFFF', fontWeight: 700 }}>
          Student Interview Portal Login
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>
          Enter your registered institutional email or personal Gmail to view available slots and manage your interview schedule. No password or OTP code required. Timezone: Asia/Kolkata (IST).
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
            <label htmlFor="login-email" style={{ fontWeight: 600, color: 'var(--portal-text)' }}>
              Registered Student Email Address:
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              placeholder="e.g. candidate@gitam.in or your registered Gmail"
              value={email}
              onChange={(e) => {
                clearError()
                setEmail(e.target.value)
              }}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                border: '1px solid var(--portal-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.95rem',
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
                fontSize: '0.875rem',
                lineHeight: 1.5,
              }}
            >
              <strong>Access Notice:</strong> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-book-slot"
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 700 }}
            disabled={isSubmitting || !email.trim()}
          >
            {isSubmitting ? 'Checking Registration...' : 'Sign In as Student'}
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
            lineHeight: 1.4,
          }}
        >
          Email-only access verification active. Access is granted immediately to email addresses matching active records in the official registration database.
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
