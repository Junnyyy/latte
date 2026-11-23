#!/usr/bin/env bash
# Compile, sign, and check one latte executable.
# Usage: scripts/build.sh <outfile> [bun target, e.g. bun-darwin-arm64]
set -euo pipefail

OUTFILE="${1:?Usage: scripts/build.sh <outfile> [target]}"
TARGET="${2:-}"

# React's development build records a performance entry for every component on
# every render, and Bun keeps them all. The TUI renders every second, so a
# development build leaks memory without bound.
bun build ./src/index.ts --compile ${TARGET:+--target="$TARGET"} \
  --define 'process.env.NODE_ENV="production"' --outfile "$OUTFILE"

if grep -aq 'react-reconciler.development' "$OUTFILE"; then
  echo "Error: $OUTFILE bundles React's development build, which leaks memory in the TUI." >&2
  exit 1
fi

codesign --force --sign - "$OUTFILE"
codesign --verify --strict "$OUTFILE"
