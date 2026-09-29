'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import { Radar, RefreshCw } from 'lucide-react'
import Header from '@/components/Header'
import EventCards from '@/components/EventCards'
import FactorPanel from '@/components/FactorPanel'
import HourlyChart from '@/components/HourlyChart'
import HistoryTable from '@/components/HistoryTable'
import Description from '@/components/Description'
import LogPanel from '@/components/LogPanel'
import { fetcher } from '@/lib/utils'
import type { ForecastResponse, HistoryResponse, FactorsResponse } from '@/lib/api-types'

export default function Home() {
  const { data: forecast, error, isValidating } = useSWR<ForecastResponse>(
    '/api/forecast', fetcher, { refreshInterval: 60_000, revalidateOnFocus: true },
  )
  const { data: history } = useSWR<HistoryResponse>(
    '/api/history', fetcher, { refreshInterval: 300_000 },
  )
  const { data: factors } = useSWR<FactorsResponse>(
    '/api/factors?day=0', fetcher, { refreshInterval: 300_000 },
  )

  return (
    <main className="relative min-h-screen overflow-x-clip bg-dusk-950">
      {/* 环境氛围层：网格 + 星空 + 扫描线 + 极光带 + 漂浮光斑 + 噪点 */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-tech-grid [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,black,transparent)]" />
        <div className="absolute inset-0 bg-stars animate-twinkle" />
        <div className="absolute inset-0 bg-stars animate-twinkle-slow [background-position:220px_130px]" />
        <div className="absolute left-1/2 top-[12%] h-[280px] w-[130%] -translate-x-1/2 -rotate-6 bg-gradient-to-r from-transparent via-ember-500/10 to-transparent blur-3xl animate-aurora" />
        <div className="absolute -top-48 left-1/2 h-[480px] w-[860px] -translate-x-1/2 rounded-full bg-ember-500/15 blur-[140px] animate-drift-a" />
        <div className="absolute top-[35%] -right-48 h-[420px] w-[420px] rounded-full bg-rose-500/10 blur-[120px] animate-drift-b" />
        <div className="absolute -bottom-24 -left-48 h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-[120px] animate-drift-a" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ember-400/60 to-transparent animate-scanline" />
        <div className="absolute inset-0 noise-overlay" />
      </div>

      <div className="relative z-10">
        <Header
          city={forecast?.city ?? '南京'}
          lat={forecast?.lat ?? 32.0603}
          lon={forecast?.lon ?? 118.7969}
        />

        <div className="container mx-auto px-4 pb-12 pt-10 sm:px-8 lg:px-16 space-y-14">
          {/* 近日预测 */}
          <section className="animate-rise" style={{ animationDelay: '0.1s' }}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Radar className="h-6 w-6 text-ember-400 animate-glow-pulse" />
                <h2 className="text-2xl font-semibold tracking-wider text-white">近日预测</h2>
                {forecast?.lastCollectText && (
                  <span className="font-mono-num text-xs tracking-wider text-slate-400">
                    数据更新 · {forecast.lastCollectText}
                  </span>
                )}
              </div>
              {isValidating && (
                <div className="flex items-center gap-2 font-mono-num text-xs tracking-wider text-slate-400">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-ember-400" />
                  读取数据中...
                </div>
              )}
            </div>
            {error ? (
              <div className="glass-panel rounded-xl p-4 text-sm text-red-400">加载失败，请稍后重试</div>
            ) : !forecast ? (
              <SkeletonCards />
            ) : (
              <EventCards events={forecast.events} now={forecast.now} />
            )}
          </section>

          {/* 气象因子 + 逐小时曲线 */}
          <section className="animate-rise grid gap-4 lg:grid-cols-2" style={{ animationDelay: '0.2s' }}>
            <FactorPanel events={forecast?.events ?? []} current={nearestPoint(factors, forecast?.now)} />
            <HourlyChart points={factors?.points ?? []} events={forecast?.events ?? []} now={forecast?.now ?? null} />
          </section>

          {/* 历史 */}
          <section className="animate-rise" style={{ animationDelay: '0.3s' }}>
            <HistoryTable events={history?.events ?? []} />
          </section>

          {/* 说明 */}
          <section className="animate-rise" style={{ animationDelay: '0.4s' }}>
            <Description />
          </section>

          {/* 运行日志 */}
          <section className="animate-rise" style={{ animationDelay: '0.5s' }}>
            <LogPanel />
          </section>
        </div>

        <footer className="py-8 text-center">
          <div className="mx-auto mb-6 h-px w-40 bg-gradient-to-r from-transparent via-ember-500/50 to-transparent" />
          <a
            href="https://beian.miit.gov.cn/#/Integrated/index"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono-num text-xs tracking-widest text-slate-500 transition-colors hover:text-ember-300"
          >
            苏ICP备08105700号-3
          </a>
        </footer>
      </div>
    </main>
  )
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-panel animate-pulse rounded-2xl p-6">
          <div className="space-y-4">
            <div className="h-4 w-3/4 rounded bg-white/10" />
            <div className="h-10 w-1/2 rounded bg-white/10" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-white/10" />
              <div className="h-4 w-5/6 rounded bg-white/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** 取距当前时刻最近的一个逐小时点（用于"当前实况"） */
function nearestPoint(factors: FactorsResponse | undefined, now: number | undefined) {
  if (!factors || !now || factors.points.length === 0) return null
  let best = factors.points[0] ?? null
  let bestDiff = Infinity
  for (const p of factors.points) {
    const d = Math.abs(p.time - now)
    if (d < bestDiff) { bestDiff = d; best = p }
  }
  return bestDiff <= 90 * 60_000 ? best : null
}
