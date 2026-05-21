import { parentPort, workerData } from 'worker_threads'
import fs from 'fs'
import path from 'path'
import { collectFiles } from '../utils/progressTracker.js'
import AdmZip from 'adm-zip'

interface ProgressMessage {
  type: 'progress'
  progress: number
  subLabel?: string
}

interface CompleteMessage {
  type: 'complete'
  subLabel?: string
}

interface ErrorMessage {
  type: 'error'
  error: string
}

type WorkerMessage = ProgressMessage | CompleteMessage | ErrorMessage

function send(msg: WorkerMessage) {
  parentPort?.postMessage(msg)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ==================== Delete ====================

async function runDelete(targetPath: string) {
  const stat = fs.statSync(targetPath)
  if (stat.isDirectory()) {
    const allFiles = collectFiles(targetPath)
    const total = allFiles.length
    if (total > 0) {
      const progressInterval = Math.max(1, Math.floor(total / 50))
      for (let i = 0; i < total; i++) {
        fs.unlinkSync(allFiles[i].fullPath)
        if (i % progressInterval === 0 || i === total - 1) {
          send({ type: 'progress', progress: Math.round(((i + 1) / total) * 100), subLabel: `${i + 1}/${total} 个文件` })
        }
        await sleep(0)
      }
    }
    fs.rmSync(targetPath, { recursive: true, force: true })
  } else {
    fs.unlinkSync(targetPath)
  }
}

async function runBatchDelete(paths: string[]) {
  const total = paths.length
  const results: { success: boolean; error?: string; path: string }[] = new Array(total).fill(null)
  let completed = 0
  let nextIndex = 0
  const CONCURRENCY = 5
  const progressInterval = Math.max(1, Math.floor(total / 50))

  async function deleteOne(p: string, idx: number) {
    try {
      const stat = fs.statSync(p)
      if (stat.isDirectory()) fs.rmSync(p, { recursive: true, force: true })
      else fs.unlinkSync(p)
      results[idx] = { path: p, success: true }
    } catch (e: any) {
      results[idx] = { path: p, success: false, error: e.message }
    }
  }

  async function worker() {
    while (true) {
      const idx = nextIndex++
      if (idx >= total) break
      await deleteOne(paths[idx], idx)
      const cur = ++completed
      if (cur % progressInterval === 0 || cur === total) {
        send({ type: 'progress', progress: Math.round((cur / total) * 100), subLabel: `${cur}/${total}` })
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  const validResults = results.filter((r): r is { success: boolean; error?: string; path: string } => r !== null)
  const succeeded = validResults.filter(r => r.success).length
  const failed = validResults.filter(r => !r.success).length

  send({ type: 'complete', subLabel: `${succeeded} 成功，${failed} 失败` })
}

// ==================== Copy ====================

async function runCopy(srcPath: string, destPath: string) {
  const stat = fs.statSync(srcPath)
  if (stat.isDirectory()) {
    const entries = collectFiles(srcPath)
    const total = entries.length
    if (total === 0) {
      fs.mkdirSync(destPath, { recursive: true })
    } else {
      for (let i = 0; i < total; i++) {
        const entry = entries[i]
        const targetFile = path.join(destPath, path.relative(srcPath, entry.fullPath))
        const targetDir = path.dirname(targetFile)
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
        fs.copyFileSync(entry.fullPath, targetFile)
        if (i % Math.max(1, Math.floor(total / 100)) === 0 || i === total - 1) {
          send({ type: 'progress', progress: Math.round(((i + 1) / total) * 100), subLabel: `${i + 1}/${total} 个文件` })
        }
        await sleep(0)
      }
    }
  } else {
    const targetDir = path.dirname(destPath)
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
    fs.copyFileSync(srcPath, destPath)
  }
}

// ==================== Move ====================

async function runMove(srcPath: string, destPath: string) {
  // 先尝试 rename（同一文件系统，瞬时完成）
  try {
    fs.renameSync(srcPath, destPath)
    return
  } catch (e: any) {
    // EXDEV = 跨文件系统，回退到复制+删除
    if (e.code !== 'EXDEV') throw e
  }
  // 跨文件系统：复制后再删
  await runCopy(srcPath, destPath)
  // 复制完成后删除源文件
  const stat = fs.statSync(srcPath)
  if (stat.isDirectory()) fs.rmSync(srcPath, { recursive: true, force: true })
  else fs.unlinkSync(srcPath)
}

// ==================== Compress ====================

async function runCompress(targetPath: string) {
  const baseName = path.basename(targetPath)
  const zipName = baseName + '.zip'
  const zipPath = path.join(path.dirname(targetPath), zipName)
  const zip = new AdmZip()
  const stat = fs.statSync(targetPath)

  if (stat.isDirectory()) {
    const files = collectFiles(targetPath)
    const total = files.length
    for (let i = 0; i < total; i++) {
      const f = files[i]
      zip.addLocalFile(f.fullPath, f.zipPath)
      if (i % Math.max(1, Math.floor(total / 100)) === 0 || i === total - 1) {
        send({ type: 'progress', progress: Math.round(((i + 1) / total) * 100), subLabel: `${i + 1}/${total} 个文件` })
      }
      await sleep(0)
    }
  } else {
    zip.addLocalFile(targetPath)
  }
  zip.writeZip(zipPath)
}

async function runCompressBatch(paths: string[], zipName: string) {
  const parentDir = path.dirname(paths[0])
  const zipPath = path.join(parentDir, zipName)
  const zip = new AdmZip()

  let items: { fullPath: string; zipPrefix: string }[] = []
  for (const p of paths) {
    const stat = fs.statSync(p)
    const baseName = path.basename(p)
    if (stat.isDirectory()) {
      const files = collectFiles(p)
      for (const f of files) {
        items.push({ fullPath: f.fullPath, zipPrefix: path.join(baseName, f.zipPath) })
      }
    } else {
      items.push({ fullPath: p, zipPrefix: '' })
    }
  }

  const total = items.length
  for (let i = 0; i < total; i++) {
    const item = items[i]
    zip.addLocalFile(item.fullPath, item.zipPrefix)
    if (i % Math.max(1, Math.floor(total / 100)) === 0 || i === total - 1) {
      send({ type: 'progress', progress: Math.round(((i + 1) / total) * 100), subLabel: `${i + 1}/${total} 个文件` })
    }
    await sleep(0)
  }
  zip.writeZip(zipPath)
}

// ==================== Extract ====================

async function runExtract(zipPath: string, targetDir: string) {
  const name = zipPath.toLowerCase()
  const isTarGz = name.endsWith('.tar.gz') || name.endsWith('.tgz')

  if (isTarGz) {
    send({ type: 'progress', progress: 5, subLabel: '正在使用 tar 解压...' })
    const { spawn } = await import('child_process')
    await new Promise<void>((resolve, reject) => {
      const child = spawn('tar', ['-xzf', zipPath, '-C', targetDir])
      let stderr = ''
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`tar 退出码 ${code}: ${stderr.trim()}`))
      })
      child.on('error', (e) => reject(e))
    })
    return
  }

  send({ type: 'progress', progress: 3, subLabel: '正在读取压缩文件...' })
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()
  const total = entries.length
  let processed = 0

  for (const entry of entries) {
    const targetPath = path.join(targetDir, entry.entryName)
    const targetParent = path.dirname(targetPath)
    if (!fs.existsSync(targetParent)) fs.mkdirSync(targetParent, { recursive: true })
    if (!entry.isDirectory) {
      const data = entry.getData()
      fs.writeFileSync(targetPath, data)
    }
    processed++
    if (processed % Math.max(1, Math.floor(total / 100)) === 0 || processed === total) {
      send({
        type: 'progress',
        progress: Math.round((processed / total) * 95) + (processed === total ? 5 : 0),
        subLabel: `${processed}/${total} 个文件`
      })
    }
    await sleep(0)
  }
}

// ==================== Dispatch ====================

async function main() {
  try {
    const { type, ...params } = workerData as any

    switch (type) {
      case 'delete':
        await runDelete(params.targetPath)
        break
      case 'batch-delete':
        await runBatchDelete(params.paths)
        break
      case 'copy':
        await runCopy(params.srcPath, params.destPath)
        break
      case 'move':
        await runMove(params.srcPath, params.destPath)
        break
      case 'compress':
        await runCompress(params.targetPath)
        break
      case 'compress-batch':
        await runCompressBatch(params.paths, params.zipName)
        break
      case 'extract':
        await runExtract(params.zipPath, params.targetDir)
        break
      default:
        throw new Error(`未知任务类型: ${type}`)
    }

    send({ type: 'complete' })
  } catch (e: any) {
    send({ type: 'error', error: e.message })
  }
}

main()
