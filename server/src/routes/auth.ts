import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { generateToken, authenticateToken, AuthenticatedRequest } from '../middleware/auth.js'
import logger from '../utils/logger.js'

const router = Router()

function getUsersPath(): string {
  const baseDir = process.cwd()
  const paths = [
    path.join(baseDir, 'server', 'data', 'users.json'),
    path.join(baseDir, 'data', 'users.json')
  ]
  return paths.find(p => { try { fs.accessSync(p); return true } catch { return false } }) || paths[0]
}

function ensureUsersPath(): string {
  const p = getUsersPath()
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(p)) fs.writeFileSync(p, '[]')
  return p
}

function readUsers(): any[] {
  try { return JSON.parse(fs.readFileSync(ensureUsersPath(), 'utf-8')) } catch { return [] }
}

function writeUsers(users: any[]): void {
  fs.writeFileSync(getUsersPath(), JSON.stringify(users, null, 2))
}

router.get('/has-users', (_req, res) => {
  const users = readUsers()
  res.json({ success: true, data: { hasUsers: users.length > 0 } })
})



router.post('/register', async (req, res) => {
  const users = readUsers()
  if (users.length > 0) {
    res.status(403).json({ success: false, message: '已有用户，无法重复注册' })
    return
  }
  const { username, password } = req.body
  if (!username || !password) {
    res.status(400).json({ success: false, message: '用户名和密码不能为空' })
    return
  }
  const hashedPassword = await bcrypt.hash(password, 10)
  const user = { id: uuidv4(), username, password: hashedPassword, role: 'admin', createdAt: new Date().toISOString() }
  users.push(user)
  writeUsers(users)
  const token = generateToken({ userId: user.id, username: user.username, role: user.role })
  logger.info(`首用户注册: ${username}`)
  res.json({ success: true, data: { token, user: { id: user.id, username: user.username, role: user.role } } })
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  const users = readUsers()
  const user = users.find((u: any) => u.username === username)
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ success: false, message: '用户名或密码错误' })
    return
  }
  user.lastLogin = new Date().toISOString()
  writeUsers(users)
  const token = generateToken({ userId: user.id, username: user.username, role: user.role })
  res.json({ success: true, data: { token, user: { id: user.id, username: user.username, role: user.role } } })
})

router.get('/verify', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({ success: true, data: { user: { id: req.user!.userId, username: req.user!.username, role: req.user!.role } } })
})

router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { oldPassword, newPassword } = req.body
  const users = readUsers()
  const user = users.find((u: any) => u.id === req.user!.userId)
  if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
    res.status(400).json({ success: false, message: '原密码错误' })
    return
  }
  user.password = await bcrypt.hash(newPassword, 10)
  writeUsers(users)
  res.json({ success: true, message: '密码修改成功' })
})

export default router
export function setupAuthRoutes() { return router }
