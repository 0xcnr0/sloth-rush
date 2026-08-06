#!/usr/bin/env bash
# The standalone verifier carries its own copy of the engine so anyone can
# reproduce a race without running the server. That copy is the entire
# "anyone-can-verify" claim, and it had silently drifted 123 lines behind — a
# public verifier that disagrees with the server makes the claim false rather
# than unproven.
#
# Copies are compared byte for byte. If this fails, run:
#   cp backend/src/simulation/{engine,items,formats}.ts simulation/
set -u
fail=0
for f in engine items formats; do
  if ! diff -q "backend/src/simulation/$f.ts" "simulation/$f.ts" > /dev/null 2>&1; then
    echo "DRIFT: simulation/$f.ts differs from backend/src/simulation/$f.ts"
    fail=1
  fi
done
if [ "$fail" = "0" ]; then
  echo "OK — the public verifier matches the server engine"
else
  echo "FAIL: the standalone verifier would not reproduce this server's races"
  exit 1
fi
