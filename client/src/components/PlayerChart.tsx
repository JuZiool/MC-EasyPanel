import { useMemo } from 'react'
import type { PlayerSession } from '../types'
import { downsamplePlayerHistory, getPlayerChartTimeRatio } from '../utils/playerChartData'

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
  /** 玩家会话记录，用于悬停时显示当时在线的玩家名称 */
  playerSessions?: PlayerSession[]
}

export default function PlayerChart({ data, width = 400, height = 140, loading, error, playerSessions }: PlayerChartProps) {
  const chart = useMemo(() => {
    if (!data || data.length < 2) return null

    const points = downsamplePlayerHistory(data, Math.min(160, Math.max(60, Math.floor(width / 2))))
    const maxOnline = Math.max(...points.map(d => d.online), 1)

    const pad = { top: 8, right: 8, bottom: 22, left: 28 }
    const cw = width - pad.left - pad.right
    const ch = height - pad.top - pad.bottom

    const scaleY = (v: number) => pad.top + ch - (v / maxOnline) * ch
    const scaleX = (i: number) => pad.left + getPlayerChartTimeRatio(points, i) * cw

    // 折线
    const lineD = points.map((d, i) => {
      const x = scaleX(i)
      const y = scaleY(d.online)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')

    // 填充区域
    const fillD = `${lineD} L${scaleX(points.length - 1).toFixed(1)},${scaleY(0).toFixed(1)} L${scaleX(0).toFixed(1)},${scaleY(0).toFixed(1)} Z`

    // Y 轴刻度
    const step = Math.ceil(maxOnline / 4) || 1
    const yTicks = []
    for (let i = 0; i <= 4; i++) {
      const val = i * step
      if (val <= maxOnline) yTicks.push({ v: val, y: scaleY(val) })
    }

    // X 轴标签（5 个）
    const indices = [0,
      Math.floor(points.length / 4),
      Math.floor(points.length / 2),
      Math.floor(points.length * 3 / 4),
      points.length - 1
    ].filter((v, i, a) => a.indexOf(v) === i)

    const spansMultipleDays = new Date(points[points.length - 1].time).toDateString() !== new Date(points[0].time).toDateString()
    const xLabels = indices.map(i => {
      const d = new Date(points[i].time)
      return {
        text: spansMultipleDays
          ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        x: scaleX(i)
      }
    })

    // 最后一个数据点坐标
    const lastPt = points[points.length - 1]
    const lastX = scaleX(points.length - 1)
    const lastY = scaleY(lastPt.online)

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

    const hitWidth = Math.max(2, cw / Math.max(points.length - 1, 1))
    return { points, lineD, fillD, yTicks, xLabels, lastPt, lastX, lastY, maxOnline, pad, cw, hitWidth, pointTooltips }
  }, [data, width, height, playerSessions])

  if (!chart) {
    return (
      <div className="text-xs text-gray-400 py-6 text-center">
        {loading ? '正在加载历史数据...' : error ? '历史数据加载失败，正在重试' : '暂无足够的历史数据'}
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="overflow-visible">
      {/* Y 轴网格线和标签 */}
      {chart.yTicks.map((t, i) => (
        <g key={i}>
          <line x1={chart.pad.left} y1={t.y} x2={width - chart.pad.right} y2={t.y}
            stroke="#e5e7eb" strokeWidth={1} />
          <text x={chart.pad.left - 6} y={t.y + 3} textAnchor="end"
            fill="#9ca3af" fontSize={10}>{t.v}</text>
        </g>
      ))}

      {/* 填充 */}
      <path d={chart.fillD} fill="rgba(34,197,94,0.08)" />

      {/* 折线 */}
      <path d={chart.lineD} fill="none" stroke="#22c55e" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />

      {/* 数据点 tooltip */}
      {chart.points.map((d, i) => {
        const players = chart.pointTooltips[i]
        const timeStr = new Date(d.time).toLocaleString('zh-CN')
        const baseTip = `${timeStr} — ${d.online}/${d.max} 在线`
        const fullTip = players ? `${baseTip}\n玩家: ${players.join(', ')}` : baseTip
        return (
          <g key={i}>
            <title>{fullTip}</title>
            <circle cx={chart.pad.left + getPlayerChartTimeRatio(chart.points, i) * chart.cw}
              cy={chart.pad.top + (height - chart.pad.top - chart.pad.bottom) - (d.online / chart.maxOnline) * (height - chart.pad.top - chart.pad.bottom)}
              r={Math.min(8, Math.max(4, chart.hitWidth))} fill="transparent" />
            {i === chart.points.length - 1 && (
              <circle cx={chart.lastX} cy={chart.lastY} r={3}
                fill="#22c55e" stroke="#fff" strokeWidth={2} />
            )}
          </g>
        )
      })}

      {/* 当前人数标注 */}
      {chart.lastPt.online > 0 && (
        <text x={chart.lastX} y={chart.lastY - 8} textAnchor="middle"
          fill="#16a34a" fontSize={11} fontWeight={600}>
          {chart.lastPt.online}
        </text>
      )}

      {/* X 轴时间 */}
      {chart.xLabels.map((l, i) => (
        <text key={i} x={l.x} y={height - 4} textAnchor="middle"
          fill="#9ca3af" fontSize={9}>{l.text}</text>
      ))}
    </svg>
  )
}
