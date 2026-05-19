import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import logger from './utils/logger.js'
import { setupAuthRoutes } from './routes/auth.js'
import InstanceManager from './modules/InstanceManager.js'
import { setupInstanceRoutes } from './routes/instances.js'
import logBuffer from './utils/logBuffer.js'
import systemRoutes from './routes/system.js'
import filesRouter from './routes/files.js'
import { PlayerStatsRecorder } from './utils/playerStatsRecorder.js'
import { queryInstancePlayers } from './utils/mcQuery.js'

dotenv.config()
const PORT = parseInt(process.env.SERVER_PORT || '3001', 10)

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
})

app.set('io', io)

app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: false }))
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 确保 data 目录存在
const dataDir = path.resolve(process.cwd(), 'server', 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

// 静态文件
const publicDir = path.resolve(process.cwd(), 'client', 'dist')
if (fs.existsSync(publicDir)) app.use(express.static(publicDir))

// 健康检查
app.get('/api/health', (_req, res) => res.json({ success: true, message: 'Mc-EasyPanel 运行中' }))

// 路由
const instanceManager = new InstanceManager()
instanceManager.initialize()

// 玩家数据记录器
const playerStatsRecorder = new PlayerStatsRecorder({
  getInstances: () => instanceManager.getInstances(),
  queryPlayerCount: async (workingDirectory) => {
    const status = await queryInstancePlayers(workingDirectory)
    if (status.online && status.players) {
      return { online: status.players.online, max: status.players.max }
    }
    return null
  }
})
playerStatsRecorder.start()

instanceManager.on('instance-status-changed', (data) => {
  io.emit('instance-status', data)
})

instanceManager.on('terminal-create', async ({ id, command, cwd, sessionId }) => {
  if (!command) return
  try {
    const { spawn } = await import('node-pty')
    const ptyProcess = spawn(
      process.platform === 'win32' ? 'powershell.exe' : 'bash',
      process.platform === 'win32' ? [] : ['-c', command],
      { name: 'xterm-color', cols: 80, rows: 24, cwd: cwd || process.cwd(), env: process.env as any }
    )
    activeTerminals.set(sessionId, ptyProcess)
    ptyProcess.onData((data: string) => {
      logBuffer.append(sessionId, data, id)
      io.emit('terminal-output', { sessionId, data })
    })
    ptyProcess.onExit(() => {
      io.emit('terminal-exit', { sessionId })
      instanceManager.setInstanceStopped(id)
      activeTerminals.delete(sessionId)
    })
    io.emit('pty-created', { sessionId, instanceId: id })
    logger.info(`实例 ${id} 的 PTY 已创建: ${sessionId}`)
  } catch (err: any) {
    logger.error(`实例 ${id} PTY 创建失败: ${err.message}`)
    instanceManager.setInstanceError(id)
  }
})

instanceManager.on('instance-input', ({ id, data }) => {
  const inst = instanceManager.getInstance(id)
  if (inst && inst.terminalSessionId) {
    const pty = activeTerminals.get(inst.terminalSessionId)
    if (pty) pty.write(data)
  }
})

instanceManager.on('instance-force-stop', ({ id }) => {
  const inst = instanceManager.getInstance(id)
  if (inst && inst.terminalSessionId) {
    const pty = activeTerminals.get(inst.terminalSessionId)
    if (pty) { pty.kill(); activeTerminals.delete(inst.terminalSessionId) }
  }
  instanceManager.setInstanceStopped(id)
})

app.use('/api/auth', setupAuthRoutes())
app.use('/api/instances', setupInstanceRoutes(instanceManager, playerStatsRecorder))
app.use('/api/system', systemRoutes)
app.use('/api/files', filesRouter)

// Socket.IO 认证
io.use(async (socket, next) => {
  try {
    const { token } = socket.handshake.auth
    if (!token) return next(new Error('未提供认证令牌'))
    const jwt = await import('jsonwebtoken')
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'mc-easypanel-default-secret-change-me') as any
    socket.data.user = { userId: decoded.userId, username: decoded.username, role: decoded.role }
    next()
  } catch { next(new Error('认证失败')) }
})

const activeTerminals = new Map<string, any>()

io.on('connection', (socket) => {
  logger.info(`Socket 已连接: ${socket.id}`)

  socket.on('create-pty', async ({ sessionId, cols, rows, cwd, command }) => {
    try {
      const { spawn } = await import('node-pty')
      const ptyProcess = spawn(
        process.platform === 'win32' ? 'powershell.exe' : 'bash',
        process.platform === 'win32' ? [] : ['-c', command || 'bash'],
        { name: 'xterm-color', cols: cols || 80, rows: rows || 24, cwd: cwd || process.cwd(), env: process.env as any }
      )
      activeTerminals.set(sessionId, ptyProcess)
      socket.join(sessionId)

      ptyProcess.onData((data: string) => {
        logBuffer.append(sessionId, data)
        socket.emit('terminal-output', { sessionId, data })
      })

      ptyProcess.onExit(() => {
        socket.emit('terminal-exit', { sessionId })
        for (const inst of instanceManager.getInstances()) {
          if (inst.terminalSessionId === sessionId && inst.status === 'running') {
            instanceManager.setInstanceStopped(inst.id)
          }
        }
        activeTerminals.delete(sessionId)
      })

      socket.emit('pty-created', { sessionId })
    } catch (err: any) {
      socket.emit('terminal-error', { sessionId, error: err.message })
    }
  })

  socket.on('terminal-input', ({ sessionId, data }) => {
    const pty = activeTerminals.get(sessionId)
    if (pty) pty.write(data)
  })

  socket.on('terminal-resize', ({ sessionId, cols, rows }) => {
    const pty = activeTerminals.get(sessionId)
    if (pty) pty.resize(cols, rows)
  })

  socket.on('close-pty', ({ sessionId }) => {
    const pty = activeTerminals.get(sessionId)
    if (pty) {
      // 仅断开终端连接，不杀死进程
      // 不从 activeTerminals 删除 —— 重连后仍需通过 sessionId 发送输入
      // 进程自然退出时 onExit 会清理 activeTerminals
      logger.info(`终端会话已断开: ${sessionId}`)
    }
  })

  socket.on('get-terminal-history', ({ sessionId, instanceId }) => {
    let data = ''
    if (sessionId) data = logBuffer.getHistory(sessionId)
    if (!data && instanceId) data = logBuffer.readInstanceLog(instanceId)
    socket.emit('terminal-history', { sessionId, instanceId, data })
  })

  socket.on('disconnect', () => {
    logger.info(`Socket 已断开: ${socket.id}`)
  })
})

// SPA 支持
app.get('*', (_req, res) => {
  const indexPath = path.join(publicDir, 'index.html')
  if (fs.existsSync(indexPath)) res.sendFile(indexPath)
  else res.status(200).json({ message: 'Mc-EasyPanel 后端运行中' })
})

httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`Mc-EasyPanel 服务已启动，端口: ${PORT}`)
})
