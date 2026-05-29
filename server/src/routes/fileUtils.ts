import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import multer from 'multer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const WORKER_PATH = path.join(__dirname, '..', 'workers', 'fileWorker.js')

export const upload = multer({
  dest: os.tmpdir() + '/mc-easypanel-uploads',
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }
})

/** 系统关键路径黑名单 */
export const SYSTEM_PATHS = ['/etc', '/bin', '/sbin', '/lib', '/lib64', '/usr', '/proc', '/dev', '/sys', '/boot', '/root', '/var', '/opt']

/** 允许操作的根路径 */
export const ALLOWED_ROOTS = [
  '/app',
  '/server',
  process.cwd(),
]

export function isWithinAllowedRoots(resolved: string): boolean {
  for (const root of ALLOWED_ROOTS) {
    const r = path.resolve(root)
    if (resolved === r || resolved.startsWith(r + '/')) return true
  }
  return false
}

export function isNotSystemPath(resolved: string): boolean {
  for (const sp of SYSTEM_PATHS) {
    if (resolved === sp || resolved.startsWith(sp + '/')) return false
  }
  return true
}

export function isValidPath(p: string): boolean {
  try {
    const real = fs.realpathSync.native(p)
    if (!path.isAbsolute(p) || p.includes('..')) return false
    if (path.relative(p, real).startsWith('..')) return false
    return isWithinAllowedRoots(real) && isNotSystemPath(real)
  } catch {
    if (!path.isAbsolute(p) || p.includes('..')) return false
    const resolved = path.resolve(p)
    if (!isNotSystemPath(resolved)) return false
    const parentDir = path.dirname(p)
    try {
      const realParent = fs.realpathSync.native(parentDir)
      if (path.relative(parentDir, realParent).startsWith('..')) return false
      return isWithinAllowedRoots(realParent)
    } catch {
      return isWithinAllowedRoots(resolved)
    }
  }
}

export function isPathOperable(p: string): boolean {
  return isValidPath(p)
}
