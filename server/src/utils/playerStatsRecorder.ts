import fs from 'fs'
import path from 'path'
import logger from './logger.js'

const RECORD_INTERVAL = 5 * 60 * 1000 // 5 分钟记录一次
const MAX_RECORDS = 7 * 24 * 60 / 5  // 7 天 × 24 小时 × 60 分钟 / 5 分钟 ≈ 2016 条
const DATA_DIR = 'player-stats'

export interface PlayerSnapshot {
  time: string
  online: number
  max: number
}

export interface PlayerStatsRecorderOptions {
  /** 查询玩家数据的函数，接收实例信息，返回在线/最大人数 */
  queryPlayerCount: (workingDirectory: string) => Promise<{ online: number; max: number } | null>
  /** 实例列表提供函数 */
  getInstances: () => { id: string; name: string; workingDirectory: string; status: string }[]
  /** 数据存储目录（相对于 server/data） */
  dataDir?: string
}

export class PlayerStatsRecorder {
  private timer: NodeJS.Timeout | null = null
  private baseDir: string
  private options: PlayerStatsRecorderOptions
  private historyByInstance = new Map<string, PlayerSnapshot[]>()
  private writeQueues = new Map<string, Promise<void>>()
  private activeRecord: Promise<void> | null = null
  private running = false

  constructor(options: PlayerStatsRecorderOptions) {
    this.options = options
    const baseDir = process.cwd()
    const possiblePaths = [
      path.join(baseDir, 'server', 'data', options.dataDir || DATA_DIR),
      path.join(baseDir, 'data', options.dataDir || DATA_DIR),
    ]
    // 使用第一个可用的路径，或默认第一个
    this.baseDir = possiblePaths[0]
    fs.mkdirSync(this.baseDir, { recursive: true })
    this.loadHistoryCache()
  }

  start(): void {
    if (this.running) return
    this.running = true
    void this.recordAndSchedule()
    logger.info(`玩家数据记录器已启动，间隔 ${RECORD_INTERVAL / 1000}s`)
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.activeRecord) await this.activeRecord
    await Promise.all(this.writeQueues.values())
    logger.info('玩家数据记录器已停止')
  }

  private loadHistoryCache(): void {
    for (const fileName of fs.readdirSync(this.baseDir)) {
      if (!fileName.endsWith('.json') || fileName === 'player-sessions.json' || fileName === 'player-totals.json') continue
      try {
        const records = JSON.parse(fs.readFileSync(path.join(this.baseDir, fileName), 'utf-8'))
        if (Array.isArray(records)) this.historyByInstance.set(fileName.slice(0, -5), records)
      } catch {}
    }
  }

  private async recordAndSchedule(): Promise<void> {
    const activeRecord = this.record()
    this.activeRecord = activeRecord
    await activeRecord
    if (this.activeRecord === activeRecord) this.activeRecord = null
    if (!this.running) return
    this.timer = setTimeout(() => void this.recordAndSchedule(), RECORD_INTERVAL)
  }

  private async record(): Promise<void> {
    try {
      const instances = this.options.getInstances()
      const runningInstances = instances.filter(i => i.status === 'running')

      if (runningInstances.length === 0) return

      const promises = runningInstances.map(async (inst) => {
        try {
          const result = await this.options.queryPlayerCount(inst.workingDirectory)
          if (result) {
            await this.appendSnapshot(inst.id, result.online, result.max)
          }
        } catch (e: any) {
          logger.debug(`记录实例 ${inst.name} 玩家数据失败: ${e.message}`)
        }
      })

      await Promise.all(promises)
    } catch (e: any) {
      logger.error(`玩家数据记录异常: ${e.message}`)
    }
  }

  private async appendSnapshot(instanceId: string, online: number, max: number): Promise<void> {
    const records = [...(this.historyByInstance.get(instanceId) || []), {
      time: new Date().toISOString(),
      online,
      max
    }]

    const limitedRecords = records.length > MAX_RECORDS ? records.slice(records.length - MAX_RECORDS) : records
    this.historyByInstance.set(instanceId, limitedRecords)
    await this.queueWrite(instanceId, limitedRecords)
  }

  private queueWrite(instanceId: string, records: PlayerSnapshot[]): Promise<void> {
    const filePath = path.join(this.baseDir, `${instanceId}.json`)
    const tempPath = `${filePath}.tmp`
    const payload = JSON.stringify(records, null, 2)
    const previous = this.writeQueues.get(instanceId) || Promise.resolve()
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await fs.promises.writeFile(tempPath, payload)
        await fs.promises.rename(tempPath, filePath)
      })
      .catch((error: any) => {
        logger.error(`保存玩家统计数据失败: ${error.message}`)
      })
    this.writeQueues.set(instanceId, next)
    void next.finally(() => {
      if (this.writeQueues.get(instanceId) === next) this.writeQueues.delete(instanceId)
    })
    return next
  }

  /**
   * 获取指定实例的历史在线人数数据
   */
  getHistory(instanceId: string): PlayerSnapshot[] {
    return [...(this.historyByInstance.get(instanceId) || [])]
  }
}
