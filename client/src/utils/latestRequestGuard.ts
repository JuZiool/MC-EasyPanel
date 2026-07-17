export interface LatestRequestGuard {
  start: () => number
  invalidate: () => void
  isCurrent: (requestId: number) => boolean
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let latestRequestId = 0

  return {
    start: () => ++latestRequestId,
    invalidate: () => { latestRequestId += 1 },
    isCurrent: (requestId) => requestId === latestRequestId,
  }
}
