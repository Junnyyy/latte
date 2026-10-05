#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="$HOME/.local/bin"
BIN_PATH="$BIN_DIR/latte"
MODE="${1:-link}"

# Guard: refuse to overwrite a non-symlink (likely from another tool)
if [ -e "$BIN_PATH" ] && [ ! -L "$BIN_PATH" ]; then
  echo "Error: $BIN_PATH exists and is not a symlink."
  echo "Another tool may own this path. Inspect with: ls -la $BIN_PATH"
  echo "Remove manually if safe: rm $BIN_PATH"
  exit 1
fi

mkdir -p "$BIN_DIR"

case "$MODE" in
  link)
    chmod +x src/index.ts
    ln -sf "$(pwd)/src/index.ts" "$BIN_PATH"
    echo "Linked: $BIN_PATH -> src/index.ts"
    ;;
  compile)
    bun build ./src/index.ts --compile --outfile latte
    codesign --force --sign - latte
    codesign --verify --strict latte
    ln -sf "$(pwd)/latte" "$BIN_PATH"
    echo "Installed: $BIN_PATH -> ./latte (compiled)"
    ;;
  *)
    echo "Usage: install.sh [link|compile]"
    exit 1
    ;;
esac
