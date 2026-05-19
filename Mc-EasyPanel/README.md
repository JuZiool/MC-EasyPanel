# Mc-EasyPanel

轻量级 Minecraft 服务器管理面板，在单容器中以子进程方式运行多个 MC 服务端实例。

## 特性

- **实例管理** — 创建/启动/停止/重启 MC 服务端实例，支持自定义停止命令
- **Web 终端** — 基于 xterm.js + node-pty 的实时终端，可连接到运行中的实例
- **文件管理** — 在线浏览、编辑、上传、下载、压缩/解压服务器文件
- **仪表盘** — 实例概览、运行时长、实时活动时间线
- **Docker 部署** — 单容器构建+运行，通过 volume 挂载所有资源

## 架构

```
Mc-EasyPanel/
├── client/     — React 18 + Vite + TypeScript + Tailwind CSS 前端
├── server/     — Express + Socket.IO + node-pty 后端
├── data/       — 面板数据持久化（JSON 文件）
├── servers/    — MC 服务端文件挂载入口
├── game/       — JDK、MC 服务端 jar 等运行时文件
├── Dockerfile       — 多阶段构建 (node:18-bullseye)
└── docker-compose.yml
```

## 快速开始

```bash
git clone https://github.com/JuZiool/MC-EasyPanel.git
cd Mc-EasyPanel

# 编辑 .env 配置 JWT_SECRET
# 将 JDK、MC 服务端 jar 放入对应目录

docker compose up --build -d
```

面板默认运行在 `http://localhost:3001`。

### 默认登录

- 用户名：`admin`
- 密码：`admin123`

## 创建实例

1. 将 MC 服务端 jar 和启动脚本放入 `servers/` 目录（通过 volume 映射到 `/app/servers`）
2. 在面板「实例管理」页面创建实例，指定工作目录和启动命令
3. 启动实例即可通过 Web 终端交互

## 端口

| 端口 | 用途 |
|------|------|
| 3001 | 面板 Web 端口 |
| 25565 | Minecraft 服务器（需在实例中配置） |

## 技术栈

- **前端**: React 18, Vite, TypeScript, Tailwind CSS, Zustand, Socket.IO Client, xterm.js
- **后端**: Express, Socket.IO, node-pty, JWT, Winston, adm-zip
- **部署**: Docker (node:18-bullseye)
