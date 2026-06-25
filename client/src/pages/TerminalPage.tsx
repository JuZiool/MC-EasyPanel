import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import socketClient from '../utils/socket'
import apiClient from '../utils/api'
import { useAuthStore } from '../stores/authStore'
import { Server, ChevronRight } from 'lucide-react'

const statusColors: Record<string, string> = {
  running: 'bg-green-500',
  stopped: 'bg-gray-400',
  starting: 'bg-yellow-400',
  stopping: 'bg-yellow-400',
  error: 'bg-red-500',
}

const statusLabelColors: Record<string, string> = {
  running: 'bg-green-50 text-green-600',
  stopped: 'bg-gray-100 text-gray-500',
  starting: 'bg-yellow-50 text-yellow-600',
  stopping: 'bg-yellow-50 text-yellow-600',
  error: 'bg-red-50 text-red-600',
}

const statusLabels: Record<string, string> = {
  running: '运行中',
  stopped: '已停止',
  starting: '启动中',
  stopping: '停止中',
  error: '错误',
}

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const sessionIdRef = useRef<string>('')
  const currentInstanceRef = useRef<string>('')
  const prevInstanceIdRef = useRef<string>('')
  const [searchParams] = useSearchParams()
  const [instances, setInstances] = useState<any[]>([])
  const [selectedInstance, setSelectedInstance] = useState(() => localStorage.getItem('terminal_selectedInstance') || '')
  const [isLive, setIsLive] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('terminal_sidebarCollapsed') === 'true')
  const token = useAuthStore(s => s.token)

  // 加载实例列表，每 3 秒轮询
  useEffect(() => {
    if (!token) return
    const instanceParam = searchParams.get('instance')
    if (instanceParam) setSelectedInstance(instanceParam)
    const fetchInstances = () => {
      apiClient.getInstances().then(d => { if (d.success) setInstances(d.data || []) })
    }
    fetchInstances()
    const interval = setInterval(fetchInstances, 3000)
    return () => clearInterval(interval)
  }, [token])

  // 记住选中的实例
  useEffect(() => {
    if (selectedInstance) localStorage.setItem('terminal_selectedInstance', selectedInstance)
  }, [selectedInstance])

  const selectedInst = instances.find((i: any) => i.id === selectedInstance)

  // 挂载时：创建 xterm + 注册 Socket 监听 + ResizeObserver
  useEffect(() => {
    if (!terminalRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'JetBrains Mono, monospace',
      theme: { background: '#1a1a2e', foreground: '#e0e0e0', cursor: '#e0e0e0', selectionBackground: '#4a4a6a' }
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()
    xtermRef.current = term

    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(terminalRef.current)

    term.onData((data) => {
      if (sessionIdRef.current) socketClient.sendTerminalInput(sessionIdRef.current, data)
    })

    const onPtyCreated = ({ sessionId, instanceId }: any) => {
      if (instanceId && instanceId === currentInstanceRef.current) {
        sessionIdRef.current = sessionId
        setIsLive(true)
      }
    }
    const onTerminalOutput = ({ sessionId, data }: any) => {
      if (sessionId === sessionIdRef.current && data) term.write(data)
    }
    const onTerminalExit = ({ sessionId }: any) => {
      if (sessionId === sessionIdRef.current) {
        term.write('\r\n\x1b[31m进程已退出\x1b[0m\r\n')
        setIsLive(false)
      }
    }
    const onTerminalError = ({ sessionId, error }: any) => {
      if (sessionId === sessionIdRef.current) {
        term.write(`\r\n\x1b[31m错误: ${error}\x1b[0m\r\n`)
      }
    }
    const onTerminalHistory = ({ sessionId, data }: any) => {
      if (sessionId === sessionIdRef.current && data) term.write(data)
    }

    socketClient.on('pty-created', onPtyCreated)
    socketClient.on('terminal-output', onTerminalOutput)
    socketClient.on('terminal-exit', onTerminalExit)
    socketClient.on('terminal-error', onTerminalError)
    socketClient.on('terminal-history', onTerminalHistory)

    return () => {
      resizeObserver.disconnect()
      socketClient.off('pty-created', onPtyCreated)
      socketClient.off('terminal-output', onTerminalOutput)
      socketClient.off('terminal-exit', onTerminalExit)
      socketClient.off('terminal-error', onTerminalError)
      socketClient.off('terminal-history', onTerminalHistory)
      term.dispose()
      xtermRef.current = null
    }
  }, [token])

  // 统一处理：实例切换（重置+历史）和轮询刷新（更新引用）
  useEffect(() => {
    if (!selectedInstance || !xtermRef.current) return
    const inst = instances.find((i: any) => i.id === selectedInstance)
    if (!inst) return

    const prevId = prevInstanceIdRef.current
    const isSwitch = prevId !== selectedInstance
    prevInstanceIdRef.current = selectedInstance

    if (isSwitch) {
      xtermRef.current.reset()
    }

    currentInstanceRef.current = inst.id
    sessionIdRef.current = inst.terminalSessionId || ''
    setIsLive(inst.status === 'running' && !!inst.terminalSessionId)

    if (isSwitch) {
      socketClient.getTerminalHistory(inst.terminalSessionId || '', inst.id)
    }
  }, [selectedInstance, instances])

  return (
    <div className="flex flex-col min-h-0 lg:h-[calc(100vh-3rem)]">
      <h1 className="text-xl font-semibold text-gray-800 mb-4 shrink-0">终端控制台</h1>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* 左侧实例列表 */}
        <div className={`shrink-0 flex flex-col bg-white rounded-xl border border-surface-200 transition-all ${sidebarCollapsed ? 'w-12' : 'w-56'}`}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-100">
            {!sidebarCollapsed && <span className="text-xs font-medium text-gray-500">实例列表</span>}
            <button
              onClick={() => { const v = !sidebarCollapsed; setSidebarCollapsed(v); localStorage.setItem('terminal_sidebarCollapsed', String(v)) }}
              className={`p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-surface-100 transition-colors ${sidebarCollapsed ? 'mx-auto' : ''}`}
              title={sidebarCollapsed ? '展开' : '折叠'}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {instances.map((inst: any) => {
              const color = statusColors[inst.status] || statusColors.stopped
              const isActive = inst.id === selectedInstance
              return (
                <button
                  key={inst.id}
                  onClick={() => setSelectedInstance(inst.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-surface-50 hover:text-gray-800'
                  }`}
                  title={inst.name}
                >
                  <Server className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 truncate">{inst.name}</span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                    </>
                  )}
                </button>
              )
            })}
            {instances.length === 0 && !sidebarCollapsed && (
              <p className="px-2.5 py-4 text-xs text-gray-400 text-center">暂无实例</p>
            )}
          </div>
        </div>

        {/* 右侧终端区域 — 始终显示 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 信息栏 — 始终显示 */}
          <div className="flex items-center gap-3 px-4 h-11 bg-white rounded-xl border border-surface-200 mb-3 shrink-0">
            {selectedInst ? (
              <>
                <Server className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-sm font-medium text-gray-700 truncate">{selectedInst.name}</span>
                <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full shrink-0 ${statusLabelColors[selectedInst.status] || statusLabelColors.stopped}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusColors[selectedInst.status] || statusColors.stopped}`} />
                  {statusLabels[selectedInst.status] || '未知'}
                </span>
                {isLive
                  ? <span className="text-xs text-green-500 font-medium flex items-center gap-1 ml-auto shrink-0"><span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />实时输出</span>
                  : <span className="text-xs text-gray-500 italic ml-auto shrink-0">历史日志（只读）</span>
                }
              </>
            ) : (
              <span className="text-sm text-gray-400">请从左侧选择一个实例</span>
            )}
          </div>

          {/* 终端容器 — 始终显示 */}
          <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden border border-surface-200 isolate">
            <div ref={terminalRef} className="w-full h-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
