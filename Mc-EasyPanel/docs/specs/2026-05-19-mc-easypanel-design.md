# Mc-EasyPanel 设计文档

## 概述

Mc-EasyPanel 是一个轻量级 Minecraft 服务器管理面板，基于 GSM3 架构的精简子集。用户通过 Docker 映射资源文件到容器内，面板负责管理 Mc 服务器进程（启动/停止/重启）、文件操作、终端控制台和配置文件编辑。

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | React 18 + Vite + TypeScript + Tailwind CSS + Zustand + Socket.IO Client + xterm.js + Monaco Editor + framer-motion |
| 后端 | Node.js + Express + Socket.IO + JWT + bcryptjs + node-pty + winston |
| 部署 | Docker 单一容器（多阶段构建） |
| 存储 | JSON 文件（server/data/） |

## UI 风格

- 米白色主色调，清新风格
- 纯 Tailwind CSS（不使用 Ant Design）
- 无暗色模式
- 弹窗淡入淡出动画（framer-motion）

## 项目结构

```
Mc-EasyPanel/
├── client/                          # React 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── InstancesPage.tsx
│   │   │   ├── FileManagerPage.tsx
│   │   │   ├── TerminalPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── NotificationContainer.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── ConfirmDeleteDialog.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── PageTransition.tsx
│   │   │   ├── MonacoEditor.tsx
│   │   │   └── SearchableSelect.tsx
│   │   ├── stores/
│   │   │   ├── authStore.ts
│   │   │   ├── instanceStore.ts
│   │   │   ├── fileStore.ts
│   │   │   ├── notificationStore.ts
│   │   │   └── systemStore.ts
│   │   ├── utils/
│   │   │   ├── api.ts
│   │   │   ├── socket.ts
│   │   │   └── format.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── server/
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── instances.ts
│   │   │   ├── files.ts
│   │   │   ├── terminal.ts
│   │   │   └── system.ts
│   │   ├── modules/
│   │   │   └── InstanceManager.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   └── utils/
│   │       └── logger.ts
│   ├── data/          # JSON 持久化
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── Dockerfile
├── start.sh
├── package.json       # 根 scripts
└── .env
```

## 数据模型

```typescript
// User
interface User {
  id: string
  username: string
  password: string        // bcrypt hash
  role: 'admin'
  createdAt: string
  lastLogin?: string
}

// Instance
type InstanceStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error'

interface Instance {
  id: string
  name: string
  description: string
  workingDirectory: string
  startCommand: string
  autoStart: boolean
  stopCommand: 'ctrl+c' | 'stop' | 'exit' | 'quit'
  status: InstanceStatus
  pid?: number
  createdAt: string
  lastStarted?: string
  lastStopped?: string
  terminalSessionId?: string
  instanceType?: 'minecraft-java' | 'generic'
  javaVersion?: string
}
```

## API 路由

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | 否 | 登录 |
| POST | `/api/auth/register` | 否 | 注册（仅无用户时） |
| GET | `/api/auth/verify` | 是 | 验证 token |
| POST | `/api/auth/change-password` | 是 | 修改密码 |
| GET | `/api/instances` | 是 | 获取实例列表 |
| GET | `/api/instances/:id` | 是 | 获取单个实例 |
| POST | `/api/instances` | 是 | 创建实例 |
| PUT | `/api/instances/:id` | 是 | 更新实例 |
| DELETE | `/api/instances/:id` | 是 | 删除实例 |
| POST | `/api/instances/:id/start` | 是 | 启动实例 |
| POST | `/api/instances/:id/stop` | 是 | 停止实例 |
| POST | `/api/instances/:id/restart` | 是 | 重启实例 |
| POST | `/api/instances/:id/input` | 是 | 发送命令到实例终端 |
| GET | `/api/files/list` | 是 | 文件列表（分页） |
| GET | `/api/files/read` | 是 | 读取文件内容（自动编码检测） |
| POST | `/api/files/save` | 是 | 保存文件 |
| POST | `/api/files/upload` | 是 | 上传文件 |
| GET | `/api/files/download` | 灵活 | 下载文件 |
| POST | `/api/files/delete` | 是 | 删除文件/目录 |
| POST | `/api/files/mkdir` | 是 | 创建目录 |
| POST | `/api/files/rename` | 是 | 重命名 |
| POST | `/api/files/copy` | 是 | 复制 |
| POST | `/api/files/move` | 是 | 移动 |
| GET | `/api/system/stats` | 否 | 系统状态（CPU/内存/磁盘） |
| GET | `/api/system/info` | 否 | 系统平台信息 |

## WebSocket 事件

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `instance-status` | 后端→前端 | `{ id, status }` | 实例状态变更推送 |
| `create-pty` | 前端→后端 | `{ sessionId, cols, rows, cwd }` | 创建终端 PTY |
| `terminal-input` | 前端→后端 | `{ sessionId, data }` | 终端输入 |
| `terminal-resize` | 前端→后端 | `{ sessionId, cols, rows }` | 调整终端大小 |
| `close-pty` | 前端→后端 | `{ sessionId }` | 关闭终端 |
| `terminal-output` | 后端→前端 | `{ sessionId, data }` | 终端输出 |
| `terminal-exit` | 后端→前端 | `{ sessionId }` | 终端退出 |
| `subscribe-system-stats` | 前端→后端 | - | 订阅系统监控 |
| `unsubscribe-system-stats` | 前端→后端 | - | 取消订阅 |
| `system-stats` | 后端→前端 | `SystemStats` | 系统状态实时推送 |

## 前端页面设计

### 1. LoginPage
- 登录表单 + 验证码（参考 GSM3 简化版）
- 首次访问自动进入注册模式
- 米白/灰调清新风格

### 2. DashboardPage
- 顶部：实例状态统计卡片（运行中/已停止/总数）
- 中部：各实例状态卡片（名称、状态、运行时间、快速操作按钮）
- 底部：系统资源（CPU/内存/磁盘 使用率进度条，WebSocket 实时更新）

### 3. InstancesPage
- 实例列表（表格或卡片视图）
- "创建实例"按钮 → 弹窗填写名称、工作目录、启动命令、自动启动选项
- 每个实例行：名称、状态指示灯、操作按钮（启动/停止/重启/终端/文件/编辑/删除）
- 状态变化实时更新（WebSocket 推送）

### 4. FileManagerPage
- 双栏布局：左侧目录树，右侧文件列表
- 文件列表：名称、大小、修改时间、操作
- 工具栏：返回上级、新建文件/目录、上传、刷新
- 文本文件（如 server.properties）→ Monaco Editor 编辑
- 点击保存 → POST `/api/files/save`

### 5. TerminalPage
- 单标签或简单多标签终端
- 基于 xterm.js
- 实例选择下拉 → 自动连接对应 PTY
- 全屏模式

### 6. SettingsPage
- 修改密码
- 面板端口/其他基础设置

## 后端模块设计

### InstanceManager
参考 GSM3 的 InstanceManager + TerminalManager 合并思路：

```
InstanceManager (EventEmitter)
├── 属性: instances: Map<string, Instance>, terminals: Map<string, PtyProcess>
├── initialize()          → 加载 data/instances.json，启动 autoStart 实例（错峰）
├── createInstance()      → 校验 → 保存
├── updateInstance()
├── deleteInstance()      → 先 stop 后删除
├── startInstance(id)     → 自动检测 jar/脚本 → spawn node-pty → 发送启动命令
├── stopInstance(id)      → 发送 stop 指令 → 超时强制 kill
├── restartInstance(id)
├── sendInput(id, data)   → 写入 PTY stdin
├── getInstances()
└── saveInstances()       → 1s 防抖写入 JSON
```

### 中间件 auth.ts
直接沿用 GSM3 的 `authenticateToken` 和 `authenticateTokenFlexible`

### 文件路由 files.ts
参考 GSM3 的文件路由子集：
- 路径安全检查（防遍历）
- jschardet + iconv-lite 编码自动检测
- multer 文件上传

## Docker 部署

```yaml
# docker-compose.yml 要点
services:
  mc-easypanel:
    build: .
    container_name: mc-easypanel
    ports:
      - "3001:3001"      # 面板端口
      - "25565-25575:25565-25575"  # Mc 服务器端口范围
    volumes:
      - ./data:/app/data           # 面板数据持久化
      - ./servers:/app/servers     # Mc 服务器文件（用户手动映射）
      - ./java:/opt/java           # Java 运行时
    environment:
      - TZ=Asia/Shanghai
    restart: unless-stopped
```
