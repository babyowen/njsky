'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Activity, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { cn, fetcher } from '@/lib/utils'
import type { LogsResponse, CollectLogView } from '@/lib/api-types'

/** 页面底部运行日志：最近 48 小时采集健康度（数据源状态一目了然） */
export default function LogPanel() {
  const { data } = useSWR<LogsResponse>('/api/logs', fetcher, { refreshInterval: 300_000 })
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (!data) {
    return <div className="glass-panel h-24 animate-pulse rounded-2xl" />
  }
  if (data.logs.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-4 text-sm text-slate-500">
        暂无采集日志——服务启动后会自动记录每一轮数据更新。
      </div>
    )
  }

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Activity className="h-5 w-5 text-emerald-400" />
          <h3 className="text-lg font-semibold tracking-wider text-white">运行日志</h3>
          <span className="font-mono-num text-[11px] tracking-wider text-slate-500">最近 48 小时 · 共 {data.logs.length} 轮</span>
        </div>
        <HealthBadge logs={data.logs} />
      </div>

      <div className="divide-y divide-white/[0.04]">
        {data.logs.map(log => (
          <LogRow
            key={log.id}
            log={log}
            expanded={expandedId === log.id}
            onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
          />
        ))}
      </div>
    </div>
  )
}

/** 健康度：取最近 5 轮，全部成功为绿色，否则按成功率给颜色 */
function HealthBadge({ logs }: { logs: CollectLogView[] }) {
  const recent = logs.slice(0, 5)
  const okCount = recent.filter(l => l.ok).length
  const allOk = okCount === recent.length
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono-num text-[11px] tracking-wider',
      allOk
        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
        : 'border-amber-400/40 bg-amber-400/10 text-amber-300',
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', allOk ? 'bg-emerald-400' : 'bg-amber-400')} />
      {allOk ? '近 5 轮全部正常' : `近 5 轮 ${okCount}/${recent.length} 正常`}
    </span>
  )
}

function LogRow({ log, expanded, onToggle }: { log: CollectLogView; expanded: boolean; onToggle: () => void }) {
  const counts: Array<{ name: string; value: number; warnWhenZero: boolean }> = [
    { name: 'SunsetBot', value: log.sunsetbot, warnWhenZero: true },
    { name: '自算', value: log.local, warnWhenZero: true },
    { name: '逐小时', value: log.hourly, warnWhenZero: true },
  ]
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        {log.ok
          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          : <XCircle className="h-4 w-4 shrink-0 text-amber-400" />}
        <span className="font-mono-num text-sm text-slate-200">{log.finishedText}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 font-mono-num text-[11px]">
          {counts.map(c => (
            <span key={c.name} className={cn(
              c.value > 0 ? 'text-slate-400' : c.warnWhenZero ? 'text-amber-400/80' : 'text-slate-600',
            )}>
              {c.name} {c.value}
            </span>
          ))}
        </span>
        {!log.ok && (
          <ChevronDown className={cn('ml-auto h-4 w-4 text-slate-500 transition-transform', expanded && 'rotate-180')} />
        )}
      </button>
      {expanded && log.errors.length > 0 && (
        <div className="border-t border-white/[0.04] bg-red-500/[0.04] px-5 py-3">
          {log.errors.map((err, i) => (
            <div key={i} className="font-mono-num text-[11px] leading-relaxed text-red-300/80">{err}</div>
          ))}
        </div>
      )}
    </div>
  )
}
