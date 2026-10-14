#!/bin/sh
# 街头饭签 · 容器入口：准备持久目录、保证会话密钥稳定，然后跑一次幂等引导。
set -eu

DATA_DIR="${DATA_DIR:-/data}"
UPLOADS_DIR="${UPLOADS_DIR:-$DATA_DIR/uploads}"
BACKUPS_DIR="${BACKUPS_DIR:-$DATA_DIR/backups}"
DATABASE_PATH="${DATABASE_PATH:-$DATA_DIR/budget-map.sqlite}"
export DATA_DIR UPLOADS_DIR BACKUPS_DIR DATABASE_PATH

mkdir -p "$DATA_DIR" "$UPLOADS_DIR" "$BACKUPS_DIR"

# 会话密钥必须跨重启稳定，否则每次重启都会踢掉后台登录。
# 未显式提供时，生成一次并持久化到数据卷（与数据库同生命周期）。
if [ -z "${SESSION_SECRET:-}" ]; then
  secret_file="$DATA_DIR/.session-secret"
  if [ ! -s "$secret_file" ]; then
    node -e "require('node:fs').writeFileSync(process.argv[1], require('node:crypto').randomBytes(32).toString('base64url'), { mode: 0o600 })" "$secret_file"
    echo "[entrypoint] 已生成会话密钥并写入 $secret_file"
  fi
  SESSION_SECRET="$(cat "$secret_file")"
  export SESSION_SECRET
elif [ "${#SESSION_SECRET}" -lt 32 ]; then
  echo "[entrypoint] 警告：SESSION_SECRET 短于 32 字符，后台登录会失败。" >&2
fi

# 幂等引导：目录 → 迁移 → 管理员密码 → 区域目录 → 演示数据（SEED_DEMO=0 可关闭）。
npx tsx scripts/bootstrap.ts

exec "$@"
