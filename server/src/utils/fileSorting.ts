export type FileSortBy = 'name' | 'size' | 'modified'
export type FileSortOrder = 'asc' | 'desc'

export interface SortableFile {
  name: string
  type: 'file' | 'directory'
  size: number
  modified: string
}

export function normalizeFileSortBy(value: unknown): FileSortBy {
  return value === 'size' || value === 'modified' ? value : 'name'
}

export function normalizeFileSortOrder(value: unknown, sortBy: FileSortBy): FileSortOrder {
  if (value === 'asc' || value === 'desc') return value
  return getDefaultFileSortOrder(sortBy)
}

export function getDefaultFileSortOrder(sortBy: FileSortBy): FileSortOrder {
  return sortBy === 'name' ? 'asc' : 'desc'
}

function compareNames(a: SortableFile, b: SortableFile) {
  return a.name.localeCompare(b.name, 'zh-CN')
}

export function sortFileItems<T extends SortableFile>(items: T[], sortBy: FileSortBy, sortOrder = getDefaultFileSortOrder(sortBy)): T[] {
  return items.slice().sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1

    const direction = sortOrder === 'asc' ? 1 : -1

    if (sortBy === 'size' && a.size !== b.size) return (a.size - b.size) * direction

    if (sortBy === 'modified') {
      const modifiedDifference = (Date.parse(a.modified) - Date.parse(b.modified)) * direction
      if (modifiedDifference !== 0) return modifiedDifference
    }

    return sortBy === 'name' ? compareNames(a, b) * direction : compareNames(a, b)
  })
}
