import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import '../styles/layout.css'

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <NavLink className="brand" to="/student" end>
            <img
              src="/assets/homecoming-2026-badge.png"
              alt="GITAM Homecoming 2026"
              className="brand__logo"
            />
            <span className="brand__divider" aria-hidden="true" />
            <span className="brand__title">Interview Portal</span>
          </NavLink>

          <nav className="primary-navigation" aria-label="Main navigation">
            <NavLink to="/student">Student</NavLink>
            <NavLink to="/admin">Admin</NavLink>

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#d2e5dc' }}>
                  {user.email} (
                  <strong style={{ textTransform: 'uppercase', color: user.role === 'admin' ? '#FDB813' : '#a8ebd0' }}>
                    {user.role}
                  </strong>
                  )
                </span>
                <button
                  type="button"
                  className="btn-table-action"
                  onClick={handleLogout}
                  style={{
                    padding: '0.35rem 0.65rem',
                    background: 'rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                  }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                style={{
                  background: '#FDB813',
                  color: '#00392F',
                  fontWeight: 700,
                  padding: '0.45rem 0.95rem',
                  borderRadius: '0.5rem',
                }}
              >
                Sign In
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="site-main" id="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          GITAM Placement Operations • Timezone: Asia/Kolkata (IST)
        </div>
      </footer>
    </div>
  )
}
