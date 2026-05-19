import { Socket } from 'net'
import fs from 'fs'
import path from 'path'
import logger from './logger.js'

export interface McServerStatus {
  online: boolean
  version?: string
  players?: {
    online: number
    max: number
    sample?: { name: string; id: string }[]
  }
  motd?: string
  favicon?: string
  error?: string
}

/**
 * 从 server.properties 文件中读取服务器端口
 */
function readServerPort(workingDirectory: string): number {
  try {
    const propsPath = path.join(workingDirectory, 'server.properties')
    if (!fs.existsSync(propsPath)) return 25565
    const content = fs.readFileSync(propsPath, 'utf-8')
    const match = content.match(/^server-port\s*=\s*(\d+)/m)
    return match ? parseInt(match[1], 10) : 25565
  } catch {
    return 25565
  }
}

/**
 * 写入 VarInt（可变长度整数）到 Buffer
 */
function writeVarInt(value: number): Buffer {
  const buf: number[] = []
  do {
    let temp = value & 0b01111111
    value >>>= 7
    if (value !== 0) temp |= 0b10000000
    buf.push(temp)
  } while (value !== 0)
  return Buffer.from(buf)
}

/**
 * 读取 VarInt 从 Buffer
 */
function readVarInt(buffer: Buffer, offset: number): { value: number; length: number } {
  let value = 0
  let length = 0
  while (true) {
    const byte = buffer[offset + length]
    value |= (byte & 0b01111111) << (length * 7)
    length++
    if (length > 5) throw new Error('VarInt 过长')
    if ((byte & 0b10000000) === 0) break
  }
  return { value, length }
}

/**
 * 写入 UTF-16BE 字符串（前置 VarInt 长度）
 */
function writeString(str: string): Buffer {
  const strBuf = Buffer.from(str, 'utf-8')
  return Buffer.concat([writeVarInt(strBuf.length), strBuf])
}

/**
 * 打包一个 Minecraft 协议包
 * 格式：[包长度(VarInt)] [包ID(VarInt)] [载荷...]
 */
function packPacket(packetId: number, ...dataBuffers: Buffer[]): Buffer {
  const idBuf = writeVarInt(packetId)
  const content = Buffer.concat([idBuf, ...dataBuffers])
  const lengthBuf = writeVarInt(content.length)
  return Buffer.concat([lengthBuf, content])
}

/**
 * 查询 Minecraft 服务器状态（Server List Ping 协议）
 * @param host 服务器地址
 * @param port 服务器端口（默认 25565）
 * @param timeout 超时时间（毫秒，默认 5000）
 */
export function queryMcServer(
  host: string,
  port: number = 25565,
  timeout: number = 5000
): Promise<McServerStatus> {
  return new Promise((resolve) => {
    const socket = new Socket()
    let resolved = false
    const buffers: Buffer[] = []
    let totalLength = 0

    const cleanup = () => {
      if (!socket.destroyed) socket.destroy()
    }

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve({ online: false, error: '连接超时' })
      }
    }, timeout)

    socket.connect(port, host, () => {
      // Step 1: Handshake packet - 协议版本 -1 (自动检测), 服务器地址, 端口, nextState=1(status)
      const handshake = packPacket(
        0x00,
        writeVarInt(-1),        // 协议版本
        writeString(host),      // 服务器地址
        Buffer.from([(port >> 8) & 0xFF, port & 0xFF]), // 端口 (unsigned short, big-endian)
        writeVarInt(1)           // Next state: 1 = status
      )

      // Step 2: Status Request packet (空载荷)
      const statusRequest = packPacket(0x00)

      socket.write(Buffer.concat([handshake, statusRequest]))
    })

    socket.on('data', (data) => {
      buffers.push(data)
      totalLength += data.length

      // 尝试解析
      try {
        const fullBuffer = Buffer.concat(buffers)

        // 解析包长度
        if (fullBuffer.length < 1) return

        const { value: _packetLength, length: lenLength } = readVarInt(fullBuffer, 0)
        const totalPacketLen = lenLength + _packetLength

        if (fullBuffer.length < totalPacketLen) return // 数据还不够

        // 解析包 ID
        const { value: packetId, length: idLen } = readVarInt(fullBuffer, lenLength)

        if (packetId !== 0x00) {
          // 不是预期的状态响应
          if (!resolved) {
            resolved = true
            cleanup()
            clearTimeout(timer)
            resolve({ online: false, error: '收到意外的包 ID' })
          }
          return
        }

        // 解析 JSON 字符串
        const jsonStart = lenLength + idLen
        const { value: jsonLen, length: strLenLen } = readVarInt(fullBuffer, jsonStart)
        const strStart = jsonStart + strLenLen
        const jsonStr = fullBuffer.toString('utf-8', strStart, strStart + jsonLen)

        const status = JSON.parse(jsonStr)

        if (!resolved) {
          resolved = true
          cleanup()
          clearTimeout(timer)
          resolve({
            online: true,
            version: status.version?.name,
            players: status.players ? {
              online: status.players.online ?? 0,
              max: status.players.max ?? 0,
              sample: status.players.sample
            } : undefined,
            motd: status.description?.text || (typeof status.description === 'string' ? status.description : JSON.stringify(status.description)),
            favicon: status.favicon
          })
        }
      } catch (e: any) {
        // 解析失败可能是数据还不完整，继续等待
        if (totalLength > 1024 * 10) {
          // 超过 10KB 还解析不了，放弃
          if (!resolved) {
            resolved = true
            cleanup()
            clearTimeout(timer)
            resolve({ online: false, error: `数据解析失败: ${e.message}` })
          }
        }
      }
    })

    socket.on('error', (err: any) => {
      if (!resolved) {
        resolved = true
        cleanup()
        clearTimeout(timer)
        resolve({ online: false, error: `连接失败: ${err.message}` })
      }
    })

    socket.on('close', () => {
      if (!resolved) {
        resolved = true
        cleanup()
        clearTimeout(timer)
        resolve({ online: false, error: '连接被关闭' })
      }
    })
  })
}

/**
 * 根据实例的工作目录查询服务器在线玩家信息
 */
export async function queryInstancePlayers(workingDirectory: string): Promise<McServerStatus> {
  const port = readServerPort(workingDirectory)
  return queryMcServer('localhost', port)
}

/**
 * 为多个实例查询玩家信息
 */
export async function queryMultipleInstancePlayers(
  instances: { id: string; name: string; workingDirectory: string }[]
): Promise<Record<string, McServerStatus>> {
  const results: Record<string, McServerStatus> = {}

  const queries = instances.map(async (inst) => {
    try {
      const status = await queryInstancePlayers(inst.workingDirectory)
      results[inst.id] = status
    } catch (e: any) {
      results[inst.id] = { online: false, error: e.message }
    }
  })

  // 并行查询所有服务器（但限制并发数，避免资源耗尽）
  const CONCURRENCY = 5
  for (let i = 0; i < queries.length; i += CONCURRENCY) {
    await Promise.all(queries.slice(i, i + CONCURRENCY))
  }

  return results
}
