import { motion } from 'framer-motion'
import { Info, Globe, Server, Database, Cpu, Wifi, Shield, Layers, Terminal, LineChart, FileSearch } from 'lucide-react'

const techStack = [
  { icon: Globe, label: '前端框架', value: 'React 18 + TypeScript', desc: '基于 Vite 构建' },
  { icon: Server, label: '后端框架', value: 'Express + TypeScript', desc: 'Node.js 运行时' },
  { icon: Wifi, label: '实时通信', value: 'Socket.IO', desc: 'WebSocket 双向通信' },
  { icon: Database, label: '状态管理', value: 'Zustand', desc: '轻量级状态管理' },
  { icon: Layers, label: '样式方案', value: 'Tailwind CSS', desc: '原子化 CSS 框架' },
  { icon: Terminal, label: 'Web 终端', value: 'xterm.js + node-pty', desc: '实时交互式终端' },
  { icon: Shield, label: '认证方案', value: 'JWT + bcryptjs', desc: 'Token 认证与密码加密' },
  { icon: LineChart, label: '玩家统计', value: 'MC Query 协议', desc: '在线人数记录与图表' },
  { icon: Cpu, label: '包管理', value: 'Monorepo', desc: 'Root + Client + Server 结构' },
]

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">关于</h1>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-surface-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-700">项目介绍</h2>
            <p className="text-xs text-gray-400">Mc-EasyPanel</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Mc-EasyPanel 是一个轻量级 Minecraft 服务器管理面板，提供实例管理、文件管理、终端访问等核心功能。
          项目参考 <strong>GSM3</strong>（Game Server Manager 3）的架构模式重新实现，专注于 Minecraft 服务器
          的运维场景，采用纯 Tailwind CSS 样式与 Monorepo 结构，适合个人或小团队管理 MC 服务端。
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-xl border border-surface-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">技术栈</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {techStack.map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-50">
              <div className="p-2 rounded-lg bg-primary-100 text-primary-600 shrink-0">
                <item.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">{item.label}</p>
                <p className="text-sm text-gray-900">{item.value}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
