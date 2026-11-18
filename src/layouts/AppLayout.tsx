import { NavLink, Outlet } from 'react-router-dom'
import '../styles/layout.css'

export function AppLayout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <NavLink className="brand" to="/student" end>
            <span className="brand__mark" aria-hidden="true">
              G
            </span>
            <span>GITAM Interview Portal</span>
          </NavLink>
          <nav className="primary-navigation" aria-label="Main navigation">
            <NavLink to="/student">Student</NavLink>
            <NavLink to="/admin">Admin</NavLink>
          </nav>
        </div>
      </header>
      <main className="site-main" id="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          Student and administrator areas are kept separate.
        </div>
      </footer>
    </div>
  )
}
