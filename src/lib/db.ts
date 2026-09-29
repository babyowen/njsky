// SQLite 存储层（better-sqlite3，单文件零配置，替代原飞书多维表格）
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { env } from './env'

// ---------- 行类型 ----------

export interface EventRow {
  id: number
  event_time: number          // epoch ms
  event_type: string          // '日出' | '日落'
  golden: number | null       // 日出事件=黄金时刻结束；日落事件=黄金时刻开始
  blue: number | null         // 日出事件=蓝调开始(dawn)；日落事件=蓝调结束(dusk)
}

export interface ReadingRow {
  id: number
  event_id: number
  source: string              // sunsetbot_gfs | sunsetbot_ec | geovis | local
  score: number | null        // 0-2.5
  level: string | null        // 无火烧云/微微烧/小烧/小到中烧/中到大烧/大烧（对齐星图云官方六级）
  label: string | null        // 源原始评价文字
  aod: number | null
  image_url: string | null    // SunsetBot 大气截面图
  run_info: string | null     // 模式时次，如 "GFS 2026092718z"
  fetched_at: number
  raw: string | null
}

export interface FactorRow {
  event_id: number
  cloud_low: number | null
  cloud_mid: number | null
  cloud_high: number | null
  cloud_total: number | null
  visibility: number | null   // 米
  humidity: number | null     // %
  aod: number | null
  pm25: number | null
  score: number | null        // 自算指数
  detail: string | null       // 评分分解 JSON
  fetched_at: number
}

export interface HourlyRow {
  time: number                // epoch ms 整点
  cloud_total: number | null
  cloud_low: number | null
  cloud_mid: number | null
  cloud_high: number | null
  visibility: number | null
  humidity: number | null
  aod: number | null
  pm25: number | null
  temp: number | null
  feels_like: number | null
  precip_prob: number | null
  weather_code: number | null
  wind: number | null
}

export interface CollectLogRow {
  id: number
  finished_at: number
  ok: number
  sunsetbot: number
  geovis: number
  local: number
  hourly: number
  images: number              // 截面图缓存成功数
  errors: string | null       // JSON 数组
}

// ---------- 连接与建表 ----------

const dbPath = env.DB_PATH || path.join(process.cwd(), 'data', 'njsky.db')

function createDb(): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const d = new Database(dbPath)
  d.pragma('journal_mode = WAL')
  // 多进程（含 Next 构建期的 page-data worker）可能同时初始化同一库，
  // 设置 busy_timeout 让锁等待而非立即报 SQLITE_BUSY。
  d.pragma('busy_timeout = 5000')
  d.pragma('synchronous = NORMAL')

  d.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_time INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  golden INTEGER,
  blue INTEGER,
  UNIQUE(event_time, event_type)
);
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  source TEXT NOT NULL,
  score REAL,
  level TEXT,
  label TEXT,
  aod REAL,
  image_url TEXT,
  run_info TEXT,
  fetched_at INTEGER NOT NULL,
  raw TEXT
);
CREATE INDEX IF NOT EXISTS idx_readings_event ON readings(event_id, source, fetched_at);
CREATE TABLE IF NOT EXISTS factors (
  event_id INTEGER PRIMARY KEY REFERENCES events(id),
  cloud_low REAL, cloud_mid REAL, cloud_high REAL, cloud_total REAL,
  visibility REAL, humidity REAL, aod REAL, pm25 REAL,
  score REAL, detail TEXT, fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS hourly (
  time INTEGER PRIMARY KEY,
  cloud_total REAL, cloud_low REAL, cloud_mid REAL, cloud_high REAL,
  visibility REAL, humidity REAL, aod REAL, pm25 REAL,
  temp REAL, feels_like REAL, precip_prob REAL, weather_code INTEGER, wind REAL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS event_state (
  key TEXT PRIMARY KEY,
  last_rank INTEGER NOT NULL,
  last_score REAL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS collect_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finished_at INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  sunsetbot INTEGER NOT NULL DEFAULT 0,
  geovis INTEGER NOT NULL DEFAULT 0,
  local INTEGER NOT NULL DEFAULT 0,
  hourly INTEGER NOT NULL DEFAULT 0,
  images INTEGER NOT NULL DEFAULT 0,
  errors TEXT
);
CREATE INDEX IF NOT EXISTS idx_collect_logs_time ON collect_logs(finished_at);
`)

  // 老库迁移：为 hourly 补齐实况列（幂等）
  {
    const cols = d.prepare(`PRAGMA table_info(hourly)`).all() as Array<{ name: string }>
    for (const [col, ddl] of [
      ['temp', 'temp REAL'],
      ['feels_like', 'feels_like REAL'],
      ['precip_prob', 'precip_prob REAL'],
      ['weather_code', 'weather_code INTEGER'],
      ['wind', 'wind REAL'],
    ] as const) {
      if (!cols.some(c => c.name === col)) {
        d.prepare(`ALTER TABLE hourly ADD COLUMN ${ddl}`).run()
      }
    }
  }

  // 老库迁移：等级标签对齐星图云官方六级（一次性，幂等）
  {
    const done = d.prepare(`SELECT value FROM meta WHERE key='level_v2'`).get()
    if (!done) {
      d.prepare(`
        UPDATE readings SET level = CASE
          WHEN score >= 0.9243 THEN '大烧'
          WHEN score >= 0.5694 THEN '中到大烧'
          WHEN score >= 0.1963 THEN '小到中烧'
          WHEN score >= 0.105  THEN '小烧'
          WHEN score >= 0.02   THEN '微微烧'
          ELSE '无火烧云'
        END WHERE score IS NOT NULL
      `).run()
      d.prepare(`INSERT INTO meta (key, value) VALUES ('level_v2', '1') ON CONFLICT(key) DO NOTHING`).run()
    }
  }

  return d
}

// 单例：缓存到 globalThis，避免 next dev 热重载时重复建立连接/重复跑建表
const g = globalThis as unknown as { __njskyDb?: Database.Database }
export const db: Database.Database = g.__njskyDb ?? (g.__njskyDb = createDb())

// ---------- 事件 ----------

const stmtUpsertEvent = db.prepare(`
  INSERT INTO events (event_time, event_type, golden, blue) VALUES (?, ?, ?, ?)
  ON CONFLICT(event_time, event_type) DO UPDATE SET golden=excluded.golden, blue=excluded.blue
`)
const stmtEventId = db.prepare(`SELECT id FROM events WHERE event_time=? AND event_type=?`)

export function upsertEvent(e: Omit<EventRow, 'id'>): number {
  stmtUpsertEvent.run(e.event_time, e.event_type, e.golden, e.blue)
  const row = stmtEventId.get(e.event_time, e.event_type) as { id: number }
  return row.id
}

/** 查找指定类型、与给定时间相差不超过 toleranceMs 的事件 */
export function findEventNear(eventType: string, timeMs: number, toleranceMs = 6 * 3600_000): EventRow | null {
  const row = db.prepare(`
    SELECT * FROM events WHERE event_type=? AND ABS(event_time - ?) <= ?
    ORDER BY ABS(event_time - ?) LIMIT 1
  `).get(eventType, timeMs, toleranceMs, timeMs) as EventRow | undefined
  return row ?? null
}

export function eventsBetween(fromMs: number, toMs: number): EventRow[] {
  return db.prepare(`
    SELECT * FROM events WHERE event_time >= ? AND event_time <= ? ORDER BY event_time
  `).all(fromMs, toMs) as EventRow[]
}

/** 下一个未发生的指定类型事件（临场采集调度用） */
export function nextEvent(eventType: string, afterMs: number): EventRow | null {
  const row = db.prepare(`
    SELECT * FROM events WHERE event_type=? AND event_time > ? ORDER BY event_time LIMIT 1
  `).get(eventType, afterMs) as EventRow | undefined
  return row ?? null
}

// ---------- 读数 ----------

const stmtInsertReading = db.prepare(`
  INSERT INTO readings (event_id, source, score, level, label, aod, image_url, run_info, fetched_at, raw)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

export function insertReading(r: Omit<ReadingRow, 'id'>): void {
  stmtInsertReading.run(r.event_id, r.source, r.score, r.level, r.label, r.aod, r.image_url, r.run_info, r.fetched_at, r.raw)
}

/** 某事件各来源的最新读数（每个 source 一条） */
export function latestReadings(eventId: number): ReadingRow[] {
  return db.prepare(`
    SELECT r.* FROM readings r
    JOIN (SELECT source, MAX(fetched_at) AS mx FROM readings WHERE event_id=? GROUP BY source) t
      ON t.source=r.source AND t.mx=r.fetched_at
    WHERE r.event_id=?
  `).all(eventId, eventId) as ReadingRow[]
}

// ---------- 因子 ----------

export function upsertFactors(f: FactorRow): void {
  db.prepare(`
    INSERT INTO factors (event_id, cloud_low, cloud_mid, cloud_high, cloud_total,
      visibility, humidity, aod, pm25, score, detail, fetched_at)
    VALUES (@event_id, @cloud_low, @cloud_mid, @cloud_high, @cloud_total,
      @visibility, @humidity, @aod, @pm25, @score, @detail, @fetched_at)
    ON CONFLICT(event_id) DO UPDATE SET
      cloud_low=excluded.cloud_low, cloud_mid=excluded.cloud_mid, cloud_high=excluded.cloud_high,
      cloud_total=excluded.cloud_total, visibility=excluded.visibility, humidity=excluded.humidity,
      aod=excluded.aod, pm25=excluded.pm25, score=excluded.score, detail=excluded.detail,
      fetched_at=excluded.fetched_at
  `).run(f)
}

export function getFactors(eventId: number): FactorRow | null {
  const row = db.prepare(`SELECT * FROM factors WHERE event_id=?`).get(eventId) as FactorRow | undefined
  return row ?? null
}

// ---------- 逐小时（曲线图用） ----------

export function replaceHourly(rows: HourlyRow[]): void {
  const stmt = db.prepare(`
    INSERT INTO hourly (time, cloud_total, cloud_low, cloud_mid, cloud_high, visibility, humidity, aod, pm25,
      temp, feels_like, precip_prob, weather_code, wind)
    VALUES (@time, @cloud_total, @cloud_low, @cloud_mid, @cloud_high, @visibility, @humidity, @aod, @pm25,
      @temp, @feels_like, @precip_prob, @weather_code, @wind)
    ON CONFLICT(time) DO UPDATE SET
      cloud_total=excluded.cloud_total, cloud_low=excluded.cloud_low, cloud_mid=excluded.cloud_mid,
      cloud_high=excluded.cloud_high, visibility=excluded.visibility, humidity=excluded.humidity,
      aod=excluded.aod, pm25=excluded.pm25,
      temp=excluded.temp, feels_like=excluded.feels_like, precip_prob=excluded.precip_prob,
      weather_code=excluded.weather_code, wind=excluded.wind
  `)
  const tx = db.transaction((rs: HourlyRow[]) => { for (const r of rs) stmt.run(r) })
  tx(rows)
}

export function hourlyBetween(fromMs: number, toMs: number): HourlyRow[] {
  return db.prepare(`SELECT * FROM hourly WHERE time >= ? AND time <= ? ORDER BY time`).all(fromMs, toMs) as HourlyRow[]
}

// ---------- 事件状态（上次采集时的等级快照，变化驱动推送的判定依据） ----------

export interface EventStateRow {
  key: string           // 'event:{id}' / 'crystal:{date}'
  last_rank: number     // 上次采集时的综合指数等级序号
  last_score: number | null
  updated_at: number
}

export function getEventState(key: string): EventStateRow | null {
  const row = db.prepare(`SELECT * FROM event_state WHERE key=?`).get(key) as EventStateRow | undefined
  return row ?? null
}

export function setEventState(key: string, rank: number, score: number | null, updatedAt: number): void {
  db.prepare(`
    INSERT INTO event_state (key, last_rank, last_score, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET last_rank=excluded.last_rank, last_score=excluded.last_score, updated_at=excluded.updated_at
  `).run(key, rank, score, updatedAt)
}

// ---------- 元数据与清理 ----------

export function getMeta(key: string): string | null {
  const row = db.prepare(`SELECT value FROM meta WHERE key=?`).get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setMeta(key: string, value: string): void {
  db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, value)
}

/** 清理：小时曲线保留 8 天，读数保留 90 天，采集日志保留 14 天 */
export function prune(nowMs: number): void {
  db.prepare(`DELETE FROM hourly WHERE time < ?`).run(nowMs - 8 * 24 * 3600_000)
  db.prepare(`DELETE FROM readings WHERE fetched_at < ?`).run(nowMs - 90 * 24 * 3600_000)
  db.prepare(`DELETE FROM collect_logs WHERE finished_at < ?`).run(nowMs - 14 * 24 * 3600_000)
}

// ---------- 采集日志 ----------

export function insertCollectLog(l: Omit<CollectLogRow, 'id'>): void {
  db.prepare(`
    INSERT INTO collect_logs (finished_at, ok, sunsetbot, geovis, local, hourly, images, errors)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(l.finished_at, l.ok, l.sunsetbot, l.geovis, l.local, l.hourly, l.images, l.errors)
}

export function recentCollectLogs(sinceMs: number): CollectLogRow[] {
  return db.prepare(`
    SELECT * FROM collect_logs WHERE finished_at >= ? ORDER BY finished_at DESC
  `).all(sinceMs) as CollectLogRow[]
}
