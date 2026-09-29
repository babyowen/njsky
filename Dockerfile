# syntax=docker/dockerfile:1
#
# 多阶段构建：依赖安装 → Next.js 构建 → 精简运行
# 目标：在无法访问 GitHub 的国内 VPS 上也能顺利构建（better-sqlite3 从源码编译）

############ 1) 依赖层：安装 node_modules ############
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# better-sqlite3 是原生模块。默认安装会从 GitHub Releases 下载预编译二进制，
# 国内 VPS 连不上 GitHub 会失败——这里装好编译工具，走源码编译兜底。
# apt 源换阿里云（Debian 官方源在国内很慢；可用 --build-arg APT_MIRROR=... 覆盖）
ARG APT_MIRROR=mirrors.aliyun.com
RUN sed -i "s@deb.debian.org@${APT_MIRROR}@g; s@security.debian.org/debian-security@${APT_MIRROR}/debian-security@g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || true \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# npm 走国内镜像（可用 --build-arg NPM_REGISTRY=... 覆盖）
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry "$NPM_REGISTRY" \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 10000

# 强制从源码编译，避免安装时卡在无法访问的 GitHub 二进制下载
ENV npm_config_build_from_source=true

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

############ 2) 构建层：编译 Next.js ############
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# 构建期页面数据收集会初始化 SQLite；指向构建专用临时库，避免与运行库/多worker抢锁。
# 该临时文件不进入最终镜像（运行层不拷贝 /tmp）。
ENV DB_PATH=/tmp/build-njsky.db
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

############ 3) 运行层：只保留运行所需 ############
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# 已实测：next start 只需要以下文件（无需 src/，instrumentation 已编译进 .next）
# 保留全部 node_modules（含 devDeps）——因为 next.config.ts 在启动时需要 TypeScript，
# 裁剪 devDeps 会导致容器启动时自动联网安装 typescript，反而更脆弱。
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# SQLite 数据目录：运行时用数据卷挂载覆盖，保证数据持久化
RUN mkdir -p data
VOLUME ["/app/data"]

EXPOSE 3002
CMD ["npm", "start"]
