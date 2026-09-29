// POST /api/admin/refresh — 手动触发一轮采集（需 x-admin-key）
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { collectOnce } from '@/lib/collect'
import { pushOnCollect } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!env.ADMIN_SECRET || req.headers.get('x-admin-key') !== env.ADMIN_SECRET) {
    return NextResponse.json({ ok: false, message: '未授权' }, { status: 403 })
  }
  const summary = await collectOnce()
  let pushed = 0
  try {
    pushed = await pushOnCollect()
  } catch {
    // 推送失败不影响采集结果返回
  }
  return NextResponse.json({ ...summary, pushed })
}
