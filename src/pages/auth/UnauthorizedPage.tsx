import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import '../../styles/portal.css'

interface LocationState {
  reason?: 'unregistered' | 'admin_required'
}

export function UnauthorizedPage() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state as LocationState | null
  const reason = state?.reason || (user?.role === 'unregistered' ? 'unregistered' : 'admin_required')

  const handleLogoutAndLogin = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ maxWidth: '540px', margin: '3rem auto', padding: '0 1rem' }}>
      <div
        style={{
          background: 'var(--portal-card-bg)',
          border: '1px solid var(--status-rejected-bg)',
          borderRadius: 'var(--radius-lg)',
          padding: '2.5rem 2rem',
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '0.4rem 0.8rem',
            background: 'var(--status-rejected-bg)',
            color: 'var(--status-rejected-text)',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '1rem',
          }}
        >
          Access Denied
        </span>

        {reason === 'unregistered' ? (
          <>
            <h1 style={{ fontSize: '1.65rem', margin: '0 0 1rem', color: 'var(--portal-text)' }}>
              Candidate Record Not Found
            </h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--portal-text-muted)', lineHeight: 1.6 }}>
              The authenticated email <strong>{user?.email}</strong> is not present in the Master Student Database.
              Only verified and registered GITAM students are permitted to view and reserve interview slots.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '1.65rem', margin: '0 0 1rem', color: 'var(--portal-text)' }}>
              Administrator Authorization Required
            </h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--portal-text-muted)', lineHeight: 1.6 }}>
              Your account <strong>{user?.email}</strong> does not possess administrative privileges.
              Administrative endpoints and review tools are restricted to authorized university placement officials.
            </p>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
          {user?.role === 'student' && (
            <button
              type="button"
              className="btn-book-slot"
              onClick={() => navigate('/student', { replace: true })}
            >
              Go to Student Directory
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={handleLogoutAndLogin}
          >
            Sign Out & Switch Account
          </button>
        </div>
      </div>
    </div>
  )
}
