import { create } from 'zustand'
import type { Notification } from '../types'

interface NotificationStore {
  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
}

const notificationTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  addNotification: (n) => {
    const { notifications } = get()
    const notificationWithDefaults = { message: '', ...n }
    const isDuplicate = notifications.some(ex => ex.title === n.title && ex.message === n.message && Date.now() - ex.timestamp < 3000)
    if (isDuplicate) return
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    const notification: Notification = { ...notificationWithDefaults, id, timestamp: Date.now() }
    set({ notifications: [...notifications, notification] })
    const duration = n.duration ?? 5000
    if (duration > 0) {
      const timer = setTimeout(() => {
        get().removeNotification(id)
        notificationTimeouts.delete(id)
      }, duration)
      notificationTimeouts.set(id, timer)
    }
  },
  removeNotification: (id) => {
    const timer = notificationTimeouts.get(id)
    if (timer) {
      clearTimeout(timer)
      notificationTimeouts.delete(id)
    }
    set((s) => ({ notifications: s.notifications.filter(n => n.id !== id) }))
  }
}))
