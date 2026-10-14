# 街头饭签 · 生产镜像
#
# 说明：Next.js 以完整模式运行（未启用 output: 'standalone'），因此镜像内保留
# node_modules 与 scripts/，首次启动可以直接用 tsx 跑 scripts/bootstrap.ts 建库、
# 迁移、写区域目录与演示数据。代价是镜像偏大（约 1GB 级），换来的是「一条命令能跑」。

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 / sharp 在无预编译包时需要本地编译工具链。
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* 会被 Next.js 在构建期内联，必须在这里注入。
ARG NEXT_PUBLIC_MAP_MODE=demo
ARG NEXT_PUBLIC_TENCENT_MAP_KEY=
ENV NEXT_PUBLIC_MAP_MODE=${NEXT_PUBLIC_MAP_MODE} \
  NEXT_PUBLIC_TENCENT_MAP_KEY=${NEXT_PUBLIC_TENCENT_MAP_KEY}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  DATA_DIR=/data \
  UPLOADS_DIR=/data/uploads \
  BACKUPS_DIR=/data/backups \
  DATABASE_PATH=/data/budget-map.sqlite

RUN apt-get update \
  && apt-get install -y --no-install-recommends tini ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data/uploads /data/backups \
  && chown -R node:node /data /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY package.json next.config.mjs tsconfig.json ./
COPY db ./db
COPY lib ./lib
COPY scripts ./scripts
COPY docker ./docker
# 从 ZIP 下载或 Windows 检出的仓库可能丢掉可执行位；入口脚本必须可执行。
RUN chmod +x /app/docker/entrypoint.sh
COPY README.md LICENSE ./

USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker/entrypoint.sh"]
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
