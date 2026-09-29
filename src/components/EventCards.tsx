'use client'
import { Sunrise, Sunset, Radar, Split, Clock3, Wind } from 'lucide-react'
import { scoreToLevel, scorePct, aodColor, aodLabel } from '@/lib/levels'
import { cn, fmtTimeCN, relativeText } from '@/lib/utils'
import type { ForecastEvent } from '@/lib/api-types'

/** 近日预测卡片：每个日出/日落事件一张，含多源指数 + 综合建议 + 摄影时段 */
export default function EventCards({ events, now }: { events: ForecastEvent[]; now: number }) {
  if (events.length === 0) {
    return <div className="glass-panel rounded-xl p-4 text-sm text-amber-300">暂无数据</div>
  }

  return (
    <div className={cn(
      'grid gap-4 w-full',
      events.length === 1 && 'grid-cols-1 max-w-xl mx-auto',
      events.length === 2 && 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto',
      events.length === 3 && 'grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto',
      events.length >= 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    )}>
      {events.map((ev, index) => (
        <EventCard key={ev.id} ev={ev} now={now} index={index} />
      ))}
    </div>
  )
}

function EventCard({ ev, now, index }: { ev: ForecastEvent; now: number; index: number }) {
  const fused = ev.fused
  const fusedLevel = fused.score !== null ? scoreToLevel(fused.score) : null
  const aod = ev.sources.find(s => s.aod !== null)?.aod ?? null

  return (
    <div
      className={cn(
        'glass-panel group animate-rise relative w-full overflow-hidden rounded-2xl p-6',
        'transition-all duration-300 ease-out',
        'hover:-translate-y-1 hover:border-ember-500/40',
        'hover:shadow-[0_24px_60px_-20px_rgba(255,107,74,0.35)]',
        ev.past && 'opacity-60',
      )}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-ember-500/0 via-ember-500/80 to-ember-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* 事件时间 + 类型 */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-mono-num text-lg tracking-wider text-slate-200">{ev.timeText}</div>
          <div className="mt-0.5 flex items-center gap-1 font-mono-num text-[11px] text-slate-500">
            <Clock3 className="h-3 w-3" />
            {relativeText(ev.eventTime, now)}
          </div>
        </div>
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs',
          ev.eventType === '日出'
            ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
            : 'border-rose-400/40 bg-rose-400/10 text-rose-300',
        )}>
          {ev.eventType === '日出' ? <Sunrise className="h-3.5 w-3.5" /> : <Sunset className="h-3.5 w-3.5" />}
          {ev.eventType}
        </span>
      </div>

      {/* 综合建议 */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5 font-mono-num text-[11px] uppercase tracking-[0.25em] text-slate-400">
          <Radar className="h-4 w-4 text-ember-400" />
          综合指数
        </div>
        {fused.score !== null && fusedLevel ? (
          <>
            <div className={cn('mt-2 font-mono-num text-6xl font-semibold tracking-tight drop-shadow-[0_0_18px_rgba(255,107,74,0.3)]', fusedLevel.color)}>
              {fused.score.toFixed(2)}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs', fusedLevel.badge)}>
                {fusedLevel.label}
              </span>
              {fused.divergent && (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-400/10 px-2.5 py-0.5 text-xs text-sky-300">
                  <Split className="h-3 w-3" />
                  源间分歧
                </span>
              )}
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out', fusedLevel.bar)}
                style={{ width: `${scorePct(fused.score)}%` }}
              />
            </div>
          </>
        ) : (
          <div className="mt-4 font-mono-num text-2xl text-slate-600">暂无预测</div>
        )}
      </div>

      {/* 各数据源明细 */}
      <div className="mt-6 space-y-2 border-t border-white/5 pt-4">
        {ev.sources.length === 0 && (
          <div className="text-center text-xs text-slate-600">等待数据源更新</div>
        )}
        {ev.sources.map(s => {
          const lv = s.score !== null ? scoreToLevel(s.score) : null
          return (
            <div key={s.source} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{s.sourceName}</span>
              {s.score !== null && lv ? (
                <span className="flex items-center gap-2">
                  <span className={cn('font-mono-num', lv.color)}>{s.score.toFixed(2)}</span>
                  <span className={cn('rounded border px-1.5 py-px text-[10px]', lv.badge)}>{lv.label}</span>
                </span>
              ) : (
                <span className="font-mono-num text-xs text-slate-600">—</span>
              )}
            </div>
          )
        })}
      </div>

      {/* 气溶胶 + 摄影时段 */}
      <div className="mt-4 space-y-1.5 border-t border-white/5 pt-3 font-mono-num text-[11px] text-slate-500">
        {aod !== null && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><Wind className="h-3 w-3" />气溶胶 AOD</span>
            <span className={aodColor(aod)}>{aod.toFixed(3)}（{aodLabel(aod)}）</span>
          </div>
        )}
        {ev.eventType === '日落' ? (
          <div className="flex items-center justify-between">
            <span>黄金 / 蓝调</span>
            <span>
              {ev.golden ? `${fmtTimeCN(ev.golden)} 起` : '—'} / {ev.blue ? `至 ${fmtTimeCN(ev.blue)}` : '—'}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span>蓝调 / 黄金</span>
            <span>
              {ev.blue ? `${fmtTimeCN(ev.blue)} 起` : '—'} / {ev.golden ? `至 ${fmtTimeCN(ev.golden)}` : '—'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
