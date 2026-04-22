#!/usr/bin/env bash
# physics-review.sh — 一键运行物理验证 workflow
#
# 用法:
#   ./scripts/physics-review.sh              # Layer 1: 全模块解析验证
#   ./scripts/physics-review.sh --module p02 # 单模块
#   ./scripts/physics-review.sh --layer 1,2  # 指定验证层
#   ./scripts/physics-review.sh --all        # 全部4层

set -euo pipefail
cd "$(dirname "$0")/.."

# 确保构建是最新的
echo "=== Step 1: Building all modules ==="
pnpm build:all 2>&1 | tail -5

echo ""
echo "=== Step 2: Running physics validation ==="
npx tsx scripts/physics-review-workflow.ts "$@"

echo ""
echo "=== Step 3: TypeScript type check ==="
pnpm -r exec tsc --noEmit 2>&1 | tail -20 || true

echo ""
echo "=== Done ==="
