#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
FRONTEND_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)
RUNTIME_ROOT=${FRONTEND_RUNTIME_ROOT:-/var/lib/wenyousite/frontend}
RELEASE_ROOT="$RUNTIME_ROOT/releases"
LOG_DIR=${FRONTEND_LOG_DIR:-/tmp/opencode}
PREFLIGHT_LOG="$LOG_DIR/wenyousite-frontend-preflight.log"
PRODUCTION_PORT=${FRONTEND_PORT:-3001}
PREFLIGHT_PORT=${FRONTEND_PREFLIGHT_PORT:-3102}
PUBLIC_BASE_URL=${FRONTEND_PUBLIC_BASE_URL:-https://wenyou.site}
FRONTEND_SERVICE=${FRONTEND_SYSTEMD_SERVICE:-wenyousite-frontend.service}
FRONTEND_SERVICE_USER=wenyousite-frontend
NODE_RUNTIME=${FRONTEND_NODE_RUNTIME:-/usr/local/lib/wenyousite/node}
VERIFY_SCRIPT="$SCRIPT_DIR/verify-static-assets.mjs"
RELEASE_METADATA_NAME=.wenyousite-release.json
EXPECTED_GIT_SHA=${FRONTEND_EXPECTED_SHA:-}

staging_dir=""
preflight_pid=""

validate_port() {
  local port=$1
  local name=$2

  if [[ ! "$port" =~ ^[0-9]+$ ]] || ((port < 1 || port > 65535)); then
    echo "$name 不是有效端口: $port" >&2
    exit 1
  fi
}

ensure_runtime_user() {
  if getent passwd "$FRONTEND_SERVICE_USER" >/dev/null 2>&1; then
    return 0
  fi
  if ! useradd --system --user-group --home-dir "$RUNTIME_ROOT" \
    --shell /usr/sbin/nologin "$FRONTEND_SERVICE_USER"; then
    echo "无法创建前端非特权运行用户: $FRONTEND_SERVICE_USER" >&2
    exit 1
  fi
}

install_node_runtime() {
  local source_node

  source_node=${WENYOU_NODE_BINARY_SOURCE:-$(command -v node)}
  if [ ! -x "$source_node" ]; then
    echo "Node 源文件不可执行: $source_node" >&2
    exit 1
  fi
  install -D -m 0755 "$source_node" "$NODE_RUNTIME"
  chown root:root "$NODE_RUNTIME"
}

listener_pid() {
  local port=$1

  ss -tlnp | sed -n "s/.*:$port .*pid=\([0-9][0-9]*\).*/\1/p" | head -n 1
}

stop_process() {
  local pid=$1
  local service_name=$2
  local attempt

  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  kill "$pid"
  for attempt in $(seq 1 50); do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.1
  done

  echo "$service_name 未能在 5 秒内退出（PID: $pid）" >&2
  return 1
}

start_server() {
  local release_dir=$1
  local port=$2
  local log_file=$3

  (
    cd "$release_dir"
    exec setsid nohup env PORT="$port" node server.js 9>&- </dev/null >"$log_file" 2>&1
  ) &
  STARTED_PID=$!
}

wait_for_http() {
  local url=$1
  local service_name=$2
  local log_file=$3
  local attempt

  for attempt in $(seq 1 50); do
    if curl --fail --silent --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done

  echo "$service_name 未能在 10 秒内通过健康检查: $url" >&2
  if [ -n "$log_file" ] && [ -f "$log_file" ]; then
    tail -n 100 "$log_file" >&2 || true
  else
    journalctl -u "$FRONTEND_SERVICE" --no-pager -n 100 >&2 || true
  fi
  return 1
}

restart_production_service() {
  if ! systemctl restart "$FRONTEND_SERVICE"; then
    echo "前端 systemd 服务重启失败: $FRONTEND_SERVICE" >&2
    journalctl -u "$FRONTEND_SERVICE" --no-pager -n 100 >&2 || true
    return 1
  fi
  if ! systemctl is-active --quiet "$FRONTEND_SERVICE"; then
    echo "前端 systemd 服务未处于 active 状态: $FRONTEND_SERVICE" >&2
    journalctl -u "$FRONTEND_SERVICE" --no-pager -n 100 >&2 || true
    return 1
  fi
}

safe_remove_release() {
  local target=$1

  case "$target" in
    "$RELEASE_ROOT"/*) ;;
    *)
      echo "拒绝清理 release 根目录之外的路径: $target" >&2
      return 1
      ;;
  esac

  if [ -d "$target" ] && [ ! -L "$target" ]; then
    rm -rf --one-file-system -- "$target"
  fi
}

atomic_link() {
  local target=$1
  local name=$2
  local temporary_link="$RUNTIME_ROOT/.${name}.$$"

  ln -s "$target" "$temporary_link"
  mv -Tf "$temporary_link" "$RUNTIME_ROOT/$name"
}

cleanup() {
  local status=$?

  trap - EXIT INT TERM
  if [ -n "$preflight_pid" ]; then
    stop_process "$preflight_pid" "前端预检进程" || true
  fi
  if [ -n "$staging_dir" ] && [ -d "$staging_dir" ]; then
    safe_remove_release "$staging_dir" || true
  fi
  exit "$status"
}

rollback_to() {
  local previous_release=$1

  if [ -z "$previous_release" ] || [ ! -f "$previous_release/server.js" ]; then
    echo "没有可用的上一版前端 release，无法自动回滚" >&2
    return 1
  fi

  echo "正在回滚到上一版前端: $previous_release" >&2
  atomic_link "$previous_release" current
  if ! restart_production_service ||
    ! wait_for_http "http://127.0.0.1:$PRODUCTION_PORT/login" "回滚后的前端" ""; then
    return 1
  fi
  node "$VERIFY_SCRIPT" "http://127.0.0.1:$PRODUCTION_PORT" / /login
}

read_release_git_sha() {
  local release_dir=$1

  node -e '
    const fs = require("node:fs");
    const metadata = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.stdout.write(typeof metadata.gitSha === "string" ? metadata.gitSha : "");
  ' "$release_dir/$RELEASE_METADATA_NAME"
}

validate_port "$PRODUCTION_PORT" "FRONTEND_PORT"
validate_port "$PREFLIGHT_PORT" "FRONTEND_PREFLIGHT_PORT"
if [ "$PRODUCTION_PORT" = "$PREFLIGHT_PORT" ]; then
  echo "生产端口与预检端口不能相同" >&2
  exit 1
fi

for command_name in chown curl flock getent git install journalctl node ss systemctl useradd; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "缺少部署命令: $command_name" >&2
    exit 1
  fi
done
if ! systemctl cat "$FRONTEND_SERVICE" >/dev/null 2>&1; then
  echo "前端 systemd 服务未安装: $FRONTEND_SERVICE" >&2
  exit 1
fi

FRONTEND_GIT_SHA=$(bash "$SCRIPT_DIR/assert-releasable-repo.sh" "$FRONTEND_DIR" dev)
if [ -n "$EXPECTED_GIT_SHA" ] && [ "$FRONTEND_GIT_SHA" != "$EXPECTED_GIT_SHA" ]; then
  echo "前端部署提交与调用方期望不一致: $FRONTEND_GIT_SHA != $EXPECTED_GIT_SHA" >&2
  exit 1
fi

mkdir -p "$RELEASE_ROOT" "$LOG_DIR"
exec 9>"$RUNTIME_ROOT/deploy.lock"
if ! flock -n 9; then
  echo "另一个前端部署正在进行" >&2
  exit 1
fi
trap cleanup EXIT INT TERM

occupied_preflight_pid=$(listener_pid "$PREFLIGHT_PORT")
if [ -n "$occupied_preflight_pid" ]; then
  echo "预检端口 $PREFLIGHT_PORT 已被 PID $occupied_preflight_pid 占用" >&2
  exit 1
fi

BUILD_ID_FILE="$FRONTEND_DIR/.next/BUILD_ID"
STANDALONE_BUILD_ID_FILE="$FRONTEND_DIR/.next/standalone/.next/BUILD_ID"
if [ ! -f "$BUILD_ID_FILE" ] || [ ! -f "$STANDALONE_BUILD_ID_FILE" ]; then
  echo "缺少完整的 Next.js standalone 构建，请先运行 pnpm check 或 pnpm build" >&2
  exit 1
fi

build_id=$(<"$BUILD_ID_FILE")
standalone_build_id=$(<"$STANDALONE_BUILD_ID_FILE")
if [[ ! "$build_id" =~ ^[A-Za-z0-9_-]+$ ]] || [ "$build_id" != "$standalone_build_id" ]; then
  echo "Next.js 根构建与 standalone 构建 ID 不一致" >&2
  exit 1
fi
if [ ! -f "$FRONTEND_DIR/.next/standalone/server.js" ] || [ ! -d "$FRONTEND_DIR/.next/static" ]; then
  echo "Next.js standalone 或 static 构建产物不完整" >&2
  exit 1
fi

source_sha_before_copy=$(bash "$SCRIPT_DIR/assert-releasable-repo.sh" "$FRONTEND_DIR" dev)
if [ "$source_sha_before_copy" != "$FRONTEND_GIT_SHA" ]; then
  echo "前端提交在准备 release 前发生变化" >&2
  exit 1
fi

staging_dir=$(mktemp -d "$RELEASE_ROOT/.staging.XXXXXX")
cp -a "$FRONTEND_DIR/.next/standalone/." "$staging_dir/"
mkdir -p "$staging_dir/.next"
cp -a "$FRONTEND_DIR/.next/static" "$staging_dir/.next/"
if [ -d "$FRONTEND_DIR/public" ]; then
  cp -a "$FRONTEND_DIR/public" "$staging_dir/"
fi

staged_build_id=$(<"$staging_dir/.next/BUILD_ID")
source_build_id_after_copy=$(<"$BUILD_ID_FILE")
if [ "$staged_build_id" != "$build_id" ] || [ "$source_build_id_after_copy" != "$build_id" ]; then
  echo "复制期间 Next.js 构建发生变化，已中止切换" >&2
  exit 1
fi

release_created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '{\n  "gitSha": "%s",\n  "buildId": "%s",\n  "createdAt": "%s"\n}\n' \
  "$FRONTEND_GIT_SHA" \
  "$build_id" \
  "$release_created_at" \
  >"$staging_dir/$RELEASE_METADATA_NAME"

start_server "$staging_dir" "$PREFLIGHT_PORT" "$PREFLIGHT_LOG"
preflight_pid=$STARTED_PID
if ! wait_for_http "http://127.0.0.1:$PREFLIGHT_PORT/login" "前端预检进程" "$PREFLIGHT_LOG" ||
  ! node "$VERIFY_SCRIPT" "http://127.0.0.1:$PREFLIGHT_PORT" / /login; then
  exit 1
fi
stop_process "$preflight_pid" "前端预检进程"
preflight_pid=""

source_sha_before_switch=$(bash "$SCRIPT_DIR/assert-releasable-repo.sh" "$FRONTEND_DIR" dev)
if [ "$source_sha_before_switch" != "$FRONTEND_GIT_SHA" ]; then
  echo "前端提交在候选预检期间发生变化" >&2
  exit 1
fi

mkdir -p "$RUNTIME_ROOT"
ensure_runtime_user
install_node_runtime

release_timestamp=$(date -u +%Y%m%dT%H%M%SZ)
release_short_sha=${FRONTEND_GIT_SHA:0:12}
release_dir="$RELEASE_ROOT/$release_timestamp-$release_short_sha-$build_id-${staging_dir##*.staging.}"
mv -- "$staging_dir" "$release_dir"
staging_dir=""

previous_release=$(readlink -f "$RUNTIME_ROOT/current" 2>/dev/null || true)
atomic_link "$release_dir" current

if ! restart_production_service ||
  ! wait_for_http "http://127.0.0.1:$PRODUCTION_PORT/login" "新前端" "" ||
  ! node "$VERIFY_SCRIPT" "http://127.0.0.1:$PRODUCTION_PORT" / /login; then
  rollback_to "$previous_release" || true
  safe_remove_release "$release_dir"
  exit 1
fi

if ! node "$VERIFY_SCRIPT" "$PUBLIC_BASE_URL" / /login; then
  rollback_to "$previous_release" || true
  safe_remove_release "$release_dir"
  exit 1
fi

if [ -n "$previous_release" ] && [ "$previous_release" != "$release_dir" ]; then
  atomic_link "$previous_release" previous
fi

current_release=$(readlink -f "$RUNTIME_ROOT/current")
if ! deployed_git_sha=$(read_release_git_sha "$current_release"); then
  echo "无法读取当前前端 release 元数据" >&2
  rollback_to "$previous_release" || true
  safe_remove_release "$release_dir"
  exit 1
fi
if [ "$deployed_git_sha" != "$FRONTEND_GIT_SHA" ]; then
  echo "当前前端 release 元数据与待部署提交不一致" >&2
  rollback_to "$previous_release" || true
  safe_remove_release "$release_dir"
  exit 1
fi
previous_release=$(readlink -f "$RUNTIME_ROOT/previous" 2>/dev/null || true)
for candidate in "$RELEASE_ROOT"/*; do
  [ -d "$candidate" ] || continue
  resolved_candidate=$(readlink -f "$candidate")
  if [ "$resolved_candidate" != "$current_release" ] && [ "$resolved_candidate" != "$previous_release" ]; then
    safe_remove_release "$resolved_candidate"
  fi
done

new_pid=$(systemctl show "$FRONTEND_SERVICE" --property MainPID --value)
echo "前端切换完成"
echo "release: $current_release"
echo "gitSha: $deployed_git_sha"
echo "buildId: $build_id"
echo "pid: $new_pid"
echo "journal: journalctl -u $FRONTEND_SERVICE"
