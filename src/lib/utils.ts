// 客户端共享工具
import type { ForecastResponse, HistoryResponse, FactorsResponse } from '@/lib/api-types'

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export type { ForecastResponse, HistoryResponse, FactorsResponse }

export function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ')
}

const CN_TZ = 'Asia/Shanghai'

export function fmtTimeCN(ms: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: CN_TZ, hour: 'numeric', minute: '2-digit', hour12: false,
  }).format(new Date(ms))
}

/** 相对时间："2小时54分后" / "已结束" */
export function relativeText(ms: number, now: number): string {
  const diff = ms - now
  if (diff <= 0) return '已结束'
  const h = Math.floor(diff / 3600_000)
  const m = Math.round((diff % 3600_000) / 60_000)
  if (h <= 0) return `${m} 分钟后`
  if (h >= 24) return `${Math.floor(h / 24)} 天后`
  return m > 0 ? `${h} 小时 ${m} 分后` : `${h} 小时后`
}
