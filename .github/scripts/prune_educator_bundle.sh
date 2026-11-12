#!/usr/bin/env bash
# Arise Educator (teachers): takes out the eye-gaze talker engine (Wren, 145 MB). It's for eye-gaze students
# and runs in the Arise AAC app; in Educator the talker page says so (pages/EyeGazeWren.tsx). Without it the
# app and each live update are about 15 MB instead of 160 MB.
# Usage: prune_educator_bundle.sh <build folder>   (the folder `npx vite build` wrote, normally dist/public)
set -euo pipefail
OUT="${1:?usage: prune_educator_bundle.sh <build folder>}"
test -f "$OUT/index.html" || { echo "::error::$OUT has no index.html"; exit 1; }
rm -rf "$OUT/eyegaze/wren"
echo "Educator bundle: $(du -sm "$OUT" | cut -f1) MB after pruning"
