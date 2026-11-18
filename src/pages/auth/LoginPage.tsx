import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { isSupabaseConfigured } from '../../services/supabaseClient'
import '../../styles/portal.css'

interface LocationState {
  from?: {
    pathname: string
  }
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const state = location.state as LocationState | null
  const redirectPath = state?.from?.pathname || '/student'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsSubmitting(true)
    const success = await login(email, password)
    setIsSubmitting(false)

    if (success) {
      navigate(redirectPath, { replace: true })
    }
  }

  const handleSelectPreconfiguredUser = async (testEmail: string) => {
    clearError()
    setEmail(testEmail)
    setIsSubmitting(true)
    const success = await login(testEmail)
    setIsSubmitting(false)

    if (success) {
      if (testEmail === 'admin@gitam.in') {
        navigate('/admin', { replace: true })
      } else {
        navigate(redirectPath, { replace: true })
      }
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto', padding: '0 1rem' }}>
      <div className="page-heading" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <p className="eyebrow">GITAM Authentication Service</p>
        <h1 style={{ fontSize: '1.85rem' }}>Sign In to Interview Portal</h1>
        <p style={{ fontSize: '0.9rem' }}>
          Registered students and authorized administrators must authenticate to access scheduling records. Timezone: Asia/Kolkata (IST).
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
            <label htmlFor="login-email">GITAM Email Address:</label>
            <input
              id="login-email"
              type="email"
              required
              placeholder="e.g. asharma14@gitam.in"
              value={email}
              onChange={(e) => {
                clearError()
                setEmail(e.target.value)
              }}
            />
          </div>

          <div className="filter-input-group">
            <label htmlFor="login-password">
              Password {isSupabaseConfigured ? '(Required)' : '(Optional in Dev Simulation)'}:
            </label>
            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
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
              }}
            >
              Authentication Error: {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-book-slot"
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
            disabled={isSubmitting || !email.trim()}
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--portal-border)',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--portal-text-muted)', display: 'block', marginBottom: '0.75rem' }}>
            Phase 3 Test Accounts (Click to Test):
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ textAlign: 'left', fontSize: '0.85rem' }}
              onClick={() => handleSelectPreconfiguredUser('asharma14@gitam.in')}
            >
              <strong>Aarav Sharma</strong> (asharma14@gitam.in) — Registered Student [CSE]
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ textAlign: 'left', fontSize: '0.85rem' }}
              onClick={() => handleSelectPreconfiguredUser('areddy22@gitam.in')}
            >
              <strong>Ananya Reddy</strong> (areddy22@gitam.in) — Registered Student [ECE]
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ textAlign: 'left', fontSize: '0.85rem' }}
              onClick={() => handleSelectPreconfiguredUser('unknown.candidate@gmail.com')}
            >
              <strong>Unregistered Candidate</strong> (unknown.candidate@gmail.com) — Ineligible
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ textAlign: 'left', fontSize: '0.85rem', borderColor: '#b7dfcb', background: '#eaf7f0' }}
              onClick={() => handleSelectPreconfiguredUser('admin@gitam.in')}
            >
              <strong>Authorized Administrator</strong> (admin@gitam.in) — Placement Office
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
