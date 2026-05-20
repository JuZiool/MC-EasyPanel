# Mc-EasyPanel

轻量级 Minecraft 服务器管理面板。在单 Docker 容器中以子进程方式运行多个 MC 服务端实例，通过 Web 界面统一管理。

## 快速开始

```bash
git clone https://github.com/JuZiool/MC-EasyPanel.git
cd Mc-EasyPanel

# 构建并启动
docker compose up --build -d
```

> **💡 Linux 部署**：容器启动时自动对 `data/` 和 `servers/` 目录设置权限，无需手动操作。

## 功能

- **实例管理** — 创建/启动/停止/重启 MC 服务端实例
- **Web 终端** — xterm.js + node-pty 实时终端，支持日志持久化回看
- **文件管理** — 浏览/编辑/上传/下载/压缩/解压/复制/移动，批量操作，实时进度
- **在线玩家监控** — 通过 MC Query 协议查询在线玩家，5 分钟粒度历史记录图表
- **仪表盘** — 实例概览、在线玩家列表、快速操作入口
- **Docker 部署** — 单容器多阶段构建，volume 挂载数据

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SERVER_PORT` | `3301` | 面板端口 |
| `JWT_SECRET` | - | JWT 签名密钥（生产务必修改） |

## 技术栈

React 18 / Vite / TypeScript / Tailwind CSS / Zustand / Framer Motion / Socket.IO / xterm.js / Express / node-pty / JWT / bcryptjs / Winston
