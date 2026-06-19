import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Mail, Lock, AlertCircle } from 'lucide-react'
import { api } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const activeTenant = tenantId || "default-tenant"
      
      const res = await api.post('/auth/login', 
        { email, password },
        { headers: { 'X-Tenant-ID': activeTenant } }
      )
      
      const { access_token } = res.data
      
      // Fetch full user profile details including roles
      const meRes = await api.get('/auth/me', {
        headers: { 
          'Authorization': `Bearer ${access_token}`,
          'X-Tenant-ID': activeTenant
        }
      })
      
      // Save state to store
      login(meRes.data, access_token, activeTenant)
      
      // Redirect to the multi-role dashboard
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid login credentials. Please check details.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Dynamic Background Circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-slate-800 shadow-2xl relative z-10 neon-border">
        {/* Title / Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-3 text-indigo-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Enterprise Test Portal</h2>
          <p className="text-xs text-slate-400 mt-1">SaaS Assessment & Proctoring System</p>
        </div>

        {/* Error Warning */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-center gap-2.5 text-sm">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Organization / Tenant ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Organization Slug / ID
            </label>
            <input
              type="text"
              required
              placeholder="e.g. acme"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="w-full glass-input"
            />
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3.5 text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full glass-input pl-10"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-3.5 text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-input pl-10"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full glow-btn font-semibold text-sm py-3 mt-4 flex justify-center items-center"
          >
            {loading ? "Verifying Credentials..." : "Access Dashboard"}
          </button>
        </form>
      </div>
    </div>
  )
}
