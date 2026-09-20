#!/bin/bash
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# 隔离 runner 接入前失败关闭，禁止回退到线上或用户提供的未知后端。
exec node "$script_dir/e2e-isolation-gate.mjs"
