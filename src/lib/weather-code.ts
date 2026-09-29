// WMO 天气代码 → 中文标签与图标（供实况展示）
import { Sun, SunMedium, CloudSun, Cloudy, CloudFog, CloudDrizzle, CloudRain, Snowflake, CloudLightning, CloudHail, type LucideIcon } from 'lucide-react'

export interface WeatherInfo {
  label: string
  Icon: LucideIcon
}

export function weatherCodeInfo(code: number | null): WeatherInfo {
  if (code === null) return { label: '未知', Icon: Cloudy }
  if (code === 0) return { label: '晴', Icon: Sun }
  if (code === 1) return { label: '大部晴朗', Icon: SunMedium }
  if (code === 2) return { label: '局部多云', Icon: CloudSun }
  if (code === 3) return { label: '阴', Icon: Cloudy }
  if (code === 45 || code === 48) return { label: '雾', Icon: CloudFog }
  if (code >= 51 && code <= 57) return { label: '毛毛雨', Icon: CloudDrizzle }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: code >= 80 ? '阵雨' : '雨', Icon: CloudRain }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: '雪', Icon: Snowflake }
  if (code >= 95) return { label: code === 95 ? '雷暴' : '雷暴伴冰雹', Icon: code === 95 ? CloudLightning : CloudHail }
  return { label: '多云', Icon: Cloudy }
}
