/**
 * 压缩格式检测工具 — 服务端和客户端共享
 */

/** 支持的压缩文件扩展名（单个） */
const ARCHIVE_EXTS = ['.zip', '.7z', '.tar', '.gz', '.xz', '.bz2', '.rar'] as const

/** 支持的复合压缩扩展名 */
const COMPOUND_EXTS = ['.tar.gz', '.tar.xz', '.tar.bz2', '.tgz', '.txz', '.tbz2'] as const

/**
 * 判断文件名是否为受支持的压缩包
 */
export function isArchiveFile(fileName: string): boolean {
  const name = fileName.toLowerCase()
  for (const ext of COMPOUND_EXTS) {
    if (name.endsWith(ext)) return true
  }
  const dotIdx = name.lastIndexOf('.')
  if (dotIdx < 0) return false
  const ext = name.substring(dotIdx)
  return (ARCHIVE_EXTS as readonly string[]).includes(ext)
}

/**
 * 检测压缩文件格式，返回格式标识
 * 返回值: 'zip' | '7z' | 'tar' | 'tar.gz' | 'tar.xz' | 'tar.bz2' | 'unknown'
 */
export function detectArchiveFormat(filePath: string): string {
  const name = filePath.toLowerCase()
  if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) return 'tar.gz'
  if (name.endsWith('.tar.xz') || name.endsWith('.txz')) return 'tar.xz'
  if (name.endsWith('.tar.bz2') || name.endsWith('.tbz2')) return 'tar.bz2'
  const dotIdx = name.lastIndexOf('.')
  if (dotIdx < 0) return 'unknown'
  const ext = name.substring(dotIdx)
  if (ext === '.zip') return 'zip'
  if (ext === '.7z') return '7z'
  if (ext === '.tar') return 'tar'
  return 'unknown'
}
