import { create } from 'zustand'
import axios from 'axios'

interface AuthState {
  user: any | null
  token: string | null
  tenantId: string | null
  login: (user: any, token: string, tenantId: string) => void
  logout: () => void
  fetchUserProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => {
  // Sync initialization with localStorage (handling both standard and Electron keys)
  const storedToken = localStorage.getItem('access_token') || localStorage.getItem('accessToken')
  const storedUser = localStorage.getItem('user_data')
  const storedTenant = localStorage.getItem('tenant_id')

  if (storedToken) {
    localStorage.setItem('access_token', storedToken)
    localStorage.setItem('accessToken', storedToken)
  }

  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken,
    tenantId: storedTenant,
    login: (user, token, tenantId) => {
      localStorage.setItem('access_token', token)
      localStorage.setItem('accessToken', token)
      localStorage.setItem('user_data', JSON.stringify(user))
      localStorage.setItem('tenant_id', tenantId)
      set({ user, token, tenantId })
    },
    logout: () => {
      localStorage.removeItem('access_token')
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user_data')
      localStorage.removeItem('tenant_id')
      set({ user: null, token: null, tenantId: null })
    },
    fetchUserProfile: async () => {
      const { token } = useAuthStore.getState()
      if (!token) return
      try {
        const res = await axios.get('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const user = res.data
        const tenantId = user.organization_slug || user.organization_id || 'default-tenant'
        localStorage.setItem('user_data', JSON.stringify(user))
        localStorage.setItem('tenant_id', tenantId)
        set({ user, tenantId })
      } catch (err) {
        console.error('[authStore] Failed to fetch user profile:', err)
        // If unauthorized/expired, clear state
        localStorage.removeItem('access_token')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user_data')
        localStorage.removeItem('tenant_id')
        set({ user: null, token: null, tenantId: null })
      }
    }
  }
})
