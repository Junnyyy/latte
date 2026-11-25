#!/usr/bin/env bash
set -euo pipefail

OUTFILE="${1:?Usage: scripts/build.sh <outfile> [bun-target]}"
TARGET="${2:-}"

bun build ./src/index.ts --compile ${TARGET:+--target="$TARGET"} \
  --define 'process.env.NODE_ENV="production"' --outfile "$OUTFILE"

if grep -aqF 'react-reconciler.development' "$OUTFILE" || ! grep -aqF 'react-reconciler.production' "$OUTFILE"; then
  echo "Error: $OUTFILE does not bundle React's production build." >&2
  exit 1
fi

codesign --force --sign - "$OUTFILE"
codesign --verify --strict "$OUTFILE"
