import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import logger from './logger.js'
import { directoryContainsCorruptedNames, buildUtf8LocaleEnv } from './filenameEncoding.js'
import { zipBinaryManager } from './zipBinaryManager.js'

const ZIP_FILENAME_ENCODINGS = ['utf-8', 'gbk'] as const

/**
 * Zip-Tools / 7z 压缩操作封装
 *
 * 提供 file_zip（ZIP 压缩/解压）和 7z（7z 压缩/解压）的：
 * - 进程执行
 * - 压缩/解压操作封装
 * - 辅助方法（目录移动、复制等）
 *
 * 二进制文件管理委托给 ZipBinaryManager。
 */
class ZipToolsManager {
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
    const toolPath = await zipBinaryManager.getZipToolsPath()
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
    const toolPath = await zipBinaryManager.getZipToolsPath()
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
    await zipBinaryManager.ensure7zInstalled()
    const toolPath = await zipBinaryManager.get7zPath()

    await fs.mkdir(targetDir, { recursive: true })

    const args = ['x', archivePath, `-o${path.resolve(targetDir)}`]

    await this.execute7z(toolPath, args)
  }

  /**
   * 压缩为 7z 文件
   * 命令: 7z a {archivePath} {file1} {file2} ...
   */
  async compress7z(archivePath: string, files: string[], cwd: string): Promise<void> {
    await zipBinaryManager.ensure7zInstalled()
    const toolPath = await zipBinaryManager.get7zPath()

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
