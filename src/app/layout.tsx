import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '南京火烧云监测',
  description: '南京火烧云与空气质量多源融合预测：SunsetBot / 本站自算（Open-Meteo）',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className="antialiased">{children}</body>
    </html>
  )
}
