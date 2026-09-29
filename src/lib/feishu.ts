// 飞书 OpenAPI 客户端：bot（应用）身份，直连 HTTP，无外部二进制依赖。
// 仅需 FEISHU_APP_ID + FEISHU_APP_SECRET（+ 接收人 FEISHU_USER_ID）。
// 文档：https://open.feishu.cn/document/server-docs/im-v1/message/create
import { env } from './env'

const OPEN_BASE = 'https://open.feishu.cn/open-apis'

// ---------- tenant_access_token 缓存（进程内，提前 5 分钟刷新） ----------
let tokenCache: { token: string; expireAt: number } | null = null

async function getTenantToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expireAt) return tokenCache.token
  const missing = [
    !env.FEISHU_APP_ID && 'FEISHU_APP_ID',
    !env.FEISHU_APP_SECRET && 'FEISHU_APP_SECRET',
  ].filter(Boolean)
  if (missing.length > 0) throw new Error(`未配置 ${missing.join(' / ')}`)
  const res = await fetch(`${OPEN_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
    signal: AbortSignal.timeout(10000),
  })
  const data = (await res.json()) as { code?: number; msg?: string; tenant_access_token?: string; expire?: number }
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`获取 tenant_access_token 失败: code=${data.code} ${data.msg ?? ''}`)
  }
  // expire 单位秒，提前 300 秒过期以避免边界
  tokenCache = { token: data.tenant_access_token, expireAt: Date.now() + ((data.expire ?? 7200) - 300) * 1000 }
  return tokenCache.token
}

// ---------- 发送卡片消息（支持 markdown 渲染） ----------

export interface FeishuSendResult {
  ok: boolean
  message: string
}

/** 以 bot 身份给 open_id 用户发送一张带标题的 markdown 卡片 */
export async function sendFeishuCard(title: string, markdown: string, template = 'red'): Promise<FeishuSendResult> {
  if (!env.FEISHU_USER_ID) return { ok: false, message: '未配置 FEISHU_USER_ID' }
  try {
    const token = await getTenantToken()
    const card = {
      config: { wide_screen_mode: true },
      header: { title: { tag: 'plain_text', content: title }, template },
      elements: [{ tag: 'markdown', content: markdown }],
    }
    const res = await fetch(`${OPEN_BASE}/im/v1/messages?receive_id_type=open_id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        receive_id: env.FEISHU_USER_ID,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      }),
      signal: AbortSignal.timeout(10000),
    })
    const data = (await res.json()) as { code?: number; msg?: string }
    if (data.code === 0) return { ok: true, message: 'ok' }
    // token 失效（99991663 等）时清缓存，下次自动重取
    if (data.code === 99991663 || data.code === 99991661) tokenCache = null
    return { ok: false, message: `飞书 code=${data.code} ${data.msg ?? ''}` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}
