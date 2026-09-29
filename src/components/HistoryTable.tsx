'use client'
import { History, Sunrise, Sunset } from 'lucide-react'
import { scoreToLevel } from '@/lib/levels'
import { cn } from '@/lib/utils'
import type { HistoryEvent } from '@/lib/api-types'

const SOURCE_SLOTS = [
  { key: 'sunsetbot_gfs', name: 'SunsetBot·GFS' },
  { key: 'sunsetbot_ec', name: 'SunsetBot·EC' },
  { key: 'local', name: '本站自算' },
]

/** 近 7 天历史：每个事件各源最后一次预测值 */
export default function HistoryTable({ events }: { events: HistoryEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-4 text-sm text-slate-500">
        暂无历史数据——系统上线运行后将自动积累。
      </div>
    )
  }

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2.5 border-b border-white/5 px-5 py-4">
        <History className="h-5 w-5 text-ember-400" />
        <h3 className="text-lg font-semibold tracking-wider text-white">近 7 天历史</h3>
        <span className="font-mono-num text-[11px] tracking-wider text-slate-500">各来源当日最后一次预测值</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left font-mono-num text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3 font-normal">时间</th>
              <th className="px-3 py-3 font-normal">事件</th>
              {SOURCE_SLOTS.map(s => (
                <th key={s.key} className="px-3 py-3 text-right font-normal">{s.name}</th>
              ))}
              <th className="px-5 py-3 text-right font-normal">综合</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => (
              <tr
                key={ev.id}
                className={cn(
                  'border-b border-white/[0.03] transition-colors hover:bg-white/[0.03]',
                  i % 2 === 1 && 'bg-white/[0.015]',
                )}
              >
                <td className="whitespace-nowrap px-5 py-2.5 font-mono-num text-slate-300">{ev.timeText}</td>
                <td className="px-3 py-2.5">
                  <span className={cn(
                    'inline-flex items-center gap-1 text-xs',
                    ev.eventType === '日出' ? 'text-amber-300' : 'text-rose-300',
                  )}>
                    {ev.eventType === '日出' ? <Sunrise className="h-3 w-3" /> : <Sunset className="h-3 w-3" />}
                    {ev.eventType}
                  </span>
                </td>
                {SOURCE_SLOTS.map(slot => {
                  const s = ev.sources.find(v => v.source === slot.key)
                  return (
                    <td key={slot.key} className="px-3 py-2.5 text-right">
                      {s && s.score !== null ? (
                        <ScoreCell score={s.score} />
                      ) : (
                        <span className="font-mono-num text-xs text-slate-700">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-5 py-2.5 text-right">
                  {ev.fused.score !== null ? (
                    <ScoreCell score={ev.fused.score} bold />
                  ) : (
                    <span className="font-mono-num text-xs text-slate-700">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 等级文字按 score 实时映射，确保与当前算法口径一致（不受库中历史标签影响） */
function ScoreCell({ score, bold }: { score: number; bold?: boolean }) {
  const lv = scoreToLevel(score)
  return (
    <span className={cn('inline-flex flex-col items-end leading-tight', bold && 'font-semibold')}>
      <span className={cn('font-mono-num', lv.color)}>{score.toFixed(2)}</span>
      <span className="text-[10px] text-slate-500">{lv.label}</span>
    </span>
  )
}
