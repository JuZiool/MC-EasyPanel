import path from 'path'
import fs from 'fs'

export function getPtyPath(): string {
  const baseDir = process.cwd()
  const possiblePaths = [
    path.join(baseDir, 'node_modules', 'node-pty', 'bin'),
    path.join(baseDir, 'node_modules', 'node-pty'),
  ]
  for (const dir of possiblePaths) {
    if (fs.existsSync(dir)) return dir
  }
  return ''
}
