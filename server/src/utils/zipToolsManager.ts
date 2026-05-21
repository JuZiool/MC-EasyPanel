import { spawn, ChildProcess } from 'child_process'
import { createWriteStream } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'
import logger from './logger.js'
import { directoryContainsCorruptedNames, buildUtf8LocaleEnv } from './filenameEncoding.js'

const ZIP_FILENAME_ENCODINGS = ['utf-8', 'gbk'] as const

/**
 * Zip-Tools / 7z 二进制文件管理器
 *
 * 负责 file_zip（ZIP 压缩/解压）和 7z（7z 压缩/解压）二进制的：
 * - 路径解析（多路径尝试）
 * - 检测与自动下载（双源回退）
 * - 压缩/解压操作封装
 *
 * 二进制文件来源：https://github.com/MCSManager/Zip-Tools
 */
class ZipToolsManager {
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

  // ======================== 工具进程执行 ========================

  private buildProcessStartError(
    toolName: string,
    toolPath: string,
    error: NodeJS.ErrnoException
  ): Error {
    const resolvedToolPath = path.resolve(toolPath)

    if (error.code === 'EACCES') {
      return new Error(
        `${toolName} 无法启动：压缩工具缺少执行权限，请为该文件添加可执行权限后重试。参考命令: chmod +x "${resolvedToolPath}"。工具路径: ${resolvedToolPath}`
      )
    }

    if (error.code === 'ENOENT') {
      return new Error(
        `${toolName} 无法启动：未找到压缩工具文件，请检查文件是否存在或重新下载依赖。工具路径: ${resolvedToolPath}`
      )
    }

    return new Error(
      `${toolName} 进程启动失败: ${error.message || '未知错误'}。工具路径: ${resolvedToolPath}`
    )
  }

  private executeZipTools(toolPath: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(toolPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: buildUtf8LocaleEnv() })

      let stderr = ''

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      child.on('error', (error: NodeJS.ErrnoException) => {
        reject(this.buildProcessStartError('Zip-Tools', toolPath, error))
      })

      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve()
        } else {
          reject(
            new Error(
              `Zip-Tools 执行失败 (退出码: ${code}): ${stderr.trim() || '未知错误'}`
            )
          )
        }
      })
    })
  }

  private execute7z(toolPath: string, args: string[], cwd?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(toolPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: buildUtf8LocaleEnv() })

      let stderr = ''

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      child.on('error', (error: NodeJS.ErrnoException) => {
        reject(this.buildProcessStartError('7z', toolPath, error))
      })

      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve()
        } else {
          reject(
            new Error(
              `7z 执行失败 (退出码: ${code}): ${stderr.trim() || '未知错误'}`
            )
          )
        }
      })
    })
  }

  // ======================== ZIP 操作 ========================

  /**
   * 解压 ZIP 文件
   * 使用 file_zip 二进制，自动尝试 UTF-8 → GBK 编码回退
   */
  async extractZip(zipPath: string, targetDir: string): Promise<void> {
    const toolPath = await this.getZipToolsPath()
    const zipDir = path.dirname(zipPath)
    const zipFileName = path.basename(zipPath)

    await fs.mkdir(targetDir, { recursive: true })

    let chosenTempDir = ''
    let sawCorruptedNames = false
    let fallbackError: Error | null = null

    for (let index = 0; index < ZIP_FILENAME_ENCODINGS.length; index++) {
      const encoding = ZIP_FILENAME_ENCODINGS[index]
      const tempTargetDir = await fs.mkdtemp(path.join(path.dirname(targetDir), '.gsm3-zip-extract-'))

      const args = [
        '-mode', '2',
        '-zipPath', zipFileName,
        '-distDirPath', path.resolve(tempTargetDir),
        '-code', encoding,
      ]

      try {
        await this.executeZipTools(toolPath, args, zipDir)
      } catch (error: any) {
        await fs.rm(tempTargetDir, { recursive: true, force: true })
        fallbackError = error instanceof Error ? error : new Error(String(error))
        logger.warn(`ZIP 解压尝试失败 (${encoding}): ${fallbackError.message}`)
        continue
      }

      const hasCorruptedNames = await directoryContainsCorruptedNames(tempTargetDir)
      if (!hasCorruptedNames) {
        chosenTempDir = tempTargetDir
        break
      }

      sawCorruptedNames = true
      logger.warn(`ZIP 解压检测到损坏文件名，准备使用下一种编码重试: ${zipPath} (${encoding})`)

      if (index === ZIP_FILENAME_ENCODINGS.length - 1) {
        chosenTempDir = tempTargetDir
      } else {
        await fs.rm(tempTargetDir, { recursive: true, force: true })
      }
    }

    if (!chosenTempDir) {
      throw fallbackError ?? new Error(`ZIP 解压失败: ${zipPath}`)
    }

    // 将临时目录的内容移到目标目录
    await this.moveDirectoryContents(chosenTempDir, targetDir)
    await fs.rm(chosenTempDir, { recursive: true, force: true })

    if (sawCorruptedNames) {
      logger.warn(`ZIP 文件 ${zipPath} 在 UTF-8 解压下出现损坏文件名，已尝试使用 GBK 回退`)
    }
  }

  /**
   * 压缩为 ZIP 文件
   * 使用 file_zip 二进制
   */
  async compressZip(archivePath: string, files: string[], cwd: string): Promise<void> {
    const toolPath = await this.getZipToolsPath()
    const zipFileName = path.basename(archivePath)

    const args = [
      '-mode', '1',
      ...files.flatMap(f => ['-file', f]),
      '-zipPath', zipFileName,
      '-code', 'utf-8',
    ]

    await this.executeZipTools(toolPath, args, cwd)
  }

  // ======================== 7z 操作 ========================

  /**
   * 解压 7z 文件
   * 命令: 7z x {archivePath} -o{targetDir}
   * 注意: -o 和目标目录之间没有空格（7z 标准格式）
   */
  async extract7z(archivePath: string, targetDir: string): Promise<void> {
    await this.ensure7zInstalled()
    const toolPath = await this.get7zPath()

    await fs.mkdir(targetDir, { recursive: true })

    const args = ['x', archivePath, `-o${path.resolve(targetDir)}`]

    await this.execute7z(toolPath, args)
  }

  /**
   * 压缩为 7z 文件
   * 命令: 7z a {archivePath} {file1} {file2} ...
   */
  async compress7z(archivePath: string, files: string[], cwd: string): Promise<void> {
    await this.ensure7zInstalled()
    const toolPath = await this.get7zPath()

    const args = ['a', archivePath, ...files]

    await this.execute7z(toolPath, args, cwd)
  }

  // ======================== 辅助方法 ========================

  private async copyDirectoryContents(sourceDir: string, targetDir: string): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true })
    const entries = await fs.readdir(sourceDir, { withFileTypes: true })

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name)
      const targetPath = path.join(targetDir, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectoryContents(sourcePath, targetPath)
        continue
      }

      await fs.copyFile(sourcePath, targetPath)
    }
  }

  private async moveExtractedEntry(sourcePath: string, targetPath: string, isDirectory: boolean): Promise<void> {
    try {
      await fs.rename(sourcePath, targetPath)
      return
    } catch (error: any) {
      if (error?.code === 'EXDEV') {
        if (isDirectory) {
          await this.copyDirectoryContents(sourcePath, targetPath)
          await fs.rm(sourcePath, { recursive: true, force: true })
        } else {
          await fs.copyFile(sourcePath, targetPath)
          await fs.rm(sourcePath, { force: true })
        }
        return
      }

      if (isDirectory && ['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error?.code)) {
        await this.moveDirectoryContents(sourcePath, targetPath)
        await fs.rm(sourcePath, { recursive: true, force: true })
        return
      }

      if (!isDirectory && ['EEXIST', 'EPERM'].includes(error?.code)) {
        await fs.rm(targetPath, { force: true })
        await fs.rename(sourcePath, targetPath)
        return
      }

      throw error
    }
  }

  private async moveDirectoryContents(sourceDir: string, targetDir: string): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true })
    const entries = await fs.readdir(sourceDir, { withFileTypes: true })

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name)
      const targetPath = path.join(targetDir, entry.name)
      await this.moveExtractedEntry(sourcePath, targetPath, entry.isDirectory())
    }
  }
}

export const zipToolsManager = new ZipToolsManager()
export { ZipToolsManager }
