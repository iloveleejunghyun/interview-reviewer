#!/usr/bin/env bash
# Build a Release version of an app and install it on the iPhone connected by USB.
# Usage: scripts/ios-device.sh [app-folder]   (default: interview-reviewer)
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)/apps/${1:-interview-reviewer}"
export LANG=en_US.UTF-8

# First connected physical iPhone.
DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null | awk '/physical/ && /connected|available/ {for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) print $i}' | head -1)
if [ -z "$DEVICE_ID" ]; then
  echo "No iPhone found. Connect it by USB, unlock it, and tap Trust if asked." >&2
  exit 1
fi

cd "$APP_DIR"
echo "▸ Generating iOS project (clean)…"
npx expo prebuild --clean --platform ios > /dev/null

cd ios
SCHEME=$(basename "$(ls -d *.xcworkspace)" .xcworkspace)
echo "▸ Building ${SCHEME} (Release) for device ${DEVICE_ID}… (a few minutes)"
xcodebuild -workspace "$SCHEME.xcworkspace" -scheme "$SCHEME" -configuration Release \
  -destination "id=$DEVICE_ID" -derivedDataPath build -allowProvisioningUpdates build -quiet

APP_PATH="build/Build/Products/Release-iphoneos/$SCHEME.app"
BUNDLE_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_PATH/Info.plist")
echo "▸ Installing and opening ${BUNDLE_ID}…"
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH" > /dev/null
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID" > /dev/null
echo "✓ Running on your iPhone."
