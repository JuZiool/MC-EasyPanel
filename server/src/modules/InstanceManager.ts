import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import logger from '../utils/logger.js'

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

class InstanceManager extends EventEmitter {
  private instances: Map<string, Instance> = new Map()
  private configPath: string
  private saveTimeout: NodeJS.Timeout | null = null

  constructor() {
    super()
    const baseDir = process.cwd()
    const paths = [path.join(baseDir, 'server', 'data', 'instances.json'), path.join(baseDir, 'data', 'instances.json')]
    this.configPath = paths[0]
    const dir = path.dirname(this.configPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  initialize() {
    this.loadInstances()
    this.startAutoStartInstances()
    logger.info(`InstanceManager 初始化完成，共 ${this.instances.size} 个实例`)
  }

  private loadInstances() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        if (Array.isArray(data)) {
          data.forEach((inst: Instance) => {
            inst.status = 'stopped'
            inst.pid = undefined
            inst.terminalSessionId = undefined
            this.instances.set(inst.id, inst)
          })
        }
      }
    } catch (e) { logger.error(`加载实例数据失败: ${e}`) }
  }

  private saveInstances() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(() => {
      try {
        const data = Array.from(this.instances.values()).map(({ id, name, description, workingDirectory, startCommand, autoStart, stopCommand, createdAt, lastStarted, lastStopped, instanceType, javaVersion }) => ({
          id, name, description, workingDirectory, startCommand, autoStart, stopCommand, createdAt, lastStarted, lastStopped, instanceType, javaVersion
        }))
        fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2))
      } catch (e) { logger.error(`保存实例数据失败: ${e}`) }
    }, 1000)
  }

  private async startAutoStartInstances() {
    for (const inst of this.instances.values()) {
      if (inst.autoStart) {
        await new Promise(r => setTimeout(r, 2000))
        this.startInstance(inst.id).catch(() => {})
      }
    }
  }

  private async detectStartScript(workingDirectory: string): Promise<string | null> {
    const scripts = ['start.sh', 'run.sh', 'start.bat', 'run.bat']
    for (const script of scripts) {
      const fullPath = path.join(workingDirectory, script)
      if (fs.existsSync(fullPath)) return script
    }
    return null
  }

  private async detectJarFile(workingDirectory: string): Promise<string | null> {
    try {
      const files = fs.readdirSync(workingDirectory)
      const jar = files.find(f => f.endsWith('.jar') && !f.includes('forge') && !f.includes('fabric'))
      if (jar) return jar
      return files.find(f => f.endsWith('.jar')) || null
    } catch { return null }
  }

  getInstances(): Instance[] { return Array.from(this.instances.values()) }

  getInstance(id: string): Instance | undefined { return this.instances.get(id) }

  createInstance(data: Partial<Instance>): Instance {
    const instance: Instance = {
      id: uuidv4(),
      name: data.name || '未命名实例',
      description: data.description || '',
      workingDirectory: data.workingDirectory || '',
      startCommand: data.startCommand || '',
      autoStart: data.autoStart || false,
      stopCommand: data.stopCommand || 'stop',
      status: 'stopped',
      createdAt: new Date().toISOString(),
      instanceType: data.instanceType || 'generic',
      javaVersion: data.javaVersion
    }
    this.instances.set(instance.id, instance)
    this.saveInstances()
    this.emit('instance-created', instance)
    return instance
  }

  updateInstance(id: string, data: Partial<Instance>): Instance | null {
    const inst = this.instances.get(id)
    if (!inst) return null
    Object.assign(inst, data)
    this.saveInstances()
    this.emit('instance-updated', inst)
    return inst
  }

  deleteInstance(id: string, removeFiles?: boolean): boolean {
    const inst = this.instances.get(id)
    if (!inst) return false
    if (inst.status === 'running') this.stopInstance(id)
    // 可选删除工作目录
    if (removeFiles && inst.workingDirectory) {
      try {
        if (fs.existsSync(inst.workingDirectory)) {
          fs.rmSync(inst.workingDirectory, { recursive: true, force: true })
        }
      } catch (e) {
        logger.error('删除实例工作目录失败:', e)
      }

    }
    this.instances.delete(id)
    this.saveInstances()
    this.emit('instance-deleted', { id, name: inst.name })
    return true
  }

  async startInstance(id: string): Promise<{ success: boolean; terminalSessionId?: string; error?: string }> {
    const inst = this.instances.get(id)
    if (!inst) return { success: false, error: '实例不存在' }
    if (inst.status === 'running') return { success: false, error: '实例已经在运行中' }

    inst.status = 'starting'
    this.emit('instance-status-changed', { id, status: 'starting' })

    if (!fs.existsSync(inst.workingDirectory)) {
      inst.status = 'error'
      this.emit('instance-status-changed', { id, status: 'error' })
      return { success: false, error: `工作目录不存在: ${inst.workingDirectory}` }
    }

    let command = inst.startCommand

    if (inst.instanceType === 'minecraft-java' && !command) {
      const script = await this.detectStartScript(inst.workingDirectory)
      if (script) {
        command = script.startsWith('.') ? script : (process.platform === 'win32' ? `.\\${script}` : `./${script}`)
      } else {
        const jarFile = await this.detectJarFile(inst.workingDirectory)
        if (jarFile) command = `java -Xmx2G -Xms1G -jar ${jarFile} nogui`
        else return { success: false, error: '未找到启动脚本或 server.jar 文件' }
      }
    }

    if (!command) return { success: false, error: '启动命令为空' }

    const terminalSessionId = `instance-${id}-${Date.now()}`
    inst.startCommand = command
    inst.terminalSessionId = terminalSessionId

    this.emit('terminal-create', { id, command, cwd: inst.workingDirectory, sessionId: terminalSessionId })
    this.emit('instance-status-changed', { id, status: 'running' })

    inst.status = 'running'
    inst.lastStarted = new Date().toISOString()
    this.saveInstances()

    return { success: true, terminalSessionId }
  }

  async stopInstance(id: string): Promise<boolean> {
    const inst = this.instances.get(id)
    if (!inst || inst.status !== 'running') return false

    inst.status = 'stopping'
    this.emit('instance-status-changed', { id, status: 'stopping' })

    let stopCmd = ''
    switch (inst.stopCommand) {
      case 'ctrl+c': stopCmd = '\x03'; break
      case 'stop': stopCmd = 'stop'; break
      case 'exit': stopCmd = 'exit'; break
      case 'quit': stopCmd = 'quit'; break
    }

    this.emit('instance-input', { id, data: stopCmd + '\r' })

    setTimeout(() => {
      const current = this.instances.get(id)
      if (current && current.status === 'stopping') {
        this.emit('instance-force-stop', { id })
      }
    }, 10000)

    return true
  }

  setInstanceStopped(id: string, keepSession: boolean = true) {
    const inst = this.instances.get(id)
    if (!inst) return
    inst.status = 'stopped'
    inst.pid = undefined
    if (!keepSession) inst.terminalSessionId = undefined
    inst.lastStopped = new Date().toISOString()
    this.saveInstances()
    this.emit('instance-status-changed', { id, status: 'stopped' })
  }

  setInstanceRunning(id: string, pid?: number) {
    const inst = this.instances.get(id)
    if (!inst) return
    inst.status = 'running'
    inst.pid = pid
    this.emit('instance-status-changed', { id, status: 'running' })
  }

  setInstanceError(id: string) {
    const inst = this.instances.get(id)
    if (!inst) return
    inst.status = 'error'
    this.emit('instance-status-changed', { id, status: 'error' })
  }

  cleanup() {
    for (const inst of this.instances.values()) {
      if (inst.status === 'running') {
        this.emit('instance-force-stop', { id: inst.id })
      }
    }
  }
}

export default InstanceManager
