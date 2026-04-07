#!/usr/bin/env bash
set -euo pipefail

BIN_PATH="$HOME/.local/bin/latte"

if [ ! -e "$BIN_PATH" ]; then
  echo "Nothing to remove: $BIN_PATH does not exist"
  exit 0
fi

if [ -e "$BIN_PATH" ] && [ ! -L "$BIN_PATH" ]; then
  echo "Warning: $BIN_PATH is not a symlink — it was not installed by latte."
  echo "Inspect with: ls -la $BIN_PATH"
  echo "Remove manually if you're sure: rm $BIN_PATH"
  exit 1
fi

rm -f "$BIN_PATH"
echo "Removed $BIN_PATH"
