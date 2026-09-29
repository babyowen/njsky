// 环境变量读取（唯一权威来源）
// 所有变量均有合理默认值，不配 .env.local 也能跑通基础功能

function opt(name: string, fallback = ''): string {
  const v = process.env[name]
  return v === undefined || v === '' ? fallback : v
}

function num(name: string, fallback: number): number {
  const v = parseFloat(opt(name))
  return Number.isFinite(v) ? v : fallback
}

export const env = {
  /** SunsetBot 查询城市名（格式：省份-城市） */
  SUNSETBOT_CITY: opt('SUNSETBOT_CITY', '江苏省-南京'),
  /** 观测点经纬度 */
  CITY_LAT: num('CITY_LAT', 32.0603),
  CITY_LON: num('CITY_LON', 118.7969),
  CITY_NAME: opt('CITY_NAME', '南京'),
  /** IANA 时区名，仅影响展示与调度窗口判断 */
  TZ_NAME: opt('TZ_NAME', 'Asia/Shanghai'),
  /** 星图云火烧云官方 API token（可选） */
  GEOVIS_TOKEN: opt('GEOVIS_TOKEN'),
  /** 飞书应用凭证（bot 身份推送，二选一即可：填了才启用推送） */
  FEISHU_APP_ID: opt('FEISHU_APP_ID'),
  FEISHU_APP_SECRET: opt('FEISHU_APP_SECRET'),
  /** 飞书推送接收人 open_id */
  FEISHU_USER_ID: opt('FEISHU_USER_ID'),
  /** 推送触发阈值（0-2.5 指数，0.1963 = 小到中烧） */
  PUSH_THRESHOLD: num('PUSH_THRESHOLD', 0.1963),
  /** 管理接口密钥（/api/admin/*） */
  ADMIN_SECRET: opt('ADMIN_SECRET'),
  /** SQLite 文件路径 */
  DB_PATH: opt('DB_PATH'),
} as const
