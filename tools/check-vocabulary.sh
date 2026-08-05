#!/usr/bin/env bash
#
# Vocabulary guard — run in CI and before every merge.
#
# Two rules, both from CLAUDE.md §0:
#
#   1. Theme words never appear in code. Code names things by what they *do*;
#      the current brand's words live in frontend/src/config/theme.ts.
#   2. Wagering words never appear at all. This is an app-store and regulatory
#      posture, not a style preference. A single "bid" undoes the whole effort.
#
# The patterns below are the ones in docs/HANDOFF_PHASE1.md. Three details
# matter and must not be "simplified":
#
#   - \b on BOTH sides. Anchoring only the front makes "bet" match "between"
#     and "better" (168 false hits against 3 real ones).
#   - --exclude-dir=node_modules. TypeScript's own lib.dom.d.ts contains "raise".
#   - legacyNames.ts allowlisted. A migration that retires the old mechanic has
#     to name `status = 'bidding'` and `DROP TABLE predictions` to do its job.
#
# A single leaked word fails the build. If you are tempted to widen the
# allowlist, rename the identifier instead.

set -uo pipefail
cd "$(dirname "$0")/.."

# NB: no quotes around the globs. Inside a bash array the quotes would be
# literal, grep would reject every --include, and it would silently fall back
# to scanning everything — including generated bundles under dist/.
SEARCH_PATHS=(frontend/src backend/src contracts/contracts simulation)
INCLUDES=(--include=*.ts --include=*.tsx --include=*.sol --include=*.css)
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=artifacts --exclude-dir=cache)

THEME_ALLOWED='config/theme\.ts|migrations/legacyNames\.ts'
BETTING_ALLOWED='migrations/legacyNames\.ts'

THEME_PATTERN='\b(sloth|zzz|scrap)\b'
BETTING_PATTERN='\b(bid|bidding|bids|bet|bets|pot|pots|wager|stake|odds|raise|payout|payouts|predict|prediction|predictions|whale)\b'

fail=0

echo "==> Theme vocabulary (allowed only in theme.ts)"
theme_hits=$(grep -rinE "$THEME_PATTERN" "${INCLUDES[@]}" "${EXCLUDES[@]}" "${SEARCH_PATHS[@]}" 2>/dev/null \
  | grep -vE "$THEME_ALLOWED" || true)
if [ -n "$theme_hits" ]; then
  echo "$theme_hits"
  echo "FAIL: theme words found outside theme.ts"
  fail=1
else
  echo "OK"
fi

echo
echo "==> Wagering vocabulary (allowed only in the retirement migration)"
bet_hits=$(grep -rinE "$BETTING_PATTERN" "${INCLUDES[@]}" "${EXCLUDES[@]}" "${SEARCH_PATHS[@]}" 2>/dev/null \
  | grep -vE "$BETTING_ALLOWED" || true)
if [ -n "$bet_hits" ]; then
  echo "$bet_hits"
  echo "FAIL: wagering words found"
  fail=1
else
  echo "OK"
fi

exit $fail
