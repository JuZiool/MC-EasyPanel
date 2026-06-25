import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import socketClient from './utils/socket'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import PageTransition from './components/PageTransition'
import NotificationContainer from './components/NotificationContainer'
import DashboardPage from './pages/DashboardPage'
import InstancesPage from './pages/InstancesPage'
import FileManagerPage from './pages/FileManagerPage'
import TerminalPage from './pages/TerminalPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { verifyToken, isAuthenticated, token } = useAuthStore()

  useEffect(() => { verifyToken() }, [])

  // Socket 连接跟随认证状态：登录后建立，登出后断开
  useEffect(() => {
    if (isAuthenticated && token) {
      socketClient.initialize(token)
    } else {
      socketClient.disconnect()
    }
  }, [isAuthenticated, token])

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <NotificationContainer />
            <Routes>
              <Route path="/" element={<PageTransition><DashboardPage /></PageTransition>} />
              <Route path="/instances" element={<PageTransition><InstancesPage /></PageTransition>} />
              <Route path="/files" element={<PageTransition><FileManagerPage /></PageTransition>} />
              <Route path="/terminal" element={<PageTransition><TerminalPage /></PageTransition>} />
              <Route path="/settings" element={<PageTransition><SettingsPage /></PageTransition>} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}
