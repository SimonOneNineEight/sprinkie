#!/bin/sh
# Weekly re-sign of the free-Apple-ID sideload build (7-day profiles).
# Plug the iPhone in, then:  sh deploy/sideload.sh
# Self-heals the two things `expo prebuild` keeps resetting: the Apple
# sign-in entitlement (free teams can't sign it) and the missing Pods
# workspace after a full project regeneration.
set -e

DEVICE="${1:-00008110-000909313A06401E}" # Simon's iPhone
TEAM=8CQBP36BAC                          # personal team of the signed-in Apple ID

MOBILE="$(cd "$(dirname "$0")/../apps/mobile" && pwd)"
SCHEME=Sprinkie # app.json's expo.name, as `expo prebuild` sanitizes it
ENTITLEMENTS="$MOBILE/ios/$SCHEME/$SCHEME.entitlements"

# A checkout from before the Sprinkie rename has an ios/ named for the old
# app, which would build the wrong scheme. --clean regenerates it, discarding
# anything hand-edited in ios/ (the entitlement strip below is reapplied).
if [ ! -d "$MOBILE/ios/$SCHEME.xcodeproj" ]; then
  (cd "$MOBILE" && npx expo prebuild -p ios --no-install --clean)
fi

if grep -q applesignin "$ENTITLEMENTS" 2>/dev/null; then
  printf '%s\n' \
    '<?xml version="1.0" encoding="UTF-8"?>' \
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' \
    '<plist version="1.0">' \
    '  <dict/>' \
    '</plist>' > "$ENTITLEMENTS"
  echo "stripped Sign in with Apple entitlement (restore for TestFlight builds)"
fi

if [ ! -d "$MOBILE/ios/$SCHEME.xcworkspace" ]; then
  (cd "$MOBILE/ios" && pod install)
fi

set -a
. "$MOBILE/.env.hosted"
set +a

cd "$MOBILE/ios"
xcodebuild -workspace "$SCHEME.xcworkspace" -scheme "$SCHEME" \
  -configuration Release -destination "id=$DEVICE" \
  -derivedDataPath build -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic build

# The phone must run without this Mac: the JS has to be inside the app and
# point at the hosted stack, or it opens blank (or signed out) away from here.
APP="$MOBILE/ios/build/Build/Products/Release-iphoneos/$SCHEME.app"
BUNDLE="$APP/main.jsbundle"
if [ ! -f "$BUNDLE" ]; then
  echo "refusing to install: no embedded JS bundle (not a Release build)"
  exit 1
fi
if ! grep -q tebfjmsmnhfeapbzytxy "$BUNDLE" || grep -q 127.0.0.1:55321 "$BUNDLE"; then
  echo "refusing to install: bundle does not point at the hosted Supabase (check .env.hosted)"
  exit 1
fi

xcrun devicectl device install app --device "$DEVICE" "$APP"
echo "installed — good for another 7 days"
