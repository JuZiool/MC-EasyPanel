# Mc-EasyPanel 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 构建一个轻量级 Minecraft 服务器管理面板，支持实例管理、文件管理、终端控制台、文件编辑和基础系统监控。

**架构:** React 18 + Vite 前端，Express + Socket.IO 后端，JSON 文件存储，单一 Docker 容器部署。完全参照 GSM3 的架构模式。

**技术栈:** React 18, Vite, TypeScript, Tailwind CSS, Zustand, Socket.IO, xterm.js, Monaco Editor, Express, node-pty, JWT, bcryptjs, winston

---

### Task 1: 项目脚手架

**Files:**
- Create: `Mc-EasyPanel/package.json`
- Create: `Mc-EasyPanel/.env`
- Create: `Mc-EasyPanel/server/package.json`
- Create: `Mc-EasyPanel/server/tsconfig.json`
- Create: `Mc-EasyPanel/client/package.json`
- Create: `Mc-EasyPanel/client/tsconfig.json`
- Create: `Mc-EasyPanel/client/vite.config.ts`
- Create: `Mc-EasyPanel/client/tailwind.config.js`
- Create: `Mc-EasyPanel/client/postcss.config.js`
- Create: `Mc-EasyPanel/client/index.html`
- Create: `Mc-EasyPanel/client/tsconfig.node.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "mc-easypanel",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "cd server && npm run dev",
    "dev:client": "cd client && npm run dev",
    "build": "npm run build:server && npm run build:client",
    "build:server": "cd server && npm run build",
    "build:client": "cd client && npm run build",
    "install:all": "npm install && cd server && npm install && cd ../client && npm install"
  },
  "devDependencies": {
    "concurrently": "^9.2.1"
  }
}
```

- [ ] **Step 2: Create .env**

```
DEV_MODE=true
SERVER_PORT=3001
```

- [ ] **Step 3: Create server/package.json**

```json
{
  "name": "mc-easypanel-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.6",
    "dotenv": "^16.6.1",
    "express": "^4.22.1",
    "helmet": "^7.2.0",
    "iconv-lite": "^0.6.3",
    "jschardet": "^3.1.4",
    "jsonwebtoken": "^9.0.3",
    "multer": "^2.1.1",
    "node-pty": "^1.0.0",
    "socket.io": "^4.8.3",
    "uuid": "^11.1.0",
    "winston": "^3.19.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.19",
    "@types/express": "^4.17.25",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/multer": "^2.0.12",
    "@types/node": "^20.19.37",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 4: Create server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowJs": true,
    "strict": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Create client/package.json**

```json
{
  "name": "mc-easypanel-client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@monaco-editor/react": "^4.7.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/xterm": "^5.5.0",
    "axios": "^1.14.0",
    "clsx": "^2.1.1",
    "framer-motion": "^11.18.2",
    "lucide-react": "^0.363.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.30.3",
    "socket.io-client": "^4.8.3",
    "zustand": "^4.5.7"
  },
  "devDependencies": {
    "@types/react": "^18.3.28",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react": "^4.7.0",
    "autoprefixer": "^10.4.27",
    "postcss": "^8.5.10",
    "tailwindcss": "^3.4.19",
    "typescript": "^5.9.3",
    "vite": "^5.4.21"
  }
}
```

- [ ] **Step 6: Create client/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 7: Create client/tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 8: Create client/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3001', changeOrigin: true, ws: true }
    }
  },
  build: { outDir: 'dist', sourcemap: true }
})
```

- [ ] **Step 9: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#fdf8f0', 100: '#faf0dd', 200: '#f5deb8', 300: '#edc78a', 400: '#e3aa57', 500: '#db9235', 600: '#ce7d2a', 700: '#ab6323', 800: '#894f22', 900: '#6f421f' },
        surface: { 50: '#fefcf8', 100: '#fcf8f0', 200: '#f7f0e0', 300: '#efe5cc', 400: '#e2d4b3' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] }
    }
  },
  plugins: []
}
```

- [ ] **Step 10: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 11: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mc-EasyPanel</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
</head>
<body class="bg-surface-50 text-gray-700">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 12: Create server/data/ 目录**

```bash
mkdir -p server/data
```

- [ ] **Step 13: 安装依赖**

```bash
cd Mc-EasyPanel && npm install && cd server && npm install && cd ../client && npm install
```

---

### Task 2: 后端基础设施（Logger + Auth 中间件 + Express 入口）

**Files:**
- Create: `Mc-EasyPanel/server/src/utils/logger.ts`
- Create: `Mc-EasyPanel/server/src/middleware/auth.ts`
- Create: `Mc-EasyPanel/server/src/index.ts`

- [ ] **Step 1: Create logger.ts**

```typescript
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [new winston.transports.Console()]
})

export default logger
```

- [ ] **Step 2: Create middleware/auth.ts**

```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; username: string; role: string }
}

const JWT_SECRET = process.env.JWT_SECRET || 'mc-easypanel-default-secret-change-me'

export function generateToken(payload: { userId: string; username: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) {
    res.status(401).json({ success: false, message: '需要提供访问令牌' })
    return
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string }
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ success: false, message: '无效或过期的访问令牌' })
  }
}

export function authenticateTokenFlexible(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  let token = authHeader && authHeader.split(' ')[1]
  if (!token) token = req.query.token as string
  if (!token) {
    res.status(401).json({ success: false, message: '需要提供访问令牌' })
    return
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string }
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ success: false, message: '无效或过期的访问令牌' })
  }
}
```

- [ ] **Step 3: Create server/src/index.ts（基础骨架）**

```typescript
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import logger from './utils/logger.js'

dotenv.config()
const PORT = parseInt(process.env.SERVER_PORT || '3001', 10)

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
})

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

io.on('connection', (socket) => {
  logger.info(`Socket 已连接: ${socket.id}`)
  socket.on('disconnect', () => logger.info(`Socket 已断开: ${socket.id}`))
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
```

---

### Task 3: 认证模块（后端 + 前端）

**Files:**
- Create: `Mc-EasyPanel/server/src/routes/auth.ts`
- Create: `Mc-EasyPanel/server/src/types/index.ts`
- Create: `Mc-EasyPanel/client/src/types/index.ts`
- Create: `Mc-EasyPanel/client/src/utils/api.ts`
- Create: `Mc-EasyPanel/client/src/stores/authStore.ts`
- Create: `Mc-EasyPanel/client/src/main.tsx`
- Create: `Mc-EasyPanel/client/src/App.tsx`
- Create: `Mc-EasyPanel/client/src/index.css`
- Create: `Mc-EasyPanel/client/src/pages/LoginPage.tsx`

- [ ] **Step 1: Create server/src/routes/auth.ts**

```typescript
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
  res.json({ success: true, hasUsers: users.length > 0 })
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
  res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role } })
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
  res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role } })
})

router.get('/verify', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({ success: true, user: req.user })
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
```

- [ ] **Step 2: 注册 auth 路由到 index.ts**

在 `server/src/index.ts` 中找到 `// 健康检查` 之前的位置，添加：

```typescript
import { setupAuthRoutes } from './routes/auth.js'
// ... 在 app.get('/api/health' ...) 之后添加：
app.use('/api/auth', setupAuthRoutes())
```

- [ ] **Step 3: Create client/src/types/index.ts**

```typescript
export interface User {
  id: string
  username: string
  role: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  loading: boolean
}

export interface Instance {
  id: string
  name: string
  description: string
  workingDirectory: string
  startCommand: string
  autoStart: boolean
  stopCommand: 'ctrl+c' | 'stop' | 'exit' | 'quit'
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
  pid?: number
  createdAt: string
  lastStarted?: string
  lastStopped?: string
  terminalSessionId?: string
  instanceType?: 'minecraft-java' | 'generic'
  javaVersion?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: string
}

export interface FilePagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasMore: boolean
}

export interface FileListResponse {
  files: FileItem[]
  pagination: FilePagination
}

export interface SystemStats {
  cpu: { usage: number; cores: number }
  memory: { total: number; used: number; usage: number }
  disk: { total: number; used: number; usage: number }
  timestamp: number
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
  timestamp: number
}
```

- [ ] **Step 4: Create client/src/utils/api.ts**

```typescript
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'

class ApiClient {
  private client: AxiosInstance
  private token: string | null = null

  constructor() {
    this.client = axios.create({ baseURL: '/api', timeout: 30000 })
    this.token = localStorage.getItem('mc_easypanel_token')
    this.client.interceptors.request.use((config) => {
      if (this.token) config.headers.Authorization = `Bearer ${this.token}`
      return config
    })
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('mc_easypanel_token')
          this.token = null
          if (window.location.pathname !== '/login') window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  setToken(token: string | null) {
    this.token = token
    if (token) localStorage.setItem('mc_easypanel_token', token)
    else localStorage.removeItem('mc_easypanel_token')
  }

  getToken() { return this.token }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<{ success: boolean; data?: T; message?: string }> {
    try { const res = await this.client.get(url, config); return res.data } catch (e: any) { return e.response?.data || { success: false, message: '网络错误' } }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<{ success: boolean; data?: T; message?: string }> {
    try { const res = await this.client.post(url, data, config); return res.data } catch (e: any) { return e.response?.data || { success: false, message: '网络错误' } }
  }

  async put<T>(url: string, data?: any): Promise<{ success: boolean; data?: T; message?: string }> {
    try { const res = await this.client.put(url, data); return res.data } catch (e: any) { return e.response?.data || { success: false, message: '网络错误' } }
  }

  async delete<T>(url: string): Promise<{ success: boolean; data?: T; message?: string }> {
    try { const res = await this.client.delete(url); return res.data } catch (e: any) { return e.response?.data || { success: false, message: '网络错误' } }
  }

  // Auth
  async login(username: string, password: string) { return this.post('/auth/login', { username, password }) }
  async register(username: string, password: string) { return this.post('/auth/register', { username, password }) }
  async verifyToken() { return this.get('/auth/verify') }
  async changePassword(oldPassword: string, newPassword: string) { return this.post('/auth/change-password', { oldPassword, newPassword }) }
  async hasUsers() { return this.get('/auth/has-users') }

  // Instances
  async getInstances() { return this.get<Instance[]>('/instances') }
  async getInstance(id: string) { return this.get<Instance>(`/instances/${id}`) }
  async createInstance(data: Partial<Instance>) { return this.post<Instance>('/instances', data) }
  async updateInstance(id: string, data: Partial<Instance>) { return this.put<Instance>(`/instances/${id}`, data) }
  async deleteInstance(id: string) { return this.delete(`/instances/${id}`) }
  async startInstance(id: string) { return this.post<{ terminalSessionId?: string }>(`/instances/${id}/start`) }
  async stopInstance(id: string) { return this.post(`/instances/${id}/stop`) }
  async restartInstance(id: string) { return this.post(`/instances/${id}/restart`) }

  // Files
  async listFiles(path: string, page = 1, pageSize = 50) { return this.get<FileListResponse>('/files/list', { params: { path, page, pageSize } }) }
  async readFile(path: string) { return this.get<{ content: string; encoding?: string }>('/files/read', { params: { path } }) }
  async saveFile(path: string, content: string, encoding?: string) { return this.post('/files/save', { path, content, encoding }) }
  async deleteFile(path: string) { return this.post('/files/delete', { path }) }
  async createDirectory(path: string) { return this.post('/files/mkdir', { path }) }
  async renameFile(path: string, newPath: string) { return this.post('/files/rename', { path, newPath }) }
  async copyFile(path: string, destPath: string) { return this.post('/files/copy', { path, destPath }) }
  async moveFile(path: string, destPath: string) { return this.post('/files/move', { path, destPath }) }

  // System
  async getSystemStats() { return this.get<SystemStats>('/system/stats') }
  async getSystemInfo() { return this.get('/system/info') }
}

export default new ApiClient()
```

- [ ] **Step 5: Create client/src/stores/authStore.ts**

```typescript
import { create } from 'zustand'
import apiClient from '../utils/api'
import type { User } from '../types'

interface AuthStore {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<boolean>
  register: (username: string, password: string) => Promise<boolean>
  logout: () => void
  verifyToken: () => Promise<boolean>
  changePassword: (oldPwd: string, newPwd: string) => Promise<boolean>
  checkHasUsers: () => Promise<boolean>
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthenticated: !!localStorage.getItem('mc_easypanel_token'),
  user: null,
  token: localStorage.getItem('mc_easypanel_token'),
  loading: false,

  login: async (username, password) => {
    set({ loading: true })
    const res = await apiClient.login(username, password)
    if (res.success && res.data) {
      apiClient.setToken(res.data.token)
      set({ isAuthenticated: true, user: res.data.user, token: res.data.token, loading: false })
      return true
    }
    set({ loading: false })
    return false
  },

  register: async (username, password) => {
    set({ loading: true })
    const res = await apiClient.register(username, password)
    if (res.success && res.data) {
      apiClient.setToken(res.data.token)
      set({ isAuthenticated: true, user: res.data.user, token: res.data.token, loading: false })
      return true
    }
    set({ loading: false })
    return false
  },

  logout: () => {
    apiClient.setToken(null)
    set({ isAuthenticated: false, user: null, token: null })
  },

  verifyToken: async () => {
    const token = localStorage.getItem('mc_easypanel_token')
    if (!token) return false
    apiClient.setToken(token)
    const res = await apiClient.verifyToken()
    if (res.success) {
      set({ isAuthenticated: true, user: res.data, token })
      return true
    }
    apiClient.setToken(null)
    set({ isAuthenticated: false, user: null, token: null })
    return false
  },

  changePassword: async (oldPwd, newPwd) => {
    const res = await apiClient.changePassword(oldPwd, newPwd)
    return res.success
  },

  checkHasUsers: async () => {
    const res = await apiClient.hasUsers()
    return res.data?.hasUsers ?? true
  }
}))
```

- [ ] **Step 6: Create client/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* 自定义滚动条 */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d4c8b0; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #c0b49c; }
```

- [ ] **Step 7: Create client/src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 8: Create client/src/App.tsx**

```tsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import LoginPage from './pages/LoginPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { verifyToken, isAuthenticated } = useAuthStore()

  useEffect(() => { verifyToken() }, [])

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/*" element={<ProtectedRoute><div>面板首页</div></ProtectedRoute>} />
    </Routes>
  )
}
```

- [ ] **Step 9: Create client/src/pages/LoginPage.tsx**

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Server, Eye, EyeOff, User, Lock } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [checking, setChecking] = useState(true)
  const { login, register, checkHasUsers, loading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    checkHasUsers().then((hasUsers) => {
      setIsRegister(!hasUsers)
      setChecking(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) { setError('请填写用户名和密码'); return }
    const success = isRegister ? await register(username, password) : await login(username, password)
    if (success) navigate('/')
    else setError(isRegister ? '注册失败，可能已有用户' : '用户名或密码错误')
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 via-white to-surface-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 mb-4">
            <Server className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">Mc-EasyPanel</h1>
          <p className="text-gray-500 mt-1">Minecraft 服务器管理面板</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-surface-200 p-8 space-y-5">
          <h2 className="text-lg font-medium text-gray-700">{isRegister ? '创建管理员账号' : '登录面板'}</h2>
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg border border-red-100">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">用户名</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-gray-700" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-gray-700" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
            {loading ? '处理中...' : (isRegister ? '创建账号' : '登录')}
          </button>
          {!isRegister && (
            <p className="text-center text-sm text-gray-400">
              首次使用？系统将自动引导注册
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
```

---

### Task 4: 布局 + 通用组件

**Files:**
- Create: `Mc-EasyPanel/client/src/components/Layout.tsx`
- Create: `Mc-EasyPanel/client/src/components/NotificationContainer.tsx`
- Create: `Mc-EasyPanel/client/src/components/ConfirmDialog.tsx`
- Create: `Mc-EasyPanel/client/src/components/ConfirmDeleteDialog.tsx`
- Create: `Mc-EasyPanel/client/src/components/LoadingSpinner.tsx`
- Create: `Mc-EasyPanel/client/src/components/PageTransition.tsx`
- Create: `Mc-EasyPanel/client/src/stores/notificationStore.ts`
- Modify: `Mc-EasyPanel/client/src/App.tsx`

- [ ] **Step 1: Create notificationStore.ts**

```typescript
import { create } from 'zustand'
import type { Notification } from '../types'

interface NotificationStore {
  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  addNotification: (n) => {
    const { notifications } = get()
    const isDuplicate = notifications.some(ex => ex.title === n.title && ex.message === n.message && Date.now() - ex.timestamp < 3000)
    if (isDuplicate) return
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    const notification: Notification = { ...n, id, timestamp: Date.now() }
    set({ notifications: [...notifications, notification] })
    const duration = n.duration ?? 5000
    if (duration > 0) setTimeout(() => get().removeNotification(id), duration)
  },
  removeNotification: (id) => set((s) => ({ notifications: s.notifications.filter(n => n.id !== id) }))
}))
```

- [ ] **Step 2: Create NotificationContainer.tsx**

```tsx
import { motion, AnimatePresence } from 'framer-motion'
import { useNotificationStore } from '../stores/notificationStore'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info }
const colors = { success: 'bg-green-50 border-green-200 text-green-700', error: 'bg-red-50 border-red-200 text-red-700', warning: 'bg-yellow-50 border-yellow-200 text-yellow-700', info: 'bg-blue-50 border-blue-200 text-blue-700' }
const iconColors = { success: 'text-green-500', error: 'text-red-500', warning: 'text-yellow-500', info: 'text-blue-500' }

export default function NotificationContainer() {
  const { notifications, removeNotification } = useNotificationStore()
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm w-full">
      <AnimatePresence>
        {notifications.map(n => {
          const Icon = icons[n.type]
          return (
            <motion.div key={n.id} initial={{ opacity: 0, x: 50, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 50, scale: 0.95 }}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-sm ${colors[n.type]}`}>
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColors[n.type]}`} />
              <div className="flex-1 min-w-0"><p className="font-medium text-sm">{n.title}</p>{n.message && <p className="text-xs mt-0.5 opacity-80">{n.message}</p>}</div>
              <button onClick={() => removeNotification(n.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 3: Create ConfirmDialog.tsx**

```tsx
import { motion, AnimatePresence } from 'framer-motion'

interface Props { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmText?: string; cancelText?: string; danger?: boolean }

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = '确认', cancelText = '取消', danger }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-xl border border-surface-200 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <p className="text-gray-500 mt-2 text-sm">{message}</p>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-surface-100 transition-colors text-sm font-medium">{cancelText}</button>
              <button onClick={() => { onConfirm(); onClose() }} className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-500 hover:bg-primary-600'}`}>{confirmText}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Create ConfirmDeleteDialog.tsx**

```tsx
import ConfirmDialog from './ConfirmDialog'

interface Props { isOpen: boolean; onClose: () => void; onConfirm: () => void; name: string; type?: string }

export default function ConfirmDeleteDialog({ isOpen, onClose, onConfirm, name, type = '实例' }: Props) {
  return <ConfirmDialog isOpen={isOpen} onClose={onClose} onConfirm={onConfirm} title={`删除${type}`} message={`确定要删除「${name}」吗？此操作不可撤销。`} confirmText="删除" danger />
}
```

- [ ] **Step 5: Create LoadingSpinner.tsx**

```tsx
export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return <div className={`animate-spin rounded-full border-b-2 border-primary-500 ${sizes[size]}`} />
}
```

- [ ] **Step 6: Create PageTransition.tsx**

```tsx
import { motion } from 'framer-motion'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 7: Create Layout.tsx**

```tsx
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Server, LayoutDashboard, Globe, Terminal, FileText, Settings, LogOut, Menu, X } from 'lucide-react'

const navItems = [
  { label: '仪表盘', icon: LayoutDashboard, path: '/' },
  { label: '实例管理', icon: Server, path: '/instances' },
  { label: '文件管理', icon: FileText, path: '/files' },
  { label: '终端', icon: Terminal, path: '/terminal' },
  { label: '设置', icon: Settings, path: '/settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-surface-50 flex">
      {/* 侧边栏 */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-white border-r border-surface-200 flex flex-col transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-100">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center"><Globe className="w-4 h-4 text-primary-600" /></div>
          <span className="font-semibold text-gray-700">Mc-EasyPanel</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-surface-50 hover:text-gray-700'}`}
              onClick={() => setSidebarOpen(false)}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-surface-100">
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-500"><div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-medium">{user?.username?.[0]}</div>{user?.username}</div>
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors mt-1"><LogOut className="w-4 h-4" />退出登录</button>
        </div>
      </aside>
      {/* 遮罩 */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      {/* 主内容 */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="lg:hidden bg-white border-b border-surface-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500"><Menu className="w-5 h-5" /></button>
          <span className="font-semibold text-gray-700">Mc-EasyPanel</span>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: 更新 App.tsx 引入布局和路由占位**

```tsx
// 替换原来的 ProtectedRoute fallback
import Layout from './components/Layout'
import PageTransition from './components/PageTransition'
import NotificationContainer from './components/NotificationContainer'
// 在 return 中
<Routes>
  <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
  <Route path="/*" element={
    <ProtectedRoute>
      <Layout>
        <NotificationContainer />
        <Routes>
          <Route path="/" element={<PageTransition><div>仪表盘</div></PageTransition>} />
          <Route path="/instances" element={<PageTransition><div>实例管理</div></PageTransition>} />
          <Route path="/files" element={<PageTransition><div>文件管理</div></PageTransition>} />
          <Route path="/terminal" element={<PageTransition><div>终端</div></PageTransition>} />
          <Route path="/settings" element={<PageTransition><div>设置</div></PageTransition>} />
        </Routes>
      </Layout>
    </ProtectedRoute>
  } />
</Routes>
```

---

### Task 5: 实例管理器（后端核心模块）

**Files:**
- Create: `Mc-EasyPanel/server/src/modules/InstanceManager.ts`
- Create: `Mc-EasyPanel/server/src/routes/instances.ts`
- Create: `Mc-EasyPanel/server/src/routes/system.ts`
- Modify: `Mc-EasyPanel/server/src/index.ts`

- [ ] **Step 1: Create server/src/modules/InstanceManager.ts**

```typescript
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import logger from '../utils/logger.js'

export interface Instance {
  id: string
  name: string
  description: string
  workingDirectory: string
  startCommand: string
  autoStart: boolean
  stopCommand: 'ctrl+c' | 'stop' | 'exit' | 'quit'
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
  pid?: number
  createdAt: string
  lastStarted?: string
  lastStopped?: string
  terminalSessionId?: string
  instanceType?: 'minecraft-java' | 'generic'
  javaVersion?: string
}

class InstanceManager extends EventEmitter {
  private instances: Map<string, Instance> = new Map()
  private configPath: string
  private saveTimeout: NodeJS.Timeout | null = null

  constructor() {
    super()
    const baseDir = process.cwd()
    const paths = [path.join(baseDir, 'server', 'data', 'instances.json'), path.join(baseDir, 'data', 'instances.json')]
    this.configPath = paths[0]
    const dir = path.dirname(this.configPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  initialize() {
    this.loadInstances()
    this.startAutoStartInstances()
    logger.info(`InstanceManager 初始化完成，共 ${this.instances.size} 个实例`)
  }

  private loadInstances() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        if (Array.isArray(data)) {
          data.forEach((inst: Instance) => {
            inst.status = 'stopped'
            inst.pid = undefined
            inst.terminalSessionId = undefined
            this.instances.set(inst.id, inst)
          })
        }
      }
    } catch (e) { logger.error(`加载实例数据失败: ${e}`) }
  }

  private saveInstances() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(() => {
      try {
        const data = Array.from(this.instances.values()).map(({ id, name, description, workingDirectory, startCommand, autoStart, stopCommand, createdAt, lastStarted, lastStopped, instanceType, javaVersion }) => ({
          id, name, description, workingDirectory, startCommand, autoStart, stopCommand, createdAt, lastStarted, lastStopped, instanceType, javaVersion
        }))
        fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2))
      } catch (e) { logger.error(`保存实例数据失败: ${e}`) }
    }, 1000)
  }

  private async startAutoStartInstances() {
    for (const inst of this.instances.values()) {
      if (inst.autoStart) {
        await new Promise(r => setTimeout(r, 2000))
        this.startInstance(inst.id).catch(() => {})
      }
    }
  }

  private async detectStartScript(workingDirectory: string): Promise<string | null> {
    const scripts = ['start.sh', 'run.sh', 'start.bat', 'run.bat']
    for (const script of scripts) {
      const fullPath = path.join(workingDirectory, script)
      if (fs.existsSync(fullPath)) return script
    }
    return null
  }

  private async detectJarFile(workingDirectory: string): Promise<string | null> {
    try {
      const files = fs.readdirSync(workingDirectory)
      const jar = files.find(f => f.endsWith('.jar') && !f.includes('forge') && !f.includes('fabric'))
      if (jar) return jar
      return files.find(f => f.endsWith('.jar')) || null
    } catch { return null }
  }

  getInstances(): Instance[] { return Array.from(this.instances.values()) }

  getInstance(id: string): Instance | undefined { return this.instances.get(id) }

  createInstance(data: Partial<Instance>): Instance {
    const instance: Instance = {
      id: uuidv4(),
      name: data.name || '未命名实例',
      description: data.description || '',
      workingDirectory: data.workingDirectory || '',
      startCommand: data.startCommand || '',
      autoStart: data.autoStart || false,
      stopCommand: data.stopCommand || 'stop',
      status: 'stopped',
      createdAt: new Date().toISOString(),
      instanceType: data.instanceType || 'generic',
      javaVersion: data.javaVersion
    }
    this.instances.set(instance.id, instance)
    this.saveInstances()
    this.emit('instance-created', instance)
    return instance
  }

  updateInstance(id: string, data: Partial<Instance>): Instance | null {
    const inst = this.instances.get(id)
    if (!inst) return null
    Object.assign(inst, data)
    this.saveInstances()
    this.emit('instance-updated', inst)
    return inst
  }

  deleteInstance(id: string): boolean {
    const inst = this.instances.get(id)
    if (!inst) return false
    if (inst.status === 'running') this.stopInstance(id)
    this.instances.delete(id)
    this.saveInstances()
    this.emit('instance-deleted', { id, name: inst.name })
    return true
  }

  async startInstance(id: string): Promise<{ success: boolean; terminalSessionId?: string; error?: string }> {
    const inst = this.instances.get(id)
    if (!inst) return { success: false, error: '实例不存在' }
    if (inst.status === 'running') return { success: false, error: '实例已经在运行中' }

    inst.status = 'starting'
    this.emit('instance-status-changed', { id, status: 'starting' })

    // 检查工作目录
    if (!fs.existsSync(inst.workingDirectory)) {
      inst.status = 'error'
      this.emit('instance-status-changed', { id, status: 'error' })
      return { success: false, error: `工作目录不存在: ${inst.workingDirectory}` }
    }

    let command = inst.startCommand

    // 如果实例类型是 minecraft-java 且没有显式启动命令，自动检测
    if (inst.instanceType === 'minecraft-java' && !command) {
      const script = await this.detectStartScript(inst.workingDirectory)
      if (script) {
        command = script.startsWith('.') ? script : (process.platform === 'win32' ? `.\\${script}` : `./${script}`)
      } else {
        const jarFile = await this.detectJarFile(inst.workingDirectory)
        if (jarFile) command = `java -Xmx2G -Xms1G -jar ${jarFile} nogui`
        else return { success: false, error: '未找到启动脚本或 server.jar 文件' }
      }
    }

    if (!command) return { success: false, error: '启动命令为空' }

    const terminalSessionId = `instance-${id}-${Date.now()}`
    inst.startCommand = command
    inst.terminalSessionId = terminalSessionId

    this.emit('instance-command', { id, command, cwd: inst.workingDirectory, terminalSessionId })
    this.emit('instance-status-changed', { id, status: 'running' })

    inst.status = 'running'
    inst.lastStarted = new Date().toISOString()
    this.saveInstances()

    return { success: true, terminalSessionId }
  }

  async stopInstance(id: string): Promise<boolean> {
    const inst = this.instances.get(id)
    if (!inst || inst.status !== 'running') return false

    inst.status = 'stopping'
    this.emit('instance-status-changed', { id, status: 'stopping' })

    // 发送停止命令
    let stopCmd = ''
    switch (inst.stopCommand) {
      case 'ctrl+c': stopCmd = '\x03'; break
      case 'stop': stopCmd = 'stop'; break
      case 'exit': stopCmd = 'exit'; break
      case 'quit': stopCmd = 'quit'; break
    }

    this.emit('instance-input', { id, data: stopCmd + '\r' })

    // 10秒超时强制停止
    setTimeout(() => {
      const current = this.instances.get(id)
      if (current && current.status === 'stopping') {
        this.emit('instance-force-stop', { id })
      }
    }, 10000)

    return true
  }

  setInstanceStopped(id: string) {
    const inst = this.instances.get(id)
    if (!inst) return
    inst.status = 'stopped'
    inst.pid = undefined
    inst.terminalSessionId = undefined
    inst.lastStopped = new Date().toISOString()
    this.saveInstances()
    this.emit('instance-status-changed', { id, status: 'stopped' })
  }

  setInstanceRunning(id: string, pid?: number) {
    const inst = this.instances.get(id)
    if (!inst) return
    inst.status = 'running'
    inst.pid = pid
    this.emit('instance-status-changed', { id, status: 'running' })
  }

  setInstanceError(id: string) {
    const inst = this.instances.get(id)
    if (!inst) return
    inst.status = 'error'
    this.emit('instance-status-changed', { id, status: 'error' })
  }

  cleanup() {
    for (const inst of this.instances.values()) {
      if (inst.status === 'running') {
        this.emit('instance-force-stop', { id: inst.id })
      }
    }
  }
}

export default InstanceManager
```

- [ ] **Step 2: Create server/src/routes/instances.ts**

```typescript
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
    if (!result.success && result.error) return res.status(400).json({ success: false, message: result.error })
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
```

- [ ] **Step 3: Create server/src/routes/system.ts**

```typescript
import { Router, Request, Response } from 'express'
import os from 'os'

const router = Router()

router.get('/stats', (_req: Request, res: Response) => {
  const cpus = os.cpus()
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
    const idle = cpu.times.idle
    return acc + (1 - idle / total) * 100
  }, 0) / cpus.length

  const totalMem = os.totalmem()
  const freeMem = os.freemem()

  let diskTotal = 0, diskFree = 0
  try {
    const { execSync } = require('child_process')
    if (process.platform === 'win32') {
      const output = execSync('wmic logicaldisk where DriveType=3 get Size,FreeSpace').toString()
      const lines = output.trim().split('\n').slice(1)
      lines.forEach((line: string) => {
        const [free, total] = line.trim().split(/\s+/).map(Number)
        if (!isNaN(free) && !isNaN(total)) { diskTotal += total; diskFree += free }
      })
    } else {
      const { stdout } = require('child_process')
      const output = execSync('df -B1 --total 2>/dev/null || df -k /').toString()
      const lastLine = output.trim().split('\n').pop() || ''
      const parts = lastLine.split(/\s+/)
      diskTotal = parseInt(parts[1]) || 0
      diskFree = parseInt(parts[3]) || 0
    }
  } catch {}

  res.json({
    success: true,
    data: {
      cpu: { usage: Math.round(cpuUsage * 10) / 10, cores: cpus.length },
      memory: { total: totalMem, used: totalMem - freeMem, usage: Math.round((1 - freeMem / totalMem) * 100) },
      disk: { total: diskTotal, used: diskTotal - diskFree, usage: diskTotal > 0 ? Math.round((diskTotal - diskFree) / diskTotal * 100) : 0 },
      timestamp: Date.now()
    }
  })
})

router.get('/info', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      uptime: os.uptime(),
      nodeVersion: process.version
    }
  })
})

export default router
```

- [ ] **Step 4: 更新 server/src/index.ts 接入 InstanceManager 和路由**

```typescript
// 在 import 部分添加：
import InstanceManager from './modules/InstanceManager.js'
import { setupInstanceRoutes } from './routes/instances.js'
import systemRoutes from './routes/system.js'

// 初始化 InstanceManager
const instanceManager = new InstanceManager()
instanceManager.initialize()

// Socket.IO 监听 InstanceManager 事件（占位，终端实现后再补全）
instanceManager.on('instance-status-changed', (data) => {
  io.emit('instance-status', data)
})

// 注册路由（在 app.use('/api/auth' ...) 附近）
app.use('/api/instances', setupInstanceRoutes(instanceManager))
app.use('/api/system', systemRoutes)
```

---

### Task 6: 实例管理前端页面

**Files:**
- Create: `Mc-EasyPanel/client/src/stores/instanceStore.ts`
- Create: `Mc-EasyPanel/client/src/pages/InstancesPage.tsx`
- Create: `Mc-EasyPanel/client/src/components/SearchableSelect.tsx`

- [ ] **Step 1: Create instanceStore.ts**

```typescript
import { create } from 'zustand'
import apiClient from '../utils/api'
import type { Instance } from '../types'

interface InstanceStore {
  instances: Instance[]
  loading: boolean
  error: string | null
  fetchInstances: () => Promise<void>
  updateInstanceStatus: (id: string, status: Instance['status']) => void
}

export const useInstanceStore = create<InstanceStore>((set, get) => ({
  instances: [],
  loading: false,
  error: null,

  fetchInstances: async () => {
    set({ loading: true, error: null })
    const res = await apiClient.getInstances()
    if (res.success && res.data) set({ instances: res.data, loading: false })
    else set({ error: res.message || '获取实例列表失败', loading: false })
  },

  updateInstanceStatus: (id, status) => {
    set((s) => ({ instances: s.instances.map(i => i.id === id ? { ...i, status } : i) }))
  }
}))
```

- [ ] **Step 2: Create pages/InstancesPage.tsx**

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useInstanceStore } from '../stores/instanceStore'
import { useNotificationStore } from '../stores/notificationStore'
import apiClient from '../utils/api'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import { Plus, Play, Square, RefreshCw, Terminal, Folder, Trash2, Server } from 'lucide-react'

export default function InstancesPage() {
  const { instances, loading, fetchInstances } = useInstanceStore()
  const { addNotification } = useNotificationStore()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [createAnimating, setCreateAnimating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', workingDirectory: '', startCommand: '', autoStart: false, stopCommand: 'stop' as const })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => { fetchInstances() }, [])

  const openCreate = () => { setShowCreate(true); setTimeout(() => setCreateAnimating(true), 10) }
  const closeCreate = () => { setCreateAnimating(false); setTimeout(() => setShowCreate(false), 300) }

  const handleCreate = async () => {
    if (!form.name.trim()) { addNotification({ type: 'warning', title: '请填写实例名称' }); return }
    const res = await apiClient.createInstance({ ...form, workingDirectory: form.workingDirectory || undefined })
    if (res.success) { addNotification({ type: 'success', title: '创建成功' }); closeCreate(); setForm({ name: '', description: '', workingDirectory: '', startCommand: '', autoStart: false, stopCommand: 'stop' }); fetchInstances() }
    else addNotification({ type: 'error', title: '创建失败', message: res.message })
  }

  const handleStart = async (id: string) => {
    setActionLoading(id)
    const res = await apiClient.startInstance(id)
    setActionLoading(null)
    if (res.success) { addNotification({ type: 'success', title: '启动成功' }); fetchInstances() }
    else addNotification({ type: 'error', title: '启动失败', message: res.message || '未知错误' })
  }

  const handleStop = async (id: string) => {
    setActionLoading(id)
    await apiClient.stopInstance(id)
    setActionLoading(null)
    addNotification({ type: 'info', title: '正在停止...' })
    setTimeout(fetchInstances, 3000)
  }

  const handleRestart = async (id: string) => {
    setActionLoading(id)
    const res = await apiClient.restartInstance(id)
    setActionLoading(null)
    if (res.success) addNotification({ type: 'success', title: '重启成功' })
    else addNotification({ type: 'error', title: '重启失败', message: res.message })
    fetchInstances()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await apiClient.deleteInstance(deleteTarget)
    if (res.success) { addNotification({ type: 'success', title: '已删除' }); fetchInstances() }
    else addNotification({ type: 'error', title: '删除失败' })
    setDeleteTarget(null)
  }

  const statusColors: Record<string, string> = { running: 'bg-green-500', stopped: 'bg-gray-300', starting: 'bg-yellow-400', stopping: 'bg-yellow-400', error: 'bg-red-500' }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">实例管理</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />创建实例
        </button>
      </div>

      {loading ? <div className="flex justify-center py-20"><LoadingSpinner /></div> : instances.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无实例，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {instances.map(inst => (
            <motion.div key={inst.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-surface-200 p-5 flex items-center gap-4">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColors[inst.status]}`} />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-800">{inst.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{inst.workingDirectory || inst.description || '未设置目录'}</p>
                <span className="inline-block text-xs text-gray-400 mt-1 capitalize">{inst.status}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {inst.status === 'running' ? (
                  <button onClick={() => handleStop(inst.id)} disabled={actionLoading === inst.id} className="p-2 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-colors" title="停止"><Square className="w-4 h-4" /></button>
                ) : (
                  <button onClick={() => handleStart(inst.id)} disabled={actionLoading === inst.id} className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors" title="启动"><Play className="w-4 h-4" /></button>
                )}
                <button onClick={() => handleRestart(inst.id)} disabled={actionLoading === inst.id} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title="重启"><RefreshCw className="w-4 h-4" /></button>
                <button onClick={() => navigate(`/terminal?instance=${inst.id}`)} className="p-2 rounded-lg text-gray-500 hover:bg-surface-50 transition-colors" title="终端"><Terminal className="w-4 h-4" /></button>
                <button onClick={() => navigate(`/files?path=${encodeURIComponent(inst.workingDirectory)}`)} className="p-2 rounded-lg text-gray-500 hover:bg-surface-50 transition-colors" title="文件"><Folder className="w-4 h-4" /></button>
                <button onClick={() => setDeleteTarget(inst.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 创建弹窗 */}
      {showCreate && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: createAnimating ? 1 : 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: createAnimating ? 1 : 0, scale: createAnimating ? 1 : 0.95 }} className="bg-white rounded-2xl shadow-xl border border-surface-200 p-6 max-w-lg w-full">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">创建实例</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">实例名称</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">描述</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">工作目录</label>
                <input type="text" value={form.workingDirectory} onChange={e => setForm({ ...form, workingDirectory: e.target.value })}
                  placeholder="/app/servers/my-server"
                  className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-gray-700 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">启动命令</label>
                <input type="text" value={form.startCommand} onChange={e => setForm({ ...form, startCommand: e.target.value })}
                  placeholder="java -Xmx2G -jar server.jar nogui"
                  className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-gray-700 font-mono text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="autoStart" checked={form.autoStart} onChange={e => setForm({ ...form, autoStart: e.target.checked })}
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-400" />
                <label htmlFor="autoStart" className="text-sm text-gray-600">面板启动时自动启动</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeCreate} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-surface-100 transition-colors text-sm">取消</button>
              <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors">创建</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <ConfirmDeleteDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} name={instances.find(i => i.id === deleteTarget)?.name || ''} />
    </div>
  )
}
```

- [ ] **Step 3: 更新 App.tsx 注册 InstancesPage 路由**

```tsx
// 在 Routes 中添加：
import InstancesPage from './pages/InstancesPage'
// ...
<Route path="/instances" element={<PageTransition><InstancesPage /></PageTransition>} />
```

---

### Task 7: 终端控制台（后端 PTY + 前端 xterm.js）

**Files:**
- Create: `Mc-EasyPanel/server/src/utils/ptyManager.ts`
- Modify: `Mc-EasyPanel/server/src/modules/InstanceManager.ts`
- Modify: `Mc-EasyPanel/server/src/index.ts`
- Create: `Mc-EasyPanel/client/src/utils/socket.ts`
- Create: `Mc-EasyPanel/client/src/pages/TerminalPage.tsx`

- [ ] **Step 1: Create ptyManager.ts（PTY 二进制路径管理）**

```typescript
import path from 'path'
import fs from 'fs'

export function getPtyPath(): string {
  const baseDir = process.cwd()
  const possiblePaths = [
    path.join(baseDir, 'node_modules', 'node-pty', 'bin'),
    path.join(baseDir, 'node_modules', 'node-pty'),
  ]
  for (const dir of possiblePaths) {
    if (fs.existsSync(dir)) return dir
  }
  return ''
}
```

- [ ] **Step 2: 修改 InstanceManager 添加终端事件处理**

在 `InstanceManager` 类的构造函数中添加：
```typescript
// 在构造函数中
this.on('instance-command', async ({ id, command, cwd, terminalSessionId }) => {
  // 由 index.ts 中的 WebSocket 处理
  this.emit('terminal-create', { id, command, cwd, terminalSessionId, sessionId: terminalSessionId })
})
this.on('instance-input', ({ id, data }) => {
  this.emit('terminal-input-forward', { id, data })
})
this.on('instance-force-stop', ({ id }) => {
  this.emit('terminal-force-close', { id })
  this.setInstanceStopped(id)
})
```

- [ ] **Step 3: 更新 server/src/index.ts 添加 WebSocket 终端处理**

```typescript
// 在 io.on('connection', ...) 中替换为完整实现：

io.on('connection', (socket) => {
  logger.info(`Socket 已连接: ${socket.id}`)

  // 终端 PTY 创建
  socket.on('create-pty', async ({ sessionId, cols, rows, cwd, command }) => {
    try {
      const ptyModule = await import('node-pty')
      const ptyProcess = ptyModule.spawn(
        process.platform === 'win32' ? 'powershell.exe' : 'bash',
        process.platform === 'win32' ? [] : ['-c', command || 'bash'],
        { name: 'xterm-color', cols: cols || 80, rows: rows || 24, cwd: cwd || process.cwd(), env: process.env as any }
      )

      activeTerminals.set(sessionId, ptyProcess)
      socket.join(sessionId)

      ptyProcess.onData((data: string) => {
        socket.emit('terminal-output', { sessionId, data })
      })

      ptyProcess.onExit(() => {
        socket.emit('terminal-exit', { sessionId })
        // 查找关联的实例并标记为停止
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

  // 终端输入
  socket.on('terminal-input', ({ sessionId, data }) => {
    const pty = activeTerminals.get(sessionId)
    if (pty) pty.write(data)
  })

  // 调整大小
  socket.on('terminal-resize', ({ sessionId, cols, rows }) => {
    const pty = activeTerminals.get(sessionId)
    if (pty) pty.resize(cols, rows)
  })

  // 关闭终端
  socket.on('close-pty', ({ sessionId }) => {
    const pty = activeTerminals.get(sessionId)
    if (pty) { pty.kill(); activeTerminals.delete(sessionId) }
  })

  // 实例启动时自动创建终端
  instanceManager.on('terminal-create', ({ id, command, cwd, sessionId }) => {
    if (!command) return
    // 通过 socket 广播给所有连接的客户端，让前端创建 PTY
    io.emit('instance-start-terminal', { instanceId: id, sessionId, command, cwd })
  })

  socket.on('disconnect', () => {
    logger.info(`Socket 已断开: ${socket.id}`)
  })
})

// 在文件顶部添加
const activeTerminals = new Map<string, any>()
```

- [ ] **Step 4: Create client/src/utils/socket.ts**

```typescript
import { io, Socket } from 'socket.io-client'

class SocketClient {
  private socket: Socket | null = null

  initialize(token: string) {
    if (this.socket?.connected) return
    this.socket = io({ auth: { token }, transports: ['websocket', 'polling'] })
    this.socket.on('connect_error', (err) => console.error('Socket 连接失败:', err.message))
  }

  getSocket(): Socket | null { return this.socket }

  disconnect() { if (this.socket) { this.socket.disconnect(); this.socket = null } }

  emit(event: string, data?: any) { this.socket?.emit(event, data) }

  on(event: string, handler: (...args: any[]) => void) { this.socket?.on(event, handler) }

  off(event: string, handler?: (...args: any[]) => void) { if (handler) this.socket?.off(event, handler); else this.socket?.off(event) }

  // 终端
  createTerminal(data: { sessionId: string; cols: number; rows: number; cwd?: string; command?: string }) { this.emit('create-pty', data) }
  sendTerminalInput(sessionId: string, data: string) { this.emit('terminal-input', { sessionId, data }) }
  resizeTerminal(sessionId: string, cols: number, rows: number) { this.emit('terminal-resize', { sessionId, cols, rows }) }
  closeTerminal(sessionId: string) { this.emit('close-pty', { sessionId }) }
}

export default new SocketClient()
```

- [ ] **Step 5: Create client/src/pages/TerminalPage.tsx**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import socketClient from '../utils/socket'
import { useAuthStore } from '../stores/authStore'
import { useInstanceStore } from '../stores/instanceStore'
import { useNotificationStore } from '../stores/notificationStore'

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string>('')
  const [searchParams] = useSearchParams()
  const [connected, setConnected] = useState(false)
  const [instances, setInstances] = useState<any[]>([])
  const [selectedInstance, setSelectedInstance] = useState('')
  const [customCommand, setCustomCommand] = useState('')
  const token = useAuthStore(s => s.token)
  const { addNotification } = useNotificationStore()

  useEffect(() => {
    if (!token) return
    socketClient.initialize(token)

    const instanceParam = searchParams.get('instance')
    if (instanceParam) setSelectedInstance(instanceParam)

    // 加载实例列表
    fetch('/api/instances').then(r => r.json()).then(d => { if (d.success) setInstances(d.data) })

    return () => { socketClient.disconnect() }
  }, [token])

  const initTerminal = () => {
    if (!terminalRef.current || xtermRef.current) return
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'JetBrains Mono, monospace',
      theme: { background: '#1a1a2e', foreground: '#e0e0e0', cursor: '#e0e0e0', selectionBackground: '#4a4a6a' }
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()
    xtermRef.current = term
    fitAddonRef.current = fitAddon

    term.onData((data) => {
      if (sessionIdRef.current) socketClient.sendTerminalInput(sessionIdRef.current, data)
    })

    window.addEventListener('resize', () => fitAddon.fit())

    // Socket 事件
    socketClient.on('pty-created', ({ sessionId }) => {
      sessionIdRef.current = sessionId
      setConnected(true)
    })
    socketClient.on('terminal-output', ({ sessionId, data }) => {
      if (sessionId === sessionIdRef.current) term.write(data)
    })
    socketClient.on('terminal-exit', ({ sessionId }) => {
      if (sessionId === sessionIdRef.current) {
        term.write('\r\n\x1b[31m进程已退出\x1b[0m\r\n')
        setConnected(false)
        sessionIdRef.current = ''
      }
    })
    socketClient.on('terminal-error', ({ sessionId, error }) => {
      if (sessionId === sessionIdRef.current) {
        term.write(`\r\n\x1b[31m错误: ${error}\x1b[0m\r\n`)
        setConnected(false)
      }
    })
  }

  useEffect(() => { initTerminal() }, [token])

  const handleConnect = () => {
    if (!xtermRef.current || sessionIdRef.current) return
    const sessionId = `term-${Date.now()}`
    const inst = instances.find((i: any) => i.id === selectedInstance)
    socketClient.createTerminal({
      sessionId,
      cols: xtermRef.current.cols,
      rows: xtermRef.current.rows,
      cwd: inst?.workingDirectory,
      command: inst?.startCommand ? `cd "${inst.workingDirectory}" && ${inst.startCommand}` : customCommand || undefined
    })
  }

  const handleDisconnect = () => {
    if (sessionIdRef.current) {
      socketClient.closeTerminal(sessionIdRef.current)
      sessionIdRef.current = ''
      setConnected(false)
    }
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <h1 className="text-xl font-semibold text-gray-800 shrink-0">终端控制台</h1>
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)}
          className="px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm text-gray-700 focus:border-primary-400 outline-none">
          <option value="">选择实例（自动连接）</option>
          {instances.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.status})</option>)}
        </select>
        <input type="text" value={customCommand} onChange={e => setCustomCommand(e.target.value)}
          placeholder="或输入自定义命令（启动 Mc 服务器）"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 text-sm font-mono focus:border-primary-400 outline-none text-gray-700" />
        {!connected ? (
          <button onClick={handleConnect} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">连接</button>
        ) : (
          <button onClick={handleDisconnect} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">断开</button>
        )}
      </div>
      <div ref={terminalRef} className="flex-1 rounded-xl overflow-hidden border border-surface-200 min-h-[400px]" />
    </div>
  )
}
```

- [ ] **Step 6: 更新 App.tsx 注册终端路由**

```tsx
import TerminalPage from './pages/TerminalPage'
// ...
<Route path="/terminal" element={<PageTransition><TerminalPage /></PageTransition>} />
```

---

### Task 8: 文件管理（后端 + 前端）

**Files:**
- Create: `Mc-EasyPanel/server/src/routes/files.ts`
- Create: `Mc-EasyPanel/client/src/pages/FileManagerPage.tsx`
- Create: `Mc-EasyPanel/client/src/components/MonacoEditor.tsx`
- Create: `Mc-EasyPanel/client/src/stores/fileStore.ts`
- Modify: `Mc-EasyPanel/server/src/index.ts`

- [ ] **Step 1: Create server/src/routes/files.ts**

```typescript
import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { authenticateToken, authenticateTokenFlexible, AuthenticatedRequest } from '../middleware/auth.js'
import logger from '../utils/logger.js'

const router = Router()
router.use(authenticateToken)

const upload = multer({ dest: '/tmp/mc-easypanel-uploads', limits: { fileSize: 1024 * 1024 * 1024 } })

function isValidPath(p: string): boolean {
  return path.isAbsolute(p) && !p.includes('..')
}

// 文件列表
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
    }).filter(Boolean)
    const total = files.length
    const totalPages = Math.ceil(total / pageSize)
    const paginated = files.slice((page - 1) * pageSize, page * pageSize)
    res.json({ success: true, data: { files: paginated, pagination: { page, pageSize, total, totalPages, hasMore: page < totalPages } } })
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

// 读取文件
router.get('/read', (req: AuthenticatedRequest, res) => {
  const filePath = req.query.path as string
  if (!filePath || !isValidPath(filePath)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    res.json({ success: true, data: { content } })
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

// 保存文件
router.post('/save', (req: AuthenticatedRequest, res) => {
  const { path: filePath, content } = req.body
  if (!filePath || !isValidPath(filePath)) return res.status(400).json({ success: false, message: '无效路径' })
  try { fs.writeFileSync(filePath, content, 'utf-8'); res.json({ success: true, message: '保存成功' }) }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

// 删除
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

// 创建目录
router.post('/mkdir', (req: AuthenticatedRequest, res) => {
  const { path: dirPath } = req.body
  if (!dirPath || !isValidPath(dirPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try { fs.mkdirSync(dirPath, { recursive: true }); res.json({ success: true, message: '已创建' }) }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

// 重命名
router.post('/rename', (req: AuthenticatedRequest, res) => {
  const { path: oldPath, newPath } = req.body
  if (!oldPath || !newPath || !isValidPath(oldPath) || !isValidPath(newPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try { fs.renameSync(oldPath, newPath); res.json({ success: true, message: '已重命名' }) }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

// 上传
router.post('/upload', upload.array('files'), (req: AuthenticatedRequest, res) => {
  const targetDir = req.body.path
  if (!targetDir || !isValidPath(targetDir)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    const files = req.files as Express.Multer.File[]
    files.forEach(f => {
      const targetPath = path.join(targetDir, f.originalname)
      fs.copyFileSync(f.path, targetPath)
      fs.unlinkSync(f.path)
    })
    res.json({ success: true, message: `已上传 ${files.length} 个文件` })
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

// 下载
router.get('/download', authenticateTokenFlexible, (req: AuthenticatedRequest, res) => {
  const filePath = req.query.path as string
  if (!filePath || !isValidPath(filePath)) return res.status(400).json({ success: false, message: '无效路径' })
  try {
    const name = path.basename(filePath)
    res.download(filePath, name)
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

// 复制
router.post('/copy', (req: AuthenticatedRequest, res) => {
  const { path: srcPath, destPath } = req.body
  if (!srcPath || !destPath || !isValidPath(srcPath) || !isValidPath(destPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try { fs.cpSync(srcPath, destPath, { recursive: true }); res.json({ success: true, message: '已复制' }) }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

// 移动
router.post('/move', (req: AuthenticatedRequest, res) => {
  const { path: srcPath, destPath } = req.body
  if (!srcPath || !destPath || !isValidPath(srcPath) || !isValidPath(destPath)) return res.status(400).json({ success: false, message: '无效路径' })
  try { fs.renameSync(srcPath, destPath); res.json({ success: true, message: '已移动' }) }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }) }
})

export default router
```

- [ ] **Step 2: 注册文件路由到 index.ts**

```typescript
import filesRouter from './routes/files.js'
// ...
app.use('/api/files', filesRouter)
```

- [ ] **Step 3: Create fileStore.ts**

```typescript
import { create } from 'zustand'
import apiClient from '../utils/api'
import type { FileItem, FilePagination } from '../types'

interface FileStore {
  currentPath: string
  files: FileItem[]
  pagination: FilePagination | null
  loading: boolean
  setPath: (path: string) => void
  fetchFiles: (path: string, page?: number) => Promise<void>
}

export const useFileStore = create<FileStore>((set) => ({
  currentPath: '',
  files: [],
  pagination: null,
  loading: false,
  setPath: (path) => set({ currentPath: path }),
  fetchFiles: async (path, page = 1) => {
    set({ loading: true, currentPath: path })
    const res = await apiClient.listFiles(path, page)
    if (res.success && res.data) set({ files: res.data.files, pagination: res.data.pagination, loading: false })
    else set({ loading: false })
  }
}))
```

- [ ] **Step 4: Create MonacoEditor.tsx（使用原生 textarea 作为轻量替代）**

```tsx
import { useState, useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
  height?: string
}

export default function MonacoEditor({ value, onChange, language, readOnly, height = '400px' }: Props) {
  const [code, setCode] = useState(value)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setCode(value) }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value)
    onChange?.(e.target.value)
  }

  return (
    <div className="relative border border-surface-200 rounded-xl overflow-hidden" style={{ height }}>
      <div className="absolute top-0 left-0 right-0 bg-surface-100 px-4 py-1.5 text-xs text-gray-400 flex items-center gap-2 border-b border-surface-200">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        <span className="w-2 h-2 rounded-full bg-yellow-400" />
        <span className="w-2 h-2 rounded-full bg-green-400" />
        <span className="ml-2 text-gray-500">{language || 'text'}</span>
      </div>
      <textarea ref={textRef} value={code} onChange={handleChange} readOnly={readOnly}
        className="w-full h-full pt-8 p-4 bg-gray-900 text-green-400 font-mono text-sm leading-relaxed resize-none outline-none"
        spellCheck={false} />
    </div>
  )
}
```

- [ ] **Step 5: Create FileManagerPage.tsx**

```tsx
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useFileStore } from '../stores/fileStore'
import { useNotificationStore } from '../stores/notificationStore'
import apiClient from '../utils/api'
import MonacoEditor from '../components/MonacoEditor'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'
import { ArrowLeft, Upload, FilePlus, FolderPlus, RefreshCw, Download, Edit3, Trash2, FileText, Folder, ChevronRight } from 'lucide-react'

export default function FileManagerPage() {
  const [searchParams] = useSearchParams()
  const { currentPath, files, pagination, loading, fetchFiles, setPath } = useFileStore()
  const { addNotification } = useNotificationStore()
  const [editFile, setEditFile] = useState<{ path: string; content: string; name: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string } | null>(null)
  const [showNewFile, setShowNewFile] = useState(false)
  const [showNewDir, setShowNewDir] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    const pathParam = searchParams.get('path')
    if (pathParam) fetchFiles(pathParam)
  }, [])

  const navigateDir = (dirPath: string) => fetchFiles(dirPath)
  const goUp = () => { const parent = currentPath.split('/').slice(0, -1).join('/') || '/'; fetchFiles(parent) }

  const handleReadFile = async (filePath: string, fileName: string) => {
    const res = await apiClient.readFile(filePath)
    if (res.success && res.data) setEditFile({ path: filePath, content: res.data.content, name: fileName })
    else addNotification({ type: 'error', title: '读取失败', message: res.message })
  }

  const handleSaveFile = async () => {
    if (!editFile) return
    const res = await apiClient.saveFile(editFile.path, editFile.content)
    if (res.success) { addNotification({ type: 'success', title: '保存成功' }); setEditFile(null) }
    else addNotification({ type: 'error', title: '保存失败' })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await apiClient.deleteFile(deleteTarget.path)
    if (res.success) { addNotification({ type: 'success', title: '已删除' }); fetchFiles(currentPath) }
    else addNotification({ type: 'error', title: '删除失败' })
    setDeleteTarget(null)
  }

  const handleCreateFile = async () => {
    if (!newName.trim()) return
    const filePath = `${currentPath}/${newName}`
    const res = await apiClient.saveFile(filePath, '')
    if (res.success) { addNotification({ type: 'success', title: '已创建' }); fetchFiles(currentPath); setShowNewFile(false); setNewName('') }
    else addNotification({ type: 'error', title: '创建失败' })
  }

  const handleCreateDir = async () => {
    if (!newName.trim()) return
    const dirPath = `${currentPath}/${newName}`
    const res = await apiClient.createDirectory(dirPath)
    if (res.success) { addNotification({ type: 'success', title: '已创建' }); fetchFiles(currentPath); setShowNewDir(false); setNewName('') }
    else addNotification({ type: 'error', title: '创建失败' })
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">文件管理</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchFiles(currentPath)} className="p-2 rounded-lg text-gray-500 hover:bg-surface-100 transition-colors" title="刷新"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowNewFile(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"><FilePlus className="w-4 h-4" />新建文件</button>
          <button onClick={() => setShowNewDir(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"><FolderPlus className="w-4 h-4" />新建目录</button>
          <label className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />上传
            <input type="file" multiple className="hidden" onChange={async (e) => {
              const formData = new FormData()
              formData.append('path', currentPath)
              Array.from(e.target.files || []).forEach(f => formData.append('files', f))
              const res = await apiClient.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
              if (res.success) { addNotification({ type: 'success', title: '上传成功' }); fetchFiles(currentPath) }
              else addNotification({ type: 'error', title: '上传失败' })
              e.target.value = ''
            }} />
          </label>
        </div>
      </div>

      {/* 路径导航 */}
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <button onClick={goUp} className="p-1 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /></button>
        <span className="font-mono text-xs bg-surface-100 px-3 py-1.5 rounded-lg">{currentPath || '/'}</span>
      </div>

      {/* 文件列表 */}
      {loading ? <div className="text-center py-10 text-gray-400">加载中...</div> : (
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          {files.map((file, i) => (
            <motion.div key={file.path} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 border-b border-surface-100 last:border-0 group">
              {file.type === 'directory' ? <Folder className="w-4 h-4 text-yellow-500 shrink-0" /> : <FileText className="w-4 h-4 text-blue-400 shrink-0" />}
              <button onClick={() => file.type === 'directory' ? navigateDir(file.path) : handleReadFile(file.path, file.name)}
                className="flex-1 text-left text-sm text-gray-700 hover:text-primary-600 truncate font-medium">
                {file.name}
              </button>
              <span className="text-xs text-gray-400 w-20 text-right">{formatSize(file.size)}</span>
              <span className="text-xs text-gray-400 w-32 text-right">{new Date(file.modified).toLocaleString()}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {file.type === 'file' && <button onClick={() => handleReadFile(file.path, file.name)} className="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50"><Edit3 className="w-3.5 h-3.5" /></button>}
                <button onClick={() => window.open(`/api/files/download?path=${encodeURIComponent(file.path)}&token=${localStorage.getItem('mc_easypanel_token')}`, '_blank')} className="p-1.5 rounded text-gray-400 hover:text-green-500 hover:bg-green-50"><Download className="w-3.5 h-3.5" /></button>
                <button onClick={() => setDeleteTarget({ path: file.path, name: file.name })} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </motion.div>
          ))}
          {files.length === 0 && <div className="text-center py-10 text-gray-400">目录为空</div>}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => fetchFiles(currentPath, p)}
              className={`px-3 py-1 rounded-lg text-sm ${p === pagination.page ? 'bg-primary-500 text-white' : 'bg-white border border-surface-200 text-gray-600 hover:bg-surface-50'}`}>{p}</button>
          ))}
        </div>
      )}

      {/* 编辑器 */}
      {editFile && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-surface-200 w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b border-surface-200">
              <h3 className="font-medium text-gray-800 truncate">{editFile.name}</h3>
              <div className="flex items-center gap-2">
                <button onClick={handleSaveFile} className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">保存</button>
                <button onClick={() => setEditFile(null)} className="px-4 py-1.5 text-gray-500 hover:bg-surface-100 rounded-lg text-sm transition-colors">关闭</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <MonacoEditor value={editFile.content} onChange={(v) => setEditFile({ ...editFile, content: v })} language="properties" height="60vh" />
            </div>
          </div>
        </motion.div>
      )}

      {/* 新建文件/目录弹窗 */}
      {(showNewFile || showNewDir) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl border border-surface-200 p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800">{showNewFile ? '新建文件' : '新建目录'}</h3>
            <p className="text-sm text-gray-400 mt-1">位置: {currentPath}</p>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="输入名称"
              className="w-full mt-4 px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowNewFile(false); setShowNewDir(false); setNewName('') }} className="px-4 py-2 text-sm text-gray-600 hover:bg-surface-100 rounded-lg">取消</button>
              <button onClick={showNewFile ? handleCreateFile : handleCreateDir} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium">创建</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <ConfirmDeleteDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} name={deleteTarget?.name || ''} type="文件" />

      {/* 回到按钮 */}
      {currentPath && <button onClick={goUp} className="fixed bottom-6 right-6 w-12 h-12 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"><ArrowLeft className="w-5 h-5" /></button>}
    </div>
  )
}
```

- [ ] **Step 6: 更新 App.tsx**

```tsx
import FileManagerPage from './pages/FileManagerPage'
// ...
<Route path="/files" element={<PageTransition><FileManagerPage /></PageTransition>} />
```

---

### Task 9: 仪表盘 + 设置页面

**Files:**
- Create: `Mc-EasyPanel/client/src/pages/DashboardPage.tsx`
- Create: `Mc-EasyPanel/client/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Create DashboardPage.tsx**

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInstanceStore } from '../stores/instanceStore'
import apiClient from '../utils/api'
import { Server, Cpu, HardDrive, MemoryStick, Activity } from 'lucide-react'

export default function DashboardPage() {
  const { instances, fetchInstances } = useInstanceStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<any>(null)

  useEffect(() => { fetchInstances(); apiClient.get('/system/stats').then(r => { if (r.success) setStats(r.data) }) }, [])

  // 定时刷新系统状态
  useEffect(() => {
    const interval = setInterval(async () => {
      const r = await apiClient.get('/system/stats')
      if (r.success) setStats(r.data)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const runningCount = instances.filter(i => i.status === 'running').length
  const stoppedCount = instances.filter(i => i.status === 'stopped').length
  const errorCount = instances.filter(i => i.status === 'error').length

  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">仪表盘</h1>

      {/* 实例统计 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-surface-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center"><Server className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-2xl font-semibold text-gray-800">{runningCount}</p><p className="text-sm text-gray-400">运行中</p></div>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center"><Server className="w-5 h-5 text-gray-400" /></div>
          <div><p className="text-2xl font-semibold text-gray-800">{stoppedCount}</p><p className="text-sm text-gray-400">已停止</p></div>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center"><Server className="w-5 h-5 text-red-500" /></div>
          <div><p className="text-2xl font-semibold text-gray-800">{errorCount}</p><p className="text-sm text-gray-400">异常</p></div>
        </div>
      </div>

      {/* 系统资源 */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <div className="flex items-center gap-2 mb-3"><Cpu className="w-4 h-4 text-blue-500" /><span className="text-sm font-medium text-gray-600">CPU</span></div>
            <div className="flex items-end gap-2"><span className="text-2xl font-semibold text-gray-800">{stats.cpu?.usage || 0}%</span><span className="text-sm text-gray-400 mb-1">{stats.cpu?.cores || 0} 核心</span></div>
            <div className="mt-3 h-2 bg-surface-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(stats.cpu?.usage || 0, 100)}%` }} /></div>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <div className="flex items-center gap-2 mb-3"><MemoryStick className="w-4 h-4 text-green-500" /><span className="text-sm font-medium text-gray-600">内存</span></div>
            <div className="flex items-end gap-2"><span className="text-2xl font-semibold text-gray-800">{stats.memory?.usage || 0}%</span><span className="text-sm text-gray-400 mb-1">{formatBytes(stats.memory?.used || 0)} / {formatBytes(stats.memory?.total || 0)}</span></div>
            <div className="mt-3 h-2 bg-surface-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(stats.memory?.usage || 0, 100)}%` }} /></div>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <div className="flex items-center gap-2 mb-3"><HardDrive className="w-4 h-4 text-orange-500" /><span className="text-sm font-medium text-gray-600">磁盘</span></div>
            <div className="flex items-end gap-2"><span className="text-2xl font-semibold text-gray-800">{stats.disk?.usage || 0}%</span><span className="text-sm text-gray-400 mb-1">{formatBytes(stats.disk?.used || 0)} / {formatBytes(stats.disk?.total || 0)}</span></div>
            <div className="mt-3 h-2 bg-surface-100 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(stats.disk?.usage || 0, 100)}%` }} /></div>
          </div>
        </div>
      )}

      {/* 实例列表 */}
      <div>
        <h2 className="text-lg font-medium text-gray-700 mb-3">实例状态</h2>
        <div className="space-y-2">
          {instances.length === 0 ? (
            <div className="bg-white rounded-xl border border-surface-200 p-6 text-center text-gray-400">
              <p>暂无实例，前往<button onClick={() => navigate('/instances')} className="text-primary-500 hover:underline mx-1">实例管理</button>创建</p>
            </div>
          ) : instances.map(inst => (
            <div key={inst.id} className="bg-white rounded-xl border border-surface-200 px-5 py-3 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${inst.status === 'running' ? 'bg-green-500' : inst.status === 'error' ? 'bg-red-500' : 'bg-gray-300'}`} />
              <span className="text-sm font-medium text-gray-700 flex-1">{inst.name}</span>
              <span className="text-xs text-gray-400 capitalize">{inst.status}</span>
              {inst.status === 'running' && <button onClick={() => navigate('/terminal')} className="text-xs text-primary-500 hover:underline">终端</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create SettingsPage.tsx**

```tsx
import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useNotificationStore } from '../stores/notificationStore'
import { Lock } from 'lucide-react'

export default function SettingsPage() {
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const { changePassword, user } = useAuthStore()
  const { addNotification } = useNotificationStore()

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd) { addNotification({ type: 'warning', title: '请填写完整' }); return }
    if (newPwd !== confirmPwd) { addNotification({ type: 'warning', title: '两次密码不一致' }); return }
    const ok = await changePassword(oldPwd, newPwd)
    if (ok) { addNotification({ type: 'success', title: '密码修改成功' }); setOldPwd(''); setNewPwd(''); setConfirmPwd('') }
    else addNotification({ type: 'error', title: '修改失败', message: '原密码错误' })
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">设置</h1>

      <div className="bg-white rounded-xl border border-surface-200 p-5">
        <h2 className="text-sm font-medium text-gray-600 mb-1">当前用户</h2>
        <p className="text-gray-800 font-medium">{user?.username}</p>
      </div>

      <div className="bg-white rounded-xl border border-surface-200 p-6 space-y-4">
        <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-gray-400" /><h2 className="font-medium text-gray-700">修改密码</h2></div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">原密码</label>
          <input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">新密码</label>
          <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">确认新密码</label>
          <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 outline-none text-gray-700" />
        </div>
        <button onClick={handleChangePassword} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">修改密码</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 更新 App.tsx**

```tsx
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
// ...
<Route path="/" element={<PageTransition><DashboardPage /></PageTransition>} />
<Route path="/settings" element={<PageTransition><SettingsPage /></PageTransition>} />
```

---

### Task 10: Docker 部署

**Files:**
- Create: `Mc-EasyPanel/Dockerfile`
- Create: `Mc-EasyPanel/docker-compose.yml`
- Create: `Mc-EasyPanel/start.sh`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm run install:all
COPY . .
RUN npm run build

FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget unzip \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/package.json ./
COPY start.sh /root/start.sh
RUN chmod +x /root/start.sh
RUN mkdir -p /app/server/data
EXPOSE 3001
ENV NODE_ENV=production
ENTRYPOINT ["/root/start.sh"]
```

- [ ] **Step 2: Create start.sh**

```bash
#!/bin/bash
cd /app
exec node server/dist/index.js
```

- [ ] **Step 3: Create docker-compose.yml**

```yaml
services:
  mc-easypanel:
    build: .
    container_name: mc-easypanel
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/server/data
      - ./servers:/app/servers
    environment:
      - TZ=Asia/Shanghai
      - SERVER_PORT=3001
    restart: unless-stopped
```
