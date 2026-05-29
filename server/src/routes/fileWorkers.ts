import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { Worker } from 'worker_threads'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js'
import { emitProgress } from '../utils/progressTracker.js'
import { isValidPath, WORKER_PATH } from './fileUtils.js'

const router = Router()

// ======================== 后台异步操作函数（Worker 线程执行） ========================

/**
 * 创建 Worker 并桥接消息到 Socket.IO 进度事件
 */
function createWorkerBridge(
  taskData: any,
  io: any,
  socketId: string | undefined,
  operationId: string,
  opType: string,
  labels: {
    progress?: (progress: number, subLabel?: string) => string
    complete?: (subLabel?: string) => string
    error: string
  }
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, { workerData: taskData })

    worker.on('message', (msg: any) => {
      switch (msg.type) {
        case 'progress':
          if (socketId) {
            emitProgress(io, socketId, {
              operationId, type: opType as any, status: 'active',
              progress: msg.progress,
              label: labels.progress?.(msg.progress, msg.subLabel) || `处理中 ${msg.progress}%`,
              subLabel: msg.subLabel,
            })
          }
          break
        case 'complete':
          if (socketId) {
            emitProgress(io, socketId, {
              operationId, type: opType as any, status: 'completed', progress: 100,
              label: labels.complete?.(msg.subLabel) || '完成',
              subLabel: msg.subLabel,
            })
          }
          resolve()
          break
        case 'error':
          if (socketId) {
            emitProgress(io, socketId, {
              operationId, type: opType as any, status: 'error', progress: 0,
              label: labels.error, error: msg.error,
            })
          }
          reject(new Error(msg.error))
          break
      }
    })
    worker.on('error', (err) => {
      console.error('Worker 异常:', err)
      if (socketId) {
        emitProgress(io, socketId, {
          operationId, type: opType as any, status: 'error', progress: 0,
          label: labels.error, error: err.message,
        })
      }
      reject(err)
    })
    worker.on('exit', (code) => {
      if (code !== 0) {
        const errMsg = `Worker 异常退出码: ${code}`
        if (socketId) {
          emitProgress(io, socketId, {
            operationId, type: opType as any, status: 'error', progress: 0,
            label: labels.error, error: errMsg,
          })
        }
        reject(new Error(errMsg))
      }
    })
  })
}

/**
 * 后台异步删除
 */
async function runDeleteInBackground(
  targetPath: string, io: any, socketId: string | undefined, operationId: string
): Promise<void> {
  const baseName = path.basename(targetPath)
  return createWorkerBridge(
    { type: 'delete', targetPath }, io, socketId, operationId, 'delete',
    {
      progress: () => `删除: ${baseName}`,
      complete: () => `已删除: ${baseName}`,
      error: '删除失败',
    }
  )
}

/**
 * 后台异步批量删除
 */
async function runBatchDeleteInBackground(
  paths: string[], io: any, socketId: string | undefined, operationId: string
): Promise<void> {
  return createWorkerBridge(
    { type: 'batch-delete', paths }, io, socketId, operationId, 'delete',
    {
      progress: (p) => `批量删除 ${p}%`,
      complete: (sub) => sub?.includes('失败') ? '批量删除完成（部分失败）' : '批量删除完成',
      error: '批量删除失败',
    }
  )
}

/**
 * 后台异步复制
 */
async function runCopyInBackground(
  srcPath: string, destPath: string, io: any, socketId: string | undefined, operationId: string
): Promise<void> {
  const baseName = path.basename(srcPath)
  return createWorkerBridge(
    { type: 'copy', srcPath, destPath }, io, socketId, operationId, 'copy',
    {
      progress: () => `复制: ${baseName}`,
      complete: () => `已复制: ${baseName}`,
      error: '复制失败',
    }
  )
}

/**
 * 后台异步移动（Worker 线程）
 */
async function runMoveInBackground(
  srcPath: string, destPath: string, io: any, socketId: string | undefined, operationId: string
): Promise<void> {
  const baseName = path.basename(srcPath)
  return createWorkerBridge(
    { type: 'move', srcPath, destPath }, io, socketId, operationId, 'move',
    {
      progress: () => `移动: ${baseName}`,
      complete: () => `已移动: ${baseName}`,
      error: '移动失败',
    }
  )
}

/**
 * 后台异步压缩（单个文件/目录）
 */
async function runCompressInBackground(
  targetPath: string, io: any, socketId: string | undefined, operationId: string
): Promise<void> {
  return createWorkerBridge(
    { type: 'compress', targetPath }, io, socketId, operationId, 'compress',
    {
      progress: () => `压缩: ${path.basename(targetPath)}`,
      complete: () => `已压缩: ${path.basename(targetPath)}.zip`,
      error: '压缩失败',
    }
  )
}

/**
 * 后台异步批量压缩
 */
async function runCompressBatchInBackground(
  paths: string[], zipName: string, io: any, socketId: string | undefined, operationId: string
): Promise<void> {
  return createWorkerBridge(
    { type: 'compress-batch', paths, zipName }, io, socketId, operationId, 'compress',
    {
      progress: () => `批量压缩: ${zipName}`,
      complete: () => `批量压缩: ${zipName}`,
      error: '批量压缩失败',
    }
  )
}

/**
 * 后台异步解压（Worker 线程执行）
 */
async function extractInBackground(zipPath: string, targetDir: string, io: any, socketId: string | undefined, operationId: string): Promise<void> {
  return createWorkerBridge(
    { type: 'extract', zipPath, targetDir }, io, socketId, operationId, 'extract',
    {
      progress: () => '正在解压...',
      complete: () => '解压完成: ' + path.basename(zipPath),
      error: '解压失败',
    }
  )
}

// ======================== 路由 ========================

router.post('/delete', async (req: AuthenticatedRequest, res) => {
  const { path: targetPath, operationId, socketId } = req.body
  if (!targetPath || !isValidPath(targetPath)) return res.status(400).json({ success: false, message: '无效路径' })
  const io = req.app.get('io')
  
  // 后台异步删除
  res.json({ success: true, message: '正在删除...' })
  
  runDeleteInBackground(targetPath, io, socketId, operationId).catch((err: any) => {
    console.error('后台删除异常:', err)
  })
})

router.post('/batch-delete', async (req: AuthenticatedRequest, res) => {
  const { paths, operationId, socketId } = req.body
  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ success: false, message: '无效路径列表' })
  }
  for (const p of paths) { if (!isValidPath(p)) return res.status(400).json({ success: false, message: '包含无效路径' }) }
  const io = req.app.get('io')

  res.json({ success: true, message: '正在批量删除...' })

  runBatchDeleteInBackground(paths, io, socketId, operationId).catch((err: any) => {
    console.error('后台批量删除异常:', err)
  })
})

router.post('/copy', async (req: AuthenticatedRequest, res) => {
  const { path: srcPath, destPath, operationId, socketId } = req.body
  if (!srcPath || !destPath || !isValidPath(srcPath) || !isValidPath(destPath)) return res.status(400).json({ success: false, message: '无效路径' })
  const io = req.app.get('io')
  
  // 后台异步复制
  res.json({ success: true, message: '正在复制...' })
  
  runCopyInBackground(srcPath, destPath, io, socketId, operationId).catch((err: any) => {
    console.error('后台复制异常:', err)
  })
})

router.post('/move', async (req: AuthenticatedRequest, res) => {
  const { path: srcPath, destPath, operationId, socketId } = req.body
  if (!srcPath || !destPath || !isValidPath(srcPath) || !isValidPath(destPath)) return res.status(400).json({ success: false, message: '无效路径' })
  const io = req.app.get('io')

  // 后台异步移动（Worker 线程，支持跨文件系统）
  res.json({ success: true, message: '正在移动...' })

  runMoveInBackground(srcPath, destPath, io, socketId, operationId).catch((err: any) => {
    console.error('后台移动异常:', err)
  })
})

router.post('/compress', async (req: AuthenticatedRequest, res) => {
  const { path: targetPath, operationId, socketId } = req.body
  if (!targetPath || !isValidPath(targetPath)) return res.status(400).json({ success: false, message: '无效路径' })
  const io = req.app.get('io')
  
  // 后台异步压缩
  res.json({ success: true, message: '正在压缩...' })
  
  runCompressInBackground(targetPath, io, socketId, operationId).catch((err: any) => {
    console.error('后台压缩异常:', err)
  })
})

router.post('/compress-batch', async (req: AuthenticatedRequest, res) => {
  const { paths, name, operationId, socketId } = req.body
  if (!paths || !Array.isArray(paths) || paths.length === 0) return res.status(400).json({ success: false, message: '无效路径列表' })
  for (const p of paths) { if (!isValidPath(p)) return res.status(400).json({ success: false, message: '包含无效路径' }) }
  const io = req.app.get('io')
  
  // 后台异步压缩
  res.json({ success: true, message: '正在压缩...' })
  
  runCompressBatchInBackground(paths, name || `batch-${Date.now()}.zip`, io, socketId, operationId).catch((err: any) => {
    console.error('后台批量压缩异常:', err)
  })
})

router.post('/extract', async (req: AuthenticatedRequest, res) => {
  const { path: zipPath, destPath, operationId, socketId } = req.body
  if (!zipPath || !isValidPath(zipPath)) return res.status(400).json({ success: false, message: '无效路径' })
  if (!fs.existsSync(zipPath)) return res.status(400).json({ success: false, message: '压缩包不存在' })
  const io = req.app.get('io')
  const targetDir = destPath || path.dirname(zipPath)
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

  // 立即返回响应，后台异步解压
  res.json({ success: true, message: '解压已开始', data: { path: targetDir } })

  // 后台解压（不阻塞响应）
  extractInBackground(zipPath, targetDir, io, socketId, operationId).catch((err: any) => {
    console.error('后台解压异常:', err)
  })
})

export default router
