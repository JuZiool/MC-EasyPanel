import { create } from 'zustand'
import apiClient from '../utils/api'
import { createLatestRequestGuard } from '../utils/latestRequestGuard'
import type { FileItem, FilePagination, FileSortBy } from '../types'

interface FileStore {
  currentPath: string
  files: FileItem[]
  pagination: FilePagination | null
  loading: boolean
  sortBy: FileSortBy
  setPath: (path: string) => void
  setSortBy: (sortBy: FileSortBy) => void
  fetchFiles: (path: string, page?: number, sortBy?: FileSortBy) => Promise<void>
}

const fileRequestGuard = createLatestRequestGuard()

export const useFileStore = create<FileStore>((set, get) => ({
  currentPath: '',
  files: [],
  pagination: null,
  loading: false,
  sortBy: 'name',
  setPath: (path) => set({ currentPath: path }),
  setSortBy: (sortBy) => set({ sortBy }),
  fetchFiles: async (path, page = 1, requestedSortBy) => {
    const sortBy = requestedSortBy || get().sortBy
    const requestId = fileRequestGuard.start()
    set({ loading: true, currentPath: path, sortBy })
    const res = await apiClient.listFiles(path, page, 50, sortBy)
    if (!fileRequestGuard.isCurrent(requestId)) return
    if (res.success && res.data) set({ files: res.data.files, pagination: res.data.pagination, loading: false })
    else set({ loading: false })
  }
}))
