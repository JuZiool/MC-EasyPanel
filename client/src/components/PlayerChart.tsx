import { useMemo } from 'react'

interface DataPoint {
  time: string
  online: number
  max: number
}

interface PlayerChartProps {
  data: DataPoint[]
  width?: number
  height?: number
}

export default function PlayerChart({ data, width = 320, height = 140 }: PlayerChartProps) {
  const chart = useMemo(() => {
    if (!data || data.length < 2) return null

    // 取最近 48 个点（约 4 小时，每 5 分钟一个点）
    const points = data.slice(-48)
    const maxOnline = Math.max(...points.map(d => d.online), 1)

    const pad = { top: 8, right: 8, bottom: 22, left: 28 }
    const cw = width - pad.left - pad.right
    const ch = height - pad.top - pad.bottom

    const scaleY = (v: number) => pad.top + ch - (v / maxOnline) * ch
    const scaleX = (i: number) => pad.left + (i / Math.max(points.length - 1, 1)) * cw

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

    const xLabels = indices.map(i => {
      const d = new Date(points[i].time)
      return {
        text: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        x: scaleX(i)
      }
    })

    // 最后一个数据点坐标
    const lastPt = points[points.length - 1]
    const lastX = scaleX(points.length - 1)
    const lastY = scaleY(lastPt.online)

    return { points, lineD, fillD, yTicks, xLabels, lastPt, lastX, lastY, pad, cw }
  }, [data, width, height])

  if (!chart) {
    return (
      <div className="text-xs text-gray-400 py-6 text-center">
        暂无足够的历史数据
      </div>
    )
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
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
      {chart.points.map((d, i) => (
        <g key={i}>
          <title>{`${new Date(d.time).toLocaleString('zh-CN')} — ${d.online}/${d.max} 在线`}</title>
          {i === chart.points.length - 1 && (
            <circle cx={chart.lastX} cy={chart.lastY} r={3}
              fill="#22c55e" stroke="#fff" strokeWidth={2} />
          )}
        </g>
      ))}

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
