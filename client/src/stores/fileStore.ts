import { create } from 'zustand'
import apiClient from '../utils/api'
import { createLatestRequestGuard } from '../utils/latestRequestGuard'
import type { FileItem, FilePagination, FileSortBy, FileSortOrder } from '../types'

interface FileStore {
  currentPath: string
  files: FileItem[]
  pagination: FilePagination | null
  loading: boolean
  sortBy: FileSortBy
  sortOrder: FileSortOrder
  setPath: (path: string) => void
  setSort: (sortBy: FileSortBy, sortOrder: FileSortOrder) => void
  fetchFiles: (path: string, page?: number, sortBy?: FileSortBy, sortOrder?: FileSortOrder) => Promise<void>
}

const fileRequestGuard = createLatestRequestGuard()

export const useFileStore = create<FileStore>((set, get) => ({
  currentPath: '',
  files: [],
  pagination: null,
  loading: false,
  sortBy: 'name',
  sortOrder: 'asc',
  setPath: (path) => set({ currentPath: path }),
  setSort: (sortBy, sortOrder) => set({ sortBy, sortOrder }),
  fetchFiles: async (path, page = 1, requestedSortBy, requestedSortOrder) => {
    const sortBy = requestedSortBy || get().sortBy
    const sortOrder = requestedSortOrder || (requestedSortBy ? (requestedSortBy === 'name' ? 'asc' : 'desc') : get().sortOrder)
    const requestId = fileRequestGuard.start()
    set({ loading: true, currentPath: path, sortBy, sortOrder })
    const res = await apiClient.listFiles(path, page, 50, sortBy, sortOrder)
    if (!fileRequestGuard.isCurrent(requestId)) return
    if (res.success && res.data) set({ files: res.data.files, pagination: res.data.pagination, loading: false })
    else set({ loading: false })
  }
}))
