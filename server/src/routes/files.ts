import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import multer from 'multer'
import AdmZip from 'adm-zip'
import { authenticateToken, authenticateTokenFlexible, AuthenticatedRequest } from '../middleware/auth.js'
import { collectFiles, emitProgress } from '../utils/progressTracker.js'
import { ChunkUploadManager } from '../modules/chunkUploadManager.js'

const router = Router()
router.use(authenticateToken)

const upload = multer({
  dest: os.tmpdir() + '/mc-easypanel-uploads',
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 单文件限制 5GB
})

function isValidPath(p: string): boolean {
  return path.isAbsolute(p) && !p.includes('..')
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
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
        return { name: e.name, path: fullPath, type: e.isDirectory() ? 'directory' : 'file', size: stat.size, modified: stat.mtime.toISOString() }
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
    const results: { name: string; path: string; type: 'file' | 'directory'; size: number; modified: string }[] = []

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
          results.push({ name: e.name, path: fullPath, type: e.isDirectory() ? 'directory' : 'file', size: stat.size, modified: stat.mtime.toISOString() })
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

router.post('/delete', (req: AuthenticatedRequest, res) => {
  const { path: targetPath } = req.body
  if (!targetPath || !isValidPath(targetPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    const stat = fs.statSync(targetPath)
    if (stat.isDirectory()) fs.rmSync(targetPath, { recursive: true })
    else fs.unlinkSync(targetPath)
    res.json({ success: true, message: '已删除' })
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
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
      const originalname = Buffer.from(f.originalname, 'latin1').toString('utf8')
      const targetPath = path.join(targetDir, originalname)
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
  try {
    const stat = fs.statSync(srcPath)
    const baseName = path.basename(srcPath)
    if (stat.isDirectory()) {
      const total = collectFiles(srcPath).length
      if (total === 0) {
        fs.mkdirSync(destPath, { recursive: true })
      } else {
        let processed = 0
        const entries = collectFiles(srcPath)
        for (const entry of entries) {
          const targetFile = path.join(destPath, path.relative(srcPath, entry.fullPath))
          const targetDir = path.dirname(targetFile)
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
          fs.copyFileSync(entry.fullPath, targetFile)
          processed++
          if (socketId) {
            emitProgress(io, socketId, {
              operationId,
              type: 'copy',
              progress: Math.round((processed / total) * 100),
              label: `复制: ${baseName}`,
              subLabel: `${processed}/${total} 个文件`,
              status: 'active'
            })
          }
          await sleep(0)
        }
      }
    } else {
      const targetDir = path.dirname(destPath)
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
      fs.copyFileSync(srcPath, destPath)
    }
    if (socketId) {
      emitProgress(io, socketId, {
        operationId,
        type: 'copy',
        progress: 100,
        label: `复制: ${baseName}`,
        status: 'completed'
      })
    }
    res.json({ success: true, message: '已复制' })
  } catch (e: any) {
    if (socketId) {
      emitProgress(io, socketId, {
        operationId, type: 'copy', progress: 0, label: '复制失败', status: 'error', error: e.message
      })
    }
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/move', (req: AuthenticatedRequest, res) => {
  const { path: srcPath, destPath } = req.body
  if (!srcPath || !destPath || !isValidPath(srcPath) || !isValidPath(destPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try { fs.renameSync(srcPath, destPath); res.json({ success: true, message: '已移动' }) }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

router.post('/compress-batch', async (req: AuthenticatedRequest, res) => {
  const { paths, name, operationId, socketId } = req.body
  if (!paths || !Array.isArray(paths) || paths.length === 0) return res.status(400).json({ success: false, message: '无效路径列表' })
  for (const p of paths) { if (!isValidPath(p)) return res.status(400).json({ success: false, message: '包含无效路径' }) }
  const io = req.app.get('io')
  try {
    const parentDir = path.dirname(paths[0])
    const zipName = name || `batch-${Date.now()}.zip`
    const zipPath = path.join(parentDir, zipName)
    const zip = new AdmZip()

    let items: { fullPath: string; zipPrefix: string }[] = []
    for (const p of paths) {
      const stat = fs.statSync(p)
      const baseName = path.basename(p)
      if (stat.isDirectory()) {
        const files = collectFiles(p)
        for (const f of files) {
          items.push({ fullPath: f.fullPath, zipPrefix: path.join(baseName, f.zipPath) })
        }
      } else {
        items.push({ fullPath: p, zipPrefix: '' })
      }
    }

    const total = items.length
    let processed = 0

    for (const item of items) {
      zip.addLocalFile(item.fullPath, item.zipPrefix)
      processed++
      if (socketId) {
        emitProgress(io, socketId, {
          operationId,
          type: 'compress',
          progress: Math.round((processed / total) * 100),
          label: `批量压缩: ${zipName}`,
          subLabel: `${processed}/${total} 个文件`,
          status: 'active'
        })
      }
      await sleep(0)
    }

    zip.writeZip(zipPath)
    if (socketId) {
      emitProgress(io, socketId, {
        operationId, type: 'compress', progress: 100, label: `批量压缩: ${zipName}`, status: 'completed'
      })
    }
    res.json({ success: true, message: '已批量压缩', data: { path: zipPath, name: zipName } })
  } catch (e: any) {
    if (socketId) {
      emitProgress(io, socketId, {
        operationId, type: 'compress', progress: 0, label: '批量压缩失败', status: 'error', error: e.message
      })
    }
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/compress', async (req: AuthenticatedRequest, res) => {
  const { path: targetPath, operationId, socketId } = req.body
  if (!targetPath || !isValidPath(targetPath)) return res.status(400).json({ success: false, message: '无效路径' })
  const io = req.app.get('io')
  try {
    const stat = fs.statSync(targetPath)
    const parentDir = path.dirname(targetPath)
    const baseName = path.basename(targetPath)
    const zipName = baseName + '.zip'
    const zipPath = path.join(parentDir, zipName)
    const zip = new AdmZip()

    if (stat.isDirectory()) {
      const files = collectFiles(targetPath)
      const total = files.length
      let processed = 0

      for (const f of files) {
        zip.addLocalFile(f.fullPath, f.zipPath)
        processed++
        if (socketId) {
          emitProgress(io, socketId, {
            operationId,
            type: 'compress',
            progress: Math.round((processed / total) * 100),
            label: `压缩: ${baseName}`,
            subLabel: `${processed}/${total} 个文件`,
            status: 'active'
          })
        }
        await sleep(0)
      }
    } else {
      zip.addLocalFile(targetPath)
    }

    zip.writeZip(zipPath)
    if (socketId) {
      emitProgress(io, socketId, {
        operationId, type: 'compress', progress: 100, label: `压缩: ${baseName}`, status: 'completed'
      })
    }
    res.json({ success: true, message: '已压缩', data: { path: zipPath, name: zipName } })
  } catch (e: any) {
    if (socketId) {
      emitProgress(io, socketId, {
        operationId, type: 'compress', progress: 0, label: '压缩失败', status: 'error', error: e.message
      })
    }
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/extract', async (req: AuthenticatedRequest, res) => {
  const { path: zipPath, destPath, operationId, socketId } = req.body
  if (!zipPath || !isValidPath(zipPath)) return res.status(400).json({ success: false, message: '无效路径' })
  const io = req.app.get('io')
  try {
    const targetDir = destPath || path.dirname(zipPath)
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()
    const total = entries.length
    let processed = 0

    for (const entry of entries) {
      const fixedName = Buffer.from(entry.entryName, 'latin1').toString('utf8')
      const targetPath = path.join(targetDir, fixedName)
      const targetParent = path.dirname(targetPath)
      if (!fs.existsSync(targetParent)) fs.mkdirSync(targetParent, { recursive: true })
      if (!entry.isDirectory) {
        const data = entry.getData()
        fs.writeFileSync(targetPath, data)
      }
      processed++
      if (socketId) {
        emitProgress(io, socketId, {
          operationId,
          type: 'extract',
          progress: Math.round((processed / total) * 100),
          label: `解压: ${path.basename(zipPath)}`,
          subLabel: `${processed}/${total} 个文件`,
          status: 'active'
        })
      }
      await sleep(0)
    }

    if (socketId) {
      emitProgress(io, socketId, {
        operationId, type: 'extract', progress: 100, label: `解压: ${path.basename(zipPath)}`, status: 'completed'
      })
    }
    res.json({ success: true, message: '已解压', data: { path: targetDir } })
  } catch (e: any) {
    if (socketId) {
      emitProgress(io, socketId, {
        operationId, type: 'extract', progress: 0, label: '解压失败', status: 'error', error: e.message
      })
    }
    res.status(500).json({ success: false, message: e.message })
  }
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

    // 处理路径
    let fullTargetPath: string
    if (path.isAbsolute(targetPath)) {
      fullTargetPath = targetPath
    } else {
      fullTargetPath = path.resolve(process.cwd(), targetPath.replace(/^\//, ''))
    }

    const targetFilePath = path.join(fullTargetPath, fileName)

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

export default router
