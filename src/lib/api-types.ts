// API 响应类型（前后端共享）
import type { SourceView, FusedView } from '@/lib/fusion'

export interface ForecastFactors {
  cloudLow: number | null
  cloudMid: number | null
  cloudHigh: number | null
  cloudTotal: number | null
  visibility: number | null
  humidity: number | null
  aod: number | null
  pm25: number | null
  score: number | null
  detail: Record<string, number> | null
  fetchedAt: number
}

export interface ForecastEvent {
  id: number
  eventTime: number
  eventType: string
  golden: number | null
  blue: number | null
  past: boolean
  timeText: string
  sources: SourceView[]
  fused: FusedView
  factors: ForecastFactors | null
}

export interface ForecastResponse {
  ok: boolean
  city: string
  lat: number
  lon: number
  now: number
  lastCollectAt: number | null
  lastCollectText: string | null
  events: ForecastEvent[]
}

export interface HistoryEvent {
  id: number
  eventTime: number
  eventType: string
  dateKey: string
  timeText: string
  sources: Array<{ source: string; sourceName: string; score: number | null; level: string | null }>
  fused: FusedView
}

export interface HistoryResponse {
  ok: boolean
  events: HistoryEvent[]
}

export interface HourlyPointView {
  time: number
  cloudTotal: number | null
  cloudLow: number | null
  cloudMid: number | null
  cloudHigh: number | null
  visibility: number | null
  humidity: number | null
  aod: number | null
  pm25: number | null
  temp: number | null
  feelsLike: number | null
  precipProb: number | null
  weatherCode: number | null
  wind: number | null
}

export interface FactorsResponse {
  ok: boolean
  date: string
  points: HourlyPointView[]
}

export interface CollectLogView {
  id: number
  finishedAt: number
  finishedText: string
  ok: boolean
  sunsetbot: number
  geovis: number
  local: number
  hourly: number
  images: number
  errors: string[]
}

export interface LogsResponse {
  ok: boolean
  lastCollectAt: number | null
  logs: CollectLogView[]
}
