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
  private lastWriteTime: Map<string, number> = new Map()
  private logDir: string
  private cleanupTimer: NodeJS.Timeout | null = null

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
    this.lastWriteTime.set(sessionId, Date.now())

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
    this.lastWriteTime.delete(sessionId)
  }

  /**
   * 清除超过指定分钟未写入的僵尸缓冲区
   */
  cleanupStale(maxAgeMinutes: number = 30) {
    const now = Date.now()
    const maxAge = maxAgeMinutes * 60 * 1000
    let count = 0
    for (const [sessionId, lastWrite] of this.lastWriteTime) {
      if (now - lastWrite > maxAge) {
        this.buffers.delete(sessionId)
        this.lastWriteTime.delete(sessionId)
        count++
      }
    }
    if (count > 0) {
      const { default: logger } = require('./logger.js')
      logger.debug(`清理了 ${count} 个僵尸日志缓冲区`)
    }
  }

  /**
   * 启动自动清理（每 10 分钟运行一次）
   */
  startAutoCleanup() {
    if (this.cleanupTimer) return
    this.cleanupTimer = setInterval(() => this.cleanupStale(30), 10 * 60 * 1000)
    this.cleanupTimer.unref()
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

export default new LogBuffer()
