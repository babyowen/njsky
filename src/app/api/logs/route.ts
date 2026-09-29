// GET /api/logs — 最近 48 小时采集日志（页面底部运行状态面板用）
import { NextResponse } from 'next/server'
import { recentCollectLogs, getMeta } from '@/lib/db'
import { fmtFull } from '@/lib/time'

export const dynamic = 'force-dynamic'

export async function GET() {
  const logs = recentCollectLogs(Date.now() - 48 * 3600_000)
  return NextResponse.json({
    ok: true,
    lastCollectAt: Number(getMeta('last_collect_at') ?? 0) || null,
    logs: logs.map(l => ({
      id: l.id,
      finishedAt: l.finished_at,
      finishedText: fmtFull(l.finished_at),
      ok: l.ok === 1,
      sunsetbot: l.sunsetbot,
      geovis: l.geovis,
      local: l.local,
      hourly: l.hourly,
      images: l.images,
      errors: l.errors ? (JSON.parse(l.errors) as string[]) : [],
    })),
  })
}
