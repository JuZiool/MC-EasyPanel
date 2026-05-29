import fs from 'fs'
import path from 'path'

// 单个实例日志文件最大 10MB，超过时轮转
const MAX_LOG_SIZE = 10 * 1024 * 1024
const MAX_LOG_FILES = 3

function rotateLogIfNeeded(filePath: string) {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > MAX_LOG_SIZE) {
      const last = `${filePath}.${MAX_LOG_FILES}`
      if (fs.existsSync(last)) fs.unlinkSync(last)
      for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
        const old = `${filePath}.${i}`
        if (fs.existsSync(old)) fs.renameSync(old, `${filePath}.${i + 1}`)
      }
      fs.renameSync(filePath, `${filePath}.1`)
    }
  } catch {}
}

class LogBuffer {
  private buffers: Map<string, string[]> = new Map()
  private logDir: string

  constructor() {
    const baseDir = process.cwd()
    const possiblePaths = [
      path.join(baseDir, 'data', 'logs'),
      path.join(baseDir, 'server', 'data', 'logs'),
    ]
    let logDir = possiblePaths.find(p => {
      try {
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
        return true
      } catch { return false }
    })
    this.logDir = logDir || possiblePaths[possiblePaths.length - 1]
    if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true })
  }

  append(sessionId: string, data: string, instanceId?: string) {
    if (!this.buffers.has(sessionId)) this.buffers.set(sessionId, [])
    const buf = this.buffers.get(sessionId)!
    buf.push(data)
    if (buf.length > 10000) buf.splice(0, buf.length - 10000)

    if (instanceId) {
      try {
        const logPath = path.join(this.logDir, `${instanceId}.log`)
        rotateLogIfNeeded(logPath)
        fs.appendFileSync(logPath, data)
      } catch {}
    }
  }

  getHistory(sessionId: string): string {
    const buf = this.buffers.get(sessionId)
    return buf ? buf.join('') : ''
  }

  readInstanceLog(instanceId: string): string {
    try {
      const logPath = path.join(this.logDir, `${instanceId}.log`)
      if (fs.existsSync(logPath)) return fs.readFileSync(logPath, 'utf-8')
    } catch {}
    return ''
  }

  clear(sessionId: string) {
    this.buffers.delete(sessionId)
  }
}

export default new LogBuffer()
