// GET /api/factors?day=0 — 逐小时气象因子（云量分层 / AOD / 能见度），默认今天
import { NextResponse } from 'next/server'
import { hourlyBetween } from '@/lib/db'
import { localDateKey } from '@/lib/time'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const dayOffset = Math.min(Math.max(parseInt(url.searchParams.get('day') ?? '0', 10) || 0, 0), 2)

  const now = new Date()
  // 城市时区下当天 0 点（站点评测固定东八区，与数据解析一致）
  const dayStartUtc = Date.parse(`${localDateKey(now.getTime())}T00:00:00+08:00`) + dayOffset * 24 * 3600_000
  const rows = hourlyBetween(dayStartUtc, dayStartUtc + 24 * 3600_000 - 1)

  return NextResponse.json({
    ok: true,
    date: localDateKey(dayStartUtc),
    points: rows.map(r => ({
      time: r.time,
      cloudTotal: r.cloud_total,
      cloudLow: r.cloud_low,
      cloudMid: r.cloud_mid,
      cloudHigh: r.cloud_high,
      visibility: r.visibility,
      humidity: r.humidity,
      aod: r.aod,
      pm25: r.pm25,
      temp: r.temp,
      feelsLike: r.feels_like,
      precipProb: r.precip_prob,
      weatherCode: r.weather_code,
      wind: r.wind,
    })),
  })
}
