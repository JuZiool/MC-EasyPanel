export interface PlayerChartPoint {
  time: string
  online: number
  max: number
}

export function getPlayerChartTimeRatio<T extends PlayerChartPoint>(points: T[], index: number): number {
  if (points.length < 2) return 0
  const firstTime = new Date(points[0].time).getTime()
  const lastTime = new Date(points[points.length - 1].time).getTime()
  const pointTime = new Date(points[index].time).getTime()
  if (!Number.isFinite(firstTime) || !Number.isFinite(lastTime) || !Number.isFinite(pointTime) || lastTime <= firstTime) {
    return index / Math.max(points.length - 1, 1)
  }
  return Math.min(1, Math.max(0, (pointTime - firstTime) / (lastTime - firstTime)))
}

export function downsamplePlayerHistory<T extends PlayerChartPoint>(points: T[], limit: number): T[] {
  if (limit < 3 || points.length <= limit) return points

  const interiorLimit = limit - 2
  const interiorCount = points.length - 2
  const bucketCount = Math.max(1, Math.floor(interiorLimit / 2))
  const bucketSize = interiorCount / bucketCount
  const selected = new Set<number>([0, points.length - 1])

  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = 1 + Math.floor(bucket * bucketSize)
    const end = Math.min(points.length - 1, 1 + Math.floor((bucket + 1) * bucketSize))
    if (start >= end) continue

    let minIndex = start
    let maxIndex = start
    for (let index = start + 1; index < end; index++) {
      if (points[index].online < points[minIndex].online) minIndex = index
      if (points[index].online > points[maxIndex].online) maxIndex = index
    }
    selected.add(minIndex)
    selected.add(maxIndex)
  }

  return Array.from(selected)
    .sort((left, right) => left - right)
    .slice(0, limit)
    .map(index => points[index])
}
