#!/usr/bin/env bash
#
# Typecheck guard — run in CI and before every merge.
#
# Two traps here, both of which have already cost us:
#
#   1. FRONTEND MUST USE `-b`, NOT `-p`.
#      frontend/tsconfig.json is a solution-style config: `"files": []` plus
#      project references. `tsc --noEmit -p frontend` therefore checks NOTHING
#      and exits 0. It read as a green gate for as long as it was in the handoff
#      docs, and broken imports and a missing THEME field sailed straight
#      through it. Build mode follows the references and actually compiles.
#
#   2. BACKEND EXITS NON-ZERO OVER CODE WE DO NOT OWN.
#      The `ox` package (pulled in under viem/wagmi) ships .ts sources rather
#      than .d.ts, so `skipLibCheck` does not apply to it, and it references
#      `window` which the backend's es2020 lib does not declare. Fifteen errors,
#      none ours, none fixable here. Failing the gate on them would leave it
#      permanently red, which is worse than a vacuous gate: a gate nobody can
#      pass is a gate everybody learns to ignore.
#
# So: run both, report everything, and fail only on errors in code we own.
# Widening the filter to hide a real error defeats the point — fix the error.

set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

echo "==> frontend (tsc -b, follows project references)"
front=$(npx tsc -b frontend 2>&1 || true)
if [ -n "$front" ]; then
  echo "$front"
  echo "FAIL: frontend type errors"
  fail=1
else
  echo "OK"
fi

echo
echo "==> backend (tsc --noEmit)"
back=$(npx tsc --noEmit -p backend 2>&1 || true)
ours=$(printf '%s\n' "$back" | grep -v '^node_modules/' | grep 'error TS' || true)
theirs=$(printf '%s\n' "$back" | grep -c '^node_modules/' || true)
if [ -n "$ours" ]; then
  echo "$ours"
  echo "FAIL: backend type errors"
  fail=1
else
  echo "OK${theirs:+ ($theirs pre-existing errors inside node_modules/ox, not ours)}"
fi

exit $fail
