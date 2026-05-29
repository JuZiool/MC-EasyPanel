import { createWriteStream } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'
import logger from './logger.js'

/**
 * Zip-Tools / 7z 二进制文件管理器
 *
 * 负责 file_zip（ZIP 压缩/解压）和 7z（7z 压缩/解压）二进制的：
 * - 路径解析（多路径尝试）
 * - 检测与自动下载（双源回退）
 *
 * 二进制文件来源：https://github.com/MCSManager/Zip-Tools
 */
class ZipBinaryManager {
  private readonly DOWNLOAD_BASE_URL =
    'https://download.xiaozhuhouses.asia/%E5%BC%80%E6%BA%90%E9%A1%B9%E7%9B%AE/GSManager/GSManager3/%E8%BF%90%E8%A1%8C%E4%BE%9D%E8%B5%96/Zip-Tools/'

  private readonly FALLBACK_DOWNLOAD_URL =
    'https://github.com/MCSManager/Zip-Tools/releases/latest/download/'

  private readonly SUPPORTED_PLATFORMS = new Set(['win32', 'linux', 'darwin'])
  private readonly SUPPORTED_ARCHS = new Set(['x64', 'arm64'])

  // ======================== 二进制文件名解析 ========================

  /**
   * 获取当前平台对应的 file_zip 二进制文件名
   */
  getBinaryName(): string {
    const platform = process.platform
    const arch = process.arch

    if (!this.SUPPORTED_PLATFORMS.has(platform)) {
      throw new Error(`不支持的操作系统平台: ${platform}`)
    }
    if (!this.SUPPORTED_ARCHS.has(arch)) {
      throw new Error(`不支持的 CPU 架构: ${arch}`)
    }

    const archLabel = (platform === 'darwin' && arch === 'x64') ? 'amd64' : arch
    const name = `file_zip_${platform}_${archLabel}`
    return platform === 'win32' ? `${name}.exe` : name
  }

  /**
   * 获取当前平台对应的 7z 二进制文件名
   */
  get7zBinaryName(): string {
    const platform = process.platform
    const arch = process.arch

    if (!this.SUPPORTED_PLATFORMS.has(platform)) {
      throw new Error(`不支持的操作系统平台: ${platform}`)
    }
    if (!this.SUPPORTED_ARCHS.has(arch)) {
      throw new Error(`不支持的 CPU 架构: ${arch}`)
    }

    const name = `7z_${platform}_${arch}`
    return platform === 'win32' ? `${name}.exe` : name
  }

  // ======================== 路径发现（多路径尝试） ========================

  private getLibDirCandidates(): string[] {
    const baseDir = process.cwd()
    return [
      path.join(baseDir, 'data', 'lib'),           // 打包后环境
      path.join(baseDir, 'server', 'data', 'lib'), // 开发环境
    ]
  }

  async getZipToolsPath(): Promise<string> {
    const binaryName = this.getBinaryName()
    const candidates = this.getLibDirCandidates()

    for (const libDir of candidates) {
      const fullPath = path.join(libDir, binaryName)
      try {
        await fs.access(fullPath)
        return fullPath
      } catch {
        // 该路径不存在，尝试下一个
      }
    }

    throw new Error(
      `未找到 Zip-Tools 二进制文件 (${binaryName})，已尝试路径: ${candidates.map(d => path.join(d, binaryName)).join(', ')}`
    )
  }

  async isInstalled(): Promise<boolean> {
    try {
      await this.getZipToolsPath()
      return true
    } catch {
      return false
    }
  }

  async get7zPath(): Promise<string> {
    const binaryName = this.get7zBinaryName()
    const candidates = this.getLibDirCandidates()

    for (const libDir of candidates) {
      const fullPath = path.join(libDir, binaryName)
      try {
        await fs.access(fullPath)
        return fullPath
      } catch {
        // 该路径不存在，尝试下一个
      }
    }

    throw new Error(
      `未找到 7z 二进制文件 (${binaryName})，已尝试路径: ${candidates.map(d => path.join(d, binaryName)).join(', ')}`
    )
  }

  async is7zInstalled(): Promise<boolean> {
    try {
      await this.get7zPath()
      return true
    } catch {
      return false
    }
  }

  // ======================== 自动下载 ========================

  private async downloadFromUrl(url: string, targetPath: string): Promise<void> {
    const axios = (await import('axios')).default
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 60000,
    })

    const writer = createWriteStream(targetPath)
    await pipeline(response.data, writer)

    const stat = await fs.stat(targetPath)
    if (stat.size === 0) {
      await fs.unlink(targetPath)
      throw new Error('下载的文件大小为 0，已删除')
    }

    if (process.platform !== 'win32') {
      await fs.chmod(targetPath, 0o755)
    }
  }

  private async downloadBinary(binaryName: string, downloadFn: (url: string, target: string) => Promise<void>): Promise<void> {
    const candidates = this.getLibDirCandidates()

    let targetDir: string | null = null
    for (const dir of candidates) {
      try {
        await fs.mkdir(dir, { recursive: true })
        targetDir = dir
        break
      } catch {
        // 无法创建该目录，尝试下一个
      }
    }

    if (!targetDir) {
      throw new Error(`无法创建 lib 目录，已尝试: ${candidates.join(', ')}`)
    }

    const targetPath = path.join(targetDir, binaryName)
    const primaryUrl = `${this.DOWNLOAD_BASE_URL}${binaryName}`
    const fallbackUrl = `${this.FALLBACK_DOWNLOAD_URL}${binaryName}`

    logger.info(`正在从自建镜像下载 ${binaryName}: ${primaryUrl}`)
    try {
      await downloadFn(primaryUrl, targetPath)
      logger.info(`${binaryName} 下载完成: ${targetPath}`)
      return
    } catch (primaryError: any) {
      logger.warn(`自建镜像下载 ${binaryName} 失败: ${primaryError.message}，尝试 GitHub 备用地址...`)
      try { await fs.unlink(targetPath) } catch { /* 忽略 */ }
    }

    logger.info(`正在从 GitHub 下载 ${binaryName}: ${fallbackUrl}`)
    try {
      await downloadFn(fallbackUrl, targetPath)
      logger.info(`${binaryName} 下载完成（GitHub 备用）: ${targetPath}`)
    } catch (fallbackError: any) {
      try { await fs.unlink(targetPath) } catch { /* 忽略 */ }
      const message = `${binaryName} 下载失败（两个源均不可用）: ${fallbackError.message}`
      logger.error(message)
      throw new Error(message)
    }
  }

  async download(): Promise<void> {
    const binaryName = this.getBinaryName()
    await this.downloadBinary(binaryName, (url, target) => this.downloadFromUrl(url, target))
  }

  async download7z(): Promise<void> {
    const binaryName = this.get7zBinaryName()
    await this.downloadBinary(binaryName, (url, target) => this.downloadFromUrl(url, target))
  }

  async ensureInstalled(): Promise<void> {
    if (await this.isInstalled()) {
      logger.info('Zip-Tools 已存在，跳过下载')
      return
    }
    await this.download()
  }

  async ensure7zInstalled(): Promise<void> {
    if (await this.is7zInstalled()) {
      logger.info('7z 已存在，跳过下载')
      return
    }
    await this.download7z()
  }
}

export const zipBinaryManager = new ZipBinaryManager()
export { ZipBinaryManager }
