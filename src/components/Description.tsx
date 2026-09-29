import { BookOpen, Database, BellRing, Camera, TriangleAlert } from 'lucide-react'

/** 网站说明：数据来源、自算算法、推送规则、免责声明 */
export default function Description() {
  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-2.5">
        <BookOpen className="h-5 w-5 text-ember-400" />
        <h3 className="text-lg font-semibold tracking-wider text-white">本站说明</h3>
      </div>

      <div className="mt-5 grid gap-6 text-sm leading-relaxed text-slate-400 md:grid-cols-2">
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 font-medium text-slate-200">
            <Database className="h-4 w-4 text-sky-400" />数据来源（多源融合，不做平均）
          </h4>
          <ul className="list-inside space-y-1.5 text-slate-400">
            <li>
              <a href="https://sunsetbot.top" target="_blank" rel="noopener noreferrer" className="text-sky-300 underline decoration-sky-300/30 underline-offset-2 hover:text-sky-200">SunsetBot</a>
              ：专业火烧云分析站，基于 NCEP-GFS/ECMWF 云况与 CAMS 霾分布。
            </li>
            <li>
              <span className="text-slate-300">本站自算</span>：基于
              <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="text-sky-300 underline decoration-sky-300/30 underline-offset-2 hover:text-sky-200"> Open-Meteo </a>
              的分层云量（GFS）与气溶胶（CAMS）按物理模型计算，算法完全公开（见下）。
            </li>
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            三个来源相互独立，并排展示、按 0-2.5 同一量纲对比。综合建议取各源最高值（宁杀错不放过）；当源间差值 ≥0.3 时标注「源间分歧」，此时请结合截面图与实时云图自行判断。
          </p>
        </section>

        <section>
          <h4 className="mb-2 flex items-center gap-1.5 font-medium text-slate-200">
            <Camera className="h-4 w-4 text-amber-400" />自算指数的物理依据
          </h4>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>头顶有「幕布」：中高层云适量（约 30~60%）时最易被低角度阳光染色；</li>
            <li>地平线方向不挡光：低云越少，日落/日出方向的光路越通畅；</li>
            <li>空气通透：气溶胶（AOD）低、能见度高、湿度低，颜色才纯净。</li>
          </ol>
          <p className="mt-2 text-xs text-slate-500">
            等级划分（对齐星图云官方）：无火烧云 &lt;0.02 · 微微烧 &lt;0.105 · 小烧 &lt;0.1963 · 小到中烧 &lt;0.5694 · 中到大烧 &lt;0.9243 · 大烧 ≥0.9243。
            页面同时给出每个事件的黄金时刻与蓝调时刻（本地天文计算），方便安排拍摄。
          </p>
        </section>

        <section>
          <h4 className="mb-2 flex items-center gap-1.5 font-medium text-slate-200">
            <BellRing className="h-4 w-4 text-rose-400" />达标推送（飞书）
          </h4>
          <p>
            采集即触发、达标就推：每次采集后，未来 3 天内任一事件综合指数达到「小到中烧」即推，重复推送时会标注较上次是上调、持平还是下调。
          </p>
          <p className="mt-2">
            另有<span className="text-sky-300">水晶天</span>推送（蓝色卡片）：当空气特别通透、能见度特别高时提醒，适合拍城市远景与蓝天。
          </p>
        </section>

        <section>
          <h4 className="mb-2 flex items-center gap-1.5 font-medium text-slate-200">
            <TriangleAlert className="h-4 w-4 text-yellow-400" />免责与建议
          </h4>
          <p>
            火烧云预测本质是对数值预报的二次解读，天然存在不确定性，越临近越准。
            SunsetBot 官方用再分析数据统计过预报上限，可参考其
            <a href="https://sunsetbot.top/reanalysis/" target="_blank" rel="noopener noreferrer" className="text-sky-300 underline decoration-sky-300/30 underline-offset-2 hover:text-sky-200"> 准确率页面</a>。
            出门前建议再对照实时卫星云图；手机端可配合「莉景天气」小程序交叉验证。
          </p>
          <p className="mt-2 text-xs text-slate-500">
            数据采集节奏：每日 01:45 / 08:45 / 13:45 / 20:45（对齐 GFS 更新窗口）。
          </p>
        </section>
      </div>
    </div>
  )
}
