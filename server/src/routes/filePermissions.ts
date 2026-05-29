import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js'
import { isValidPath } from './fileUtils.js'

const router = Router()

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
