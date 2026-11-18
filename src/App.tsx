import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { AdminPage } from './pages/admin/AdminPage'
import { StudentPage } from './pages/student/StudentPage'
import { LoginPage } from './pages/auth/LoginPage'
import { UnauthorizedPage } from './pages/auth/UnauthorizedPage'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/student" replace />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="unauthorized" element={<UnauthorizedPage />} />
              <Route
                path="student"
                element={
                  <ProtectedRoute>
                    <StudentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

function NotFoundPage() {
  return (
    <section className="placeholder-panel" aria-labelledby="not-found-title">
      <p className="eyebrow">Page not found</p>
      <h1 id="not-found-title">This page is unavailable.</h1>
      <p>Use the navigation above to open the student or admin area.</p>
    </section>
  )
}

export default App
