# Mc-EasyPanel

轻量级 Minecraft 服务器管理面板，在单 Docker 容器中以子进程方式运行多个 MC 服务端实例，提供 Web 界面进行统一管理。

## 特性

- **实例管理** — 创建/启动/停止/重启 MC 服务端实例，支持自定义停止命令、自动检测 Java 版服务端
- **Web 终端** — 基于 xterm.js + node-pty 的实时终端，支持多会话、日志持久化（进程退出后仍可查看历史日志）
- **文件管理** — 在线浏览/编辑/上传/下载/压缩/解压/复制/移动文件，支持批量操作、右键菜单、剪贴板
- **文件搜索** — 递归搜索文件或文件夹，快速定位配置文件（深度 5 层，300ms 防抖）
- **操作进度** — 上传/下载/压缩/解压/复制操作均有实时进度显示（Socket.IO 逐文件推送）
- **仪表盘** — 实例概览、系统资源监控（CPU/内存/磁盘）、运行时长、实时活动时间线
- **安全认证** — JWT 登录认证，支持修改密码，首次启动自动引导注册
- **Docker 部署** — 单容器多阶段构建，通过 volume 挂载所有数据

## 架构

```
mc-easypanel/
├── client/                          # React 18 + Vite + TypeScript + Tailwind CSS 前端
│   └── src/
│       ├── components/              # 通用组件 (Layout, Dialog, Notification, ProgressBar 等)
│       ├── pages/                   # 页面 (Dashboard, Instances, FileManager, Terminal, Settings)
│       ├── stores/                  # Zustand 状态管理 (auth/instance/file/notification/progress)
│       ├── utils/                   # API 客户端、Socket.IO 封装
│       ├── types/                   # TypeScript 接口定义
│       ├── App.tsx                  # 路由配置
│       └── main.tsx                 # 入口
├── server/                          # Express + Socket.IO + node-pty 后端
│   └── src/
│       ├── routes/                  # API 路由 (auth, instances, files, system)
│       ├── middleware/              # JWT 认证中间件
│       ├── modules/                 # 实例生命周期管理 (InstanceManager)
│       ├── utils/                   # 日志、PTY 管理、进度跟踪
│       └── index.ts                 # 入口 (Express + Socket.IO + 终端 PTY)
├── data/                            # 面板运行时数据持久化（JSON 文件）
│   ├── instances.json               # 实例配置列表
│   └── users.json                   # 用户账户信息
├── servers/                         # MC 服务端与 JDK 运行文件
│   └── jdk/                         # Azul Zulu JDK
├── docs/specs/                      # 设计文档与实现计划
├── Dockerfile                       # 多阶段构建 (node:18-bullseye)
├── docker-compose.yml               # Docker Compose 编排
├── start.sh                         # 快速构建启动脚本
└── .env                             # 环境配置
```

## 快速开始

### 环境要求

- Node.js >= 18（开发）
- Docker & Docker Compose（生产部署）

### 开发模式

```bash
# 1. 安装依赖（根、server、client）
npm run install:all

# 2. 启动开发服务器（前后端并行，支持热重载）
npm run dev
```

开发模式下：
- 前端：`http://localhost:5173`（Vite HMR）
- 后端：`http://localhost:3001`（Express + Socket.IO）

### 生产部署

```bash
git clone https://github.com/JuZiool/MC-EasyPanel.git
cd Mc-EasyPanel

# 构建并启动
docker compose up --build -d
```

面板默认运行在 `http://localhost:3001`。

### 默认登录

| 用户名 | 密码 |
|--------|------|
| `admin` | `admin123` |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SERVER_PORT` | `3001` | 面板监听端口 |
| `DEV_MODE` | `true` | 开发模式开关 |
| `JWT_SECRET` | `mc-easypanel-secret-key-change-in-production` | JWT 签名密钥（docker-compose 中配置，生产环境务必修改） |

## 端口

| 端口 | 用途 |
|------|------|
| 3001 | 面板 Web 端口 |
| 25565 | Minecraft 游戏服务器（需在实例中配置） |

## 实例管理

1. 将 MC 服务端 jar 和启动脚本放入 `servers/` 目录（通过 volume 映射到 `/app/servers`）
2. 在面板「实例管理」页面创建实例，指定工作目录和启动命令
3. 面板自动检测 `start.sh`/`run.sh` 脚本或 `server.jar`，获取 Java 版本信息
4. 启动实例即可通过 Web 终端交互

## 文件管理

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

## WebSocket 事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `create-pty` | 客户端→服务端 | 创建 PTY 终端 |
| `terminal-input` | 客户端→服务端 | 发送终端输入 |
| `terminal-output` | 服务端→客户端 | 终端输出 |
| `terminal-exit` | 服务端→客户端 | 终端退出 |
| `terminal-resize` | 客户端→服务端 | 调整终端大小 |
| `close-pty` | 客户端→服务端 | 关闭 PTY 终端 |
| `get-terminal-history` | 客户端→服务端 | 请求终端历史日志 |
| `file-progress` | 服务端→客户端 | 文件操作进度更新 |
| `instance-status-changed` | 服务端→客户端 | 实例状态变更广播 |

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
| GET | `/api/files/search` | 搜索文件 |
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

## 技术栈

- **前端**: React 18, Vite 5, TypeScript, Tailwind CSS 3, Zustand, Framer Motion, Socket.IO Client, xterm.js, Lucide React, clsx
- **后端**: Node.js (ESM), Express 4, Socket.IO 4, node-pty, JWT, Winston, adm-zip, Multer, bcryptjs, Helmet, uuid
- **部署**: Docker (node:18-bullseye 多阶段构建), dumb-init, Docker Compose
- **开发**: concurrently, tsx (热重载), Google Fonts (Inter + JetBrains Mono)

## 开发约定

参见 `AGENTS.md` 了解项目的开发规范和约定。

## 许可证

MIT
