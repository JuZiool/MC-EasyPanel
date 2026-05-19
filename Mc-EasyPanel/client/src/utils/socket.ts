import { io, Socket } from 'socket.io-client'

class SocketClient {
  private socket: Socket | null = null

  initialize(token: string) {
    if (this.socket?.connected) return
    this.socket = io({ auth: { token }, transports: ['websocket', 'polling'] })
    this.socket.on('connect_error', (err) => console.error('Socket 连接失败:', err.message))
  }

  getSocket(): Socket | null { return this.socket }

  disconnect() { if (this.socket) { this.socket.disconnect(); this.socket = null } }

  emit(event: string, data?: any) { this.socket?.emit(event, data) }

  on(event: string, handler: (...args: any[]) => void) { this.socket?.on(event, handler) }

  off(event: string, handler?: (...args: any[]) => void) { if (handler) this.socket?.off(event, handler); else this.socket?.off(event) }

  createTerminal(data: { sessionId: string; cols: number; rows: number; cwd?: string; command?: string }) { this.emit('create-pty', data) }
  sendTerminalInput(sessionId: string, data: string) { this.emit('terminal-input', { sessionId, data }) }
  resizeTerminal(sessionId: string, cols: number, rows: number) { this.emit('terminal-resize', { sessionId, cols, rows }) }
  closeTerminal(sessionId: string) { this.emit('close-pty', { sessionId }) }
}

export default new SocketClient()
