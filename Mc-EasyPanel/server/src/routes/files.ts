import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import multer from 'multer'
import AdmZip from 'adm-zip'
import { authenticateToken, authenticateTokenFlexible, AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()
router.use(authenticateToken)

const upload = multer({ dest: os.tmpdir() + '/mc-easypanel-uploads', limits: { fileSize: 1024 * 1024 * 1024 } })

function isValidPath(p: string): boolean {
  return path.isAbsolute(p) && !p.includes('..')
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

router.post('/copy', (req: AuthenticatedRequest, res) => {
  const { path: srcPath, destPath } = req.body
  if (!srcPath || !destPath || !isValidPath(srcPath) || !isValidPath(destPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try { fs.cpSync(srcPath, destPath, { recursive: true }); res.json({ success: true, message: '已复制' }) }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

router.post('/move', (req: AuthenticatedRequest, res) => {
  const { path: srcPath, destPath } = req.body
  if (!srcPath || !destPath || !isValidPath(srcPath) || !isValidPath(destPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try { fs.renameSync(srcPath, destPath); res.json({ success: true, message: '已移动' }) }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

router.post('/compress-batch', (req: AuthenticatedRequest, res) => {
  const { paths, name } = req.body
  if (!paths || !Array.isArray(paths) || paths.length === 0) return res.status(400).json({ success: false, message: '无效路径列表' })
  for (const p of paths) { if (!isValidPath(p)) return res.status(400).json({ success: false, message: '包含无效路径' }) }
  try {
    const parentDir = path.dirname(paths[0])
    const zipName = name || `batch-${Date.now()}.zip`
    const zipPath = path.join(parentDir, zipName)
    const zip = new AdmZip()
    for (const p of paths) {
      const stat = fs.statSync(p)
      const baseName = path.basename(p)
      if (stat.isDirectory()) zip.addLocalFolder(p, baseName)
      else zip.addLocalFile(p)
    }
    zip.writeZip(zipPath)
    res.json({ success: true, message: '已批量压缩', data: { path: zipPath, name: zipName } })
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

router.post('/compress', (req: AuthenticatedRequest, res) => {
  const { path: targetPath } = req.body
  if (!targetPath || !isValidPath(targetPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    const stat = fs.statSync(targetPath)
    const parentDir = path.dirname(targetPath)
    const baseName = path.basename(targetPath)
    const zipName = baseName + '.zip'
    const zipPath = path.join(parentDir, zipName)
    const zip = new AdmZip()
    if (stat.isDirectory()) zip.addLocalFolder(targetPath)
    else zip.addLocalFile(targetPath)
    zip.writeZip(zipPath)
    res.json({ success: true, message: '已压缩', data: { path: zipPath, name: zipName } })
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

router.post('/extract', (req: AuthenticatedRequest, res) => {
  const { path: zipPath, destPath } = req.body
  if (!zipPath || !isValidPath(zipPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    const targetDir = destPath || path.dirname(zipPath)
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()
    for (const entry of entries) {
      const fixedName = Buffer.from(entry.entryName, 'latin1').toString('utf8')
      const targetPath = path.join(targetDir, fixedName)
      const targetParent = path.dirname(targetPath)
      if (!fs.existsSync(targetParent)) fs.mkdirSync(targetParent, { recursive: true })
      if (!entry.isDirectory) {
        const data = entry.getData()
        fs.writeFileSync(targetPath, data)
      }
    }
    res.json({ success: true, message: '已解压', data: { path: targetDir } })
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

export default router
