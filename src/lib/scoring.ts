// 自算火烧云指数（本站自有算法，原料来自 Open-Meteo 的 GFS 云量与 CAMS 气溶胶）
//
// 物理依据（与 SunsetBot 官方说明一致）：
//   ① 头顶有"幕布"：中高层云适量（中云为主、高云为辅）时最易被低角度阳光染色；
//      云太少没东西染，太厚则光线无法穿透。
//   ② 地平线方向不挡光：低云越多，日落/日出方向的光线被遮挡越严重。
//   ③ 空气通透：气溶胶(AOD)低、能见度高、湿度低，颜色才纯净。
//
// 输出与 SunsetBot 同量纲的 0-2.5 指数，方便多源并排对比。
//
// 指数 = 2.5 × 幕布 × 透光 × 通透 × 光路   （四个 0-1 因子相乘，任一为 0 即归零）

import { scoreToLevel } from './levels'

/** 太阳方向光路上的一个采样点（按距离升序传入，距离定义见 openmeteo.PATH_DIST_KM） */
export interface PathCloudInput {
  cloudLow: number | null
  cloudMid: number | null
  cloudHigh: number | null
}

export interface FactorInput {
  cloudLow: number | null    // %
  cloudMid: number | null    // %
  cloudHigh: number | null   // %
  visibility: number | null  // 米
  humidity: number | null    // %
  aod: number | null
  /** 太阳方位角方向 80/200/400km 处的云量；缺省或为空则不启用光路因子（=1） */
  path?: Array<PathCloudInput | null> | undefined
}

export interface ScoreDetail {
  canvas: number       // 幕布强度（中高云加权云量 0-100）
  canvasScore: number  // 幕布得分 0-1
  blockFactor: number  // 低云挡光因子 0-1
  clarity: number      // 通透度 0-1
  horizonFactor: number // 光路因子：太阳方向云墙越少越高 0-1
}

export interface ScoreResult {
  score: number
  level: string
  detail: ScoreDetail
}

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(Math.max(v, lo), hi)
}

/** 三角评分：x ≤ peak 时线性升到 1，x 从 peak 到 zero 线性降到 0 */
function tent(x: number, peak: number, zero: number): number {
  if (x <= peak) return clamp(x / peak)
  return clamp((zero - x) / (zero - peak))
}

/**
 * AOD 评分：气溶胶对火烧云是"适量最佳"而非"越少越好"。
 *   - 0.15~0.35 为理想平台（满分）：适量粒子增强散射染色
 *   - 低于 0.15 缓慢降到 0.7：极通透但缺乏散射粒子，颜色偏淡
 *   - 高于 0.35 线性降到 0（1.0 处归零）：天空发灰，饱和度与亮度下降
 * 依据 SunsetBot 对 AOD 的说明：气溶胶过大时光线被明显散射吸收，天空看起来污浊。
 */
function aodScore(aod: number): number {
  if (aod <= 0.35) return aod < 0.15 ? 0.7 + 0.3 * (aod / 0.15) : 1.0
  return clamp((1.0 - aod) / 0.65)
}

export function computeLocalScore(f: FactorInput): ScoreResult | null {
  // 云量三项缺一即无法评估（AOD/能见度缺失时按中性 0.5 处理）
  if (f.cloudLow === null || f.cloudMid === null || f.cloudHigh === null) return null

  // ① 幕布：中云、高云分别按"适量最佳"三角评分（云太少没东西染，太厚光线无法穿透）
  //    中云峰值 40%、75% 以上归零；高云峰值 50%、85% 以上归零
  const canvasScore = 0.65 * tent(f.cloudMid, 40, 75) + 0.35 * tent(f.cloudHigh, 50, 85)
  const canvas = 0.6 * f.cloudMid + 0.4 * f.cloudHigh

  // ② 低云挡光：低云 100%（满天低云）时归零——阴天不可能有火烧云
  const blockFactor = Math.pow(1 - clamp(f.cloudLow / 100), 1.2)

  // ③ 通透度：AOD 为主（梯形，适量最佳）、能见度为辅，湿度近饱和时打折
  const aod = f.aod === null ? 0.5 : aodScore(f.aod)
  const visScore = f.visibility === null ? 0.5 : clamp(f.visibility / 30000)
  const humFactor = f.humidity !== null && f.humidity >= 85 ? 0.7 : 1
  const clarity = clamp((0.6 * aod + 0.4 * visScore) * humFactor)

  // ④ 光路：火烧云是"被低角度阳光点亮的云"，阳光以掠射角从太阳方向数百公里外射来。
  //    地球曲率+折射下光线高度随距离爬升：80km 处≈0.4km（只有低云能挡）、200km≈2.4km
  //    （低/中云挡）、400km≈9.4km（中/高云挡）。任一处是 100% 云墙 → 光路切断 → 归零。
  //    采样点数据缺失时跳过该点，不因缺数据误伤；指数近处大远处小（近处云墙更致命）。
  let horizonFactor = 1
  if (f.path && f.path.length > 0) {
    const exponents = [0.5, 0.4, 0.3]
    f.path.forEach((p, i) => {
      if (!p || horizonFactor === 0) return
      const layers = i === 0 ? [p.cloudLow]
        : i === 1 ? [p.cloudLow, p.cloudMid]
        : [p.cloudMid, p.cloudHigh]
      const vals = layers.filter((v): v is number => v !== null)
      if (vals.length === 0) return
      horizonFactor *= Math.pow(1 - clamp(Math.max(...vals) / 100), exponents[i] ?? 0.3)
    })
    horizonFactor = clamp(horizonFactor)
  }

  // 四因子相乘，不设保底：任一条件不成立（阴天 / 重度雾霾 / 光路云墙）即不可能有火烧云
  const score = Math.round(2.5 * canvasScore * blockFactor * clarity * horizonFactor * 1000) / 1000

  return {
    score,
    level: scoreToLevel(score).label,
    detail: {
      canvas: Math.round(canvas * 10) / 10,
      canvasScore: Math.round(canvasScore * 100) / 100,
      blockFactor: Math.round(blockFactor * 100) / 100,
      clarity: Math.round(clarity * 100) / 100,
      horizonFactor: Math.round(horizonFactor * 100) / 100,
    },
  }
}
