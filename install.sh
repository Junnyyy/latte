#!/usr/bin/env bash
set -euo pipefail

REPO="Junnyyy/latte"
BIN_DIR="$HOME/.local/bin"
BIN_PATH="$BIN_DIR/latte"

log() { echo "[latte] $*"; }
err() { echo "[latte] Error: $*" >&2; }

# --- Step 1: Environment detection ---

OS="$(uname -s)"
if [ "$OS" != "Darwin" ]; then
  err "Only macOS is supported right now (detected: $OS)"
  exit 1
fi

ARCH="$(uname -m)"
case "$ARCH" in
  arm64|aarch64) ARCH="arm64" ;;
  x86_64)        ARCH="x64" ;;
  *)
    err "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

BINARY="latte-darwin-${ARCH}"
log "Detected: macOS $ARCH"

# --- Step 2: Classify existing install ---

CURRENT_VERSION=""
INSTALL_TYPE="fresh"  # fresh | update | symlink-replace

if [ -L "$BIN_PATH" ]; then
  # Symlink — likely a dev install
  LINK_TARGET="$(readlink "$BIN_PATH")"
  log "Found dev symlink at $BIN_PATH -> $LINK_TARGET"
  INSTALL_TYPE="symlink-replace"
elif [ -f "$BIN_PATH" ]; then
  # Regular file — likely a previous install
  if [ -x "$BIN_PATH" ]; then
    CURRENT_VERSION="$("$BIN_PATH" --version 2>/dev/null || echo "")"
    if [ -n "$CURRENT_VERSION" ]; then
      log "Current install: $CURRENT_VERSION"
      INSTALL_TYPE="update"
    else
      log "Found existing binary at $BIN_PATH (could not detect version)"
      INSTALL_TYPE="update"
    fi
  else
    err "$BIN_PATH exists but is not executable."
    err "Inspect with: ls -la $BIN_PATH"
    err "Remove manually if safe: rm $BIN_PATH"
    exit 1
  fi
elif [ -e "$BIN_PATH" ]; then
  # Something else (directory, socket, etc.)
  err "$BIN_PATH exists and is not a regular file or symlink."
  err "Inspect with: ls -la $BIN_PATH"
  err "Remove manually if safe: rm $BIN_PATH"
  exit 1
else
  log "No existing install found"
fi

# --- Step 3: Fetch latest release tag (metadata only, no binary download) ---

log "Fetching latest release..."
TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' \
  | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' \
  | head -1)"

if [ -z "$TAG" ]; then
  err "Could not determine latest release tag"
  exit 1
fi

# Compare versions — skip download if already up to date
if [ "$INSTALL_TYPE" = "update" ] && [ -n "$CURRENT_VERSION" ]; then
  # Normalize: CURRENT_VERSION might be "0.1.0" or "v0.1.0", TAG is "v0.1.0"
  CURRENT_NORMALIZED="${CURRENT_VERSION#v}"
  TAG_NORMALIZED="${TAG#v}"
  if [ "$CURRENT_NORMALIZED" = "$TAG_NORMALIZED" ]; then
    log "Already up to date ($TAG)"
    exit 0
  fi
fi

log "Latest: $TAG"

# --- Step 4: Download binary (only reached if needed) ---

URL="https://github.com/${REPO}/releases/download/${TAG}/${BINARY}"
mkdir -p "$BIN_DIR"
TMPFILE="$(mktemp "${BIN_DIR}/latte.XXXXXX")"

cleanup() { if [ -n "$TMPFILE" ]; then rm -f "$TMPFILE"; fi; }
trap cleanup EXIT

log "Downloading $BINARY..."
if ! curl -fsSL "$URL" -o "$TMPFILE"; then
  err "Download failed: $URL"
  exit 1
fi

chmod +x "$TMPFILE"
mv -f "$TMPFILE" "$BIN_PATH"  # rename(2) atomically replaces symlinks without following
TMPFILE=""  # Disarm cleanup trap — binary is installed

# --- Step 5: Confirm and advise ---

INSTALLED_VERSION="$("$BIN_PATH" --version 2>/dev/null || echo "$TAG")"

if [ "$INSTALL_TYPE" = "update" ] && [ -n "$CURRENT_VERSION" ]; then
  log "Updated latte: $CURRENT_VERSION -> $INSTALLED_VERSION"
else
  log "Installed latte $INSTALLED_VERSION to $BIN_PATH"
fi

# PATH hint
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    log ""
    log "Add ~/.local/bin to your PATH:"
    log "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    ;;
esac
