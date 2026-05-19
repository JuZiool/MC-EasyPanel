import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useInstanceStore } from '../stores/instanceStore'
import { useNotificationStore } from '../stores/notificationStore'
import { useAuthStore } from '../stores/authStore'
import apiClient from '../utils/api'
import socketClient from '../utils/socket'
import { Play, Square, Terminal, FileText, Plus, Server, Clock, Power, PowerOff, Activity } from 'lucide-react'

interface Activity {
  id: string
  type: 'start' | 'stop' | 'error'
  instanceName: string
  time: Date
}

export default function DashboardPage() {
  const { instances, fetchInstances } = useInstanceStore()
  const { addNotification } = useNotificationStore()
  const navigate = useNavigate()
  const token = useAuthStore(s => s.token)
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    if (!token) return
    socketClient.initialize(token)
    socketClient.on('instance-status', ({ id, status }: { id: string; status: string }) => {
      const inst = instances.find(i => i.id === id)
      if (!inst) return
      const actType: Activity['type'] = status === 'running' ? 'start' : status === 'stopped' ? 'stop' : 'error'
      setActivities(prev => [{
        id: `${id}-${Date.now()}`,
        type: actType,
        instanceName: inst.name,
        time: new Date()
      }, ...prev].slice(0, 20))
    })
    return () => { socketClient.off('instance-status'); socketClient.disconnect() }
  }, [token, instances])

  useEffect(() => {
    fetchInstances()
    const interval = setInterval(fetchInstances, 5000)
    return () => clearInterval(interval)
  }, [fetchInstances])

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

  const formatTime = (iso?: string) => {
    if (!iso) return '-'
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const formatDuration = (iso?: string) => {
    if (!iso) return null
    const diff = Date.now() - new Date(iso).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
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
                className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${inst.status === 'running' ? 'bg-green-500' : inst.status === 'starting' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300'}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">{inst.name}</p>
                    <p className="text-xs text-gray-400">
                      {inst.status === 'running' && inst.lastStarted ? `已运行 ${formatDuration(inst.lastStarted)}` : formatTime(inst.lastStarted)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
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
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Activity className="w-4 h-4" />近期动态</h2>
          {activities.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">暂无动态</p>}
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            <AnimatePresence>
              {activities.map(a => (
                <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-3 py-2 text-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${a.type === 'start' ? 'bg-green-100 text-green-600' : a.type === 'stop' ? 'bg-red-100 text-red-500' : 'bg-yellow-100 text-yellow-600'}`}>
                    {a.type === 'start' ? <Play className="w-3 h-3" /> : a.type === 'stop' ? <Square className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  </span>
                  <span className="text-gray-600 min-w-0 truncate">
                    <span className="font-medium text-gray-700">{a.instanceName}</span>
                    {' '}{a.type === 'start' ? '已启动' : a.type === 'stop' ? '已停止' : '状态变更'}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto shrink-0">{formatTime(a.time.toISOString())}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
