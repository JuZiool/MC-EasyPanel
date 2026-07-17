import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js'
import { isValidPath, upload } from './fileUtils.js'
import { normalizeFileSortBy, sortFileItems } from '../utils/fileSorting.js'

const router = Router()

router.get('/list', (req: AuthenticatedRequest, res) => {
  const dirPath = req.query.path as string
  if (!dirPath || !isValidPath(dirPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    if (!fs.existsSync(dirPath)) return res.status(404).json({ success: false, message: '路径不存在' })
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 50
    const sortBy = normalizeFileSortBy(req.query.sortBy)
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const files = entries.map(e => {
      try {
        const fullPath = path.join(dirPath, e.name)
        const stat = fs.statSync(fullPath)
        const perm = (stat.mode & 0o777).toString(8).padStart(3, '0')
        return { name: e.name, path: fullPath, type: e.isDirectory() ? ('directory' as const) : ('file' as const), size: stat.size, modified: stat.mtime.toISOString(), permissions: perm }
      } catch { return null }
    }).filter((file): file is NonNullable<typeof file> => file !== null)
    const sortedFiles = sortFileItems(files, sortBy)
    const total = sortedFiles.length
    const totalPages = Math.ceil(total / pageSize)
    const paginated = sortedFiles.slice((page - 1) * pageSize, page * pageSize)
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
    const sortBy = normalizeFileSortBy(req.query.sortBy)
    res.json({ success: true, data: sortFileItems(results, sortBy).slice(0, 200) })
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

router.get('/download', authenticateToken, (req: AuthenticatedRequest, res) => {

  const filePath = req.query.path as string
  if (!filePath || !isValidPath(filePath)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    const name = path.basename(filePath)
    res.download(filePath, name)
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

export default router
