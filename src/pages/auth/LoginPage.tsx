import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  const { login, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const state = location.state as LocationState | null
  const redirectPath = state?.from?.pathname || '/student'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || !password) return

    setIsSubmitting(true)
    const success = await login(identifier, password)
    setIsSubmitting(false)

    if (success) {
      if (identifier.toLowerCase().includes('admin') || identifier.toLowerCase().includes('placement')) {
        navigate('/admin', { replace: true })
      } else {
        navigate(redirectPath, { replace: true })
      }
    }
  }

  const handlePreFill = (testId: string, testPass: string) => {
    clearError()
    setIdentifier(testId)
    setPassword(testPass)
  }

  return (
    <div style={{ maxWidth: '520px', margin: '2rem auto', padding: '0 1rem' }}>
      <div className="page-heading" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <p className="eyebrow">GITAM Authentication Service</p>
        <h1 style={{ fontSize: '1.85rem' }}>Sign In to Interview Portal</h1>
        <p style={{ fontSize: '0.9rem' }}>
          Registered students from the database and authorized administrators authenticate with dedicated credentials. Timezone: Asia/Kolkata (IST).
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
            <label htmlFor="login-identifier">Student ID or University Email:</label>
            <input
              id="login-identifier"
              type="text"
              required
              placeholder="e.g. GITAM-2026-005 or asharma14@gitam.in"
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
              placeholder="Enter your account password"
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
            {isSubmitting ? 'Verifying Credentials...' : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--portal-border)',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--portal-text-muted)',
              display: 'block',
              marginBottom: '0.75rem',
            }}
          >
            Pre-Configured Registered Credentials (Click to Fill Form):
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ textAlign: 'left', fontSize: '0.85rem' }}
              onClick={() => handlePreFill('GITAM-2026-005', 'Student@Gitam2026')}
            >
              <div><strong>Sneha Patel</strong> (Unbooked Student)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--portal-text-muted)' }}>
                ID: GITAM-2026-005 | Email: snair18@gitam.in | Pass: Student@Gitam2026
              </div>
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{ textAlign: 'left', fontSize: '0.85rem' }}
              onClick={() => handlePreFill('asharma14@gitam.in', 'Student@Gitam2026')}
            >
              <div><strong>Aarav Sharma</strong> (Booked Student)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--portal-text-muted)' }}>
                ID: GITAM-2026-001 | Email: asharma14@gitam.in | Pass: Student@Gitam2026
              </div>
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{ textAlign: 'left', fontSize: '0.85rem', borderColor: '#b7dfcb', background: '#eaf7f0' }}
              onClick={() => handlePreFill('admin@gitam.in', 'Admin@Gitam2026')}
            >
              <div><strong>University Placement Administrator</strong></div>
              <div style={{ fontSize: '0.75rem', color: 'var(--portal-text-muted)' }}>
                Email: admin@gitam.in | Pass: Admin@Gitam2026
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
