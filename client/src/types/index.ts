export interface User {
  id: string
  username: string
  role: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  loading: boolean
}

export interface Instance {
  id: string
  name: string
  description: string
  workingDirectory: string
  startCommand: string
  autoStart: boolean
  stopCommand: 'ctrl+c' | 'stop' | 'exit' | 'quit'
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
  pid?: number
  createdAt: string
  lastStarted?: string
  lastStopped?: string
  terminalSessionId?: string
  instanceType?: 'minecraft-java' | 'generic'
  javaVersion?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: string
  permissions?: string
}

export interface FilePagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasMore: boolean
}

export interface FileListResponse {
  files: FileItem[]
  pagination: FilePagination
}

export interface SystemStats {
  cpu: { usage: number; cores: number }
  memory: { total: number; used: number; usage: number }
  disk: { total: number; used: number; usage: number }
  timestamp: number
}

export interface PlayerInfo {
  name: string
  id: string
}

export interface ServerPlayerInfo {
  instanceId: string
  instanceName: string
  online: boolean
  version?: string
  players?: {
    online: number
    max: number
    sample?: PlayerInfo[]
  }
  motd?: string
  error?: string
}

export interface PlayerSession {
  playerName: string
  playerId: string
  instanceId: string
  firstSeen: string
  lastSeen: string
  active: boolean
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  timestamp: number
}
