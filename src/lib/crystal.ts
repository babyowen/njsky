// 水晶天判定：空气特别通透、能见度特别高的"极品通透天"，适合拍城市远景/蓝天/高机位。
// 与火烧云是不同性质（火烧云要云，水晶天要净），故独立判定、用不同卡片推送。
import type { HourlyRow } from './db'

export interface CrystalAssessment {
  rank: number            // 0 普通 / 1 偏通透 / 2 水晶天 / 3 极品水晶天
  label: string
  time: number
  aod: number | null
  visibility: number | null
  cloudLow: number | null
  cloudTotal: number | null
}

export const CRYSTAL_LEVELS = [
  { rank: 3, label: '极品水晶天', color: 'text-cyan-300' },
  { rank: 2, label: '水晶天',     color: 'text-sky-400' },
  { rank: 1, label: '偏通透',     color: 'text-slate-300' },
  { rank: 0, label: '普通',       color: 'text-slate-500' },
] as const

/** 单点水晶天评级（阈值均可在此调整）。
 *  只看 AOD + 能见度，不看云量——有云的水晶天反而更有看头。 */
export function assessCrystal(p: {
  aod: number | null
  visibility: number | null
  cloudLow: number | null
  cloudTotal: number | null
  time: number
}): CrystalAssessment {
  const { aod, visibility, cloudLow, cloudTotal, time } = p
  let rank = 0

  if (aod !== null && visibility !== null) {
    // 极品：AOD 极低 + 能见度极高
    if (aod <= 0.12 && visibility >= 30000) {
      rank = 3
    }
    // 水晶天：AOD 低 + 能见度高
    else if (aod <= 0.18 && visibility >= 25000) {
      rank = 2
    }
    // 偏通透：空气不错但未达水晶天（不推送，仅内部参考）
    else if (aod <= 0.25 && visibility >= 20000) {
      rank = 1
    }
  }

  const label = (CRYSTAL_LEVELS.find(l => l.rank === rank) ?? CRYSTAL_LEVELS[3]).label
  return { rank, label, time, aod, visibility, cloudLow, cloudTotal }
}

/** 在一段时间范围内找"最通透"的时刻（取 AOD 最低且达标者） */
export function bestCrystalWindow(points: HourlyRow[]): CrystalAssessment | null {
  let best: CrystalAssessment | null = null
  for (const p of points) {
    const a = assessCrystal({
      aod: p.aod, visibility: p.visibility, cloudLow: p.cloud_low, cloudTotal: p.cloud_total, time: p.time,
    })
    if (a.rank < 2) continue
    if (best === null || a.rank > best.rank ||
        (a.rank === best.rank && (a.aod ?? 99) < (best.aod ?? 99))) {
      best = a
    }
  }
  return best
}
