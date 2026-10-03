# 部署指南（腾讯云 VPS + 宝塔面板 + Docker）

目标：用 Docker 跑应用容器，宝塔负责反向代理与 SSL。全程不需要 registry，也不依赖 GitHub。

---

## 一、一次性准备

### 1. 宝塔安装 Docker
宝塔面板 → 软件商店 → 搜索并安装 **Docker 管理器**。

### 2. 配置镜像加速（关键，解决 Docker Hub 拉不动）
宝塔 → Docker → 配置（或设置）→ **镜像加速**，填入加速地址（腾讯云控制台的容器镜像服务里可获取，CVM 常用 `https://mirror.ccs.tencentyun.com`，以你控制台实际显示的为准）。

也可以在终端直接写 `/etc/docker/daemon.json`：
```json
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
```
然后 `systemctl restart docker`。

### 3. 升级 docker-compose 到 v2
宝塔软件商店里把 Docker Compose 升到 v2（v1 老版本在宝塔里会出现"获取不到编排列表"的问题）。
终端验证：`docker compose version`（注意是 `docker compose`，不是带横杠的 `docker-compose`）。

### 4. 安全组 / 防火墙
- 放行 **80、443**（给网站和 SSL）
- **不要**放行 3002（它只绑定本机回环，由宝塔 nginx 反代）

---

## 二、获取代码

### 方式 A（推荐，更新方便）：用 Gitee 仓库
在宝塔终端执行（公开仓库，HTTPS 匿名克隆即可）：
```bash
cd /www/wwwroot
git clone https://gitee.com/babyowen/njsky.git njsky
cd njsky            # 仓库根目录就是项目本身（含 Dockerfile / docker-compose.yml）
```

### 方式 B：本地打包上传
本地把项目打包成 zip → 宝塔文件管理器上传到 `/www/wwwroot/njsky` → 解压。

> 注意：**.env.local 和 data/ 不要打进包里**（前者是密钥、后者是数据）。

---

## 三、配置环境变量

在项目目录（含 Dockerfile 的那一层）：
```bash
cp .env.example .env.local
vi .env.local        # 填入 FEISHU_APP_SECRET、FEISHU_USER_ID 等
chmod 600 .env.local # 保护密钥
mkdir -p data        # SQLite 数据目录
```
`.env.local` 会被 docker-compose 通过 `env_file` 注入容器；`data/` 会挂载给容器持久化。

---

## 四、构建并启动

```bash
cd /www/wwwroot/njsky          # 仓库根目录，含 docker-compose.yml
docker compose up -d --build
docker compose logs -f         # 观察启动日志（Ctrl+C 只退出日志，不停止容器）
```
- **首次构建约 3~5 分钟**：会从源码编译 better-sqlite3，并执行 `next build`。
- 看到 `[njsky] 调度器已启动` 即成功。
- 验证：`curl -I http://127.0.0.1:3002/` 返回 200。

`restart: unless-stopped` 会让容器随 Docker 开机自启，无需 pm2。

---

## 五、宝塔反向代理 + SSL

1. 宝塔 → **网站** → 添加站点：域名填你的域名，其余默认（PHP 版本选纯静态即可）。
   - 此时宝塔会生成一个占位站点目录（如 `njsky-web-none`，纯静态站点 PHP=none 的命名），
     **它不放任何代码**：nginx 里 `location /` 全量反代到 3002 容器，
     该目录仅用于 `.well-known` 证书续期验证；SSL 证书在 `/www/server/panel/vhost/cert/<域名>/`。
2. 进入该站点 → **反向代理** → 添加：
   - 代理名称：`njsky`
   - 目标 URL：`http://127.0.0.1:3002`
   - 发送域名：`$host`
3. 站点 → **SSL** → Let's Encrypt → 一键申请证书 → 打开**强制 HTTPS**。

> 之前页脚里的 ICP 备案域名就是走这一步对外提供服务。

---

## 六、日常更新

```bash
cd /www/wwwroot/njsky
git pull
docker compose up -d --build
```
数据（`data/njsky.db`）和配置（`.env.local`）都在宿主机上，构建/更新不会动它们。

---

## 七、备份

只需备份 **`data/njsky.db`**。SQLite 使用 WAL 模式，建议这样备份以避免写入中途：
```bash
cd /www/wwwroot/njsky
docker compose stop
cp data/njsky.db /path/to/backup/njsky-$(date +%F).db
docker compose start
```
（或在宝塔里加个**计划任务**定期执行。）

---

## 八、排错

| 现象 | 处理 |
|---|---|
| 构建卡在下载 / 报网络错误 | 确认 Docker 镜像加速已配好、重启 Docker |
| `Address already in use :3002` | 3002 被占用，改 `docker-compose.yml` 里的端口映射 |
| 容器起来又退出 | `docker compose logs -f` 看报错；多为 `.env.local` 缺失或格式错误 |
| 页面能开但无数据 | 正常，首次采集在启动约 20 秒后触发；看 `docker compose logs` |
| 想进容器排查 | `docker compose exec njsky sh` |
| 构建内存不足（少见，4G 够） | 加 2G swap：`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile` |

---

## 九、这套方案的要点回顾

- **不依赖 registry**：镜像在 VPS 本地构建，省去 TCR 学习和费用（TCR 个人版免费，但要推送/拉取更麻烦）。
- **不依赖 GitHub**：代码从 Gitee 拉；Docker 构建走国内 npm 镜像 + better-sqlite3 源码编译。
- **数据持久**：`data/njsky.db` 在宿主机，容器重建不丢。
- **单容器**：网站和定时采集同进程（instrumentation 启动调度器），无需额外 worker。
