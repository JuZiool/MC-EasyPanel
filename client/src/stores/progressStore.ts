import { create } from 'zustand'

export interface ProgressItem {
  id: string
  type: 'upload' | 'download' | 'compress' | 'extract' | 'copy' | 'move'
  label: string
  subLabel?: string
  progress: number
  status: 'pending' | 'active' | 'completed' | 'error'
  error?: string
}

interface ProgressState {
  items: ProgressItem[]
  addItem: (item: ProgressItem) => void
  updateItem: (id: string, updates: Partial<ProgressItem>) => void
  removeItem: (id: string) => void
  handleProgressEvent: (data: { operationId: string; type: string; progress: number; label: string; subLabel?: string; status: string; error?: string }) => void
}

export const useProgressStore = create<ProgressState>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  handleProgressEvent: (data) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === data.operationId)
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.id === data.operationId
              ? {
                  ...item,
                  progress: data.progress,
                  subLabel: data.subLabel || item.subLabel,
                  status: data.status as ProgressItem['status'],
                  error: data.error,
                }
              : item
          ),
        }
      }
      return state
    }),
}))
