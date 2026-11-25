#!/usr/bin/env bash
set -euo pipefail

OUTFILE="${1:?Usage: scripts/build.sh <outfile> [bun-target]}"
TARGET="${2:-}"

BUILD_DIR="$(mktemp -d "$(dirname "$OUTFILE")/.latte-build.XXXXXX")"
trap 'rm -rf "$BUILD_DIR"' EXIT
CANDIDATE="$BUILD_DIR/$(basename "$OUTFILE")"

bun build ./src/index.ts --compile ${TARGET:+--target="$TARGET"} \
  --define 'process.env.NODE_ENV="production"' --outfile "$CANDIDATE"

if grep -aqF 'react-reconciler.development' "$CANDIDATE" || ! grep -aqF 'react-reconciler.production' "$CANDIDATE"; then
  echo "Error: $OUTFILE does not bundle React's production build." >&2
  exit 1
fi

codesign --force --sign - "$CANDIDATE"
codesign --verify --strict "$CANDIDATE"
mv -f "$CANDIDATE" "$OUTFILE"
