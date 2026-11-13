#!/usr/bin/env bash
# For the iPhone apps that open straight into their own screens and never show Arise Reader or Arise AAC
# (Cooked Fitness by Arise, Cooked PT, Arise Talk, Arise Undercover): takes out the website's big folders
# they never use, so the app and each live update are a few MB instead of 160 MB. App.tsx sends these
# apps to their own screen before any route that could reach these files (tests/app-bundle-size.test.ts).
# Usage: prune_own_app_bundle.sh <app> <build folder>   (the folder `npx vite build` wrote, normally dist/public)
set -euo pipefail
APP="${1:?usage: prune_own_app_bundle.sh <app> <build folder>}"
OUT="${2:?usage: prune_own_app_bundle.sh <app> <build folder>}"
case "$APP" in fit|trainer|talk|undercover) ;; *) echo "::error::$APP is not an app that opens straight into its own screens"; exit 1 ;; esac
test -f "$OUT/index.html" || { echo "::error::$OUT has no index.html"; exit 1; }
# The eye-gaze talker (145 MB) and its pictures, classic books, reading passages, avatars and the 3D world,
# read-along audio and pets art: Arise Reader's and Arise AAC's.
for d in eyegaze classics reads avatar audio world pets; do rm -rf "$OUT/$d"; done
MB=$(du -sm "$OUT" | cut -f1)
echo "$APP bundle: $MB MB after pruning"
if [ "$MB" -gt 60 ]; then echo "::error::The $APP app's web code is $MB MB (limit 60 MB): something big was added to client/public"; exit 1; fi
