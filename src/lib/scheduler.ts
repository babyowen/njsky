// 调度器：1 小时心跳驱动采集；采集完成后把达标的火烧云事件 + 水晶天推一遍。
// 不依赖服务器本地时区（VPS 可能是 UTC）。
//
// 数据更新慢（SunsetBot 一天4次、GFS 6小时一轮、CAMS 约2次/天），无需高频轮询。
// 采集窗口：固定整点 hour ∈ {2, 9, 14, 21}（GFS 更新完成后）+ 临场（日出/日落前 75~150 分钟）。
// 采集有节制（一天约6次），故"每次采集后达标即推"天然不轰炸；临场那次采集即承担临场提醒。
import cron from 'node-cron'
import { collectOnce } from './collect'
import { pushOnCollect } from './push'
import { getMeta, nextEvent } from './db'
import { localHourFloat } from './time'

/** 固定采集窗口：整点小时（GFS 更新完成后采集） */
const COLLECT_HOURS = new Set([2, 9, 14, 21])

/** 窗口内距上次采集超过该时长才重采（避免同一窗口重复） */
const WINDOW_STALE_MS = 2 * 3600_000
/** 启动补采的过期阈值（更宽松，避免重启就白采一轮） */
const BOOT_STALE_MS = 4 * 3600_000
/** 临场采集距上次采集的最短间隔 */
const PRE_EVENT_MIN_GAP_MS = 40 * 60_000

/** 是否处于某事件前 75~150 分钟的临场采集窗口 */
function inPreEventWindow(nowMs: number): boolean {
  return (['日落', '日出'] as const).some(type => {
    const ev = nextEvent(type, nowMs)
    if (!ev) return false
    const mins = (ev.event_time - nowMs) / 60_000
    return mins >= 75 && mins <= 150
  })
}

/** 判断是否需要采集；若需要则执行采集并触发"数据变化推送"。返回是否真采了。 */
async function maybeCollect(reason: 'window' | 'boot' | 'pre-event'): Promise<boolean> {
  const last = Number(getMeta('last_collect_at') ?? 0)
  const age = Date.now() - last
  const nowMs = Date.now()
  let due: boolean
  if (reason === 'boot') {
    due = age > BOOT_STALE_MS
  } else if (reason === 'window') {
    const hour = Math.floor(localHourFloat(nowMs))
    due = COLLECT_HOURS.has(hour) && age > WINDOW_STALE_MS
  } else {
    due = inPreEventWindow(nowMs) && age > PRE_EVENT_MIN_GAP_MS
  }
  if (!due) return false
  try {
    const r = await collectOnce()
    console.log(`[njsky] 采集完成(${reason}) sunsetbot=${r.sunsetbot} geovis=${r.geovis} local=${r.local} hourly=${r.hourlyPoints}${r.errors.length ? ` 错误:${r.errors.join(';')}` : ''}`)
  } catch (e) {
    console.error('[njsky] 采集失败:', e)
  }
  // 采集后：把当前达标的都推一遍（临场那次采集即承担临场提醒）
  await safePushCollect()
  return true
}

async function safePushCollect(): Promise<void> {
  try {
    const n = await pushOnCollect()
    if (n > 0) console.log(`[njsky] 推送 ${n} 条（采集后达标）`)
  } catch (e) {
    console.error('[njsky] 推送失败:', e)
  }
}

export function startScheduler(): void {
  const g = globalThis as { __njskyScheduler?: boolean }
  if (g.__njskyScheduler) return
  g.__njskyScheduler = true

  // 每小时整点：判断固定窗口 + 临场窗口，任一命中则采集并随后推送判断
  cron.schedule('0 * * * *', () => {
    void (async () => {
      const a = await maybeCollect('window')
      const b = await maybeCollect('pre-event')
      if (!a && !b) return // 未采集 = 数据未更新，不检查推送
    })()
  })
  // 启动 20 秒后：若数据过期（如首次部署/停机恢复）立即补采 + 推送判断
  setTimeout(() => { void maybeCollect('boot') }, 20_000)
  console.log('[njsky] 调度器已启动（每 1 小时整点；采集窗口 02/09/14/21 点 + 临场；采集后达标即推）')
}
