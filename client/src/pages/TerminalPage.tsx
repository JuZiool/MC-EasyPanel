import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import socketClient from '../utils/socket'
import apiClient from '../utils/api'
import { useAuthStore } from '../stores/authStore'
import { Server, Terminal as TerminalIcon, ChevronRight } from 'lucide-react'

const statusConfig: Record<string, { color: string; label: string }> = {
  running: { color: 'bg-green-500', label: '运行中' },
  stopped: { color: 'bg-gray-400', label: '已停止' },
  error: { color: 'bg-red-500', label: '错误' },
}

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string>('')
  const currentInstanceRef = useRef<string>('')
  const isFirstLoadForInstance = useRef<string>('')
  const [searchParams] = useSearchParams()
  const [instances, setInstances] = useState<any[]>([])
  const [selectedInstance, setSelectedInstance] = useState('')
  const [isLive, setIsLive] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const token = useAuthStore(s => s.token)

  // 加载实例列表，轮询更新
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

  const selectedInst = instances.find((i: any) => i.id === selectedInstance)

  // 选中实例时创建 xterm，切换/取消时销毁
  useEffect(() => {
    if (!selectedInstance || !selectedInst || !terminalRef.current) return

    // 销毁旧终端（如果有）
    if (xtermRef.current) {
      xtermRef.current.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }

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
    fitAddonRef.current = fitAddon

    const onResize = () => fitAddon.fit()
    window.addEventListener('resize', onResize)

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
      if (sessionId === sessionIdRef.current) term.write(data)
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
      if (currentInstanceRef.current && data) {
        term.write(data)
      }
    }

    socketClient.on('pty-created', onPtyCreated)
    socketClient.on('terminal-output', onTerminalOutput)
    socketClient.on('terminal-exit', onTerminalExit)
    socketClient.on('terminal-error', onTerminalError)
    socketClient.on('terminal-history', onTerminalHistory)

    // 初始化当前实例状态
    isFirstLoadForInstance.current = selectedInstance
    currentInstanceRef.current = selectedInst.id
    sessionIdRef.current = selectedInst.terminalSessionId || ''
    setIsLive(selectedInst.status === 'running' && !!selectedInst.terminalSessionId)
    socketClient.getTerminalHistory(selectedInst.terminalSessionId || '', selectedInst.id)

    return () => {
      window.removeEventListener('resize', onResize)
      socketClient.off('pty-created', onPtyCreated)
      socketClient.off('terminal-output', onTerminalOutput)
      socketClient.off('terminal-exit', onTerminalExit)
      socketClient.off('terminal-error', onTerminalError)
      socketClient.off('terminal-history', onTerminalHistory)
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [selectedInstance])

  // 实例轮询时更新状态引用
  useEffect(() => {
    if (!selectedInstance || !xtermRef.current) return
    const inst = instances.find((i: any) => i.id === selectedInstance)
    if (!inst) return
    currentInstanceRef.current = inst.id
    if (inst.terminalSessionId) sessionIdRef.current = inst.terminalSessionId
    setIsLive(inst.status === 'running' && !!inst.terminalSessionId)
  }, [instances])

  const statusInfo = selectedInst ? statusConfig[selectedInst.status] || statusConfig.stopped : null

  return (
    <div className="flex flex-col min-h-0 lg:h-[calc(100vh-3rem)]">
      <h1 className="text-xl font-semibold text-gray-800 mb-4 shrink-0">终端控制台</h1>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* 左侧实例列表 */}
        <div className={`shrink-0 flex flex-col bg-white rounded-xl border border-surface-200 transition-all ${sidebarCollapsed ? 'w-12' : 'w-56'}`}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-100">
            {!sidebarCollapsed && <span className="text-xs font-medium text-gray-500">实例列表</span>}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-surface-100 transition-colors ${sidebarCollapsed ? 'mx-auto' : ''}`}
              title={sidebarCollapsed ? '展开' : '折叠'}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {instances.map((inst: any) => {
              const info = statusConfig[inst.status] || statusConfig.stopped
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
                      <span className={`w-2 h-2 rounded-full shrink-0 ${info.color}`} title={info.label} />
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

        {/* 右侧终端区域 — 参考项目条件渲染方式 */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedInstance && selectedInst ? (
            <>
              {/* 实例信息栏 */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border border-surface-200 mb-3 shrink-0">
                <Server className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{selectedInst.name}</span>
                {statusInfo && (
                  <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                    selectedInst.status === 'running' ? 'bg-green-50 text-green-600' :
                    selectedInst.status === 'error' ? 'bg-red-50 text-red-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.color}`} />
                    {statusInfo.label}
                  </span>
                )}
                {isLive
                  ? <span className="text-xs text-green-500 font-medium flex items-center gap-1 ml-auto"><span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />实时输出</span>
                  : <span className="text-xs text-gray-500 italic ml-auto">历史日志（只读）</span>
                }
              </div>

              {/* 终端容器 */}
              <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden border border-surface-200 isolate">
                <div ref={terminalRef} className="w-full h-full" />
                {xtermRef.current === null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                    <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </>
          ) : (
            // 未选择实例 — flex-1 占满整块区域，与选中态高度一致
            <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-surface-200">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-100 flex items-center justify-center">
                  <TerminalIcon className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">请从左侧选择一个实例</p>
                <p className="text-xs text-gray-300">选择后将显示该实例的终端或日志</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
