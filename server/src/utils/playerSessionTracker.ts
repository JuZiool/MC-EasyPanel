import fs from 'fs'
import path from 'path'
import logger from './logger.js'

const POLL_INTERVAL = 30 * 1000 // 30 秒轮询一次
const SESSIONS_FILE = 'player-sessions.json'

export interface PlayerSession {
  playerName: string
  playerId: string
  instanceId: string
  firstSeen: string  // ISO timestamp
  lastSeen: string   // ISO timestamp
  active: boolean
}

interface PlayerSessionTrackerOptions {
  queryPlayers: (instances: { id: string; name: string; workingDirectory: string }[]) => Promise<Record<string, any>>
  getInstances: () => { id: string; name: string; workingDirectory: string; status: string }[]
}

export class PlayerSessionTracker {
  private timer: NodeJS.Timeout | null = null
  private sessions: PlayerSession[] = []
  private filePath: string
  private options: PlayerSessionTrackerOptions

  constructor(options: PlayerSessionTrackerOptions) {
    this.options = options
    const baseDir = process.cwd()
    const possiblePaths = [
      path.join(baseDir, 'server', 'data', 'player-stats'),
      path.join(baseDir, 'data', 'player-stats'),
    ]
    const dir = possiblePaths[0]
    fs.mkdirSync(dir, { recursive: true })
    this.filePath = path.join(dir, SESSIONS_FILE)
    this.loadSessions()
  }

  private loadSessions(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8')
        this.sessions = JSON.parse(content)
      }
    } catch {
      this.sessions = []
    }
  }

  private saveSessions(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.sessions, null, 2))
    } catch (e: any) {
      logger.error(`保存玩家会话数据失败: ${e.message}`)
    }
  }

  start(): void {
    this.poll()
    this.scheduleNext()
    logger.info(`玩家会话追踪器已启动，间隔 ${POLL_INTERVAL / 1000}s`)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    logger.info('玩家会话追踪器已停止')
  }

  private scheduleNext(): void {
    this.timer = setTimeout(() => {
      this.poll().finally(() => this.scheduleNext())
    }, POLL_INTERVAL)
  }

  private async poll(): Promise<void> {
    try {
      const instances = this.options.getInstances().filter(i => i.status === 'running')
      if (instances.length === 0) return

      const playersData = await this.options.queryPlayers(instances)
      const now = new Date().toISOString()

      // 收集当前所有在线玩家的 key: "instanceId:playerId"
      const currentPlayers = new Set<string>()

      for (const inst of instances) {
        const info = playersData[inst.id]
        if (!info || !info.players || !info.players.sample) continue

        for (const player of info.players.sample) {
          const key = `${inst.id}:${player.id}`
          currentPlayers.add(key)

          // 检查该玩家是否已有活跃会话
          const existing = this.sessions.find(
            s => s.playerId === player.id && s.instanceId === inst.id && s.active
          )

          if (!existing) {
            // 新玩家加入
            this.sessions.push({
              playerName: player.name,
              playerId: player.id,
              instanceId: inst.id,
              firstSeen: now,
              lastSeen: now,
              active: true
            })
          } else {
            // 更新最后活跃时间
            existing.lastSeen = now
          }
        }
      }

      // 标记已离开的玩家为 inactive
      let changed = false
      for (const session of this.sessions) {
        if (session.active) {
          const key = `${session.instanceId}:${session.playerId}`
          if (!currentPlayers.has(key)) {
            session.active = false
            session.lastSeen = now
            changed = true
          }
        }
      }

      // 有变化或有人在线上时才写入，减少 IO
      if (currentPlayers.size > 0 || changed) {
        this.saveSessions()
      }
    } catch (e: any) {
      logger.debug(`玩家会话轮询异常: ${e.message}`)
    }
  }

  /**
   * 获取指定实例当前在线的玩家会话
   */
  getActiveSessions(instanceId: string): PlayerSession[] {
    return this.sessions.filter(s => s.instanceId === instanceId && s.active)
  }

  /**
   * 获取指定实例的所有玩家会话记录（在线 + 历史）
   */
  getAllSessions(instanceId: string): PlayerSession[] {
    return this.sessions.filter(s => s.instanceId === instanceId)
  }
}
