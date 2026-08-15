#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
FRONTEND_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)
PREVIEW_PORT=${FRONTEND_E2E_PORT:-3101}
PREVIEW_BASE_URL="http://127.0.0.1:$PREVIEW_PORT"
VERIFY_SCRIPT="$SCRIPT_DIR/verify-static-assets.mjs"

preview_dir=""
preview_pid=""

cleanup() {
  local status=$?
  trap - EXIT INT TERM

  if [ -n "$preview_pid" ] && kill -0 "$preview_pid" 2>/dev/null; then
    kill "$preview_pid" 2>/dev/null || true
    wait "$preview_pid" 2>/dev/null || true
  fi
  if [ -n "$preview_dir" ] && [ -d "$preview_dir" ]; then
    rm -rf --one-file-system -- "$preview_dir"
  fi
  exit "$status"
}

if [[ ! "$PREVIEW_PORT" =~ ^[0-9]+$ ]] || ((PREVIEW_PORT < 1 || PREVIEW_PORT > 65535)); then
  echo "FRONTEND_E2E_PORT 不是有效端口: $PREVIEW_PORT" >&2
  exit 1
fi

for command_name in curl node pnpm ss; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "候选 E2E 缺少命令: $command_name" >&2
    exit 1
  fi
done

if ss -tln | grep -Eq "[:.]$PREVIEW_PORT[[:space:]]"; then
  echo "候选 E2E 端口 $PREVIEW_PORT 已被占用" >&2
  exit 1
fi

BUILD_ID_FILE="$FRONTEND_DIR/.next/BUILD_ID"
STANDALONE_BUILD_ID_FILE="$FRONTEND_DIR/.next/standalone/.next/BUILD_ID"
if [ ! -f "$BUILD_ID_FILE" ] || [ ! -f "$STANDALONE_BUILD_ID_FILE" ]; then
  echo "缺少 standalone 构建，请先运行 pnpm check 或 pnpm build" >&2
  exit 1
fi

build_id=$(<"$BUILD_ID_FILE")
standalone_build_id=$(<"$STANDALONE_BUILD_ID_FILE")
if [[ ! "$build_id" =~ ^[A-Za-z0-9_-]+$ ]] || [ "$build_id" != "$standalone_build_id" ]; then
  echo "Next.js 根构建与 standalone 构建 ID 不一致" >&2
  exit 1
fi

preview_dir=$(mktemp -d "${TMPDIR:-/tmp}/wenyousite-frontend-e2e.XXXXXX")
trap cleanup EXIT INT TERM

cp -a "$FRONTEND_DIR/.next/standalone/." "$preview_dir/"
mkdir -p "$preview_dir/.next"
cp -a "$FRONTEND_DIR/.next/static" "$preview_dir/.next/"
if [ -d "$FRONTEND_DIR/public" ]; then
  cp -a "$FRONTEND_DIR/public" "$preview_dir/"
fi

if [ "$(<"$preview_dir/.next/BUILD_ID")" != "$build_id" ] ||
  [ "$(<"$BUILD_ID_FILE")" != "$build_id" ]; then
  echo "复制期间 Next.js 构建发生变化，已中止候选 E2E" >&2
  exit 1
fi

preview_log="$preview_dir/server.log"
(
  cd "$preview_dir"
  exec env HOSTNAME=127.0.0.1 PORT="$PREVIEW_PORT" node server.js >"$preview_log" 2>&1
) &
preview_pid=$!

ready=false
for _ in $(seq 1 50); do
  if curl --fail --silent --max-time 2 "$PREVIEW_BASE_URL/login" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.2
done
if [ "$ready" != true ]; then
  echo "候选 standalone 未能在 10 秒内启动" >&2
  tail -n 100 "$preview_log" >&2 || true
  exit 1
fi

node "$VERIFY_SCRIPT" "$PREVIEW_BASE_URL" / /login

cd "$FRONTEND_DIR"
E2E_ENV=test \
E2E_BASE_URL="$PREVIEW_BASE_URL" \
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:3000}" \
pnpm test:e2e

echo "候选 standalone E2E 通过: build=$build_id url=$PREVIEW_BASE_URL"
