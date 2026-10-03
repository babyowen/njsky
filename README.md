# 南京火烧云监测（njsky）

多源融合的南京火烧云（朝霞/晚霞）与大气通透度预测网站。**前后端一体，单进程部署，自带采集调度与本地存储**——不再需要独立的 Python 脚本和飞书多维表格。

## 架构

```
┌───────────────────── 一个 Next.js 进程 ─────────────────────┐
│ node-cron 调度器（随服务启动，每 1 小时整点心跳）            │
│   └─ 采集窗口 02 / 09 / 14 / 21 点（GFS 更新完成后）+ 临场    │
│        │                                                    │
│        ▼                                                    │
│ 数据源插件层（src/lib/sources/，加源只需加一个文件）          │
│   ├─ sunsetbot.ts   SunsetBot 抓取（GFS+EC，容错改版）       │
│   └─ openmeteo.ts   Open-Meteo 分层云量+CAMS气溶胶（免key）  │
│        │  + scoring.ts 本站自算指数（物理模型，公开可调）    │
│        ▼                                                    │
│ SQLite 单文件（data/njsky.db，自动建表/迁移/清理）           │
│        │                                                    │
│        ▼                                                    │
│ API 路由 → 深色"大气观测站"前端（SWR 轮询）                  │
│                                                             │
│ 达标推送：飞书 OpenAPI（bot 身份）→ 单聊卡片               │
│   火烧云（红/橙卡）：未来3天达标即推，等级上调再推+临场一次    │
│   水晶天（蓝卡）：空气极品通透时推送                         │
└─────────────────────────────────────────────────────────────┘
```

> **数据源现状（2026-09）**：
> - **SunsetBot** 对数据中心 IP 有 CDN 风控（间歇 525），靠多轮重试对抗（数据来源仅存 image_url 记录，不再下载图片）。
> - **星图云**火烧云 API 已改为付费产品，token 留空即自动跳过（代码保留，付费后填入即用）。

## 快速开始

```bash
cd web
npm install
cp .env.example .env.local   # 按需填写（全部留空也能跑）
npm run build
npm start                    # http://localhost:3002
```

首次启动约 20 秒后自动完成第一轮采集，之后每天 4 个窗口定时采集。

### 手动采集 / 测试推送

```bash
npm run collect                                   # 命令行采集一轮（调试用）
curl -X POST -H 'x-admin-key: 你的ADMIN_SECRET' http://localhost:3002/api/admin/refresh
curl -X POST -H 'x-admin-key: 你的ADMIN_SECRET' http://localhost:3002/api/admin/push-test
```

## 配置（.env.local）

| 变量 | 必填 | 说明 |
|---|---|---|
| `SUNSETBOT_CITY` | 否 | SunsetBot 查询名，默认 `江苏省-南京` |
| `CITY_LAT` / `CITY_LON` / `CITY_NAME` | 否 | 观测点坐标与城市名 |
| `GEOVIS_TOKEN` | 可选 | 星图云火烧云 API token，见下 |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 可选 | 飞书自建应用凭证，配了才有推送（见下「飞书推送配置」） |
| `FEISHU_USER_ID` | 可选 | 飞书推送接收人 open_id（`lark-cli contact +get-user` 查自己，ou_ 开头） |
| `PUSH_THRESHOLD` | 否 | 火烧云推送阈值，默认 0.1963（小到中烧） |
| `ADMIN_SECRET` | 可选 | 管理接口密钥 |
| `DB_PATH` | 否 | SQLite 路径，默认 `./data/njsky.db` |

### 星图云 token（付费产品，可不接）

> 截至 2026-09：星图云火烧云预报已**取消免费额度**，需「按需购买」或「包月套餐」。
> 不付费也完全能用——token 留空时系统自动跳过该源，SunsetBot + 自算两源照常工作。

如已购买套餐：
1. 控制台 →「申请 token」（服务密钥）
2. 填入 `.env.local` 的 `GEOVIS_TOKEN`，重启服务
3. 页面底部「运行日志」里 `星图云` 计数 >0 即接入成功
4. 查套餐余量：`curl "https://api.open.geovisearth.com/v2/app/getStandardRemain/list?token=你的token"`

### 飞书推送配置（约 3 分钟，可选）

推送走**飞书 OpenAPI 直连**（`src/lib/feishu.ts`），不依赖任何外部 CLI，服务器上填好凭证即用：

1. 打开[飞书开发者后台](https://open.feishu.cn/app) → 你的自建应用 →「凭证与基础信息」，复制 **App ID** 和 **App Secret**
2. 应用「权限管理」开通 **`im:message`**（以应用身份发消息）；bot 给自己发单聊无需用户授权
3. 把三个值填入 `.env.local`：`FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_USER_ID`（接收人 open_id）
4. 测试：
   - 本地开发：`npx tsx --env-file-if-exists=.env.local scripts/push-test.ts`
   - 服务器/Docker（scripts 不进镜像，用 admin API）：
     ```bash
     curl -X POST -H "x-admin-key: 你的ADMIN_SECRET" http://127.0.0.1:3002/api/admin/push-test
     ```
   返回 `{"ok":true}` 即通

> bot 身份用 appId+appSecret 自动换取 tenant_access_token（进程内缓存 2 小时、失效自动重取），**不会像 user OAuth 那样过期**，适合服务器长期运行。

## 多源融合策略

- 来源统一映射到 0-2.5 同量纲（无火烧云/微微烧/小烧/小到中烧/中到大烧/大烧），**并排展示、不做平均**；
- 综合建议取各源**最高值**（宁杀错不放过）；源间差值 ≥0.3 时页面标注「源间分歧」；
- 本站自算算法（`src/lib/scoring.ts`）：幕布（中高云适量三角评分）× 透光（低云挡光惩罚）× 通透（AOD 梯形"适量最佳"+能见度+湿度）× 光路（沿事件时刻太阳方位角采样 80/200/400km 云墙，近低云、远中高云，任一 100% 云墙归零），四因子相乘、任一归零即不烧，无保底。公式与权重全公开可调。

## 推送规则（采集即触发，达标就推）

**核心机制**：定时采集 → 把当前达标的火烧云事件和水晶天各推一条。**不做去重、不看数据是否变化**——采集本身有节制（固定 02/09/14/21 整点 + 临场窗口，一天约 6 次），所以天然不轰炸；临场那次采集即承担"临场提醒"。

```
定时采集（02/09/14/21 点 + 日出/日落前 75~150 分钟临场）
   ↓ 采集完成
未来 3 天每个事件：综合指数 ≥ 小到中烧（0.1963）→ 推
未来 12h 白天水晶天：AOD/能见度达标 → 推
```

- 重复推送时卡片标注「较上次上调 / 持平 / 下调」，信息量比静默更高
- **火烧云（红/橙卡片）**：综合指数 = 各源最高值，任一源达小到中烧即推
- **水晶天（蓝色卡片）**：AOD≤0.18 且能见度≥25km（极品 AOD≤0.12 且≥30km），不看云量

> 阈值在 `src/lib/crystal.ts`、`PUSH_THRESHOLD` 环境变量可调。

## 部署到 VPS

### 方式一：Docker（推荐，见 [DEPLOY.md](./DEPLOY.md)）

```bash
cp .env.example .env.local   # 填 FEISHU_APP_SECRET 等
vi .env.local && chmod 600 .env.local
mkdir -p data
docker compose up -d --build
```
单容器（网站 + 内置调度器同进程），`data/` 卷持久化 SQLite，随 Docker 开机自启。国内 VPS 也能构建：基础镜像走加速器、npm 走淘宝镜像、better-sqlite3 源码编译（不依赖 GitHub）。

### 方式二：直接跑（配合 pm2）

```bash
npm ci && npm run build
pm2 start npm --name njsky -- start
```

注意：
- **无外部二进制依赖**：采集、推送全部走 Node 内置 fetch，服务器只需 Node 18+（建议 20+）和 `.env.local` 里的凭证；
- `data/njsky.db` 是全部持久化数据，备份=复制该文件；
- 页面底部「运行日志」面板可查看最近 48 小时每轮采集的各来源成功数与错误明细，数据异常先看这里；
- 服务器时区随意：调度窗口与日出日落计算均显式按城市时区 `TZ_NAME`（默认 Asia/Shanghai）判定，不依赖服务器本地时区（UTC 的 VPS 亦可）；
- 采集窗口：固定 02 / 09 / 14 / 21 整点（GFS 更新完成后）+ 临场采集（日出/日落前 75~150 分钟，让临场提醒用最新预报）；1 小时心跳检查，数据更新慢（SunsetBot 一天4次、GFS 6小时一轮），无需高频轮询；
- 页面端口 3002，可在 package.json 中改。

## 目录结构

```
web/
├── Dockerfile                 # 多阶段构建（better-sqlite3 源码编译）
├── docker-compose.yml         # 单容器编排（端口/数据卷/env_file）
├── .dockerignore
├── DEPLOY.md                  # 宝塔 + Docker 部署清单
├── src/
│   ├── instrumentation.ts     # 启动钩子：拉起调度器
│   ├── lib/
│   │   ├── env.ts             # 环境变量（唯一权威来源）
│   │   ├── db.ts              # SQLite 存储层
│   │   ├── collect.ts         # 采集编排
│   │   ├── scheduler.ts       # 定时调度
│   │   ├── push.ts            # 达标推送调度（飞书卡片）
│   │   ├── feishu.ts          # 飞书 OpenAPI 客户端（token 缓存 + 发消息）
│   │   ├── scoring.ts         # 自算火烧云指数
│   │   ├── fusion.ts          # 多源融合
│   │   ├── sun.ts             # 日出日落/黄金蓝调时刻
│   │   └── sources/           # 数据源插件（sunsetbot/geovis/openmeteo）
│   ├── app/api/               # forecast / history / factors / logs / admin
│   └── components/            # 事件卡、因子面板、逐小时曲线、历史表、运行日志
├── scripts/collect-once.ts    # 命令行单次采集
└── data/njsky.db              # SQLite（自动生成，勿提交）
```

## 数据来源与致谢

- [SunsetBot](https://sunsetbot.top)：火烧云分析
- [Open-Meteo](https://open-meteo.com)：免费气象与空气质量（CAMS）数据
