// GET /api/forecast — 近日预测（今明日出日落 × 各数据源 × 因子 × 综合建议）
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { eventsBetween, latestReadings, getFactors, getMeta } from '@/lib/db'
import { toSourceViews, fuse } from '@/lib/fusion'
import { fmtDateTime, fmtFull } from '@/lib/time'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = Date.now()
  // 展示窗口：3 小时前（刚发生的日出日落短暂保留）至未来 3 天（覆盖后天，便于提前准备）
  const events = eventsBetween(now - 3 * 3600_000, now + 3 * 24 * 3600_000)

  const items = events.map(ev => {
    const views = toSourceViews(latestReadings(ev.id))
    const factors = getFactors(ev.id)
    return {
      id: ev.id,
      eventTime: ev.event_time,
      eventType: ev.event_type,
      golden: ev.golden,
      blue: ev.blue,
      past: ev.event_time < now,
      timeText: fmtDateTime(ev.event_time),
      sources: views,
      fused: fuse(views),
      factors: factors
        ? {
            cloudLow: factors.cloud_low,
            cloudMid: factors.cloud_mid,
            cloudHigh: factors.cloud_high,
            cloudTotal: factors.cloud_total,
            visibility: factors.visibility,
            humidity: factors.humidity,
            aod: factors.aod,
            pm25: factors.pm25,
            score: factors.score,
            detail: factors.detail ? (JSON.parse(factors.detail) as Record<string, number>) : null,
            fetchedAt: factors.fetched_at,
          }
        : null,
    }
  })

  const lastCollect = Number(getMeta('last_collect_at') ?? 0)
  return NextResponse.json({
    ok: true,
    city: env.CITY_NAME,
    lat: env.CITY_LAT,
    lon: env.CITY_LON,
    now,
    lastCollectAt: lastCollect || null,
    lastCollectText: lastCollect ? fmtFull(lastCollect) : null,
    events: items,
  })
}
