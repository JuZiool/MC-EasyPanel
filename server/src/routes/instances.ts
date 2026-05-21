import { Router } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js'
import { queryMultipleInstancePlayers } from '../utils/mcQuery.js'
import logger from '../utils/logger.js'
import type { PlayerStatsRecorder } from '../utils/playerStatsRecorder.js'
import type { PlayerSessionTracker } from '../utils/playerSessionTracker.js'

export function setupInstanceRoutes(instanceManager: any, playerStatsRecorder?: PlayerStatsRecorder, playerSessionTracker?: PlayerSessionTracker) {
  const router = Router()
  router.use(authenticateToken)

  router.get('/', (_req: AuthenticatedRequest, res) => {
    res.json({ success: true, data: instanceManager.getInstances() })
  })

  // 查询所有运行中 Minecraft 实例的在线玩家信息（必须在 /:id 前面）
  router.get('/players', async (req: AuthenticatedRequest, res) => {
    const allInstances = instanceManager.getInstances() as any[]
    const targetInstances = allInstances.filter(
      (i: any) => i.status === 'running' && (i.instanceType === 'minecraft-java' || i.workingDirectory)
    )
    if (targetInstances.length === 0) {
      return res.json({ success: true, data: {} })
    }
    const players = await queryMultipleInstancePlayers(
      targetInstances.map((i: any) => ({ id: i.id, name: i.name, workingDirectory: i.workingDirectory }))
    )
    const result: Record<string, any> = {}
    for (const inst of targetInstances) {
      if (players[inst.id]) {
        result[inst.id] = {
          instanceId: inst.id,
          instanceName: inst.name,
          ...players[inst.id]
        }
      }
    }
    res.json({ success: true, data: result })
  })

  router.get('/:id', (req: AuthenticatedRequest, res) => {
    const inst = instanceManager.getInstance(req.params.id)
    if (!inst) return res.status(404).json({ success: false, message: '实例不存在' })
    res.json({ success: true, data: inst })
  })

  // 获取实例的历史在线人数数据
  router.get('/:id/player-stats', (req: AuthenticatedRequest, res) => {
    const inst = instanceManager.getInstance(req.params.id)
    if (!inst) return res.status(404).json({ success: false, message: '实例不存在' })
    const history = playerStatsRecorder ? playerStatsRecorder.getHistory(req.params.id) : []
    res.json({ success: true, data: history })
  })

  // 获取实例的所有玩家会话记录（在线 + 历史）
  router.get('/:id/player-sessions', (req: AuthenticatedRequest, res) => {
    const inst = instanceManager.getInstance(req.params.id)
    if (!inst) return res.status(404).json({ success: false, message: '实例不存在' })
    const sessions = playerSessionTracker ? playerSessionTracker.getAllSessions(req.params.id) : []
    res.json({ success: true, data: sessions })
  })

  router.post('/', (req: AuthenticatedRequest, res) => {
    const inst = instanceManager.createInstance(req.body)
    res.json({ success: true, data: inst })
  })

  router.put('/:id', (req: AuthenticatedRequest, res) => {
    const inst = instanceManager.updateInstance(req.params.id, req.body)
    if (!inst) return res.status(404).json({ success: false, message: '实例不存在' })
    res.json({ success: true, data: inst })
  })

  router.delete('/:id', (req: AuthenticatedRequest, res) => {
    const removeFiles = req.query.removeFiles === '1'
    const result = instanceManager.deleteInstance(req.params.id, removeFiles)
    if (!result) return res.status(404).json({ success: false, message: '实例不存在' })
    res.json({ success: true, message: removeFiles ? '已删除（含文件）' : '已删除' })
  })

  router.post('/:id/start', async (req: AuthenticatedRequest, res) => {
    const result = await instanceManager.startInstance(req.params.id)
    if (!result.success) return res.status(400).json({ success: false, message: result.error || '启动失败' })
    res.json({ success: true, data: { terminalSessionId: result.terminalSessionId } })
  })

  router.post('/:id/stop', async (req: AuthenticatedRequest, res) => {
    const result = await instanceManager.stopInstance(req.params.id)
    if (!result) return res.status(400).json({ success: false, message: '停止失败' })
    res.json({ success: true, message: '正在停止...' })
  })

  router.post('/:id/restart', async (req: AuthenticatedRequest, res) => {
    await instanceManager.stopInstance(req.params.id)
    // 轮询等待实例状态变为 stopped（最多等 15 秒）
    const maxWait = 15000
    const pollInterval = 500
    const deadline = Date.now() + maxWait
    let stopped = false
    while (Date.now() < deadline) {
      const inst = instanceManager.getInstance(req.params.id)
      if (inst && inst.status === 'stopped') {
        stopped = true
        break
      }
      await new Promise(r => setTimeout(r, pollInterval))
    }
    if (!stopped) {
      logger.warn(`实例 ${req.params.id} 重启：等待停止超时，强制启动`)
    }
    const result = await instanceManager.startInstance(req.params.id)
    if (!result.success) return res.status(400).json({ success: false, message: result.error })
    res.json({ success: true, data: { terminalSessionId: result.terminalSessionId } })
  })

  return router
}
