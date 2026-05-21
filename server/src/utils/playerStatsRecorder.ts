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
  }

  start(): void {
    this.record()
    this.scheduleNext()
    logger.info(`玩家数据记录器已启动，间隔 ${RECORD_INTERVAL / 1000}s`)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    logger.info('玩家数据记录器已停止')
  }

  private scheduleNext(): void {
    this.timer = setTimeout(() => {
      this.record().finally(() => this.scheduleNext())
    }, RECORD_INTERVAL)
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
            this.appendSnapshot(inst.id, result.online, result.max)
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

  private appendSnapshot(instanceId: string, online: number, max: number): void {
    const filePath = path.join(this.baseDir, `${instanceId}.json`)
    let records: PlayerSnapshot[] = []

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        records = JSON.parse(content)
      }
    } catch { records = [] }

    records.push({
      time: new Date().toISOString(),
      online,
      max
    })

    // 限制数量，删除最旧的数据
    if (records.length > MAX_RECORDS) {
      records = records.slice(records.length - MAX_RECORDS)
    }

    try {
      fs.writeFileSync(filePath, JSON.stringify(records, null, 2))
    } catch (e: any) {
      logger.error(`保存玩家统计数据失败: ${e.message}`)
    }
  }

  /**
   * 获取指定实例的历史在线人数数据
   */
  getHistory(instanceId: string): PlayerSnapshot[] {
    const filePath = path.join(this.baseDir, `${instanceId}.json`)
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      }
    } catch {}
    return []
  }
}
