import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Launch from './pages/Launch'
import Login from './pages/Login'
import Trigger from './pages/Trigger'
import Admin from './pages/Admin'
import AllUserButtons from './pages/AllUserButtons'

function Protected({ children, roles }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen">Memuat…</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && profile && !roles.includes(profile.role)) {
    // Redirect sesuai role
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/trigger'} replace />
  }
  // Jika profile belum termuat tapi user ada, tetap tampilkan (hindari loop)
  return children
}

function LoginRoute() {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen">Memuat…</div>
  if (user && profile) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/trigger'} replace />
  }
  return <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Launch />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/trigger"
            element={
              <Protected roles={['user', 'admin']}>
                <Trigger />
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <Protected roles={['admin']}>
                <Admin />
              </Protected>
            }
          />
          <Route
            path="/semua-buttons"
            element={
              <Protected roles={['admin']}>
                <AllUserButtons />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}