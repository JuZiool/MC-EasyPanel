import fs from 'fs'
import path from 'path'
import logger from './logger.js'

const POLL_INTERVAL = 30 * 1000
const SESSIONS_FILE = 'player-sessions.json'
const TOTALS_FILE = 'player-totals.json'

export interface PlayerSession {
  playerName: string
  playerId: string
  instanceId: string
  firstSeen: string
  lastSeen: string
  active: boolean
}

export interface PlayerTotal {
  playerName: string
  playerId: string
  instanceId: string
  totalDurationMs: number
  lastSeen: string
  active: boolean
  currentSessionStartedAt?: string
}

export interface PlayerTrackingData {
  sessions: PlayerSession[]
  players: PlayerTotal[]
  listStatus: 'available' | 'unsupported' | 'unavailable'
}

interface PlayerSessionTrackerOptions {
  queryPlayers: (instances: { id: string; name: string; workingDirectory: string }[]) => Promise<Record<string, any>>
  getInstances: () => { id: string; name: string; workingDirectory: string; status: string }[]
  onUpdate?: (dataByInstance: Record<string, PlayerTrackingData>) => void
  dataDir?: string
}

export class PlayerSessionTracker {
  private timer: NodeJS.Timeout | null = null
  private sessions: PlayerSession[] = []
  private totals: PlayerTotal[] = []
  private sessionsPath: string
  private totalsPath: string
  private options: PlayerSessionTrackerOptions
  private lastCleanup = 0
  private listStatusByInstance = new Map<string, PlayerTrackingData['listStatus']>()
  private activePoll: Promise<void> | null = null
  private running = false
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(options: PlayerSessionTrackerOptions) {
    this.options = options
    const baseDir = process.cwd()
    const possiblePaths = [
      path.join(baseDir, 'server', 'data', options.dataDir || 'player-stats'),
      path.join(baseDir, 'data', options.dataDir || 'player-stats'),
    ]
    const dir = possiblePaths.find(candidate => fs.existsSync(candidate)) || possiblePaths[0]
    fs.mkdirSync(dir, { recursive: true })
    this.sessionsPath = path.join(dir, SESSIONS_FILE)
    this.totalsPath = path.join(dir, TOTALS_FILE)
    this.loadData()
  }

  private loadData(): void {
    try {
      if (fs.existsSync(this.sessionsPath)) {
        this.sessions = JSON.parse(fs.readFileSync(this.sessionsPath, 'utf-8'))
      }
    } catch {
      this.sessions = []
    }

    try {
      if (fs.existsSync(this.totalsPath)) {
        this.totals = JSON.parse(fs.readFileSync(this.totalsPath, 'utf-8'))
      } else {
        this.migrateTotalsFromSessions()
      }
    } catch {
      this.totals = []
      this.migrateTotalsFromSessions()
    }

    this.closeStaleActiveSessions()
  }

  private migrateTotalsFromSessions(): void {
    const totalsByPlayer = new Map<string, PlayerTotal>()
    for (const session of this.sessions) {
      const key = this.playerKey(session.instanceId, session.playerId)
      const duration = Math.max(0, new Date(session.lastSeen).getTime() - new Date(session.firstSeen).getTime())
      const existing = totalsByPlayer.get(key)
      if (existing) {
        existing.totalDurationMs += duration
        if (session.lastSeen >= existing.lastSeen) {
          existing.playerName = session.playerName
          existing.lastSeen = session.lastSeen
        }
      } else {
        totalsByPlayer.set(key, {
          playerName: session.playerName,
          playerId: session.playerId,
          instanceId: session.instanceId,
          totalDurationMs: duration,
          lastSeen: session.lastSeen,
          active: false,
        })
      }
      session.active = false
    }
    this.totals = Array.from(totalsByPlayer.values())
    void this.saveData()
  }

  private closeStaleActiveSessions(): void {
    let changed = false
    for (const session of this.sessions) {
      if (!session.active) continue
      session.active = false
      this.addCompletedDuration(session)
      changed = true
    }
    for (const total of this.totals) {
      total.active = false
      delete total.currentSessionStartedAt
    }
    if (changed) void this.saveData()
  }

  private async saveJson(filePath: string, value: unknown): Promise<void> {
    const tempPath = `${filePath}.tmp`
    await fs.promises.writeFile(tempPath, JSON.stringify(value, null, 2))
    await fs.promises.rename(tempPath, filePath)
    await fs.promises.chmod(filePath, 0o640)
  }

  private saveData(): Promise<void> {
    const sessions = this.sessions.map(session => ({ ...session }))
    const totals = this.totals.map(total => ({ ...total }))
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        await this.saveJson(this.sessionsPath, sessions)
        await this.saveJson(this.totalsPath, totals)
      })
      .catch((error: any) => {
        logger.error(`保存玩家追踪数据失败: ${error.message}`)
      })
    return this.writeQueue
  }

  start(): void {
    if (this.running) return
    this.running = true
    void this.pollAndSchedule()
    logger.info(`玩家会话追踪器已启动，间隔 ${POLL_INTERVAL / 1000}s`)
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.activePoll) await this.activePoll
    this.closeSessionsForInstances(new Set(this.options.getInstances().map(instance => instance.id)), new Date().toISOString())
    await this.writeQueue
    logger.info('玩家会话追踪器已停止')
  }

  private async pollAndSchedule(): Promise<void> {
    const activePoll = this.poll()
    this.activePoll = activePoll
    await activePoll
    if (this.activePoll === activePoll) this.activePoll = null
    if (!this.running) return
    this.timer = setTimeout(() => void this.pollAndSchedule(), POLL_INTERVAL)
  }

  private playerKey(instanceId: string, playerId: string): string {
    return `${instanceId}:${playerId}`
  }

  private getOrCreateTotal(instanceId: string, playerId: string, playerName: string, now: string): PlayerTotal {
    let total = this.totals.find(item => item.instanceId === instanceId && item.playerId === playerId)
    if (!total) {
      total = { playerName, playerId, instanceId, totalDurationMs: 0, lastSeen: now, active: false }
      this.totals.push(total)
    }
    total.playerName = playerName
    total.lastSeen = now
    return total
  }

  private addCompletedDuration(session: PlayerSession): void {
    const total = this.getOrCreateTotal(session.instanceId, session.playerId, session.playerName, session.lastSeen)
    total.totalDurationMs += Math.max(0, new Date(session.lastSeen).getTime() - new Date(session.firstSeen).getTime())
    total.active = false
    delete total.currentSessionStartedAt
  }

  private closeSessionsForInstances(instanceIds: Set<string>, now: string): boolean {
    let changed = false
    for (const session of this.sessions) {
      if (!session.active || !instanceIds.has(session.instanceId)) continue
      session.active = false
      session.lastSeen = now
      this.addCompletedDuration(session)
      changed = true
    }
    if (changed) void this.saveData()
    return changed
  }

  private async poll(): Promise<void> {
    const nowMs = Date.now()
    if (nowMs - this.lastCleanup > 30 * 60 * 1000) {
      this.lastCleanup = nowMs
      this.cleanupOldSessions()
    }

    try {
      const allInstances = this.options.getInstances()
      const runningInstances = allInstances.filter(instance => instance.status === 'running')
      const stoppedIds = new Set(allInstances.filter(instance => instance.status !== 'running').map(instance => instance.id))
      const now = new Date().toISOString()
      let changed = this.closeSessionsForInstances(stoppedIds, now)

      const playersData = runningInstances.length > 0 ? await this.options.queryPlayers(runningInstances) : {}
      for (const instance of runningInstances) {
        const info = playersData[instance.id]
        if (!info?.online || !info.players) {
          this.listStatusByInstance.set(instance.id, 'unavailable')
          continue
        }
        const playerSample = Array.isArray(info.players.sample)
          ? info.players.sample
          : info.players.online === 0 ? [] : null
        if (playerSample === null || playerSample.length < info.players.online) {
          this.listStatusByInstance.set(instance.id, 'unsupported')
          continue
        }
        this.listStatusByInstance.set(instance.id, 'available')

        const currentPlayerIds = new Set<string>()
        for (const player of playerSample) {
          currentPlayerIds.add(player.id)
          let session = this.sessions.find(item => item.instanceId === instance.id && item.playerId === player.id && item.active)
          if (!session) {
            session = { playerName: player.name, playerId: player.id, instanceId: instance.id, firstSeen: now, lastSeen: now, active: true }
            this.sessions.push(session)
            changed = true
          } else {
            session.playerName = player.name
            session.lastSeen = now
          }
          const total = this.getOrCreateTotal(instance.id, player.id, player.name, now)
          total.active = true
          total.currentSessionStartedAt = session.firstSeen
        }

        for (const session of this.sessions) {
          if (!session.active || session.instanceId !== instance.id || currentPlayerIds.has(session.playerId)) continue
          session.active = false
          session.lastSeen = now
          this.addCompletedDuration(session)
          changed = true
        }
      }

      if (changed || this.sessions.some(session => session.active)) await this.saveData()
      this.emitUpdate(allInstances.map(instance => instance.id))
    } catch (error: any) {
      logger.debug(`玩家会话轮询异常: ${error.message}`)
    }
  }

  private emitUpdate(instanceIds: string[]): void {
    if (!this.options.onUpdate) return
    const dataByInstance: Record<string, PlayerTrackingData> = {}
    for (const instanceId of instanceIds) dataByInstance[instanceId] = this.getTrackingData(instanceId)
    this.options.onUpdate(dataByInstance)
  }

  getTrackingData(instanceId: string): PlayerTrackingData {
    return {
      sessions: this.sessions.filter(session => session.instanceId === instanceId),
      players: this.totals
        .filter(total => total.instanceId === instanceId)
        .map(total => ({ ...total })),
      listStatus: this.listStatusByInstance.get(instanceId) || 'unavailable',
    }
  }

  private cleanupOldSessions(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now()
    const before = this.sessions.length
    this.sessions = this.sessions.filter(session => session.active || now - new Date(session.lastSeen).getTime() < maxAgeMs)
    if (this.sessions.length !== before) void this.saveData()
  }
}
