import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useInstanceStore } from '../stores/instanceStore'
import { useNotificationStore } from '../stores/notificationStore'
import apiClient from '../utils/api'
import { Play, Square, Terminal, FileText, Server, Power, PowerOff, Users } from 'lucide-react'
import type { ServerPlayerInfo, Instance } from '../types'

export default function DashboardPage() {
  const { instances, fetchInstances } = useInstanceStore()
  const { addNotification } = useNotificationStore()
  const navigate = useNavigate()
  const [playerData, setPlayerData] = useState<Record<string, ServerPlayerInfo>>({})

  useEffect(() => {
    fetchInstances()
    const interval = setInterval(fetchInstances, 5000)
    return () => clearInterval(interval)
  }, [fetchInstances])

  // 定时查询在线玩家
  useEffect(() => {
    const fetchPlayers = async () => {
      const res = await apiClient.getInstancePlayers()
      if (res.success && res.data) setPlayerData(res.data)
    }
    fetchPlayers()
    const interval = setInterval(fetchPlayers, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleStart = async (id: string) => {
    const res = await apiClient.startInstance(id)
    if (res.success) addNotification({ type: 'success', title: '已启动' })
    else addNotification({ type: 'error', title: '启动失败', message: res.message })
    fetchInstances()
  }

  const handleStop = async (id: string) => {
    const res = await apiClient.stopInstance(id)
    if (res.success) addNotification({ type: 'success', title: '正在停止' })
    else addNotification({ type: 'error', title: '停止失败', message: res.message })
    fetchInstances()
  }

  const running = instances.filter(i => i.status === 'running').length
  const stopped = instances.filter(i => i.status === 'stopped').length

  const formatDuration = (iso?: string) => {
    if (!iso) return null
    const diff = Date.now() - new Date(iso).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  const formatMsDuration = (ms: number) => {
    if (!ms || ms <= 0) return '-'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m`
    return '<1m'
  }

  const formatDateTime = (iso?: string) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  /** 实时总计运行时长：运行中 = 历史累计 + 本次已运行，已停止 = 历史累计 */
  const getRealtimeTotal = (inst: Instance) => {
    let total = inst.totalRunDuration || 0
    if (inst.status === 'running' && inst.lastStarted) {
      total += Date.now() - new Date(inst.lastStarted).getTime()
    }
    return total
  }

  const quickActions = [
    { icon: Server, label: '新建实例', onClick: () => navigate('/instances'), color: 'bg-primary-100 text-primary-600' },
    { icon: Terminal, label: '终端控制台', onClick: () => navigate('/terminal'), color: 'bg-blue-100 text-blue-600' },
    { icon: FileText, label: '文件管理', onClick: () => navigate('/files'), color: 'bg-green-100 text-green-600' },
  ]

  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">仪表盘</h1>
        <p className="text-sm text-gray-500 font-mono">{now.toLocaleDateString('zh-CN')} {now.toLocaleTimeString('zh-CN', { hour12: false })}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Server, label: '总计', value: instances.length, color: 'bg-purple-100 text-purple-600' },
          { icon: Power, label: '运行中', value: running, color: 'bg-green-100 text-green-600' },
          { icon: PowerOff, label: '已停止', value: stopped, color: 'bg-gray-100 text-gray-500' },
        ].map(item => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-surface-200 p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${item.color}`}><item.icon className="w-4 h-4" /></div>
            <div>
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="text-xl font-semibold text-gray-800">{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {quickActions.map((action, i) => (
          <motion.button key={action.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            onClick={action.onClick}
            className="bg-white rounded-xl border border-surface-200 p-4 flex items-center gap-3 hover:border-primary-300 transition-colors text-left">
            <div className={`p-2.5 rounded-lg ${action.color}`}><action.icon className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-gray-700">{action.label}</span>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-surface-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Server className="w-4 h-4" />实例列表</h2>
          {instances.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">暂无实例</p>}
          <AnimatePresence>
            {instances.map(inst => (
              <motion.div key={inst.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-start justify-between py-2.5 border-b border-surface-100 last:border-0">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${inst.status === 'running' ? 'bg-green-500' : inst.status === 'starting' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 truncate font-medium">{inst.name}</p>
                    <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                      <p className="truncate">
                        <span className="text-gray-500">创建</span> {formatDateTime(inst.createdAt)}
                        <span className="mx-1.5 text-gray-300">|</span>
                        <span className="text-gray-500">上次</span> {formatDateTime(inst.lastStarted)}
                      </p>
                      <p className="truncate">
                        <span className="text-gray-500">总计</span> {formatMsDuration(getRealtimeTotal(inst))}
                        <span className="mx-1.5 text-gray-300">|</span>
                        <span className="text-gray-500">本次</span>{' '}
                        {inst.status === 'running' && inst.lastStarted
                          ? formatDuration(inst.lastStarted)
                          : inst.lastStarted && inst.lastStopped
                            ? formatMsDuration(new Date(inst.lastStopped).getTime() - new Date(inst.lastStarted).getTime())
                            : '-'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2 mt-0.5">
                  <button onClick={() => navigate(`/terminal?instance=${inst.id}`)} className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-surface-100"><Terminal className="w-3.5 h-3.5" /></button>
                  <button onClick={() => navigate(`/files?path=${encodeURIComponent(inst.workingDirectory)}`)} className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-surface-100"><FileText className="w-3.5 h-3.5" /></button>
                  {inst.status === 'running' ? (
                    <button onClick={() => handleStop(inst.id)} className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50"><Square className="w-3.5 h-3.5" /></button>
                  ) : (
                    <button onClick={() => handleStart(inst.id)} className="p-1.5 rounded text-green-400 hover:text-green-600 hover:bg-green-50"><Play className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="bg-white rounded-xl border border-surface-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Users className="w-4 h-4" />在线玩家</h2>
          {Object.keys(playerData).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">暂无可查询的在线玩家</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {Object.entries(playerData).map(([id, info]) => (
                <motion.div key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-surface-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-gray-700">{info.instanceName}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {info.players ? `${info.players.online}/${info.players.max}` : '-'}
                    </span>
                  </div>
                  {info.players && info.players.sample && info.players.sample.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {info.players.sample.map((p, i) => (
                        <span key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                          <Users className="w-3 h-3" />
                          {p.name}
                        </span>
                      ))}
                    </div>
                  ) : info.online ? (
                    <p className="text-xs text-gray-400">服务器已运行，暂无在线玩家</p>
                  ) : (
                    <p className="text-xs text-red-400">
                      {info.error || '无法查询到服务器信息'}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
