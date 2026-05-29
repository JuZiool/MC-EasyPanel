import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import socketClient from '../utils/socket'
import apiClient from '../utils/api'
import { useAuthStore } from '../stores/authStore'

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string>('')
  const currentInstanceRef = useRef<string>('')
  const [searchParams] = useSearchParams()
  const [instances, setInstances] = useState<any[]>([])
  const [selectedInstance, setSelectedInstance] = useState('')
  const [isLive, setIsLive] = useState(false)
  const token = useAuthStore(s => s.token)

  useEffect(() => {
    if (!token) return

    const instanceParam = searchParams.get('instance')
    if (instanceParam) setSelectedInstance(instanceParam)

    apiClient.getInstances().then(d => { if (d.success) setInstances(d.data || []) })
  }, [token])


  const termInitRef = useRef(false)

  useEffect(() => {
    if (!terminalRef.current || termInitRef.current) return
    termInitRef.current = true
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

    // 实例 PTY 创建时自动附着
    socketClient.on('pty-created', ({ sessionId, instanceId }) => {
      if (instanceId && instanceId === currentInstanceRef.current) {
        sessionIdRef.current = sessionId
        setIsLive(true)
      }
    })
    socketClient.on('terminal-output', ({ sessionId, data }) => {
      if (sessionId === sessionIdRef.current) term.write(data)
    })
    socketClient.on('terminal-exit', ({ sessionId }) => {
      if (sessionId === sessionIdRef.current) {
        term.write('\r\n\x1b[31m进程已退出\x1b[0m\r\n')
        setIsLive(false)
      }
    })
    socketClient.on('terminal-error', ({ sessionId, error }) => {
      if (sessionId === sessionIdRef.current) {
        term.write(`\r\n\x1b[31m错误: ${error}\x1b[0m\r\n`)
      }
    })
    socketClient.on('terminal-history', ({ sessionId, data }) => {
      if (currentInstanceRef.current && data) {
        term.write(data)
      }
    })

    return () => {
      window.removeEventListener('resize', onResize)
      socketClient.off('pty-created')
      socketClient.off('terminal-output')
      socketClient.off('terminal-exit')
      socketClient.off('terminal-error')
      socketClient.off('terminal-history')
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [token])

  // 选择实例时自动加载日志/实时输出

  // 选择实例时自动加载日志/实时输出
  useEffect(() => {
    if (!selectedInstance || !xtermRef.current) return

    const inst = instances.find((i: any) => i.id === selectedInstance)
    if (!inst) return

    // 清空终端，切换到新实例
    xtermRef.current.reset()
    sessionIdRef.current = inst.terminalSessionId || ''
    currentInstanceRef.current = inst.id
    setIsLive(inst.status === 'running' && !!inst.terminalSessionId)

    // 加载历史日志
    socketClient.getTerminalHistory(inst.terminalSessionId || '', inst.id)
  }, [selectedInstance, instances])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-800">终端控制台</h1>
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)}
          className="px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm text-gray-700 focus:border-primary-400 outline-none">
          <option value="">选择实例</option>
          {instances.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.status})</option>)}
        </select>
        {selectedInstance && (
          isLive
            ? <span className="text-xs text-green-500 font-medium flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />实时输出</span>
            : <span className="text-xs text-gray-500 italic">← 历史日志（只读）</span>
        )}
      </div>
      <div ref={terminalRef} className="w-full aspect-[4/5] rounded-xl overflow-hidden border border-surface-200 max-h-[calc(100vh-12rem)]" />
    </div>
  )
}
