import fs from 'fs'
import path from 'path'

interface ProcessStat {
  pid: number
  parentPid: number
  rssBytes: number
}

function getProcessStats(): ProcessStat[] {
  if (process.platform !== 'linux') return []
  try {
    return fs.readdirSync('/proc')
      .filter(entry => /^\d+$/.test(entry))
      .map(Number)
      .map(readProcessStat)
      .filter((stat): stat is ProcessStat => stat !== null)
  } catch {
    return []
  }
}

export function getProcessTreePids(rootPid: number): number[] {
  if (!Number.isInteger(rootPid) || rootPid <= 0) return []
  const childrenByParent = new Map<number, number[]>()
  for (const stat of getProcessStats()) {
    const children = childrenByParent.get(stat.parentPid) || []
    children.push(stat.pid)
    childrenByParent.set(stat.parentPid, children)
  }

  const processIds: number[] = []
  const pending = [rootPid]
  const visited = new Set<number>()
  while (pending.length > 0) {
    const pid = pending.pop()!
    if (visited.has(pid)) continue
    visited.add(pid)
    processIds.push(pid)
    pending.push(...(childrenByParent.get(pid) || []))
  }
  return processIds
}

export function killProcessTree(rootPid: number): void {
  const processIds = getProcessTreePids(rootPid).reverse()
  for (const pid of processIds) {
    try { process.kill(pid, 'SIGKILL') } catch {}
  }
}

function readProcessStat(pid: number): ProcessStat | null {
  try {
    const stat = fs.readFileSync(path.join('/proc', String(pid), 'stat'), 'utf-8')
    const commandEnd = stat.lastIndexOf(')')
    if (commandEnd === -1) return null
    const fields = stat.slice(commandEnd + 2).trim().split(/\s+/)
    const parentPid = Number(fields[1])
    const rssPages = Number(fields[21])
    if (!Number.isFinite(parentPid) || !Number.isFinite(rssPages)) return null
    return { pid, parentPid, rssBytes: rssPages * 4096 }
  } catch {
    return null
  }
}

export function getProcessTreeMemory(rootPid: number): number {
  if (process.platform !== 'linux' || !Number.isInteger(rootPid) || rootPid <= 0) return 0

  const processStats = getProcessStats()
  const childrenByParent = new Map<number, number[]>()
  const memoryByPid = new Map<number, number>()

  for (const stat of processStats) {
    memoryByPid.set(stat.pid, stat.rssBytes)
    const children = childrenByParent.get(stat.parentPid) || []
    children.push(stat.pid)
    childrenByParent.set(stat.parentPid, children)
  }

  let totalMemory = 0
  const pending = [rootPid]
  const visited = new Set<number>()
  while (pending.length > 0) {
    const pid = pending.pop()!
    if (visited.has(pid)) continue
    visited.add(pid)
    totalMemory += memoryByPid.get(pid) || 0
    pending.push(...(childrenByParent.get(pid) || []))
  }

  return totalMemory
}
