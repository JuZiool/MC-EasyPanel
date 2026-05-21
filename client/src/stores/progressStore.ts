import { create } from 'zustand'

export interface ProgressItem {
  id: string
  type: 'upload' | 'download' | 'compress' | 'extract' | 'copy' | 'move' | 'delete'
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
  handleProgressEvent: (data) => {
    const status = data.status as ProgressItem['status']
    const isTerminal = status === 'completed' || status === 'error'
    set((state) => {
      const existing = state.items.find((i) => i.id === data.operationId)
      if (existing) {
        // 防止 Socket.IO 的 'active' 事件覆盖已设置的 'error' 或 'completed' 状态
        if ((existing.status === 'error' || existing.status === 'completed') && status === 'active') {
          return state
        }
        return {
          items: state.items.map((item) =>
            item.id === data.operationId
              ? {
                  ...item,
                  progress: data.progress,
                  label: data.label || item.label,
                  subLabel: data.subLabel || item.subLabel,
                  status,
                  error: data.error,
                }
              : item
          ),
        }
      }
      return state
    })
    // 完成后触发刷新回调（延迟一点确保状态已更新）
    if (isTerminal) {
      setTimeout(() => {
        completeCallbacks.forEach((cb) => cb(data.type))
      }, 300)
    }
  },
}))

// ---- 操作完成回调系统 ----
type CompleteCallback = (type: string) => void
const completeCallbacks = new Set<CompleteCallback>()

/** 注册操作完成回调，返回取消注册函数 */
export function onProgressComplete(cb: CompleteCallback): () => void {
  completeCallbacks.add(cb)
  return () => completeCallbacks.delete(cb)
}
