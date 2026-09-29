// POST /api/admin/push-test — 发送一条测试推送（需 x-admin-key）
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { sendTestPush } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!env.ADMIN_SECRET || req.headers.get('x-admin-key') !== env.ADMIN_SECRET) {
    return NextResponse.json({ ok: false, message: '未授权' }, { status: 403 })
  }
  const result = await sendTestPush()
  return NextResponse.json(result)
}
