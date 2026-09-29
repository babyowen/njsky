// 达标推送：飞书 OpenAPI（bot 身份）→ 单聊卡片
//
// 设计（2026-09 与用户确认）：**采集即触发，达标就推**，不做去重、不看数据是否变化。
//   采集本身有节制（固定 02/09/14/21 整点 + 临场窗口，一天约 6 次），所以"每次采集后
//   把达标的都推一遍"天然不会轰炸；临场窗口那次采集即天然承担"临场提醒"。
//   event_state 快照仅用于在卡片里标注"较上次上调/持平/下调"，不参与推送判定。
import { env } from './env'
import {
  eventsBetween, latestReadings, hourlyBetween,
  getEventState, setEventState, type EventRow,
} from './db'
import { toSourceViews, fuse, type SourceView, type FusedView } from './fusion'
import { scoreToRank, scoreToLevel, rankToScoreFloor, aodLabel } from './levels'
import { bestCrystalWindow, type CrystalAssessment } from './crystal'
import { sendFeishuCard } from './feishu'
import { fmtDateTime, fmtTime, localDateKey, localHourFloat } from './time'

/** 综合指数达到该等级才推送火烧云（默认 0.1963 = 小到中烧） */
const PUSH_RANK_MIN = () => scoreToRank(env.PUSH_THRESHOLD)
/** 水晶天推送的最低等级（2=水晶天） */
const CRYSTAL_RANK_MIN = 2

/** 采集完成后调用：把当前达标的火烧云事件 + 水晶天各推一条。返回推送条数。 */
export async function pushOnCollect(nowMs = Date.now()): Promise<number> {
  const [a, b] = await Promise.all([pushFirecloud(nowMs), pushCrystal(nowMs)])
  return a + b
}

// ---------- 火烧云（红/橙卡片） ----------

async function pushFirecloud(nowMs: number): Promise<number> {
  const events = eventsBetween(nowMs, nowMs + 3 * 24 * 3600_000) // 未来 3 天
  const minRank = PUSH_RANK_MIN()
  let pushed = 0
  for (const ev of events) {
    const views = toSourceViews(latestReadings(ev.id))
    const fused = fuse(views)
    if (fused.score === null) continue
    const rank = scoreToRank(fused.score)
    const key = `event:${ev.id}`
    const prev = getEventState(key)
    setEventState(key, rank, fused.score, nowMs) // 记录快照供下次对比
    if (rank < minRank) continue                 // 不达标不推；达标就推（不管变没变）
    await sendFirecloud(ev, views, fused, prev?.last_rank ?? null, nowMs)
    pushed++
  }
  return pushed
}

async function sendFirecloud(
  ev: EventRow, views: SourceView[], fused: FusedView, prevRank: number | null, nowMs: number,
): Promise<void> {
  const isSunset = ev.event_type === '日落'
  const icon = isSunset ? '🌇' : '🌅'
  const score = fused.score ?? 0
  const rank = scoreToRank(score)
  const level = scoreToLevel(score).label
  const when = relativeDayText(ev.event_time, nowMs)

  // 变化提示：上调 / 下调 / 持平 / 首次
  let changeHint = ''
  if (prevRank !== null) {
    const prevLevel = scoreToLevel(rankToScoreFloor(prevRank)).label
    if (rank > prevRank) changeHint = `（较上次上调：${prevLevel} → ${level}）`
    else if (rank < prevRank) changeHint = `（较上次下调：${prevLevel} → ${level}）`
    else changeHint = `（与上次持平：${level}）`
  }
  const title = `${icon} 南京${when}${ev.event_type}可能「${level}」`
  const countdown = countdownText(ev.event_time, nowMs)

  const lines = [
    `**综合指数 ${score.toFixed(2)}（${level}）**${changeHint}`,
    ...(countdown ? [`距现在约 ${countdown}`] : []),
    '',
    ...views.filter(v => v.score !== null).map(v => `- ${v.sourceName}：${v.score?.toFixed(2)} ${scoreToLevel(v.score ?? 0).label}`),
    '',
    `${ev.event_type}时间：${fmtDateTime(ev.event_time)}`,
  ]
  if (isSunset) {
    if (ev.golden) lines.push(`黄金时刻：${fmtTime(ev.golden)} 起`)
    if (ev.blue) lines.push(`蓝调时刻：至 ${fmtTime(ev.blue)}`)
  } else {
    if (ev.blue) lines.push(`蓝调时刻：${fmtTime(ev.blue)} 起`)
    if (ev.golden) lines.push(`黄金时刻：至 ${fmtTime(ev.golden)}`)
  }
  const aod = views.find(v => v.aod !== null)?.aod ?? null
  if (aod !== null) lines.push(`气溶胶 AOD：${aod}（${aodLabel(aod)}）`)
  lines.push('', '数据来源：SunsetBot / 本站自算（Open-Meteo）。预测仅供参考，出门前请再看一眼实时云图。')

  await sendFeishuCard(title, lines.join('\n'), isSunset ? 'red' : 'orange')
}

// ---------- 水晶天（蓝色卡片） ----------

async function pushCrystal(nowMs: number): Promise<number> {
  // 未来 12 小时、仅白天（8:00-18:00）的最通透时段
  const points = hourlyBetween(nowMs, nowMs + 12 * 3600_000)
    .filter(p => {
      const h = localHourFloat(p.time)
      return h >= 8 && h < 18
    })
  const best = bestCrystalWindow(points)
  if (!best || best.rank < CRYSTAL_RANK_MIN) return 0

  // key 用"水晶天发生那天"，记录快照供下次对比（不参与是否推送的判定）
  const key = `crystal:${localDateKey(best.time)}`
  const prev = getEventState(key)
  setEventState(key, best.rank, best.aod, nowMs)

  await sendCrystal(best, prev?.last_rank ?? null, nowMs)
  return 1
}

async function sendCrystal(best: CrystalAssessment, prevRank: number | null, nowMs: number): Promise<void> {
  const isTop = best.rank >= 3
  let changeHint = ''
  if (prevRank !== null) {
    if (best.rank > prevRank) changeHint = '（通透度上调）'
    else if (best.rank < prevRank) changeHint = '（通透度下调）'
    else changeHint = '（持续通透）'
  }
  const title = (isTop ? '💎 南京「极品水晶天」' : '☀️ 南京「水晶天」') + changeHint
  const lines = [
    `**空气特别通透，适合拍城市远景 / 蓝天 / 高机位**`,
    '',
    `最佳时段：${fmtDateTime(best.time)} 前后（${relativeDayText(best.time, nowMs)}${countdownText(best.time, nowMs) ? `，约 ${countdownText(best.time, nowMs)}后` : ''}）`,
    best.aod !== null ? `气溶胶 AOD：${best.aod.toFixed(3)}（${aodLabel(best.aod)}）` : '',
    best.visibility !== null ? `能见度：${(best.visibility / 1000).toFixed(1)} km` : '',
    best.cloudLow !== null ? `低云：${Math.round(best.cloudLow)}%` : '',
    best.cloudTotal !== null ? `总云量：${Math.round(best.cloudTotal)}%` : '',
    '',
    '数据来源：本站自算（Open-Meteo CAMS/GFS）。',
  ].filter(Boolean)

  await sendFeishuCard(title, lines.join('\n'), 'blue')
}

// ---------- 工具 ----------

/** 管理接口用：发送一条测试推送 */
export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  return sendFeishuCard(
    '🔥 南京火烧云监测 · 测试推送',
    `如果你看到这条消息，说明飞书推送通道已打通。\n\n发送时间：${fmtDateTime(Date.now())}`,
    'blue',
  )
}

/** 相对今天的天数描述 */
function relativeDayText(ms: number, nowMs: number): string {
  const today = localDateKey(nowMs)
  const target = localDateKey(ms)
  const dayMs = 24 * 3600_000
  const todayMs = Date.parse(`${today}T00:00:00+08:00`)
  const targetMs = Date.parse(`${target}T00:00:00+08:00`)
  const diffDays = Math.round((targetMs - todayMs) / dayMs)
  if (diffDays <= 0) return '今日'
  if (diffDays === 1) return '明日'
  if (diffDays === 2) return '后天'
  return `${diffDays}天后`
}

/** 距现在的倒计时（"约 3 小时 20 分"）；已过期或过远返回空串 */
function countdownText(ms: number, nowMs: number): string {
  const diff = ms - nowMs
  if (diff <= 0) return ''
  const h = Math.floor(diff / 3600_000)
  const m = Math.round((diff % 3600_000) / 60_000)
  if (h >= 48) return '' // 超过两天的不显示倒计时（"明日/后天"已够）
  if (h <= 0) return `${m} 分钟`
  return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`
}
