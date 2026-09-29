// 时间工具：内部统一使用 epoch ms；展示一律按城市时区（默认 Asia/Shanghai）
import { env } from './env'

const TZ = env.TZ_NAME

/** 解析国内数据源返回的本地时间字符串（"2026-09-28 17:52:55"，固定东八区） */
export function parseChinaTime(s: string): number | null {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}+08:00`
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/** 解析 Open-Meteo 按请求时区返回的 ISO 本地时间（"2026-09-28T17:00"）。
 *  本站固定请求 Asia/Shanghai，故按东八区解析。 */
export function parseOpenMeteoTime(s: string): number | null {
  const t = Date.parse(s.length === 16 ? `${s}:00+08:00` : `${s}+08:00`)
  return Number.isNaN(t) ? null : t
}

/** 城市时区下的日期键（YYYY-MM-DD），用于"同一天"匹配 */
export function localDateKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms))
}

/** 城市时区下的"小时 + 分钟小数"，用于调度窗口判断（如 20.75 = 20:45） */
export function localHourFloat(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date(ms))
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0) % 24
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
  return h + m / 60
}

export function fmtDateTime(ms: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ, month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: false,
  }).format(new Date(ms))
}

export function fmtFull(ms: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(ms))
}

export function fmtTime(ms: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: false,
  }).format(new Date(ms))
}
