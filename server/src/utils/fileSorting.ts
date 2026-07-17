export type FileSortBy = 'name' | 'size' | 'modified'

export interface SortableFile {
  name: string
  type: 'file' | 'directory'
  size: number
  modified: string
}

export function normalizeFileSortBy(value: unknown): FileSortBy {
  return value === 'size' || value === 'modified' ? value : 'name'
}

function compareNames(a: SortableFile, b: SortableFile) {
  return a.name.localeCompare(b.name, 'zh-CN')
}

export function sortFileItems<T extends SortableFile>(items: T[], sortBy: FileSortBy): T[] {
  return items.slice().sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1

    if (sortBy === 'size' && a.size !== b.size) return b.size - a.size

    if (sortBy === 'modified') {
      const modifiedDifference = Date.parse(b.modified) - Date.parse(a.modified)
      if (modifiedDifference !== 0) return modifiedDifference
    }

    return compareNames(a, b)
  })
}
