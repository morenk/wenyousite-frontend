#!/bin/bash
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$script_dir/.."
export BACKEND_URL=${BACKEND_URL:-http://127.0.0.1:3000}
export FRONTEND_E2E_PORT=${FRONTEND_E2E_PORT:-3105}
if [[ "$FRONTEND_E2E_PORT" == 3000 || "$FRONTEND_E2E_PORT" == 3001 ]]; then
  echo 'S5 requires a separate candidate port' >&2
  exit 1
fi
node scripts/rich-text-real-api-preflight.mjs --require-credentials
# Next rewrites 固化于构建时；必须在独立 worktree 中使用本次真实目标重新构建。
pnpm build
export RICH_TEXT_REAL_API=true
export RICH_TEXT_CANDIDATE_SHA=6859f00c305b7c63a62fc2d3f709d811c55f2dc0
export RICH_TEXT_HARNESS_SHA=$(git rev-parse HEAD)
export RICH_TEXT_RUN_DIR=${RICH_TEXT_RUN_DIR:-$(mktemp -d /tmp/rich-text-web-s5.XXXXXX)}
mkdir -p "$RICH_TEXT_RUN_DIR"
node scripts/rich-text-real-api-preflight.mjs --require-credentials > "$RICH_TEXT_RUN_DIR/preflight.json"
pnpm test:e2e:candidate e2e/s5/rich-text-real-api.spec.ts --output="$RICH_TEXT_RUN_DIR/browser"
echo "S5 evidence: $RICH_TEXT_RUN_DIR"
