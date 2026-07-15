import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useInstanceStore } from '../stores/instanceStore'
import { useNotificationStore } from '../stores/notificationStore'
import apiClient from '../utils/api'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import PlayerChart from '../components/PlayerChart'
import type { Instance, PlayerTrackingData } from '../types'
import { Plus, Play, Square, Terminal, Folder, Trash2, Server, Users, Pencil } from 'lucide-react'
import socketClient from '../utils/socket'

type DataLoadStatus = 'loading' | 'ready' | 'error'

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
  const [chartData, setChartData] = useState<Record<string, any>>({})
  const [trackingData, setTrackingData] = useState<Record<string, PlayerTrackingData>>({})
  const [instanceMemory, setInstanceMemory] = useState<Record<string, number>>({})
  const [chartLoadStatus, setChartLoadStatus] = useState<Record<string, DataLoadStatus>>({})
  const [trackingLoadStatus, setTrackingLoadStatus] = useState<Record<string, DataLoadStatus>>({})
  const loadedChartIdsRef = useRef(new Set<string>())
  const loadedTrackingIdsRef = useRef(new Set<string>())
  const loadingChartIdsRef = useRef(new Set<string>())
  const loadingTrackingIdsRef = useRef(new Set<string>())
  const [, setDurationTick] = useState(0)

  useEffect(() => { fetchInstances() }, [])

  useEffect(() => {
    const interval = setInterval(() => setDurationTick(tick => tick + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // 并行加载新增实例的数据，失败项每 30 秒重试，历史图表每五分钟刷新一次
  useEffect(() => {
    if (instances.length === 0) return
    const loadData = async (refreshCharts: boolean) => {
      await Promise.all(instances.map(async inst => {
        const needsChart = (refreshCharts || !loadedChartIdsRef.current.has(inst.id)) && !loadingChartIdsRef.current.has(inst.id)
        const needsTracking = !loadedTrackingIdsRef.current.has(inst.id) && !loadingTrackingIdsRef.current.has(inst.id)
        if (!needsChart && !needsTracking) return

        if (needsChart && !loadedChartIdsRef.current.has(inst.id)) {
          setChartLoadStatus(prev => ({ ...prev, [inst.id]: 'loading' }))
        }
        if (needsTracking && !loadedTrackingIdsRef.current.has(inst.id)) {
          setTrackingLoadStatus(prev => ({ ...prev, [inst.id]: 'loading' }))
        }
        if (needsChart) loadingChartIdsRef.current.add(inst.id)
        if (needsTracking) loadingTrackingIdsRef.current.add(inst.id)

        try {
          const [chartRes, trackingRes] = await Promise.all([
            needsChart ? apiClient.get(`/instances/${inst.id}/player-stats`) : null,
            needsTracking ? apiClient.getInstancePlayerSessions(inst.id) : null,
          ])

          if (chartRes) {
            if (chartRes.success && chartRes.data) {
              setChartData(prev => ({ ...prev, [inst.id]: chartRes.data }))
              setChartLoadStatus(prev => ({ ...prev, [inst.id]: 'ready' }))
              loadedChartIdsRef.current.add(inst.id)
            } else {
              setChartLoadStatus(prev => ({ ...prev, [inst.id]: 'error' }))
              loadedChartIdsRef.current.delete(inst.id)
            }
          }

          if (trackingRes) {
            if (trackingRes.success && trackingRes.data) {
              setTrackingData(prev => ({ ...prev, [inst.id]: trackingRes.data! }))
              setTrackingLoadStatus(prev => ({ ...prev, [inst.id]: 'ready' }))
              loadedTrackingIdsRef.current.add(inst.id)
            } else {
              setTrackingLoadStatus(prev => ({ ...prev, [inst.id]: 'error' }))
              loadedTrackingIdsRef.current.delete(inst.id)
            }
          }
        } finally {
          if (needsChart) loadingChartIdsRef.current.delete(inst.id)
          if (needsTracking) loadingTrackingIdsRef.current.delete(inst.id)
        }
      }))
    }
    loadData(false)
    const retryInterval = setInterval(() => loadData(false), 30 * 1000)
    const chartInterval = setInterval(() => loadData(true), 5 * 60 * 1000)
    return () => {
      clearInterval(retryInterval)
      clearInterval(chartInterval)
    }
  }, [instances])

  // 通过 WebSocket 实时接收玩家会话更新
  useEffect(() => {
    const handler = (data: Record<string, PlayerTrackingData>) => {
      setTrackingData(prev => ({ ...prev, ...data }))
      const instanceIds = Object.keys(data)
      if (instanceIds.length > 0) {
        for (const instanceId of instanceIds) loadedTrackingIdsRef.current.add(instanceId)
        setTrackingLoadStatus(prev => ({
          ...prev,
          ...Object.fromEntries(instanceIds.map(instanceId => [instanceId, 'ready' as const])),
        }))
      }
    }
    socketClient.on('player-sessions-update', handler)
    return () => { socketClient.off('player-sessions-update', handler) }
  }, [])

  useEffect(() => {
    const handler = (data: Record<string, number>) => setInstanceMemory(data)
    socketClient.on('instance-memory', handler)
    return () => { socketClient.off('instance-memory', handler) }
  }, [])

  const formatDuration = (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    if (h > 0) return `${h}时${m}分`
    if (m > 0) return `${m}分`
    return '刚刚'
  }

  const getPlayerDisplayDuration = (player: PlayerTrackingData['players'][number]) => {
    if (!player.active || !player.currentSessionStartedAt) return player.totalDurationMs
    return player.totalDurationMs + Math.max(0, Date.now() - new Date(player.currentSessionStartedAt).getTime())
  }

  const formatMemory = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '-'
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
    return `${Math.round(bytes / 1024 ** 2)} MB`
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
    try {
      await apiClient.stopInstance(id)
      addNotification({ type: 'info', title: '正在停止...' })
      setTimeout(fetchInstances, 3000)
    } catch {
      addNotification({ type: 'error', title: '停止失败', message: '网络错误' })
    } finally {
      setActionLoading(null)
    }
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
            const data = chartData[inst.id]
            const playerData = trackingData[inst.id]
            const hasReliablePlayerList = playerData?.listStatus === 'available'
            return (
              <motion.div key={inst.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-surface-200">
                {/* 实例信息行 */}
                <div className="p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate">{inst.name}</h3>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColors[inst.status]}`} />
                      <span className="text-xs text-gray-400 font-mono shrink-0">内存 {formatMemory(instanceMemory[inst.id])}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{inst.workingDirectory || inst.description || '未设置目录'}</p>
                    <span className="inline-block text-xs text-gray-400 mt-1 capitalize">{inst.status}</span>
                    {inst.status === 'running' && hasReliablePlayerList && playerData.players.some(player => player.active) && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full mt-1 ml-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {playerData.players.filter(player => player.active).length} 在线
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
                {/* 在线人数图表区域（左侧图表 + 右侧在线玩家） */}
                <div className="border-t border-surface-100">
                  <div className="px-5 pb-4 pt-3 flex flex-col sm:flex-row gap-4">
                    {/* 左侧：历史在线人数图表 */}
                    <div className="flex-1 min-w-0">
                      <PlayerChart
                        data={data || []}
                        height={140}
                        loading={chartLoadStatus[inst.id] === 'loading'}
                        error={chartLoadStatus[inst.id] === 'error'}
                        playerSessions={playerData?.sessions}
                      />
                    </div>
                    {/* 右侧：所有玩家及游玩时长 */}
                    <div className="w-full sm:w-44 shrink-0 border-t sm:border-t-0 sm:border-l border-surface-100 pt-3 sm:pt-0 sm:pl-4">
                      <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                        <Users className="w-3 h-3" />玩家
                      </h4>
                      {inst.status === 'running' && playerData?.listStatus === 'unsupported' && (
                        <p className="text-[11px] leading-4 text-amber-600 mb-2">服务器未提供完整玩家名单，以下仅显示历史记录</p>
                      )}
                      {inst.status === 'running' && playerData?.listStatus === 'unavailable' && trackingLoadStatus[inst.id] === 'ready' && (
                        <p className="text-[11px] leading-4 text-gray-400 mb-2">玩家查询暂不可用，以下仅显示历史记录</p>
                      )}
                      {playerData?.players.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {playerData.players
                            .slice()
                            .sort((a, b) => getPlayerDisplayDuration(b) - getPlayerDisplayDuration(a))
                            .map(player => {
                              const playerIsActive = hasReliablePlayerList && player.active
                              return (
                                <div key={player.playerId} className="flex items-center justify-between text-xs">
                                  <span className={`flex items-center gap-1.5 truncate ${playerIsActive ? 'text-gray-700' : 'text-gray-400'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${playerIsActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    <span className={`truncate ${playerIsActive ? 'text-green-700' : 'text-gray-400'}`}>{player.playerName}</span>
                                  </span>
                                  <span className="text-gray-400 shrink-0 ml-2">{formatDuration(playerIsActive ? getPlayerDisplayDuration(player) : player.totalDurationMs)}</span>
                                </div>
                              )
                            })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-8 text-center text-xs text-gray-400">
                          {trackingLoadStatus[inst.id] === 'loading'
                            ? '正在加载玩家数据...'
                            : trackingLoadStatus[inst.id] === 'error'
                              ? '玩家数据加载失败，正在重试'
                              : inst.status !== 'running'
                                ? '实例未运行'
                                : playerData?.listStatus === 'unsupported'
                                  ? '服务器未提供完整玩家名单'
                                  : playerData?.listStatus === 'unavailable'
                                    ? '玩家查询暂不可用'
                                    : '暂无玩家记录'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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
