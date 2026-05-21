import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import { Worker } from 'worker_threads'
import { fileURLToPath } from 'url'
import multer from 'multer'
import { authenticateToken, authenticateTokenFlexible, AuthenticatedRequest } from '../middleware/auth.js'
import { emitProgress } from '../utils/progressTracker.js'
import { ChunkUploadManager } from '../modules/chunkUploadManager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKER_PATH = path.join(__dirname, '..', 'workers', 'fileWorker.js')

const router = Router()
router.use(authenticateToken)

const upload = multer({
  dest: os.tmpdir() + '/mc-easypanel-uploads',
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 单文件限制 5GB
})

/** 系统关键路径黑名单 */
const SYSTEM_PATHS = ['/etc', '/bin', '/sbin', '/lib', '/lib64', '/usr', '/proc', '/dev', '/sys', '/boot', '/root', '/var', '/opt']

/** 允许操作的根路径 */
const ALLOWED_ROOTS = [
  '/app',
  '/server',
  process.cwd(),
]

function isWithinAllowedRoots(resolved: string): boolean {
  for (const root of ALLOWED_ROOTS) {
    const r = path.resolve(root)
    if (resolved === r || resolved.startsWith(r + '/')) return true
  }
  return false
}

function isNotSystemPath(resolved: string): boolean {
  for (const sp of SYSTEM_PATHS) {
    if (resolved === sp || resolved.startsWith(sp + '/')) return false
  }
  return true
}

function isValidPath(p: string): boolean {
  try {
    const real = fs.realpathSync.native(p)
    if (!path.isAbsolute(p) || p.includes('..')) return false
    if (path.relative(p, real).startsWith('..')) return false
    return isWithinAllowedRoots(real) && isNotSystemPath(real)
  } catch {
    if (!path.isAbsolute(p) || p.includes('..')) return false
    const resolved = path.resolve(p)
    if (!isNotSystemPath(resolved)) return false
    const parentDir = path.dirname(p)
    try {
      const realParent = fs.realpathSync.native(parentDir)
      if (path.relative(parentDir, realParent).startsWith('..')) return false
      return isWithinAllowedRoots(realParent)
    } catch {
      return isWithinAllowedRoots(resolved)
    }
  }
}

function isPathOperable(p: string): boolean {
  return isValidPath(p)
}

router.get('/list', (req: AuthenticatedRequest, res) => {
  const dirPath = req.query.path as string
  if (!dirPath || !isValidPath(dirPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    if (!fs.existsSync(dirPath)) return res.status(404).json({ success: false, message: '路径不存在' })
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 50
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const files = entries.map(e => {
      try {
        const fullPath = path.join(dirPath, e.name)
        const stat = fs.statSync(fullPath)
        const perm = (stat.mode & 0o777).toString(8).padStart(3, '0')
        return { name: e.name, path: fullPath, type: e.isDirectory() ? 'directory' : 'file', size: stat.size, modified: stat.mtime.toISOString(), permissions: perm }
      } catch { return null }
    }).filter(Boolean).sort((a: any, b: any) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    const total = files.length
    const totalPages = Math.ceil(total / pageSize)
    const paginated = files.slice((page - 1) * pageSize, page * pageSize)
    res.json({ success: true, data: { files: paginated, pagination: { page, pageSize, total, totalPages, hasMore: page < totalPages } } })
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

router.get('/search', (req: AuthenticatedRequest, res) => {
  const rootPath = req.query.path as string
  const query = (req.query.query as string || '').toLowerCase().trim()
  if (!rootPath || !isValidPath(rootPath)) return res.status(400).json({ success: false, message: '无效路径' })
  if (!query) return res.json({ success: true, data: [] })
  try {
    if (!fs.existsSync(rootPath)) return res.status(404).json({ success: false, message: '路径不存在' })
    const maxDepth = parseInt(req.query.depth as string) || 5
    const results: { name: string; path: string; type: 'file' | 'directory'; size: number; modified: string; permissions: string }[] = []

    function walk(dir: string, depth: number) {
      if (depth > maxDepth) return
      let entries: fs.Dirent[]
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        if (e.name.startsWith('.')) continue
        const fullPath = path.join(dir, e.name)
        if (!e.name.toLowerCase().includes(query)) {
          if (e.isDirectory()) walk(fullPath, depth + 1)
          continue
        }
        try {
          const stat = fs.statSync(fullPath)
          const perm = (stat.mode & 0o777).toString(8).padStart(3, '0')
          results.push({ name: e.name, path: fullPath, type: e.isDirectory() ? 'directory' : 'file', size: stat.size, modified: stat.mtime.toISOString(), permissions: perm })
        } catch { /* skip */ }
        if (e.isDirectory()) walk(fullPath, depth + 1)
      }
    }

    walk(rootPath, 0)
    results.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    res.json({ success: true, data: results.slice(0, 200) })
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

router.get('/read', (req: AuthenticatedRequest, res) => {
  const filePath = req.query.path as string
  if (!filePath || !isValidPath(filePath)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    res.json({ success: true, data: { content } })
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

router.post('/save', (req: AuthenticatedRequest, res) => {
  const { path: filePath, content } = req.body
  if (!filePath || !isValidPath(filePath)) return res.status(400).json({ success: false, message: '无效路径' })
  try { fs.writeFileSync(filePath, content, 'utf-8'); res.json({ success: true, message: '保存成功' }) }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

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

router.post('/mkdir', (req: AuthenticatedRequest, res) => {
  const { path: dirPath } = req.body
  if (!dirPath || !isValidPath(dirPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try { fs.mkdirSync(dirPath, { recursive: true }); res.json({ success: true, message: '已创建' }) }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

router.post('/rename', (req: AuthenticatedRequest, res) => {
  const { path: oldPath, newPath } = req.body
  if (!oldPath || !newPath || !isValidPath(oldPath) || !isValidPath(newPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try { fs.renameSync(oldPath, newPath); res.json({ success: true, message: '已重命名' }) }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

router.post('/upload', upload.array('files'), (req: AuthenticatedRequest, res) => {
  const targetDir = req.body.path
  if (!targetDir || !isValidPath(targetDir)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    const files = req.files as Express.Multer.File[]
    files.forEach(f => {
      const safeName = path.basename(Buffer.from(f.originalname, 'latin1').toString('utf8'))
      const targetPath = path.join(targetDir, safeName)
      fs.copyFileSync(f.path, targetPath)
      fs.unlinkSync(f.path)
    })
    res.json({ success: true, message: `已上传 ${files.length} 个文件` })
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

router.get('/download', authenticateTokenFlexible, (req: AuthenticatedRequest, res) => {
  const filePath = req.query.path as string
  if (!filePath || !isValidPath(filePath)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    const name = path.basename(filePath)
    res.download(filePath, name)
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
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

// ============================================================
// 分片上传路由
// ============================================================

// 检查已上传的分片（断点续传）
router.post('/upload/check', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { uploadId, fileName, fileSize, totalChunks } = req.body

    if (!uploadId || !fileName || !fileSize || !totalChunks) {
      return res.status(400).json({ success: false, message: '缺少必要参数' })
    }

    const chunkManager = ChunkUploadManager.getInstance()

    await chunkManager.getOrCreateUpload(
      uploadId,
      fileName,
      fileSize,
      totalChunks,
      ''
    )

    const uploadedChunks = chunkManager.getUploadedChunks(uploadId)

    res.json({
      success: true,
      data: { uploadId, uploadedChunks, totalChunks }
    })
  } catch (error: any) {
    console.error('Check upload error:', error)
    res.status(500).json({ success: false, message: error.message || '检查上传状态失败' })
  }
})

// 上传单个分片
router.post('/upload/chunk', authenticateToken, upload.single('chunk'), async (req: AuthenticatedRequest, res) => {
  try {
    const { uploadId, fileName, fileSize, chunkIndex, totalChunks, chunkHash, targetPath } = req.body
    const chunkFile = req.file

    if (!uploadId || !fileName || !fileSize || chunkIndex === undefined || !totalChunks || !chunkHash || !targetPath || !chunkFile) {
      return res.status(400).json({ success: false, message: '缺少必要参数' })
    }

    const chunkManager = ChunkUploadManager.getInstance()

    await chunkManager.getOrCreateUpload(
      uploadId,
      fileName,
      parseInt(fileSize),
      parseInt(totalChunks),
      targetPath
    )

    // 读取分片数据
    const chunkData = fs.readFileSync(chunkFile.path)

    // 保存分片
    await chunkManager.saveChunk(
      uploadId,
      parseInt(chunkIndex),
      chunkData,
      chunkHash
    )

    // 删除临时文件
    try {
      if (fs.existsSync(chunkFile.path)) {
        fs.unlinkSync(chunkFile.path)
      }
    } catch (err) {
      console.warn('删除临时分片文件失败:', err)
    }

    res.json({
      success: true,
      message: `分片 ${chunkIndex} 上传成功`,
      data: { chunkIndex: parseInt(chunkIndex), uploaded: true }
    })
  } catch (error: any) {
    console.error('Upload chunk error:', error)

    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path) } catch { /* ignore */ }
    }

    res.status(500).json({ success: false, message: error.message || '分片上传失败' })
  }
})

// 合并分片
router.post('/upload/merge', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { uploadId, fileName, fileSize, totalChunks, targetPath, conflictStrategy = 'rename' } = req.body

    if (!uploadId || !fileName || !fileSize || !totalChunks || !targetPath) {
      return res.status(400).json({ success: false, message: '缺少必要参数' })
    }

    const chunkManager = ChunkUploadManager.getInstance()

    if (!chunkManager.isUploadComplete(uploadId)) {
      const uploadedChunks = chunkManager.getUploadedChunks(uploadId)
      return res.status(400).json({
        success: false,
        message: `文件未完全上传，已上传 ${uploadedChunks.length}/${totalChunks} 个分片`
      })
    }

    // 安全校验：禁止路径遍历
    if (!isValidPath(targetPath)) {
      return res.status(400).json({ success: false, message: '无效的目标路径' })
    }
    const safeFileName = path.basename(fileName)
    const fullTargetPath = path.resolve(targetPath)
    const targetFilePath = path.join(fullTargetPath, safeFileName)

    // 检查文件是否已存在
    let finalFilePath = targetFilePath
    const fileExists = fs.existsSync(targetFilePath)

    if (fileExists) {
      if (conflictStrategy === 'replace') {
        console.log(`Replacing existing file: ${fileName}`)
        fs.unlinkSync(targetFilePath)
      } else {
        // 自动重命名：添加序号
        let counter = 1
        while (fs.existsSync(finalFilePath)) {
          const ext = path.extname(fileName)
          const nameWithoutExt = path.basename(fileName, ext)
          const newFileName = `${nameWithoutExt}(${counter})${ext}`
          finalFilePath = path.join(fullTargetPath, newFileName)
          counter++
        }
        console.log(`Renaming file: ${fileName} -> ${path.basename(finalFilePath)}`)
      }
    }

    // 合并分片
    await chunkManager.mergeChunks(uploadId, finalFilePath)

    res.json({
      success: true,
      message: '文件合并成功',
      data: {
        filePath: finalFilePath,
        fileName: path.basename(finalFilePath),
        fileSize: parseInt(fileSize),
        replaced: fileExists && conflictStrategy === 'replace'
      }
    })
  } catch (error: any) {
    console.error('Merge chunks error:', error)
    res.status(500).json({ success: false, message: error.message || '合并文件失败' })
  }
})

// 取消上传
router.delete('/upload/cancel/:uploadId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { uploadId } = req.params

    if (!uploadId) {
      return res.status(400).json({ success: false, message: '缺少uploadId' })
    }

    const chunkManager = ChunkUploadManager.getInstance()
    await chunkManager.cancelUpload(uploadId)

    res.json({ success: true, message: '上传已取消' })
  } catch (error: any) {
    console.error('Cancel upload error:', error)
    res.status(500).json({ success: false, message: error.message || '取消上传失败' })
  }
})

// ============================================================
// 文件权限路由（仅 Linux 系统支持）
// ============================================================

// 获取文件/目录权限信息
router.get('/permissions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (process.platform === 'win32') {
      return res.status(400).json({ success: false, message: 'Windows 系统不支持此功能' })
    }
    const filePath = req.query.path as string
    if (!filePath || !isValidPath(filePath)) {
      return res.status(400).json({ success: false, message: '无效的路径' })
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件或目录不存在' })
    }
    const stats = fs.statSync(filePath)
    const statResult = await new Promise<string>((resolve, reject) => {
      const child = spawn('stat', ['-c', '%a %U %G', '--', filePath])
      let out = '', err = ''
      child.stdout.on('data', (d: Buffer) => { out += d.toString() })
      child.stderr.on('data', (d: Buffer) => { err += d.toString() })
      child.on('close', (code) => {
        if (code === 0) resolve(out.trim())
        else reject(new Error(err.trim() || `stat 退出码: ${code}`))
      })
      child.on('error', (e) => reject(e))
    })
    const [octalPermissions, owner, group] = statResult.split(' ')

    const parseOctalPermissions = (octal: string) => {
      const ownerPerms = parseInt(octal[0])
      const groupPerms = parseInt(octal[1])
      const othersPerms = parseInt(octal[2])
      const parsePermBits = (bits: number) => ({
        read: (bits & 4) !== 0,
        write: (bits & 2) !== 0,
        execute: (bits & 1) !== 0
      })
      return {
        owner: parsePermBits(ownerPerms),
        group: parsePermBits(groupPerms),
        others: parsePermBits(othersPerms)
      }
    }

    res.json({
      success: true,
      data: {
        owner,
        group,
        permissions: parseOctalPermissions(octalPermissions),
        octal: octalPermissions,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime.toISOString()
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// 修改文件/目录权限
router.post('/permissions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (process.platform === 'win32') {
      return res.status(400).json({ success: false, message: 'Windows 系统不支持此功能' })
    }
    const { path: filePath, permissions, recursive } = req.body
    if (!filePath || !isValidPath(filePath)) {
      return res.status(400).json({ success: false, message: '无效的路径' })
    }
    if (!permissions) {
      return res.status(400).json({ success: false, message: '权限参数不能为空' })
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件或目录不存在' })
    }

    // 支持八进制字符串 "777" 或对象 {owner, group, others}
    let octalPermissions: string
    if (typeof permissions === 'string' && /^[0-7]{3,4}$/.test(permissions)) {
      octalPermissions = permissions
    } else if (typeof permissions === 'object' && permissions.owner && permissions.group && permissions.others) {
      const convertPermBits = (perms: { read: boolean; write: boolean; execute: boolean }) =>
        (perms.read ? 4 : 0) + (perms.write ? 2 : 0) + (perms.execute ? 1 : 0)
      const ownerBits = convertPermBits(permissions.owner)
      const groupBits = convertPermBits(permissions.group)
      const othersBits = convertPermBits(permissions.others)
      octalPermissions = `${ownerBits}${groupBits}${othersBits}`
    } else {
      return res.status(400).json({ success: false, message: '权限格式无效，请使用 "777" 或 {owner:{read,write,execute},...}' })
    }

    const mode = parseInt(octalPermissions, 8)
    if (recursive) {
      await new Promise<void>((resolve, reject) => {
        const child = spawn('chmod', ['-R', mode.toString(8), '--', filePath])
        let err = ''
        child.stderr.on('data', (d: Buffer) => { err += d.toString() })
        child.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(err.trim() || `chmod 退出码: ${code}`))
        })
        child.on('error', (e) => reject(e))
      })
    } else {
      fs.chmodSync(filePath, mode)
    }

    res.json({ success: true, message: '权限修改成功', data: { octal: octalPermissions } })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
