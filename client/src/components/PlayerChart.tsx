import { useMemo } from 'react'
import type { PlayerSession } from '../types'

interface DataPoint {
  time: string
  online: number
  max: number
}

interface PlayerChartProps {
  data: DataPoint[]
  width?: number
  height?: number
  loading?: boolean
  error?: boolean
  playerSessions?: PlayerSession[]
}

const formatTime = (time: string, withDate = false) => {
  const date = new Date(time)
  if (!Number.isFinite(date.getTime())) return '--:--'
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return withDate ? `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}` : `${hours}:${minutes}`
}

export default function PlayerChart({ data, width = 520, height = 140, loading, error, playerSessions }: PlayerChartProps) {
  const chart = useMemo(() => {
    if (!data || data.length < 2) return null

    const points = data.slice(-48)
    const maxOnline = Math.max(...points.map(point => point.online), 1)
    const peak = Math.max(...points.map(point => point.online), 0)
    const average = points.reduce((total, point) => total + point.online, 0) / points.length
    const latest = points[points.length - 1]
    const spansMultipleDays = new Date(points[0].time).toDateString() !== new Date(latest.time).toDateString()
    const pad = { top: 10, right: 2, bottom: 23, left: 2 }
    const chartWidth = width - pad.left - pad.right
    const chartHeight = height - pad.top - pad.bottom
    const gap = 1.5
    const barWidth = Math.max(2, (chartWidth - gap * (points.length - 1)) / points.length)
    const gridValues = [0.25, 0.5, 0.75, 1]

    const timeline = (playerSessions || []).flatMap(session => {
      const firstSeen = new Date(session.firstSeen).getTime()
      const lastSeen = session.active ? Infinity : new Date(session.lastSeen).getTime()
      return [
        { time: firstSeen, playerName: session.playerName, delta: 1 },
        ...(Number.isFinite(lastSeen) ? [{ time: lastSeen + 1, playerName: session.playerName, delta: -1 }] : []),
      ]
    }).sort((left, right) => left.time - right.time || left.delta - right.delta)

    const activePlayers = new Map<string, number>()
    let timelineIndex = 0
    const pointTooltips = points.map(point => {
      const pointTime = new Date(point.time).getTime()
      while (timelineIndex < timeline.length && timeline[timelineIndex].time <= pointTime) {
        const event = timeline[timelineIndex++]
        const count = (activePlayers.get(event.playerName) || 0) + event.delta
        if (count > 0) activePlayers.set(event.playerName, count)
        else activePlayers.delete(event.playerName)
      }
      return activePlayers.size > 0 ? Array.from(activePlayers.keys()) : null
    })

    const bars = points.map((point, index) => {
      const rawHeight = (point.online / maxOnline) * chartHeight
      const barHeight = point.online === 0 ? 3 : Math.max(rawHeight, 4)
      return { point, x: pad.left + index * (barWidth + gap), y: pad.top + chartHeight - barHeight, height: barHeight }
    })
    const labelIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 4), Math.floor((points.length - 1) / 2), Math.floor((points.length - 1) * 3 / 4), points.length - 1]))

    return { points, latest, peak, average, spansMultipleDays, pad, chartWidth, chartHeight, barWidth, bars, gridValues, labelIndexes, pointTooltips }
  }, [data, width, height, playerSessions])

  if (!chart) {
    return <div className="h-[188px] flex items-center justify-center text-xs text-gray-400">{loading ? '正在加载历史数据...' : error ? '历史数据加载失败，正在重试' : '暂无足够的历史数据'}</div>
  }

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div><p className="text-xs text-gray-500">在线人数</p><p className="mt-0.5 text-[10px] text-gray-400">最近 {chart.points.length} 次探测</p></div>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap"><span className="text-xl font-semibold leading-none text-green-600">{chart.latest.online}</span><span className="text-[10px] text-gray-400">当前 · {formatTime(chart.latest.time)}</span></div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="block overflow-visible" role="img" aria-label="历史在线人数柱状图">
        {chart.gridValues.map(ratio => <line key={ratio} x1={chart.pad.left} y1={chart.pad.top + chart.chartHeight * (1 - ratio)} x2={chart.pad.left + chart.chartWidth} y2={chart.pad.top + chart.chartHeight * (1 - ratio)} stroke="#e5e7eb" strokeWidth="1" strokeDasharray={ratio === 1 ? '3 2' : undefined} />)}
        {chart.bars.map((bar, index) => {
          const players = chart.pointTooltips[index]
          const baseTip = `${new Date(bar.point.time).toLocaleString('zh-CN')} — ${bar.point.online}/${bar.point.max} 在线`
          const tooltip = players ? `${baseTip}\n玩家：${players.join('、')}` : baseTip
          return <g key={`${bar.point.time}-${index}`} className="group"><title>{tooltip}</title><rect x={bar.x} y={bar.y} width={chart.barWidth} height={bar.height} fill={bar.point.online > 0 ? '#22c55e' : '#d1d5db'} opacity={bar.point.online > 0 ? 0.82 : 0.7} className="transition-opacity group-hover:opacity-100" rx="1" /></g>
        })}
        {chart.labelIndexes.map(index => {
          const bar = chart.bars[index]
          const textAnchor = index === 0 ? 'start' : index === chart.points.length - 1 ? 'end' : 'middle'
          const x = index === 0 ? chart.pad.left : index === chart.points.length - 1 ? width - chart.pad.right : bar.x + chart.barWidth / 2
          return <text key={index} x={x} y={height - 4} textAnchor={textAnchor} fill="#9ca3af" fontSize="9">{formatTime(bar.point.time, chart.spansMultipleDays)}</text>
        })}
        <circle cx={chart.bars[chart.bars.length - 1].x + chart.barWidth / 2} cy={chart.bars[chart.bars.length - 1].y} r="2.5" fill="#16a34a" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
        <span>近 {chart.points.length} 次探测</span>
        <span className="flex items-center gap-3"><span>均值 <strong className="font-medium text-gray-500">{chart.average.toFixed(1)}</strong></span><span>峰值 <strong className="font-medium text-green-600">{chart.peak}</strong></span></span>
      </div>
    </div>
  )
}
