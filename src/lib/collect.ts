// 采集编排：协调三个数据源 + 自算评分 + 因子快照 + 逐小时曲线
import { env } from './env'
import {
  upsertEvent, findEventNear, insertReading, upsertFactors,
  replaceHourly, prune, setMeta, insertCollectLog, type EventRow,
} from './db'
import { upcomingSunEvents, sunBearing } from './sun'
import { scoreToLevel } from './levels'
import { computeLocalScore } from './scoring'
import { fetchSunsetbot } from './sources/sunsetbot'
import { fetchGeovis } from './sources/geovis'
import { fetchHourlyFactors, fetchPathCloud, nearestHourly, type PathSample } from './sources/openmeteo'
import { localDateKey } from './time'

export interface CollectSummary {
  ok: boolean
  sunsetbot: number   // 成功写入的读数条数
  geovis: number
  local: number
  hourlyPoints: number
  errors: string[]
  finishedAt: number
}

// 进程内采集互斥：并发调用（如管理接口手动刷新撞上调度心跳）复用同一个进行中的采集
let inflight: Promise<CollectSummary> | null = null

/** 完整采集一轮。任一来源失败不影响其他来源；并发调用自动合并。 */
export function collectOnce(): Promise<CollectSummary> {
  if (inflight) return inflight
  const p = doCollectOnce().finally(() => { inflight = null })
  inflight = p
  return p
}

async function doCollectOnce(): Promise<CollectSummary> {
  const now = Date.now()
  const errors: string[] = []
  let nSunsetbot = 0, nGeovis = 0, nLocal = 0, nHourly = 0

  // 1. 计算并登记今明后天 6 个日出日落事件（含黄金/蓝调时刻）
  const sunEvents = upcomingSunEvents()
  const eventRows: EventRow[] = []
  for (const e of sunEvents) {
    const id = upsertEvent({ event_time: e.eventTime, event_type: e.eventType, golden: e.golden, blue: e.blue })
    eventRows.push({ id, event_time: e.eventTime, event_type: e.eventType, golden: e.golden, blue: e.blue })
  }

  // 2. SunsetBot（GFS + EC）
  try {
    const { readings, errors: sbErrors } = await fetchSunsetbot(env.SUNSETBOT_CITY)
    errors.push(...sbErrors)
    for (const r of readings) {
      // 以源给出的时间为准匹配事件；源未给时间则按时次序号兜底
      const eventType = r.eventKey.startsWith('rise') ? '日出' : '日落'
      const target = r.eventTime ?? fallbackEventTime(r.eventKey, eventRows)
      if (target === null) continue
      const ev = findEventNear(eventType, target)
      if (!ev) continue
      insertReading({
        event_id: ev.id,
        source: r.model === 'EC' ? 'sunsetbot_ec' : 'sunsetbot_gfs',
        score: r.score,
        level: r.score !== null ? scoreToLevel(r.score).label : null,
        label: r.label,
        aod: r.aod,
        image_url: r.imageRemote,
        run_info: r.runInfo,
        fetched_at: now,
        raw: r.raw,
      })
      nSunsetbot++
    }
  } catch (e) {
    errors.push(`sunsetbot: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 3. 星图云官方 API（可选）
  if (env.GEOVIS_TOKEN) {
    try {
      const points = await fetchGeovis(env.CITY_LAT, env.CITY_LON, env.GEOVIS_TOKEN)
      for (const p of points) {
        // fc_time 08:00=朝霞 / 20:00=晚霞，按"同日期+事件类型"匹配
        const isRise = new Date(p.fcTime).getUTCHours() + 8 < 12 // 北京时间中午前视为朝霞
        const eventType = isRise ? '日出' : '日落'
        const dayKey = localDateKey(p.fcTime)
        const ev = eventRows.find(e => e.event_type === eventType && localDateKey(e.event_time) === dayKey)
          ?? findEventNear(eventType, p.fcTime, 12 * 3600_000)
        if (!ev) continue
        insertReading({
          event_id: ev.id,
          source: 'geovis',
          score: p.score,
          level: scoreToLevel(p.score).label,
          label: null,
          aod: null,
          image_url: null,
          run_info: '星图云 fc_idx',
          fetched_at: now,
          raw: JSON.stringify(p),
        })
        nGeovis++
      }
    } catch (e) {
      errors.push(`geovis: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 4. Open-Meteo：逐小时因子 + 每个事件的因子快照 + 自算指数
  try {
    const points = await fetchHourlyFactors(env.CITY_LAT, env.CITY_LON)
    replaceHourly(points.map(p => ({
      time: p.time,
      cloud_total: p.cloudTotal, cloud_low: p.cloudLow, cloud_mid: p.cloudMid, cloud_high: p.cloudHigh,
      visibility: p.visibility, humidity: p.humidity, aod: p.aod, pm25: p.pm25,
      temp: p.temp, feels_like: p.feelsLike, precip_prob: p.precipProb,
      weather_code: p.weatherCode, wind: p.wind,
    })))
    nHourly = points.length

    // 光路采样：按事件时刻的太阳方位角（5° 桶）分组，同组共享一次请求（日出/日落各一次）。
    // 单个方向失败只记错误、该方向事件退化为不带光路因子（horizonFactor=1），不影响本地格点评分。
    const bearingKeyOf = new Map<number, number>()  // event_id → 方位角桶
    const groupBearing = new Map<number, number>()  // 桶 → 代表方位角
    for (const ev of eventRows) {
      const b = sunBearing(ev.event_time)
      if (b === null) continue
      const key = Math.round(b / 5) * 5
      bearingKeyOf.set(ev.id, key)
      if (!groupBearing.has(key)) groupBearing.set(key, b)
    }
    const pathSamples = new Map<number, PathSample[]>()
    for (const [key, bearing] of groupBearing) {
      try {
        pathSamples.set(key, await fetchPathCloud(env.CITY_LAT, env.CITY_LON, bearing))
      } catch (e) {
        errors.push(`openmeteo-path(${key}°): ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    for (const ev of eventRows) {
      const p = nearestHourly(points, ev.event_time)
      if (!p) continue
      const samples = pathSamples.get(bearingKeyOf.get(ev.id) ?? -1)
      const path = samples?.map(s => {
        const pp = nearestHourly(s.points, ev.event_time)
        return pp ? { cloudLow: pp.cloudLow, cloudMid: pp.cloudMid, cloudHigh: pp.cloudHigh } : null
      })
      const result = computeLocalScore({
        cloudLow: p.cloudLow, cloudMid: p.cloudMid, cloudHigh: p.cloudHigh,
        visibility: p.visibility, humidity: p.humidity, aod: p.aod,
        path,
      })
      upsertFactors({
        event_id: ev.id,
        cloud_low: p.cloudLow, cloud_mid: p.cloudMid, cloud_high: p.cloudHigh, cloud_total: p.cloudTotal,
        visibility: p.visibility, humidity: p.humidity, aod: p.aod, pm25: p.pm25,
        score: result?.score ?? null,
        detail: result ? JSON.stringify(result.detail) : null,
        fetched_at: now,
      })
      if (result) {
        insertReading({
          event_id: ev.id,
          source: 'local',
          score: result.score,
          level: result.level,
          label: null,
          aod: p.aod,
          image_url: null,
          run_info: 'Open-Meteo GFS + CAMS',
          fetched_at: now,
          raw: JSON.stringify(result.detail),
        })
        nLocal++
      }
    }
  } catch (e) {
    errors.push(`openmeteo: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 5. 收尾：清理过期数据 + 记录采集时间与日志
  prune(now)
  setMeta('last_collect_at', String(now))
  const summary: CollectSummary = {
    ok: errors.length === 0,
    sunsetbot: nSunsetbot,
    geovis: nGeovis,
    local: nLocal,
    hourlyPoints: nHourly,
    errors,
    finishedAt: now,
  }
  insertCollectLog({
    finished_at: now,
    ok: errors.length === 0 ? 1 : 0,
    sunsetbot: nSunsetbot,
    geovis: nGeovis,
    local: nLocal,
    hourly: nHourly,
    images: 0,
    errors: errors.length > 0 ? JSON.stringify(errors) : null,
  })
  return summary
}

/** SunsetBot 未返回时间时，按时次序号从已登记事件里兜底 */
function fallbackEventTime(eventKey: string, eventRows: EventRow[]): number | null {
  const isRise = eventKey.startsWith('rise')
  const isToday = eventKey.endsWith('_1')
  const type = isRise ? '日出' : '日落'
  const sorted = eventRows.filter(e => e.event_type === type).sort((a, b) => a.event_time - b.event_time)
  const target = isToday ? sorted[0] : sorted[1]
  return target ? target.event_time : null
}
