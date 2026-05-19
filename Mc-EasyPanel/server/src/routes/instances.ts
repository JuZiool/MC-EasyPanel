import { Router } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js'

export function setupInstanceRoutes(instanceManager: any) {
  const router = Router()
  router.use(authenticateToken)

  router.get('/', (_req: AuthenticatedRequest, res) => {
    res.json({ success: true, data: instanceManager.getInstances() })
  })

  router.get('/:id', (req: AuthenticatedRequest, res) => {
    const inst = instanceManager.getInstance(req.params.id)
    if (!inst) return res.status(404).json({ success: false, message: '实例不存在' })
    res.json({ success: true, data: inst })
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
    const result = instanceManager.deleteInstance(req.params.id)
    if (!result) return res.status(404).json({ success: false, message: '实例不存在' })
    res.json({ success: true, message: '已删除' })
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
    await new Promise(r => setTimeout(r, 2000))
    const result = await instanceManager.startInstance(req.params.id)
    if (!result.success) return res.status(400).json({ success: false, message: result.error })
    res.json({ success: true, data: { terminalSessionId: result.terminalSessionId } })
  })

  return router
}
