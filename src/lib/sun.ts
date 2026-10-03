// 日出日落与摄影时段计算（suncalc 本地天文算法，不再依赖抓取）
import SunCalc from 'suncalc'
import { env } from './env'
import { localDateKey } from './time'

export interface SunEvent {
  eventTime: number
  eventType: '日出' | '日落'
  /** 日出事件=黄金时刻结束；日落事件=黄金时刻开始 */
  golden: number | null
  /** 日出事件=蓝调开始(dawn)；日落事件=蓝调结束(dusk) */
  blue: number | null
}

/** 传入"当日正午"的 epoch ms，计算该日的日出日落（正午取哪一天，SunCalc 就算哪一天） */
function dayEvents(noonMs: number): SunEvent[] {
  const t = SunCalc.getTimes(new Date(noonMs), env.CITY_LAT, env.CITY_LON)
  const out: SunEvent[] = []
  if (t.sunrise && !Number.isNaN(t.sunrise.getTime())) {
    out.push({
      eventTime: t.sunrise.getTime(),
      eventType: '日出',
      golden: validMs(t.goldenHourEnd),
      blue: validMs(t.dawn),
    })
  }
  if (t.sunset && !Number.isNaN(t.sunset.getTime())) {
    out.push({
      eventTime: t.sunset.getTime(),
      eventType: '日落',
      golden: validMs(t.goldenHour),
      blue: validMs(t.dusk),
    })
  }
  return out
}

function validMs(d: Date | undefined): number | null {
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : null
}

/**
 * 今天 + 明天 + 后天的日出日落（共 6 个事件；SunsetBot 只预报今明 4 个，后天仅自算源有数据）。
 *
 * 注意：基准"今天"必须按**城市时区**判定，不能用服务器本地时区——部署到 UTC 的 VPS 时，
 * 北京时间 00:00-08:00 期间 UTC 仍在前一天，会导致事件整体错位一天。
 * 本站固定中国城市（东八区），故用城市日期键 + 东八区正午定位。
 */
/**
 * 事件时刻的太阳方位角（罗盘度数：北0 东90 南180 西270）。
 * 火烧云光路沿此方向延伸：日出事件往东偏南/北采样，日落事件往西采样。
 * suncalc 的 azimuth 从正南起算、向西为正（弧度），换算为罗盘方位。
 */
export function sunBearing(eventTime: number): number | null {
  const pos = SunCalc.getPosition(new Date(eventTime), env.CITY_LAT, env.CITY_LON)
  if (!pos || Number.isNaN(pos.azimuth)) return null
  return (pos.azimuth * 180 / Math.PI + 180) % 360
}

export function upcomingSunEvents(now = new Date()): SunEvent[] {
  const todayKey = localDateKey(now.getTime())          // 城市时区下的"今天"
  const baseNoon = Date.parse(`${todayKey}T12:00:00+08:00`)
  const out: SunEvent[] = []
  for (let d = 0; d < 3; d++) {
    out.push(...dayEvents(baseNoon + d * 24 * 3600_000))
  }
  return out.sort((a, b) => a.eventTime - b.eventTime)
}
