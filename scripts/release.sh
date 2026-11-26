#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-}"

if [[ -z "$BUMP" ]] || [[ ! "$BUMP" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: bun run release <patch|minor|major>"
  exit 1
fi

# Ensure clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: Working tree is dirty. Commit or stash changes first."
  exit 1
fi

# Ensure gh CLI is available
if ! command -v gh &>/dev/null; then
  echo "Error: gh CLI is required. Install: https://cli.github.com"
  exit 1
fi

# Bump version in package.json (no git tag, we'll do it ourselves)
OLD_VERSION=$(grep '"version"' package.json | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/')

IFS='.' read -r MAJOR MINOR PATCH <<< "$OLD_VERSION"
case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
TAG="v${NEW_VERSION}"

echo "Bumping version: ${OLD_VERSION} -> ${NEW_VERSION}"

# Update package.json
sed -i '' "s/\"version\": \"${OLD_VERSION}\"/\"version\": \"${NEW_VERSION}\"/" package.json

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

# Cross-compile binaries
for PLATFORM in darwin-arm64 darwin-x64; do
  BINARY="latte-$PLATFORM"
  echo "Building $BINARY..."
  ./scripts/build.sh "$BINARY" "bun-$PLATFORM"
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

# Commit, tag, push
git add package.json
git commit -m "chore: bump version to ${NEW_VERSION}"
git tag "$TAG"
git push
git push origin "$TAG"

# Create GitHub release with binaries
echo "Creating GitHub release ${TAG}..."
gh release create "$TAG" \
  --title "$TAG" \
  --generate-notes \
  latte-darwin-arm64 \
  latte-darwin-x64

# Clean up binaries
rm -f latte-darwin-arm64 latte-darwin-x64

echo ""
echo "Released ${TAG}"
