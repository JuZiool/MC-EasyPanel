import { create } from 'zustand'
import apiClient from '../utils/api'
import socketClient from '../utils/socket'
import type { User } from '../types'
interface AuthStore {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<boolean>
  register: (username: string, password: string) => Promise<boolean>
  logout: () => void
  verifyToken: () => Promise<boolean>
  changePassword: (oldPwd: string, newPwd: string) => Promise<boolean>
  checkHasUsers: () => Promise<boolean>
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthenticated: !!localStorage.getItem('mc_easypanel_token'),
  user: null,
  token: localStorage.getItem('mc_easypanel_token'),
  loading: false,

  login: async (username, password) => {
    set({ loading: true })
    const res = await apiClient.login(username, password)
    if (res.success && res.data) {
      const { token, user } = res.data
      apiClient.setToken(token)
      set({ isAuthenticated: true, user, token, loading: false })
      return true
    }
    set({ loading: false })
    return false
  },

  register: async (username, password) => {
    set({ loading: true })
    const res = await apiClient.register(username, password)
    if (res.success && res.data) {
      const { token, user } = res.data
      apiClient.setToken(token)
      set({ isAuthenticated: true, user, token, loading: false })
      return true
    }
    set({ loading: false })
    return false
  },
  logout: () => {
    apiClient.setToken(null)
    socketClient.disconnect()
    set({ isAuthenticated: false, user: null, token: null })
  },



  verifyToken: async () => {
    const token = localStorage.getItem('mc_easypanel_token')
    if (!token) return false
    apiClient.setToken(token)
    const res = await apiClient.verifyToken()
    if (res.success && res.data) {
      set({ isAuthenticated: true, user: res.data.user, token })
      return true
    }
    apiClient.setToken(null)
    set({ isAuthenticated: false, user: null, token: null })
    return false
  },

  changePassword: async (oldPwd, newPwd) => {
    const res = await apiClient.changePassword(oldPwd, newPwd)
    return res.success
  },

  checkHasUsers: async () => {
    const res = await apiClient.hasUsers()
    return res.data?.hasUsers ?? true
  }

}))
