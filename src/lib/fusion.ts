// 多源融合：不取平均，采用"最乐观值"策略（宁杀错不放过，对摄影决策更友好），
// 并标注源间分歧——分歧本身是有用信息。
import type { ReadingRow } from './db'
import { scoreToLevel } from './levels'

export interface SourceView {
  source: string
  sourceName: string
  score: number | null
  level: string | null
  label: string | null
  aod: number | null
  imageUrl: string | null
  runInfo: string | null
  fetchedAt: number
}

export interface FusedView {
  score: number | null
  level: string | null
  /** 源间是否存在显著分歧（最高-最低 ≥ 0.3） */
  divergent: boolean
  sourceCount: number
}

export const SOURCE_NAMES: Record<string, string> = {
  sunsetbot_gfs: 'SunsetBot·GFS',
  sunsetbot_ec: 'SunsetBot·EC',
  geovis: '星图云',
  local: '本站自算',
}

/** 来源展示顺序 */
const SOURCE_ORDER = ['sunsetbot_gfs', 'sunsetbot_ec', 'geovis', 'local']

export function toSourceViews(readings: ReadingRow[]): SourceView[] {
  const views = readings.map(r => ({
    source: r.source,
    sourceName: SOURCE_NAMES[r.source] ?? r.source,
    score: r.score,
    level: r.level,
    label: r.label,
    aod: r.aod,
    imageUrl: r.image_url,
    runInfo: r.run_info,
    fetchedAt: r.fetched_at,
  }))
  views.sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source))
  return views
}

export function fuse(views: SourceView[]): FusedView {
  const scores = views.map(v => v.score).filter((s): s is number => s !== null)
  if (scores.length === 0) return { score: null, level: null, divergent: false, sourceCount: 0 }
  const max = Math.max(...scores)
  const min = Math.min(...scores)
  return {
    score: max,
    level: scoreToLevel(max).label,
    divergent: scores.length >= 2 && max - min >= 0.3,
    sourceCount: scores.length,
  }
}
