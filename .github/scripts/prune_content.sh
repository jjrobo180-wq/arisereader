#!/usr/bin/env bash
# Takes out what the iPhone apps read from the server instead (November 2026), so every app and its
# live updates stay small and new books need no app update:
#  - the books' chapters (reads/, classics/): fetched from arisetodo.com when a book is opened
#    (client/src/main.tsx); the lists of reads and books are topped up from the server too
#    (shared/liveCatalog.ts)
#  - audio/: nothing in the apps uses it
#  - the eye-gaze talker engine (Wren, 145 MB) unless this is Arise AAC, the app it belongs to
# Usage: prune_content.sh <app> <build folder>
set -euo pipefail
APP="${1:?usage: prune_content.sh <app> <build folder>}"
OUT="${2:?usage: prune_content.sh <app> <build folder>}"
test -f "$OUT/index.html" || { echo "::error::$OUT has no index.html"; exit 1; }
rm -rf "$OUT/reads" "$OUT/classics" "$OUT/audio"
[ "$APP" = "eyegaze" ] || rm -rf "$OUT/eyegaze/wren"
echo "$APP bundle: $(du -sm "$OUT" | cut -f1) MB after taking out what comes from the server"
