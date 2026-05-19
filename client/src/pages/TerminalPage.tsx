import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import socketClient from '../utils/socket'
import apiClient from '../utils/api'
import { useAuthStore } from '../stores/authStore'
import { useNotificationStore } from '../stores/notificationStore'

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string>('')
  const currentInstanceRef = useRef<string>('')
  const [searchParams] = useSearchParams()
  const [connected, setConnected] = useState(false)
  const [logViewer, setLogViewer] = useState(false)
  const [instances, setInstances] = useState<any[]>([])
  const [selectedInstance, setSelectedInstance] = useState('')
  const [customCommand, setCustomCommand] = useState('')
  const token = useAuthStore(s => s.token)
  const { addNotification } = useNotificationStore()

  useEffect(() => {
    if (!token) return
    socketClient.initialize(token)

    const instanceParam = searchParams.get('instance')
    if (instanceParam) setSelectedInstance(instanceParam)

    apiClient.getInstances().then(d => { if (d.success) setInstances(d.data || []) })

    return () => { socketClient.disconnect() }
  }, [token])

  const initTerminal = useCallback(() => {
    if (!terminalRef.current || xtermRef.current) return
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

    term.onData((data) => {
      if (sessionIdRef.current) socketClient.sendTerminalInput(sessionIdRef.current, data)
    })

    window.addEventListener('resize', () => fitAddon.fit())

    socketClient.on('pty-created', ({ sessionId }) => {
      sessionIdRef.current = sessionId
      setConnected(true)
      setLogViewer(false)
    })
    socketClient.on('terminal-output', ({ sessionId, data }) => {
      if (sessionId === sessionIdRef.current) term.write(data)
    })
    socketClient.on('terminal-exit', ({ sessionId }) => {
      if (sessionId === sessionIdRef.current) {
        term.write('\r\n\x1b[31m进程已退出\x1b[0m\r\n')
        setConnected(false)
        setLogViewer(true)
      }
    })
    socketClient.on('terminal-error', ({ sessionId, error }) => {
      if (sessionId === sessionIdRef.current) {
        term.write(`\r\n\x1b[31m错误: ${error}\x1b[0m\r\n`)
        setConnected(false)
      }
    })
    socketClient.on('terminal-history', ({ sessionId, data }) => {
      if (currentInstanceRef.current && data) {
        term.write(data)
      }
    })
  }, [])

  useEffect(() => { initTerminal() }, [initTerminal])

  const handleConnect = () => {
    if (!xtermRef.current || sessionIdRef.current) return
    const inst = instances.find((i: any) => i.id === selectedInstance)

    if (inst?.status === 'running' && inst.terminalSessionId) {
      sessionIdRef.current = inst.terminalSessionId
      currentInstanceRef.current = inst.id
      setConnected(true)
      setLogViewer(false)
      socketClient.getTerminalHistory(inst.terminalSessionId, inst.id)
      addNotification({ type: 'info', title: '已连接到运行中的终端' })
      return
    }

    if (inst && inst.status !== 'running') {
      currentInstanceRef.current = inst.id
      setConnected(true)
      setLogViewer(true)
      socketClient.getTerminalHistory('', inst.id)
      addNotification({ type: 'info', title: '已加载历史日志' })
      return
    }

    if (customCommand) {
      const sessionId = `term-${Date.now()}`
      socketClient.createTerminal({
        sessionId, cols: xtermRef.current.cols, rows: xtermRef.current.rows,
        cwd: inst?.workingDirectory, command: customCommand
      })
      return
    }

    addNotification({ type: 'warning', title: '请选择实例或输入命令' })
  }

  const handleDisconnect = () => {
    if (sessionIdRef.current && !logViewer) {
      socketClient.closeTerminal(sessionIdRef.current)
    }
    sessionIdRef.current = ''
    currentInstanceRef.current = ''
    setConnected(false)
    setLogViewer(false)
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <h1 className="text-xl font-semibold text-gray-800 shrink-0">终端控制台</h1>
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)}
          className="px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm text-gray-700 focus:border-primary-400 outline-none">
          <option value="">选择实例（自动连接）</option>
          {instances.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.status})</option>)}
        </select>
        <input type="text" value={customCommand} onChange={e => setCustomCommand(e.target.value)}
          placeholder="或输入自定义命令"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 text-sm font-mono focus:border-primary-400 outline-none text-gray-700" />
        {!connected ? (
          <button onClick={handleConnect} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">连接</button>
        ) : (
          <button onClick={handleDisconnect} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">{logViewer ? '关闭日志' : '断开'}</button>
        )}
        {logViewer && <span className="text-xs text-gray-500 italic">← 日志查看模式（只读）</span>}
      </div>
      <div ref={terminalRef} className="flex-1 rounded-xl overflow-hidden border border-surface-200 min-h-[400px]" />
    </div>
  )
}
