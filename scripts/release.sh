#!/usr/bin/env bash
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "Error: releases run in the Release workflow. Start it from the Actions tab, or run: gh workflow run release.yml -f bump=patch" >&2
  exit 1
fi

COMMAND="${1:-}"
BUMP="${2:-}"
BINARIES=(latte-darwin-arm64 latte-darwin-x64)

if ! { [[ "$COMMAND" == verify && -z "$BUMP" ]] ||
  { [[ "$COMMAND" =~ ^(build|publish)$ ]] && [[ "$BUMP" =~ ^(patch|minor|major)$ ]]; }; }; then
  echo "Usage: scripts/release.sh <build|publish> <patch|minor|major>" >&2
  echo "       scripts/release.sh verify" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: Working tree is dirty. Commit or stash changes first." >&2
  exit 1
fi

# Both jobs derive the version from their own checkout, so publish never
# trusts a package.json produced by the build job.
bump_version() {
  local old major minor patch
  old=$(grep '"version"' package.json | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/')
  IFS='.' read -r major minor patch <<< "$old"
  case "$BUMP" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
  esac
  NEW_VERSION="${major}.${minor}.${patch}"
  TAG="v${NEW_VERSION}"

  echo "Bumping version: ${old} -> ${NEW_VERSION}"
  sed "s/\"version\": \"${old}\"/\"version\": \"${NEW_VERSION}\"/" package.json > package.json.tmp
  mv package.json.tmp package.json
  if ! grep -q "\"version\": \"${NEW_VERSION}\"" package.json; then
    echo "Error: could not write version ${NEW_VERSION} to package.json." >&2
    exit 1
  fi
}

build() {
  bump_version

  PRIVATE_PATTERNS=(
    -e '/Users/[A-Za-z0-9._-]+'
    -e 'gh[pousr]_[A-Za-z0-9]{36}'
    -e 'github_pat_[A-Za-z0-9_]{22,}'
    -e 'sk-ant-[A-Za-z0-9_-]{20,}'
    -e '(AKIA|ASIA)[0-9A-Z]{16}'
    -e '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  )
  EMAIL=$(git config user.email || true)
  if [[ -n "$EMAIL" ]]; then
    PRIVATE_PATTERNS+=(-e "$(printf '%s' "$EMAIL" | sed 's/[][\.*^$+?(){}|]/\\&/g')")
  fi

  for BINARY in "${BINARIES[@]}"; do
    echo "Building $BINARY..."
    ./scripts/build.sh "$BINARY" "bun-${BINARY#latte-}"
    if ! BUILT_VERSION=$("./$BINARY" --version); then
      echo "Error: $BINARY failed to start. Release aborted." >&2
      exit 1
    fi
    if [[ "$BUILT_VERSION" != "$NEW_VERSION" ]]; then
      echo "Error: $BINARY reported version '$BUILT_VERSION', expected '$NEW_VERSION'." >&2
      exit 1
    fi
    SCAN_STATUS=0
    MATCHES=$(LC_ALL=C grep -aoE "${PRIVATE_PATTERNS[@]}" "$BINARY" | sort -u) || SCAN_STATUS=$?
    if (( SCAN_STATUS == 0 )); then
      echo "Error: $BINARY contains private data. Release aborted. First 8 bytes of each match:" >&2
      cut -c1-8 <<< "$MATCHES" | sort -u | sed 's/$/.../' >&2
      exit 1
    elif (( SCAN_STATUS > 1 )); then
      echo "Error: could not scan $BINARY for private data. Release aborted." >&2
      exit 1
    fi
  done

  shasum -a 256 "${BINARIES[@]}" > SHA256SUMS
}

verify() {
  for BINARY in "${BINARIES[@]}"; do
    if ! grep -qE "^[0-9a-f]{64}  ${BINARY}\$" SHA256SUMS; then
      echo "Error: SHA256SUMS has no checksum for $BINARY. Release aborted." >&2
      exit 1
    fi
  done
  if ! shasum -a 256 -c SHA256SUMS; then
    echo "Error: release binaries do not match SHA256SUMS. Release aborted." >&2
    exit 1
  fi
}

# Runs no bun and no latte binary: this step holds the write token.
publish() {
  verify

  if ! command -v gh &>/dev/null; then
    echo "Error: gh CLI is required. Install: https://cli.github.com" >&2
    exit 1
  fi

  bump_version

  git add package.json
  git commit -m "chore: bump version to ${NEW_VERSION}"
  git tag "$TAG"
  git push
  git push origin "$TAG"

  echo "Creating GitHub release ${TAG}..."
  gh release create "$TAG" --title "$TAG" --generate-notes "${BINARIES[@]}" SHA256SUMS

  echo "Released ${TAG}"
}

"$COMMAND"
