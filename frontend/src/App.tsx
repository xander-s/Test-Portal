import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import TestInterface from './pages/TestInterface'
import Dashboard from './pages/Dashboard'
import SystemCheck from './pages/SystemCheck'
import { useAuthStore } from './store/authStore'
import { Loader2 } from 'lucide-react'

export default function App() {
  const { token, user, fetchUserProfile } = useAuthStore()
  const [initAuthComplete, setInitAuthComplete] = useState(false)

  useEffect(() => {
    const initAuth = async () => {
      if (token && !user) {
        await fetchUserProfile()
      }
      setInitAuthComplete(true)
    }
    initAuth()
  }, [token, user, fetchUserProfile])

  if (!initAuthComplete) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-semibold tracking-wider text-slate-400">Initializing Exam Session...</p>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/test/:attemptId" element={<TestInterface />} />
        <Route path="/system-check/:attemptId" element={<SystemCheck />} />
        <Route path="/" element={<Dashboard />} />
        {/* Default route fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}
