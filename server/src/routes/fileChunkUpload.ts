import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js'
import { ChunkUploadManager } from '../modules/chunkUploadManager.js'
import { isValidPath, upload } from './fileUtils.js'

const router = Router()

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

export default router
