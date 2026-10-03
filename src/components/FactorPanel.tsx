'use client'
import { CloudRainWind, Eye, Droplets, Wind, Gauge, Thermometer, Umbrella, Wind as WindIcon } from 'lucide-react'
import { aodColor, aodLabel } from '@/lib/levels'
import { weatherCodeInfo } from '@/lib/weather-code'
import { cn, fmtTimeCN } from '@/lib/utils'
import type { ForecastEvent, HourlyPointView } from '@/lib/api-types'

/** 下一事件的气象因子面板：当前实况 + 分层云量构成 + 通透度指标 + 自算评分分解 */
export default function FactorPanel({ events, current }: { events: ForecastEvent[]; current: HourlyPointView | null }) {
  // 取最近一个未结束且有因子数据的事件
  const ev = events.find(e => !e.past && e.factors) ?? events.find(e => e.factors)
  if (!ev || !ev.factors) {
    return (
      <div className="glass-panel rounded-xl p-4 text-sm text-slate-500">
        气象因子暂无数据——下次采集后自动出现。
      </div>
    )
  }
  const f = ev.factors
  const wx = current ? weatherCodeInfo(current.weatherCode) : null

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <CloudRainWind className="h-5 w-5 text-sky-400" />
          <h3 className="text-lg font-semibold tracking-wider text-white">气象因子</h3>
          <span className="font-mono-num text-[11px] tracking-wider text-slate-500">
            {ev.timeText} {ev.eventType} · Open-Meteo（GFS 云量 / CAMS 气溶胶）
          </span>
        </div>
      </div>

      {/* 当前实况条 */}
      {current && wx && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="flex items-center gap-1.5 text-slate-200">
            <wx.Icon className="h-4 w-4 text-amber-300" />
            {wx.label}
          </span>
          {current.temp !== null && (
            <span className="flex items-center gap-1 text-slate-300">
              <Thermometer className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-mono-num">{Math.round(current.temp)}°</span>
              {current.feelsLike !== null && (
                <span className="text-xs text-slate-500">体感 {Math.round(current.feelsLike)}°</span>
              )}
            </span>
          )}
          {current.precipProb !== null && (
            <span className="flex items-center gap-1 text-slate-300">
              <Umbrella className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-mono-num">{Math.round(current.precipProb)}%</span>
            </span>
          )}
          {current.wind !== null && (
            <span className="flex items-center gap-1 text-slate-300">
              <WindIcon className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-mono-num">{Math.round(current.wind)} km/h</span>
            </span>
          )}
          <span className="ml-auto font-mono-num text-[11px] text-slate-600">当前实况 · {fmtTimeCN(current.time)}</span>
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {/* 左：云层构成 */}
        <div>
          <div className="mb-2 font-mono-num text-[11px] uppercase tracking-[0.25em] text-slate-400">
            云层构成（火烧云的「幕布」）
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded-full bg-white/5">
            {f.cloudLow !== null && f.cloudLow > 0 && (
              <div className="h-full bg-sky-500/70" style={{ width: `${f.cloudLow}%` }} title={`低云 ${f.cloudLow}%`} />
            )}
            {f.cloudMid !== null && f.cloudMid > 0 && (
              <div className="h-full bg-indigo-400/70" style={{ width: `${f.cloudMid}%` }} title={`中云 ${f.cloudMid}%`} />
            )}
            {f.cloudHigh !== null && f.cloudHigh > 0 && (
              <div className="h-full bg-fuchsia-300/60" style={{ width: `${f.cloudHigh}%` }} title={`高云 ${f.cloudHigh}%`} />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono-num text-[11px] text-slate-400">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-500/70" />低云 {fmtPct(f.cloudLow)}</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-indigo-400/70" />中云 {fmtPct(f.cloudMid)}</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-fuchsia-300/60" />高云 {fmtPct(f.cloudHigh)}</span>
            <span className="text-slate-500">总云量 {fmtPct(f.cloudTotal)}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            中高云适量（约 30~60%）最易成烧；低云过多会挡住地平线方向的阳光。
          </p>
        </div>

        {/* 右：通透度指标 */}
        <div>
          <div className="mb-2 font-mono-num text-[11px] uppercase tracking-[0.25em] text-slate-400">
            大气通透度
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <StatChip icon={<Wind className="h-3.5 w-3.5" />} name="气溶胶 AOD"
              value={f.aod !== null ? f.aod.toFixed(3) : '—'}
              extra={f.aod !== null ? aodLabel(f.aod) : undefined}
              valueClass={aodColor(f.aod)} />
            <StatChip icon={<Eye className="h-3.5 w-3.5" />} name="能见度"
              value={f.visibility !== null ? `${(f.visibility / 1000).toFixed(1)} km` : '—'}
              valueClass="text-slate-200" />
            <StatChip icon={<Droplets className="h-3.5 w-3.5" />} name="相对湿度"
              value={f.humidity !== null ? `${Math.round(f.humidity)}%` : '—'}
              valueClass="text-slate-200" />
            <StatChip icon={<Gauge className="h-3.5 w-3.5" />} name="PM2.5"
              value={f.pm25 !== null ? `${Math.round(f.pm25)} μg/m³` : '—'}
              valueClass="text-slate-200" />
          </div>
        </div>
      </div>

      {/* 自算评分分解 */}
      {f.detail && (
        <div className="mt-5 border-t border-white/5 pt-4">
          <div className="mb-2 font-mono-num text-[11px] uppercase tracking-[0.25em] text-slate-400">
            本站自算指数分解（{f.score !== null ? f.score.toFixed(2) : '—'}）
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DetailBar name="幕布" hint="中高云适宜度" value={f.detail.canvasScore} />
            <DetailBar name="透光" hint="低云遮挡越少越高" value={f.detail.blockFactor} />
            <DetailBar name="通透" hint="AOD/能见度/湿度" value={f.detail.clarity} />
            {typeof f.detail.horizonFactor === 'number' && (
              <DetailBar name="光路" hint="太阳方向云墙越少越高" value={f.detail.horizonFactor} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function fmtPct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v)}%`
}

function StatChip({ icon, name, value, extra, valueClass }: {
  icon: React.ReactNode
  name: string
  value: string
  extra?: string | undefined
  valueClass: string
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">{icon}{name}</div>
      <div className={cn('mt-1 font-mono-num text-lg', valueClass)}>
        {value}
        {extra && <span className="ml-1.5 text-xs">（{extra}）</span>}
      </div>
    </div>
  )
}

function DetailBar({ name, hint, value }: { name: string; hint: string; value: number | undefined }) {
  const v = typeof value === 'number' ? value : 0
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-slate-400">{name}</span>
        <span className="font-mono-num text-xs text-slate-300">{Math.round(v * 100)}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-ember-500" style={{ width: `${v * 100}%` }} />
      </div>
      <div className="mt-1 text-[10px] text-slate-600">{hint}</div>
    </div>
  )
}
