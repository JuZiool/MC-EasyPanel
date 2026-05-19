import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useInstanceStore } from '../stores/instanceStore'
import { useNotificationStore } from '../stores/notificationStore'
import apiClient from '../utils/api'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import type { Instance } from '../types'
import { Plus, Play, Square, RefreshCw, Terminal, Folder, Trash2, Server } from 'lucide-react'

export default function InstancesPage() {
  const { instances, loading, fetchInstances } = useInstanceStore()
  const { addNotification } = useNotificationStore()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [createAnimating, setCreateAnimating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [form, setForm] = useState<{ name: string; description: string; workingDirectory: string; startCommand: string; autoStart: boolean; stopCommand: Instance['stopCommand'] }>({ name: '', description: '', workingDirectory: '', startCommand: '', autoStart: false, stopCommand: 'stop' })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => { fetchInstances() }, [])

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

  const handleRestart = async (id: string) => {
    setActionLoading(id)
    const res = await apiClient.restartInstance(id)
    setActionLoading(null)
    if (res.success) addNotification({ type: 'success', title: '重启成功' })
    else addNotification({ type: 'error', title: '重启失败', message: res.message })
    fetchInstances()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await apiClient.deleteInstance(deleteTarget)
    if (res.success) { addNotification({ type: 'success', title: '已删除' }); fetchInstances() }
    else addNotification({ type: 'error', title: '删除失败' })
    setDeleteTarget(null)
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
        <div className="grid gap-4">
          {instances.map(inst => (
            <motion.div key={inst.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-surface-200 p-5 flex items-center gap-4">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColors[inst.status]}`} />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-800">{inst.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{inst.workingDirectory || inst.description || '未设置目录'}</p>
                <span className="inline-block text-xs text-gray-400 mt-1 capitalize">{inst.status}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {inst.status === 'running' ? (
                  <button onClick={() => handleStop(inst.id)} disabled={actionLoading === inst.id} className="p-2 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-colors" title="停止"><Square className="w-4 h-4" /></button>
                ) : (
                  <button onClick={() => handleStart(inst.id)} disabled={actionLoading === inst.id} className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors" title="启动"><Play className="w-4 h-4" /></button>
                )}
                <button onClick={() => handleRestart(inst.id)} disabled={actionLoading === inst.id} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title="重启"><RefreshCw className="w-4 h-4" /></button>
                <button onClick={() => navigate(`/terminal?instance=${inst.id}`)} className="p-2 rounded-lg text-gray-500 hover:bg-surface-50 transition-colors" title="终端"><Terminal className="w-4 h-4" /></button>
                <button onClick={() => navigate(`/files?path=${encodeURIComponent(inst.workingDirectory)}`)} className="p-2 rounded-lg text-gray-500 hover:bg-surface-50 transition-colors" title="文件"><Folder className="w-4 h-4" /></button>
                <button onClick={() => setDeleteTarget(inst.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
              </div>
            </motion.div>
          ))}
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

      <ConfirmDeleteDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} name={instances.find(i => i.id === deleteTarget)?.name || ''} />
    </div>
  )
}
