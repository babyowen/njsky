// 数据源：Open-Meteo（免费免 Key）
// 预报接口给逐小时分层云量/能见度/湿度；空气质量接口给 CAMS 的 AOD 与 PM2.5
// （CAMS 与 SunsetBot 的霾数据同源，可直接交叉验证）。
import { parseOpenMeteoTime } from '../time'

export interface HourlyPoint {
  time: number               // epoch ms 整点
  cloudTotal: number | null  // %
  cloudLow: number | null
  cloudMid: number | null
  cloudHigh: number | null
  visibility: number | null  // 米
  humidity: number | null    // %
  aod: number | null         // CAMS 气溶胶光学厚度
  pm25: number | null        // μg/m³
  temp: number | null        // ℃
  feelsLike: number | null   // ℃
  precipProb: number | null  // %
  weatherCode: number | null // WMO 天气代码
  wind: number | null        // km/h
}

interface OmHourly {
  time?: string[]
  cloud_cover?: Array<number | null>
  cloud_cover_low?: Array<number | null>
  cloud_cover_mid?: Array<number | null>
  cloud_cover_high?: Array<number | null>
  visibility?: Array<number | null>
  relative_humidity_2m?: Array<number | null>
  temperature_2m?: Array<number | null>
  apparent_temperature?: Array<number | null>
  precipitation_probability?: Array<number | null>
  weather_code?: Array<number | null>
  wind_speed_10m?: Array<number | null>
}
interface OmAirHourly {
  time?: string[]
  aerosol_optical_depth?: Array<number | null>
  pm2_5?: Array<number | null>
}

const pick = (arr: Array<number | null> | undefined, i: number): number | null => {
  const v = arr?.[i]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export async function fetchHourlyFactors(lat: number, lon: number): Promise<HourlyPoint[]> {
  const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,relative_humidity_2m,` +
    `temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m` +
    `&forecast_days=3&timezone=Asia%2FShanghai`
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&hourly=aerosol_optical_depth,pm2_5&forecast_days=3&timezone=Asia%2FShanghai`

  const [wxRes, airRes] = await Promise.all([
    fetch(wxUrl, { signal: AbortSignal.timeout(20000) }),
    fetch(airUrl, { signal: AbortSignal.timeout(20000) }),
  ])
  if (!wxRes.ok) throw new Error(`open-meteo forecast HTTP ${wxRes.status}`)
  if (!airRes.ok) throw new Error(`open-meteo air HTTP ${airRes.status}`)

  const wx = (await wxRes.json()) as { hourly?: OmHourly }
  const air = (await airRes.json()) as { hourly?: OmAirHourly }
  const h = wx.hourly ?? {}
  const a = air.hourly ?? {}
  const times = h.time ?? []

  const out: HourlyPoint[] = []
  for (let i = 0; i < times.length; i++) {
    const ts = times[i]
    if (!ts) continue
    const t = parseOpenMeteoTime(ts)
    if (t === null) continue
    out.push({
      time: t,
      cloudTotal: pick(h.cloud_cover, i),
      cloudLow: pick(h.cloud_cover_low, i),
      cloudMid: pick(h.cloud_cover_mid, i),
      cloudHigh: pick(h.cloud_cover_high, i),
      visibility: pick(h.visibility, i),
      humidity: pick(h.relative_humidity_2m, i),
      aod: pick(a.aerosol_optical_depth, i),
      pm25: pick(a.pm2_5, i),
      temp: pick(h.temperature_2m, i),
      feelsLike: pick(h.apparent_temperature, i),
      precipProb: pick(h.precipitation_probability, i),
      weatherCode: pick(h.weather_code, i),
      wind: pick(h.wind_speed_10m, i),
    })
  }
  return out
}

/** 取距离目标时间最近的整点数据 */
export function nearestHourly(points: HourlyPoint[], targetMs: number): HourlyPoint | null {
  let best: HourlyPoint | null = null
  let bestDiff = Infinity
  for (const p of points) {
    const d = Math.abs(p.time - targetMs)
    if (d < bestDiff) { bestDiff = d; best = p }
  }
  // 超过 90 分钟视为不匹配
  return bestDiff <= 90 * 60_000 ? best : null
}
