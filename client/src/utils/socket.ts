import { io, Socket } from 'socket.io-client'
import { useProgressStore } from '../stores/progressStore'

class SocketClient {
  private socket: Socket | null = null
  private listeners = new Map<string, Set<(...args: any[]) => void>>()

  initialize(token: string) {
    if (this.socket?.connected) return
    if (this.socket) this.socket.disconnect()
    this.socket = io({ auth: { token }, transports: ['websocket', 'polling'] })
    this.socket.on('connect_error', (err) => console.error('Socket 连接失败:', err.message))
    this.socket.on('file-progress', (data) => {
      useProgressStore.getState().handleProgressEvent(data)
    })
    for (const [event, handlers] of this.listeners) {
      for (const handler of handlers) this.socket.on(event, handler)
    }
  }

  getSocket(): Socket | null { return this.socket }

  getSocketId(): string | null {
    return this.socket?.id || null
  }

  disconnect() { if (this.socket) { this.socket.disconnect(); this.socket = null } }

  emit(event: string, data?: any) { this.socket?.emit(event, data) }

  on(event: string, handler: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    const handlers = this.listeners.get(event)!
    if (handlers.has(handler)) return
    handlers.add(handler)
    this.socket?.on(event, handler)
  }

  off(event: string, handler?: (...args: any[]) => void) {
    if (handler) {
      this.listeners.get(event)?.delete(handler)
      if (this.listeners.get(event)?.size === 0) this.listeners.delete(event)
      this.socket?.off(event, handler)
    } else {
      this.listeners.delete(event)
      this.socket?.off(event)
    }
  }

  createTerminal(data: { sessionId: string; cols: number; rows: number; cwd?: string; command?: string }) { this.emit('create-pty', data) }
  sendTerminalInput(sessionId: string, data: string) { this.emit('terminal-input', { sessionId, data }) }
  resizeTerminal(sessionId: string, cols: number, rows: number) { this.emit('terminal-resize', { sessionId, cols, rows }) }
  closeTerminal(sessionId: string) { this.emit('close-pty', { sessionId }) }
  getTerminalHistory(sessionId: string, instanceId?: string) { this.emit('get-terminal-history', { sessionId, instanceId }) }
}

export default new SocketClient()
