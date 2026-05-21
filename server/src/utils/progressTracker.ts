import fs from 'fs'
import path from 'path'

export interface ProgressData {
  operationId: string
  type: 'compress' | 'extract' | 'copy' | 'delete'
  progress: number
  label: string
  subLabel?: string
  status: 'active' | 'completed' | 'error'
  error?: string
}

export function collectFiles(dirPath: string): { fullPath: string; zipPath: string }[] {
  const result: { fullPath: string; zipPath: string }[] = []
  const entries = fs.readdirSync(dirPath)
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      const subFiles = collectFiles(fullPath)
      for (const sf of subFiles) {
        result.push({ fullPath: sf.fullPath, zipPath: path.join(entry, sf.zipPath) })
      }
    } else {
      result.push({ fullPath, zipPath: '' })
    }
  }
  return result
}

export function countFiles(dirPath: string): number {
  let count = 0
  const entries = fs.readdirSync(dirPath)
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) count += countFiles(fullPath)
    else count++
  }
  return count
}

export function emitProgress(io: any, socketId: string, data: ProgressData) {
  io.to(socketId).emit('file-progress', data)
}
