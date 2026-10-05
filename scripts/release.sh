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

# Cross-compile binaries
echo "Building latte-darwin-arm64..."
bun build --compile --target=bun-darwin-arm64 ./src/index.ts --outfile latte-darwin-arm64

echo "Building latte-darwin-x64..."
bun build --compile --target=bun-darwin-x64 ./src/index.ts --outfile latte-darwin-x64

for BINARY in latte-darwin-arm64 latte-darwin-x64; do
  codesign --force --sign - "$BINARY"
  codesign --verify --strict "$BINARY"
  if ! BUILT_VERSION=$("./$BINARY" --version); then
    echo "Error: $BINARY failed to start. Release aborted." >&2
    exit 1
  fi
  if [[ "$BUILT_VERSION" != "$NEW_VERSION" ]]; then
    echo "Error: $BINARY reported version '$BUILT_VERSION', expected '$NEW_VERSION'." >&2
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
