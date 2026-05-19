# Mc-EasyPanel

轻量级 Minecraft 服务器管理面板，在单容器中以子进程方式运行多个 MC 服务端实例。

## 特性

- **实例管理** — 创建/启动/停止/重启 MC 服务端实例，支持自定义停止命令、自动检测 Java 版服务端
- **Web 终端** — 基于 xterm.js + node-pty 的实时终端，支持多会话、日志持久化
- **文件管理** — 在线浏览/编辑/上传/下载/压缩/解压/复制/移动文件，支持批量操作、右键菜单
- **文件搜索** — 递归搜索文件或文件夹，快速定位配置文件
- **操作进度** — 上传/下载/压缩/解压/复制操作均有实时进度显示
- **仪表盘** — 实例概览、系统资源监控（CPU/内存/磁盘）、运行时长、实时活动时间线
- **Docker 部署** — 单容器构建+运行，通过 volume 挂载所有资源

## 架构

```
Mc-EasyPanel/
├── client/               # React 18 + Vite + TypeScript + Tailwind CSS 前端
│   └── src/
│       ├── components/   # 通用组件 (Layout, ProgressBar, Notification, Dialog 等)
│       ├── pages/        # 页面 (Dashboard, Instances, FileManager, Terminal, Settings)
│       ├── stores/       # Zustand 状态管理
│       └── utils/        # API 客户端、Socket.IO 封装
├── server/               # Express + Socket.IO + node-pty 后端
│   └── src/
│       ├── routes/       # API 路由 (auth, instances, files, system)
│       ├── middleware/   # JWT 认证中间件
│       ├── modules/      # 实例生命周期管理 (InstanceManager)
│       └── utils/        # 日志、PTY 管理、进度跟踪工具
├── data/                 # 面板数据持久化（JSON 文件，运行时挂载卷）
├── servers/              # MC 服务端文件挂载入口
├── game/                 # JDK、MC 服务端 jar 等运行时文件
├── Dockerfile            # 多阶段构建 (node:18-bullseye)
└── docker-compose.yml    # Docker Compose 编排
```

## 快速开始

### 生产部署

```bash
git clone https://github.com/JuZiool/MC-EasyPanel.git
cd Mc-EasyPanel

# 编辑 .env 配置 JWT_SECRET（必改！）
# 将 JDK、MC 服务端 jar 放入对应目录
# 将服务端文件放入 servers/ 目录（映射到容器 /app/servers）

docker compose up --build -d
```

面板默认运行在 `http://localhost:3001`。

### 开发模式

```bash
# 安装依赖（根、server、client）
npm run install:all

# 启动开发服务器（前后端并行，支持热重载）
npm run dev
```

开发模式下：
- 前端：`http://localhost:5173`（Vite HMR）
- 后端：`http://localhost:3001`（Express + Socket.IO）

### 默认登录

| 用户名 | 密码 |
|--------|------|
| `admin` | `admin123` |

## 文件管理功能

面板内置完整的文件管理器，支持以下操作：

| 操作 | 说明 | 进度显示 |
|------|------|---------|
| 浏览 | 分页列表，目录优先，支持路径跳转 | — |
| 搜索 | 递归搜索当前目录，深度 5 层，300ms 防抖 | — |
| 编辑 | 内联文本编辑器，支持保存 | — |
| 上传 | 批量上传，支持大文件（上限 1GB） | 实时百分比进度条 |
| 下载 | 单文件下载 | 实时百分比进度条 |
| 压缩 | 单文件/目录/多选批量压缩为 ZIP | Socket.IO 逐文件进度 |
| 解压 | ZIP 文件解压到指定目录 | Socket.IO 逐文件进度 |
| 复制 | 文件/目录递归复制 | Socket.IO 逐文件进度 |
| 移动 | 文件/目录移动 | — |
| 重命名 | 文件/目录重命名 | — |
| 删除 | 单文件/批量删除（确认弹窗） | — |
| 剪贴板 | 多选复制/剪切 → 粘贴到目标目录 | — |

进度面板显示在屏幕右下角，支持多个操作并发跟踪。

## 创建实例

1. 将 MC 服务端 jar 和启动脚本放入 `servers/` 目录（通过 volume 映射到 `/app/servers`）
2. 在面板「实例管理」页面创建实例，指定工作目录和启动命令
3. 启动实例即可通过 Web 终端交互

面板会自动检测 `start.sh`/`run.sh` 脚本或 `server.jar`，并获取 Java 版本信息。

## API 概览

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/has-users` | 检查是否存在用户 |
| POST | `/api/auth/register` | 注册（仅首用户） |
| POST | `/api/auth/login` | 登录，返回 JWT |
| GET | `/api/auth/verify` | 验证令牌 |
| POST | `/api/auth/change-password` | 修改密码 |

### 实例

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/instances` | 获取所有实例 |
| GET | `/api/instances/:id` | 获取单个实例 |
| POST | `/api/instances` | 创建实例 |
| PUT | `/api/instances/:id` | 更新实例 |
| DELETE | `/api/instances/:id` | 删除实例 |
| POST | `/api/instances/:id/start` | 启动实例 |
| POST | `/api/instances/:id/stop` | 停止实例 |
| POST | `/api/instances/:id/restart` | 重启实例 |

### 文件

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/files/list` | 浏览目录（分页） |
| GET | `/api/files/search` | 搜索文件（递归，深度 5 层） |
| GET | `/api/files/read` | 读取文件内容 |
| POST | `/api/files/save` | 保存文件 |
| POST | `/api/files/delete` | 删除文件/目录 |
| POST | `/api/files/mkdir` | 创建目录 |
| POST | `/api/files/rename` | 重命名 |
| POST | `/api/files/copy` | 复制（支持递归） |
| POST | `/api/files/move` | 移动 |
| POST | `/api/files/upload` | 上传文件（Multipart） |
| GET | `/api/files/download` | 下载文件 |
| POST | `/api/files/compress` | 压缩单个文件/目录 |
| POST | `/api/files/compress-batch` | 批量压缩 |
| POST | `/api/files/extract` | 解压 ZIP |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/system/stats` | 系统资源（CPU/内存/磁盘） |
| GET | `/api/system/info` | 系统信息（平台/架构/主机名） |
| GET | `/api/health` | 健康检查 |

### WebSocket 事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `create-pty` | 客户端→服务端 | 创建 PTY 终端 |
| `terminal-input` | 客户端→服务端 | 发送终端输入 |
| `terminal-output` | 服务端→客户端 | 终端输出 |
| `terminal-exit` | 服务端→客户端 | 终端退出 |
| `file-progress` | 服务端→客户端 | 文件操作进度更新 |

## 端口

| 端口 | 用途 |
|------|------|
| 3001 | 面板 Web 端口 |
| 25565 | Minecraft 服务器（需在实例中配置） |

## 技术栈

- **前端**: React 18, Vite 5, TypeScript, Tailwind CSS 3, Zustand, Framer Motion, Socket.IO Client, xterm.js, Lucide Icons
- **后端**: Express 4, Socket.IO 4, node-pty, JWT, Winston, adm-zip, Multer, bcryptjs
- **部署**: Docker (node:18-bullseye), dumb-init, Docker Compose

## 开发约定

参见 `AGENTS.md` 了解项目的开发规范和约定。
