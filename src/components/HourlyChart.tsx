'use client'
import { ChartLine, Sunrise, Sunset } from 'lucide-react'
import type { HourlyPointView, ForecastEvent } from '@/lib/api-types'

const W = 720
const H = 260
const PAD = { l: 36, r: 44, t: 16, b: 28 }

/** 今日逐小时云量分层（堆积面积） + AOD 曲线（右轴），标注日出日落时刻 */
export default function HourlyChart({ points, events, now }: {
  points: HourlyPointView[]
  events: ForecastEvent[]
  now: number | null
}) {
  if (points.length < 2) {
    return (
      <div className="glass-panel rounded-xl p-4 text-sm text-slate-500">
        逐小时曲线暂无数据——完成一次采集后自动出现。
      </div>
    )
  }

  const t0 = points[0]?.time ?? 0
  const t1 = points[points.length - 1]?.time ?? 1
  const spanX = W - PAD.l - PAD.r
  const spanY = H - PAD.t - PAD.b
  const yBottom = H - PAD.b

  const x = (t: number) => PAD.l + ((t - t0) / Math.max(t1 - t0, 1)) * spanX
  const yCloud = (v: number) => yBottom - (Math.min(Math.max(v, 0), 100) / 100) * spanY
  const yAod = (v: number) => yBottom - (Math.min(Math.max(v, 0), 1.2) / 1.2) * spanY

  // 堆积面积：低云（底）→ 中云 → 高云（顶）
  const area = (bottom: (p: HourlyPointView) => number, top: (p: HourlyPointView) => number): string => {
    const fwd = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.time).toFixed(1)},${yCloud(top(p)).toFixed(1)}`).join(' ')
    const bwd = [...points].reverse().map(p => `L${x(p.time).toFixed(1)},${yCloud(bottom(p)).toFixed(1)}`).join(' ')
    return `${fwd} ${bwd} Z`
  }
  const low = (p: HourlyPointView) => p.cloudLow ?? 0
  const mid = (p: HourlyPointView) => low(p) + (p.cloudMid ?? 0)
  const high = (p: HourlyPointView) => mid(p) + (p.cloudHigh ?? 0)

  // AOD 折线（null 处断开）
  const aodSegments: string[] = []
  let seg: string[] = []
  for (const p of points) {
    if (p.aod === null) {
      if (seg.length > 0) { aodSegments.push(seg.join(' ')); seg = [] }
      continue
    }
    seg.push(`${seg.length === 0 ? 'M' : 'L'}${x(p.time).toFixed(1)},${yAod(p.aod).toFixed(1)}`)
  }
  if (seg.length > 0) aodSegments.push(seg.join(' '))

  // 日出日落标记（仅落在今天范围内的事件）
  const markers = events.filter(e => e.eventTime >= t0 && e.eventTime <= t1)

  // X 轴刻度：每 6 小时
  const hourTicks = points.filter(p => new Date(p.time).getUTCMinutes() === 0)
    .filter((_, i) => i % 6 === 0)

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <ChartLine className="h-5 w-5 text-sky-400" />
          <h3 className="text-lg font-semibold tracking-wider text-white">今日逐小时</h3>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono-num text-[11px] text-slate-400">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-500/70" />低云</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-indigo-400/70" />中云</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-fuchsia-300/60" />高云</span>
          <span><i className="mr-1 inline-block h-[2px] w-3 rounded-sm bg-ember-500 align-middle" />AOD（右轴）</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[560px] w-full" role="img" aria-label="逐小时云量与气溶胶曲线">
          {/* 横向网格（云量 %） */}
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yCloud(v)} y2={yCloud(v)} stroke="rgba(148,163,184,0.12)" strokeDasharray={v === 0 ? '' : '3 5'} />
              <text x={PAD.l - 6} y={yCloud(v) + 3} textAnchor="end" fontSize="9" fill="rgba(148,163,184,0.55)" fontFamily="monospace">{v}%</text>
            </g>
          ))}
          {/* 右轴 AOD */}
          {[0, 0.4, 0.8, 1.2].map(v => (
            <text key={v} x={W - PAD.r + 6} y={yAod(v) + 3} fontSize="9" fill="rgba(255,138,92,0.6)" fontFamily="monospace">{v.toFixed(1)}</text>
          ))}

          {/* 堆积云量 */}
          <path d={area(() => 0, low)} fill="rgba(56,189,248,0.45)" />
          <path d={area(low, mid)} fill="rgba(129,140,248,0.45)" />
          <path d={area(mid, high)} fill="rgba(240,171,252,0.35)" />

          {/* AOD 折线 */}
          {aodSegments.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#ff6b4a" strokeWidth="1.8" strokeLinejoin="round" />
          ))}

          {/* X 轴时间刻度 */}
          {hourTicks.map(p => (
            <text key={p.time} x={x(p.time)} y={H - 8} textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.55)" fontFamily="monospace">
              {new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(p.time))}
            </text>
          ))}

          {/* 日出日落标记 */}
          {markers.map(e => (
            <g key={e.id}>
              <line
                x1={x(e.eventTime)} x2={x(e.eventTime)} y1={PAD.t} y2={yBottom}
                stroke={e.eventType === '日出' ? 'rgba(251,191,36,0.7)' : 'rgba(251,113,133,0.7)'}
                strokeDasharray="4 3" strokeWidth="1.2"
              />
              <text x={x(e.eventTime)} y={PAD.t - 4} textAnchor="middle" fontSize="9"
                fill={e.eventType === '日出' ? 'rgba(251,191,36,0.9)' : 'rgba(251,113,133,0.9)'}>
                {e.eventType}
              </text>
            </g>
          ))}

          {/* 当前时刻 */}
          {now !== null && now >= t0 && now <= t1 && (
            <line x1={x(now)} x2={x(now)} y1={PAD.t} y2={yBottom} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
          )}
        </svg>
      </div>

      {/* 事件图例补充 */}
      {markers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono-num text-[11px] text-slate-500">
          {markers.map(e => (
            <span key={e.id} className="inline-flex items-center gap-1">
              {e.eventType === '日出'
                ? <Sunrise className="h-3 w-3 text-amber-400" />
                : <Sunset className="h-3 w-3 text-rose-400" />}
              {e.timeText}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
