#!/bin/bash
# Rebuild T4 Code on the exact version of the installed official T3 Code, then install it.
# T4 is a client of T3's server: matching versions keeps client and server in step.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
T3_APP="/Applications/T3 Code (Nightly).app"
T4_APP_NAME="T4 Code.app"
NODE_BIN="$(ls -d "$HOME"/.local/share/vite-plus/js_runtime/node/24.*/bin | sort -V | tail -1)"
export PATH="$HOME/.local/share/vite-plus/bin:$NODE_BIN:$PATH"

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "Uncommitted changes in $REPO: commit them on the t4 branch first." >&2
  exit 1
fi

VERSION="$(defaults read "$T3_APP/Contents/Info" CFBundleShortVersionString)"
TAG="v$VERSION"
OLD_BASE="$(git describe --tags --abbrev=0 --match 'v*' HEAD)"
echo "T3 installed: $VERSION (T4 currently on $OLD_BASE)"

if [ "$OLD_BASE" != "$TAG" ]; then
  git fetch upstream tag "$TAG" --no-tags
  git rebase --onto "$TAG" "$OLD_BASE" t4
  vp i
fi

node scripts/build-desktop-artifact.ts --platform mac --target dmg --arch arm64 --build-version "$VERSION"

DMG="$(ls -t release/T4-Code-"$VERSION"-arm64.dmg | head -1)"
MOUNT="$(mktemp -d)"
hdiutil attach -nobrowse -quiet -mountpoint "$MOUNT" "$DMG"
trap 'hdiutil detach -quiet "$MOUNT"' EXIT
osascript -e 'if application "T4 Code" is running then tell application "T4 Code" to quit'
while [ "$(osascript -e 'application "T4 Code" is running')" = "true" ]; do sleep 1; done
rm -rf "/Applications/$T4_APP_NAME"
cp -R "$MOUNT/$T4_APP_NAME" /Applications/
xattr -dr com.apple.quarantine "/Applications/$T4_APP_NAME" 2>/dev/null || true
echo "Installed /Applications/$T4_APP_NAME ($VERSION)"
