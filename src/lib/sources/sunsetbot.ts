// 数据源：SunsetBot.top（抓取，无官方 API）
// 适配网站 2025 年后的双模型版本：必须带 model 参数（GFS/EC）；
// 未出数据的时次会返回 "-" 与"没有该时次的预报"，属正常情况，不视为错误。
// 注意：该站 CDN 对数据中心 IP 有风控（间歇性 525 SSL 握手失败），
// 靠多轮重试对抗；截面图由 collect 层下载到本地缓存，前端不直连。
import { parseChinaTime } from '../time'

const EVENT_KEYS = ['rise_1', 'set_1', 'rise_2', 'set_2'] as const
const MODELS = ['GFS', 'EC'] as const

export type SunsetbotEventKey = (typeof EVENT_KEYS)[number]
export type SunsetbotModel = (typeof MODELS)[number]

export interface SunsetbotReading {
  eventKey: SunsetbotEventKey
  model: SunsetbotModel
  score: number | null
  label: string | null
  aod: number | null
  aodLabel: string | null
  /** 源给出的日出日落时间（北京时），未出数时为 null */
  eventTime: number | null
  /** 大气截面图远程地址（SunsetBot 直链；仅作记录，页面不展示、不下载） */
  imageRemote: string | null
  /** 模式时次，如 "上午时次 2026092718z" */
  runInfo: string | null
  raw: string
}

export interface FetchSunsetbotResult {
  readings: SunsetbotReading[]
  errors: string[]
}

interface SunsetbotResponse {
  status?: string
  tb_quality?: string
  tb_aod?: string
  tb_event_time?: string
  img_href?: string
  display_times_name?: string
  display_times_str?: string
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const BASE = 'https://sunsetbot.top/'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** 解析 "0.341（一般）" / "0.0（不烧）" / "-" 这类值 */
function parseValueLabel(s: string | undefined): { value: number | null; label: string | null } {
  if (!s || s.trim() === '-') return { value: null, label: null }
  const m = s.match(/(-?\d+(?:\.\d+)?)/)
  const labelMatch = s.match(/（(.+)）/)
  return {
    value: m && m[1] ? parseFloat(m[1]) : null,
    label: labelMatch && labelMatch[1] ? labelMatch[1] : null,
  }
}

/**
 * img_href 形如 /image/cross_section/GFS_南京_20260928_set_2026092718z.jpg/，
 * 该地址返回的是 HTML 详情页；真实图片在 /static/media/ 同名路径。仅用于记录 image_url。
 */
function sunsetbotImageRemote(href: string | undefined): string | null {
  if (!href) return null
  const m = href.match(/\/image\/([^/]+\/[^/]+?)(?:\/?)$/)
  if (m) return `https://sunsetbot.top/static/media/${m[1]}`
  if (href.startsWith('http')) return href
  return `https://sunsetbot.top${href}`
}

async function fetchJson(url: string): Promise<SunsetbotResponse> {
  // 该站 CDN 对数据中心 IP 间歇性返回 525，重试 3 次（1.5s/4s）；窗口内多轮采集兜底
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) return (await res.json()) as SunsetbotResponse
      if (res.status === 525 || res.status === 522 || res.status === 520 || res.status === 503) {
        throw new Error(`HTTP ${res.status}（CDN 风控）`)
      }
      throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
      if (attempt < 2) await sleep(attempt === 0 ? 1500 : 4000)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

async function fetchOne(city: string, eventKey: SunsetbotEventKey, model: SunsetbotModel): Promise<SunsetbotReading | null> {
  const params = new URLSearchParams({
    query_id: String(Math.floor(Math.random() * 10000000) + 1),
    intend: 'select_city',
    query_city: city,
    event: eventKey,
    event_date: 'None',
    times: 'None',
    model,
  })
  const data = await fetchJson(`${BASE}?${params}`)

  const quality = parseValueLabel(data.tb_quality)
  const aod = parseValueLabel(data.tb_aod)
  const eventTime = data.tb_event_time ? parseChinaTime(data.tb_event_time) : null

  // "没有该时次的预报"：所有字段都是 "-"，返回 null 表示此时次暂无数据
  if (quality.value === null && eventTime === null) return null

  const runInfo = [data.display_times_name, data.display_times_str].filter(Boolean).join(' ') || null
  return {
    eventKey,
    model,
    score: quality.value,
    label: quality.label,
    aod: aod.value,
    aodLabel: aod.label,
    eventTime,
    imageRemote: sunsetbotImageRemote(data.img_href),
    runInfo,
    raw: JSON.stringify(data),
  }
}

/** 抓取 4 个时次 × 2 个模型；单个失败不影响其他，错误汇总返回 */
export async function fetchSunsetbot(city: string): Promise<FetchSunsetbotResult> {
  const out: SunsetbotReading[] = []
  const errors: string[] = []
  for (const model of MODELS) {
    for (const eventKey of EVENT_KEYS) {
      try {
        const r = await fetchOne(city, eventKey, model)
        if (r) out.push(r)
      } catch (e) {
        const msg = `${model}/${eventKey}: ${e instanceof Error ? e.message : String(e)}`
        console.warn(`[njsky] sunsetbot ${msg}`)
        errors.push(msg)
      }
      await sleep(300) // 礼貌限速
    }
  }
  return { readings: out, errors }
}
