// 火烧云指数（0-2.5）→ 等级文字与展示颜色
// 阈值与标签均对齐星图云 fc_idx 官方六级分级（docId=1000651），
// 与 SunsetBot 同量纲，保证多源并排对比时口径一致、不偏乐观。
//   0.0-0.02 无火烧云 / 0.02-0.105 微微烧 / 0.105-0.1963 小烧
//   0.1963-0.5694 小到中烧 / 0.5694-0.9243 中到大烧 / 0.9243-2.5 大烧

export interface Level {
  min: number
  label: string
  /** 文字颜色（tailwind class） */
  color: string
  /** 徽章样式 */
  badge: string
  /** 进度条渐变 */
  bar: string
}

export const LEVELS: Level[] = [
  { min: 0.9243, label: '大烧',     color: 'text-rose-400',   badge: 'border-rose-400/50 bg-rose-400/15 text-rose-300',       bar: 'from-orange-400 via-rose-500 to-red-500' },
  { min: 0.5694, label: '中到大烧', color: 'text-orange-400', badge: 'border-orange-400/50 bg-orange-400/15 text-orange-300', bar: 'from-amber-400 via-orange-500 to-rose-500' },
  { min: 0.1963, label: '小到中烧', color: 'text-amber-400',  badge: 'border-amber-400/50 bg-amber-400/15 text-amber-300',    bar: 'from-yellow-400 via-amber-500 to-orange-500' },
  { min: 0.105,  label: '小烧',     color: 'text-teal-300',   badge: 'border-teal-400/40 bg-teal-400/10 text-teal-300',       bar: 'from-teal-400 to-emerald-500' },
  { min: 0.02,   label: '微微烧',   color: 'text-emerald-400', badge: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300', bar: 'from-emerald-500 to-teal-500' },
  { min: -1,     label: '无火烧云', color: 'text-slate-500',  badge: 'border-slate-500/40 bg-slate-500/10 text-slate-400',    bar: 'from-slate-500 to-slate-600' },
]

export function scoreToLevel(score: number): Level {
  for (const l of LEVELS) {
    if (score >= l.min) return l
  }
  return LEVELS[LEVELS.length - 1] as Level
}

/** 等级序号（0-5，越大烧得越猛），用于"等级上调才重复推送"的比较 */
export function scoreToRank(score: number): number {
  const idx = LEVELS.findIndex(l => score >= l.min)
  const i = idx === -1 ? LEVELS.length - 1 : idx
  return LEVELS.length - 1 - i // LEVELS 从高到低排列，反转后大烧=5、无火烧云=0
}

/** rank → 该等级的分数下限（与 LEVELS 同源，避免阈值重复定义） */
export function rankToScoreFloor(rank: number): number {
  const idx = LEVELS.length - 1 - rank
  return LEVELS[idx]?.min ?? 0
}

/** 量表百分比（0-2.5 量程） */
export function scorePct(score: number): number {
  return Math.min(Math.max(score / 2.5, 0), 1) * 100
}

/** 气溶胶 AOD 展示颜色：越高越差 */
export function aodColor(aod: number | null): string {
  if (aod === null || Number.isNaN(aod)) return 'text-slate-500'
  if (aod > 0.8) return 'text-slate-300'
  if (aod > 0.4) return 'text-violet-400'
  if (aod > 0.2) return 'text-emerald-500'
  return 'text-emerald-400'
}

/** 气溶胶评价文字 */
export function aodLabel(aod: number | null): string {
  if (aod === null || Number.isNaN(aod)) return '无数据'
  if (aod > 0.8) return '浑浊'
  if (aod > 0.4) return '一般'
  if (aod > 0.2) return '较好'
  return '通透'
}
