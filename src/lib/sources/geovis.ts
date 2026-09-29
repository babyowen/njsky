// 数据源：星图云（中科星图）火烧云官方 API
// 文档：https://open.geovisearth.com/support/document?docId=1000651
// 指数 fc_idx 与 SunsetBot 同量纲（0-2.5），未来 3 天、每日 2 更。
import { parseChinaTime } from '../time'

export interface GeovisPoint {
  /** 预报时次（北京时 epoch ms），08:00=朝霞，20:00=晚霞 */
  fcTime: number
  score: number
}

interface GeovisResponse {
  status?: number
  result?: {
    datas?: Array<{ fc_time?: string; values?: number[] }>
  }
}

export async function fetchGeovis(lat: number, lon: number, token: string): Promise<GeovisPoint[]> {
  if (!token) return []
  const url = `https://api.open.geovisearth.com/pj/query/grid/v1/weather/grid/glow_global/day/data?location=${lon},${lat}&meteCodes=fc_idx&token=${encodeURIComponent(token)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`geovis HTTP ${res.status}`)
  const data = (await res.json()) as GeovisResponse
  if (data.status !== 0 || !data.result?.datas) return []

  const out: GeovisPoint[] = []
  for (const d of data.result.datas) {
    const t = d.fc_time ? parseChinaTime(d.fc_time) : null
    const v = d.values?.[0]
    if (t !== null && typeof v === 'number' && Number.isFinite(v)) {
      out.push({ fcTime: t, score: v })
    }
  }
  return out
}
