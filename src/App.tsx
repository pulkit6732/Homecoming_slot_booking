import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { AppLayout } from './layouts/AppLayout'
import { AdminPage } from './pages/admin/AdminPage'
import { StudentPage } from './pages/student/StudentPage'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/student" replace />} />
            <Route path="student" element={<StudentPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
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
