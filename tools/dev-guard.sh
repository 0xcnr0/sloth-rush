#!/usr/bin/env bash
# Refuse to start a second backend on the same port.
#
# Five backend processes were running at once during a measurement session, and
# port 3001 was held by the oldest of them — so the code being read was not the
# code answering. Every number taken that day was suspect, including a playtest
# report. A duplicate server is not a nuisance; it silently invalidates results.
#
# Hooked to `dev`, `backend` AND `frontend`. It guarded only `dev` at first,
# which is the combined script — so `npm run backend`, the way a single service
# actually gets restarted, walked straight past it. Vite matters for the same
# reason from the other end: with 5173 taken it does not refuse, it quietly
# moves to 5174, and every screenshot of "localhost:5173" is then of the old
# build.
set -euo pipefail
PORT="${1:-3001}"
HOLDER="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
if [ -n "$HOLDER" ]; then
  echo "REFUSED — port $PORT is already held by pid $HOLDER, started:"
  ps -o lstart=,command= -p "$HOLDER" | cut -c1-120
  echo
  echo "Stop it first:  kill $HOLDER      (or: npm run dev:reset)"
  exit 1
fi
