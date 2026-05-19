import { create } from 'zustand'
import apiClient from '../utils/api'
import type { Instance } from '../types'

interface InstanceStore {
  instances: Instance[]
  loading: boolean
  error: string | null
  fetchInstances: () => Promise<void>
  updateInstanceStatus: (id: string, status: Instance['status']) => void
}

export const useInstanceStore = create<InstanceStore>((set, get) => ({
  instances: [],
  loading: false,
  error: null,

  fetchInstances: async () => {
    set({ loading: true, error: null })
    const res = await apiClient.getInstances()
    if (res.success && res.data) set({ instances: res.data, loading: false })
    else set({ error: res.message || '获取实例列表失败', loading: false })
  },

  updateInstanceStatus: (id, status) => {
    set((s) => ({ instances: s.instances.map(i => i.id === id ? { ...i, status } : i) }))
  }
}))
