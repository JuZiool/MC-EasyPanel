import { create } from 'zustand'
import apiClient from '../utils/api'
import type { FileItem, FilePagination } from '../types'

interface FileStore {
  currentPath: string
  files: FileItem[]
  pagination: FilePagination | null
  loading: boolean
  setPath: (path: string) => void
  fetchFiles: (path: string, page?: number) => Promise<void>
}

export const useFileStore = create<FileStore>((set) => ({
  currentPath: '',
  files: [],
  pagination: null,
  loading: false,
  setPath: (path) => set({ currentPath: path }),
  fetchFiles: async (path, page = 1) => {
    set({ loading: true, currentPath: path })
    const res = await apiClient.listFiles(path, page)
    if (res.success && res.data) set({ files: res.data.files, pagination: res.data.pagination, loading: false })
    else set({ loading: false })
  }
}))
