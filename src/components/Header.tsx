import Image from 'next/image'
import { MapPin, Layers } from 'lucide-react'

export default function Header({ city, lat, lon }: { city: string; lat: number; lon: number }) {
  return (
    <header className="relative w-full h-[380px] overflow-hidden">
      {/* 底图：火烧云实拍 */}
      <div className="absolute inset-0">
        <Image
          src="/images/cover/sunset.jpg"
          alt={`${city}火烧云`}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        {/* 暮色融合：上下压暗，底部融入页面底色 */}
        <div className="absolute inset-0 bg-gradient-to-b from-dusk-950/80 via-dusk-950/10 to-dusk-950" />
        {/* 火烧云色调增强 */}
        <div className="absolute inset-0 bg-gradient-to-tr from-ember-500/25 via-transparent to-indigo-900/40 mix-blend-overlay" />
      </div>

      {/* 顶部遥测状态条 */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 sm:px-10 lg:px-16 py-6 font-mono-num text-[11px] uppercase tracking-[0.3em] text-white/60">
        <span className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ember-400" />
          </span>
          Live · 大气监测中
        </span>
        <span className="hidden sm:flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-ember-300" />
          {lat.toFixed(4)}°N / {lon.toFixed(4)}°E · {city}
        </span>
      </div>

      {/* 主标题区 */}
      <div className="absolute bottom-0 inset-x-0 px-6 sm:px-10 lg:px-16 pb-10">
        <p className="animate-rise font-mono-num text-xs sm:text-sm uppercase tracking-[0.45em] text-ember-300 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
          Nanjing Skyfire Observatory
        </p>
        <h1
          className="animate-rise mt-3 text-4xl sm:text-6xl font-bold tracking-[0.08em] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
          style={{ animationDelay: '0.15s' }}
        >
          {city}火烧云<span className="text-ember-gradient">监测</span>
        </h1>
        <p
          className="animate-rise mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-white/65"
          style={{ animationDelay: '0.3s' }}
        >
          为{city}的追光者服务——多源数据融合预判每一次日出日落的火烧云强度与大气通透度，科学等候那一片燃烧的天空。
        </p>
        <p
          className="animate-rise mt-3 flex items-center gap-2 font-mono-num text-[11px] uppercase tracking-[0.25em] text-white/40"
          style={{ animationDelay: '0.45s' }}
        >
          <Layers className="h-3.5 w-3.5 text-ember-300/70" />
          SunsetBot · Open-Meteo 自算
        </p>
      </div>

      {/* 地平线呼吸光晕 */}
      <div className="absolute bottom-0 left-1/2 h-24 w-[720px] max-w-full -translate-x-1/2 translate-y-1/2 rounded-full bg-ember-500/25 blur-[60px] animate-glow-pulse" />
    </header>
  )
}
