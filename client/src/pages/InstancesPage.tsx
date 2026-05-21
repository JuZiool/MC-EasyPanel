import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useInstanceStore } from '../stores/instanceStore'
import { useNotificationStore } from '../stores/notificationStore'
import apiClient from '../utils/api'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import PlayerChart from '../components/PlayerChart'
import type { Instance, PlayerSession } from '../types'
import { Plus, Play, Square, Terminal, Folder, Trash2, Server, BarChart3, Users, Pencil } from 'lucide-react'

export default function InstancesPage() {
  const { instances, loading, fetchInstances } = useInstanceStore()
  const { addNotification } = useNotificationStore()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [createAnimating, setCreateAnimating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [editAnimating, setEditAnimating] = useState(false)
  const [editForm, setEditForm] = useState<{ name: string; description: string; workingDirectory: string; startCommand: string; autoStart: boolean; stopCommand: Instance['stopCommand'] }>({ name: '', description: '', workingDirectory: '', startCommand: '', autoStart: false, stopCommand: 'stop' })
  const [form, setForm] = useState<{ name: string; description: string; workingDirectory: string; startCommand: string; autoStart: boolean; stopCommand: Instance['stopCommand'] }>({ name: '', description: '', workingDirectory: '', startCommand: '', autoStart: false, stopCommand: 'stop' })
  const [removeFilesOnDelete, setRemoveFilesOnDelete] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedCharts, setExpandedCharts] = useState<Set<string>>(new Set())
  const [chartData, setChartData] = useState<Record<string, any>>({})
  const [playerSessions, setPlayerSessions] = useState<Record<string, PlayerSession[]>>({})
  const [initLoaded, setInitLoaded] = useState(false)

  useEffect(() => { fetchInstances() }, [])

  // 实例加载完成后默认展开所有图表并加载数据
  useEffect(() => {
    if (instances.length > 0 && !initLoaded) {
      setInitLoaded(true)
      const all = new Set(instances.map(i => i.id))
      setExpandedCharts(all)

      let cancelled = false
      const loadAll = async () => {
        const results = await Promise.all(instances.map(async (inst) => {
          const [chartRes, sessionRes] = await Promise.all([
            apiClient.get(`/instances/${inst.id}/player-stats`),
            apiClient.getInstancePlayerSessions(inst.id)
          ])
          return {
            id: inst.id,
            chartData: chartRes.data,
            sessions: (sessionRes.data as PlayerSession[]) || []
          }
        }))

        if (cancelled) return

        const chartMap: Record<string, any> = {}
        const sessionMap: Record<string, PlayerSession[]> = {}
        for (const r of results) {
          if (r.chartData) chartMap[r.id] = r.chartData
          if (r.sessions) sessionMap[r.id] = r.sessions
        }
        setChartData(chartMap)
        setPlayerSessions(sessionMap)
      }
      loadAll()
      return () => { cancelled = true }
    }
  }, [instances, initLoaded])

  const toggleChart = async (id: string) => {
    const next = new Set(expandedCharts)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
      if (!chartData[id]) {
        const res = await apiClient.get(`/instances/${id}/player-stats`)
        if (res.success && res.data) {
          setChartData(prev => ({ ...prev, [id]: res.data }))
        }
      }
      if (!playerSessions[id]) {
        const res = await apiClient.getInstancePlayerSessions(id)
        if (res.success && res.data) {
          setPlayerSessions(prev => ({ ...prev, [id]: res.data as PlayerSession[] }))
        }
      }
    }
    setExpandedCharts(next)
  }

  const getPlayerTotalDuration = (sessions: PlayerSession[]) => {
    let total = 0
    for (const s of sessions) {
      const end = s.active ? Date.now() : new Date(s.lastSeen).getTime()
      total += end - new Date(s.firstSeen).getTime()
    }
    return total
  }

  const formatDuration = (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    if (h > 0) return `${h}时${m}分`
    if (m > 0) return `${m}分`
    return '刚刚'
  }

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

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await apiClient.deleteInstance(deleteTarget, removeFilesOnDelete)
    if (res.success) { addNotification({ type: 'success', title: removeFilesOnDelete ? '已删除（含文件）' : '已删除' }); fetchInstances() }
    else addNotification({ type: 'error', title: '删除失败' })
    setDeleteTarget(null)
    setRemoveFilesOnDelete(false)
  }

  const openEdit = (id: string) => {
    const inst = instances.find(i => i.id === id)
    if (!inst) return
    setEditForm({
      name: inst.name,
      description: inst.description,
      workingDirectory: inst.workingDirectory,
      startCommand: inst.startCommand,
      autoStart: inst.autoStart,
      stopCommand: inst.stopCommand,
    })
    setEditTarget(id)
    setTimeout(() => setEditAnimating(true), 10)
  }
  const closeEdit = () => {
    setEditAnimating(false)
    setTimeout(() => setEditTarget(null), 300)
  }
  const handleEdit = async () => {
    if (!editTarget || !editForm.name.trim()) return
    const res = await apiClient.updateInstance(editTarget, {
      name: editForm.name.trim(),
      description: editForm.description,
      workingDirectory: editForm.workingDirectory,
      startCommand: editForm.startCommand,
      autoStart: editForm.autoStart,
      stopCommand: editForm.stopCommand,
    })
    if (res.success) { addNotification({ type: 'success', title: '已保存' }); fetchInstances(); closeEdit() }
    else addNotification({ type: 'error', title: '保存失败', message: res.message })
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
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {instances.map(inst => {
            const showChart = expandedCharts.has(inst.id)
            const data = chartData[inst.id]
            return (
              <motion.div key={inst.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-surface-200">
                {/* 实例信息行 */}
                <div className="p-5 flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColors[inst.status]}`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800">{inst.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{inst.workingDirectory || inst.description || '未设置目录'}</p>
                    <span className="inline-block text-xs text-gray-400 mt-1 capitalize">{inst.status}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleChart(inst.id)}
                      className={`p-2 rounded-lg transition-colors ${showChart ? 'text-primary-600 bg-primary-50' : 'text-gray-400 hover:bg-surface-50'}`}
                      title="历史在线人数">
                      <BarChart3 className="w-4 h-4" />
                    </button>
                    {inst.status === 'running' ? (
                      <button onClick={() => handleStop(inst.id)} disabled={actionLoading === inst.id} className="p-2 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-colors" title="停止"><Square className="w-4 h-4" /></button>
                    ) : (
                      <button onClick={() => handleStart(inst.id)} disabled={actionLoading === inst.id} className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors" title="启动"><Play className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => navigate(`/terminal?instance=${inst.id}`)} className="p-2 rounded-lg text-gray-500 hover:bg-surface-50 transition-colors" title="终端"><Terminal className="w-4 h-4" /></button>
                    <button onClick={() => navigate(`/files?path=${encodeURIComponent(inst.workingDirectory)}`)} className="p-2 rounded-lg text-gray-500 hover:bg-surface-50 transition-colors" title="文件"><Folder className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(inst.id)} className="p-2 rounded-lg text-gray-500 hover:bg-surface-50 transition-colors" title="编辑"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteTarget(inst.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {/* 展开的折线图区域（左侧图表 + 右侧在线玩家） */}
                <AnimatePresence>
                  {showChart && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-5 pb-4 pt-0 border-t border-surface-100">
                        <div className="pt-3 flex gap-4">
                          {/* 左侧：历史在线人数图表 */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-medium text-gray-500 mb-2">历史在线人数</h4>
                            {data ? (
                              <PlayerChart data={data} width={400} height={140} />
                            ) : (
                              <div className="text-xs text-gray-400 py-6 text-center">加载中...</div>
                            )}
                          </div>
                          {/* 右侧：所有玩家及游玩时长 */}
                          <div className="w-44 shrink-0 border-l border-surface-100 pl-4">
                            <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                              <Users className="w-3 h-3" />玩家
                            </h4>
                            {playerSessions[inst.id] && playerSessions[inst.id].length > 0 ? (
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {(() => {
                                  // 按 playerId 聚合所有会话，计算累计总时长
                                  const grouped: Record<string, PlayerSession[]> = {}
                                  for (const s of playerSessions[inst.id]) {
                                    if (!grouped[s.playerId]) grouped[s.playerId] = []
                                    grouped[s.playerId].push(s)
                                  }
                                  return Object.entries(grouped).map(([playerId, sessions]) => {
                                    const isOnline = sessions.some(s => s.active)
                                    const totalMs = getPlayerTotalDuration(sessions)
                                    const playerName = sessions[0].playerName
                                    return (
                                      <div key={playerId} className="flex items-center justify-between text-xs">
                                        <span className={`flex items-center gap-1.5 truncate ${isOnline ? 'text-gray-700' : 'text-gray-400'}`}>
                                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                                          <span className={`truncate ${isOnline ? 'text-green-700' : 'text-gray-400'}`}>{playerName}</span>
                                        </span>
                                        <span className="text-gray-400 shrink-0 ml-2">{formatDuration(totalMs)}</span>
                                      </div>
                                    )
                                  })
                                })()}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-8 text-gray-300">
                                <Users className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
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
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">关闭命令</label>
                <select value={form.stopCommand} onChange={e => setForm({ ...form, stopCommand: e.target.value as Instance['stopCommand'] })}
                  className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-gray-700 text-sm">
                  <option value="stop">stop（发送停止命令到控制台）</option>
                  <option value="ctrl+c">ctrl+c（模拟 Ctrl+C 中断）</option>
                  <option value="exit">exit（发送退出命令）</option>
                  <option value="quit">quit（发送退出命令）</option>
                </select>
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

      {/* 编辑弹窗 */}
      {editTarget && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: editAnimating ? 1 : 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: editAnimating ? 1 : 0, scale: editAnimating ? 1 : 0.95 }} className="bg-white rounded-2xl shadow-xl border border-surface-200 p-6 max-w-lg w-full">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">编辑实例</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">实例名称</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">描述</label>
                <input type="text" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">工作目录</label>
                <input type="text" value={editForm.workingDirectory} onChange={e => setEditForm({ ...editForm, workingDirectory: e.target.value })}
                  placeholder="/app/servers/my-server"
                  className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-gray-700 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">启动命令</label>
                <input type="text" value={editForm.startCommand} onChange={e => setEditForm({ ...editForm, startCommand: e.target.value })}
                  placeholder="java -Xmx2G -jar server.jar nogui"
                  className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-gray-700 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">关闭命令</label>
                <select value={editForm.stopCommand} onChange={e => setEditForm({ ...editForm, stopCommand: e.target.value as Instance['stopCommand'] })}
                  className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-gray-700 text-sm">
                  <option value="stop">stop（发送停止命令到控制台）</option>
                  <option value="ctrl+c">ctrl+c（模拟 Ctrl+C 中断）</option>
                  <option value="exit">exit（发送退出命令）</option>
                  <option value="quit">quit（发送退出命令）</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="editAutoStart" checked={editForm.autoStart} onChange={e => setEditForm({ ...editForm, autoStart: e.target.checked })}
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-400" />
                <label htmlFor="editAutoStart" className="text-sm text-gray-600">面板启动时自动启动</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeEdit} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-surface-100 transition-colors text-sm">取消</button>
              <button onClick={handleEdit} className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors">保存</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <ConfirmDeleteDialog isOpen={!!deleteTarget} onClose={() => { setDeleteTarget(null); setRemoveFilesOnDelete(false) }} onConfirm={handleDelete} name={instances.find(i => i.id === deleteTarget)?.name || ''}>
        <label className="flex items-center gap-2 mt-3 px-1 cursor-pointer">
          <input type="checkbox" checked={removeFilesOnDelete} onChange={e => setRemoveFilesOnDelete(e.target.checked)}
            className="rounded border-gray-300 text-red-500 focus:ring-red-400" />
          <span className="text-sm text-gray-600">同时删除实例文件（不可恢复）</span>
        </label>
      </ConfirmDeleteDialog>
    </div>
  )
}
