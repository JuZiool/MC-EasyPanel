import { Router, Request, Response } from 'express'
import os from 'os'

const router = Router()

router.get('/stats', (_req: Request, res: Response) => {
  const cpus = os.cpus()
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
    const idle = cpu.times.idle
    return acc + (1 - idle / total) * 100
  }, 0) / cpus.length

  const totalMem = os.totalmem()
  const freeMem = os.freemem()

  let diskTotal = 0, diskFree = 0
  try {
    const { execSync } = require('child_process')
    if (process.platform === 'win32') {
      const output = execSync('wmic logicaldisk where DriveType=3 get Size,FreeSpace').toString()
      const lines = output.trim().split('\n').slice(1)
      lines.forEach((line: string) => {
        const [free, total] = line.trim().split(/\s+/).map(Number)
        if (!isNaN(free) && !isNaN(total)) { diskTotal += total; diskFree += free }
      })
    } else {
      const output = execSync('df -B1 --total 2>/dev/null || df -k /').toString()
      const lastLine = output.trim().split('\n').pop() || ''
      const parts = lastLine.split(/\s+/)
      diskTotal = parseInt(parts[1]) || 0
      diskFree = parseInt(parts[3]) || 0
    }
  } catch {}

  res.json({
    success: true,
    data: {
      cpu: { usage: Math.round(cpuUsage * 10) / 10, cores: cpus.length },
      memory: { total: totalMem, used: totalMem - freeMem, usage: Math.round((1 - freeMem / totalMem) * 100) },
      disk: { total: diskTotal, used: diskTotal - diskFree, usage: diskTotal > 0 ? Math.round((diskTotal - diskFree) / diskTotal * 100) : 0 },
      timestamp: Date.now()
    }
  })
})

router.get('/info', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      uptime: os.uptime(),
      nodeVersion: process.version
    }
  })
})

export default router
