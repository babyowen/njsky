// GET /api/history — 近 7 天历史（已发生的事件 + 各源最后一次预测值）
import { NextResponse } from 'next/server'
import { eventsBetween, latestReadings } from '@/lib/db'
import { toSourceViews, fuse } from '@/lib/fusion'
import { fmtDateTime, localDateKey } from '@/lib/time'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = Date.now()
  const events = eventsBetween(now - 7 * 24 * 3600_000, now - 30 * 60_000)
    .sort((a, b) => b.event_time - a.event_time)

  const items = events.map(ev => {
    const views = toSourceViews(latestReadings(ev.id))
    return {
      id: ev.id,
      eventTime: ev.event_time,
      eventType: ev.event_type,
      dateKey: localDateKey(ev.event_time),
      timeText: fmtDateTime(ev.event_time),
      sources: views.map(v => ({ source: v.source, sourceName: v.sourceName, score: v.score, level: v.level })),
      fused: fuse(views),
    }
  })

  return NextResponse.json({ ok: true, events: items })
}
